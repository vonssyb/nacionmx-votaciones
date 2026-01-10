// Visa Payment Button Handler
// handles: visa_pay_bank, visa_pay_credit, visa_pay_cash

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const ImageGenerator = require('../utils/ImageGenerator');

const VISA_COSTS = {
    turista: 10000,
    trabajo: 25000,
    estudiante: 50000,
    residente: 150000
};

const VISA_DURATIONS = {
    turista: 90,
    trabajo: 180,
    estudiante: 365,
    residente: null // Permanent
};

module.exports = {
    name: 'visa_pay_handler',
    description: 'Handles visa payment button interactions',

    async execute(interaction, client, customId) {
        const parts = customId.split('_');
        // Format: visa_pay_{method}_{userId}_{visaType}_{cost}
        if (parts.length < 5) return;

        const paymentMethod = parts[2]; // bank, credit, cash
        const targetUserId = parts[3];
        const visaType = parts[4];
        const cost = parseInt(parts[5]);

        await interaction.deferUpdate();

        const AMERICAN_ROLE_ID = process.env.AMERICAN_ROLE_ID || '1457950212923461632';

        try {
            // Get target user
            const targetUser = await client.users.fetch(targetUserId);
            const targetMember = await interaction.guild.members.fetch(targetUserId);
            const supabase = client.supabase;

            // Get DNI
            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('id, nombre, apellido, foto_url')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUserId)
                .maybeSingle();

            if (!dni) {
                return interaction.editReply({
                    content: '❌ DNI not found. Visa creation cancelled.',
                    embeds: [],
                    components: []
                });
            }

            // Process payment based on method
            let paymentSuccess = false;
            let paymentError = null;

            if (paymentMethod === 'bank') {
                try {
                    await client.services.billing.ubService.removeMoney(
                        interaction.guildId,
                        targetUserId,
                        cost,
                        `Visa USA ${visaType}`,
                        'bank'
                    );
                    paymentSuccess = true;
                } catch (error) {
                    paymentError = error.message;
                }
            } else if (paymentMethod === 'cash') {
                try {
                    await client.services.billing.ubService.removeMoney(
                        interaction.guildId,
                        targetUserId,
                        cost,
                        `Visa USA ${visaType}`,
                        'cash'
                    );
                    paymentSuccess = true;
                } catch (error) {
                    paymentError = error.message;
                }
            } else if (paymentMethod === 'credit') {
                // Use credit card payment system
                const economyUtils = require('../utils/economyUtils');
                const result = await economyUtils.processPayment(
                    supabase,
                    client.services.billing.ubService,
                    interaction.guildId,
                    targetUserId,
                    cost,
                    `Visa USA ${visaType}`,
                    'credit',
                    'any' // Allow any card
                );

                if (result.success) {
                    paymentSuccess = true;
                } else {
                    paymentError = result.message;
                }
            }

            if (!paymentSuccess) {
                return interaction.editReply({
                    content: `❌ Payment failed: ${paymentError || 'Unknown error'}`,
                    embeds: [],
                    components: []
                });
            }

            // Generate visa number
            const { data: visaNumberResult } = await supabase.rpc('generate_us_visa_number');
            const visaNumber = visaNumberResult;

            // Calculate expiration
            let expirationDate = null;
            if (VISA_DURATIONS[visaType]) {
                expirationDate = new Date();
                expirationDate.setDate(expirationDate.getDate() + VISA_DURATIONS[visaType]);
            }

            // Create visa
            const { data: newVisa, error: visaError } = await supabase
                .from('us_visas')
                .insert({
                    guild_id: interaction.guildId,
                    user_id: targetUserId,
                    citizen_dni_id: dni.id,
                    visa_type: visaType,
                    visa_number: visaNumber,
                    expiration_date: expirationDate,
                    status: 'active',
                    approved_by: interaction.user.id,
                    approved_by_tag: interaction.user.tag
                })
                .select()
                .single();

            if (visaError) {
                console.error('[visa payment] Error creating visa:', visaError);
                // Refund
                if (paymentMethod === 'bank' || paymentMethod === 'cash') {
                    await client.services.billing.ubService.addMoney(
                        interaction.guildId,
                        targetUserId,
                        cost,
                        'Visa refund - creation failed',
                        paymentMethod
                    );
                }
                return interaction.editReply({
                    content: '❌ Error creating visa. Payment refunded.',
                    embeds: [],
                    components: []
                });
            }

            // Grant American role
            try {
                await targetMember.roles.add(AMERICAN_ROLE_ID);
            } catch (roleError) {
                console.error('[visa payment] Role error:', roleError);
            }

            // Prepare data for generator
            const visaData = {
                ...newVisa,
                nombre: dni.nombre,
                apellido: dni.apellido,
                nombre_completo: `${dni.nombre} ${dni.apellido}`,
                foto_url: dni.foto_url || targetUser.displayAvatarURL({ extension: 'png', size: 512 })
            };

            const visaImageBuffer = await ImageGenerator.generateVisa(visaData);
            const attachment = new AttachmentBuilder(visaImageBuffer, { name: 'visa.png' });

            const embed = new EmbedBuilder()
                .setTitle('✅ US Visa Granted')
                .setColor('#00FF00')
                .setDescription(`US Visa granted to ${targetUser.tag}`)
                .setImage('attachment://visa.png')
                .addFields(
                    { name: '👤 Recipient', value: `<@${targetUserId}>`, inline: true },
                    { name: '📋 Type', value: visaType.charAt(0).toUpperCase() + visaType.slice(1), inline: true },
                    { name: '💰 Cost', value: `$${cost.toLocaleString()}`, inline: true },
                    { name: '💳 Payment Method', value: paymentMethod === 'bank' ? '🏦 Banco' : paymentMethod === 'credit' ? '💳 Tarjeta' : '💵 Efectivo', inline: true },
                    { name: '🎫 Visa Number', value: `\`${visaNumber}\``, inline: false },
                    { name: '📅 Issued', value: new Date().toLocaleDateString(), inline: true },
                    { name: '⏰ Expires', value: expirationDate ? expirationDate.toLocaleDateString() : 'Never (Permanent)', inline: true },
                    { name: '👮 Issued By', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setFooter({ text: 'American role granted • Payment processed' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], files: [attachment], components: [] });

            // DM the user
            try {
                await targetUser.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🎉 Your US Visa Has Been Granted!')
                        .setColor('#00FF00')
                        .setDescription(`Congratulations! Your US visa has been approved and processed by USCIS.`)
                        .addFields(
                            { name: '🎫 Visa Number', value: `\`${visaNumber}\``, inline: false },
                            { name: '📋 Type', value: visaType.charAt(0).toUpperCase() + visaType.slice(1), inline: true },
                            { name: '💰 Paid', value: `$${cost.toLocaleString()}`, inline: true },
                            { name: '⏰ Valid Until', value: expirationDate ? expirationDate.toLocaleDateString() : 'Permanent', inline: false }
                        )
                        .setFooter({ text: 'Welcome to the United States!' })
                        .setTimestamp()
                    ],
                    files: [attachment]
                });
            } catch (dmError) {
                // User has DMs disabled
            }

        } catch (error) {
            console.error('[visa payment] Error:', error);
            await interaction.editReply({
                content: '❌ Error processing visa payment. Contact an administrator.',
                embeds: [],
                components: []
            });
        }
    }
};
