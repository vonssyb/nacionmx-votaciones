const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Visa costs (automatically charged)
const VISA_COSTS = {
    turista: 10000,
    trabajo: 25000,
    estudiante: 50000,
    residente: 150000
};

// Visa durations (in days)
const VISA_DURATIONS = {
    turista: 90,
    trabajo: 180,
    estudiante: 365,
    residente: null // Permanent
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('visa')
        .setDescription('🇺🇸 US Visa System (USCIS Only)')
        .addSubcommand(sub => sub
            .setName('otorgar')
            .setDescription('Grant US visa (charges automatically) - USCIS only')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('User to grant visa')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('tipo')
                .setDescription('Visa type')
                .setRequired(true)
                .addChoices(
                    { name: '🛂 Tourist (B-2) - 90d - $10,000', value: 'turista' },
                    { name: '💼 Work (H-1B) - 180d - $25,000', value: 'trabajo' },
                    { name: '📚 Student (F-1) - 365d - $50,000', value: 'estudiante' },
                    { name: '🏠 Resident (Green Card) - Permanent - $150,000', value: 'residente' }
                )))
        .addSubcommand(sub => sub
            .setName('ver')
            .setDescription('View your current visa'))
        .addSubcommand(sub => sub
            .setName('revocar')
            .setDescription('Revoke a visa - USCIS/Admin only')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('User whose visa to revoke')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('razon')
                .setDescription('Reason for revocation')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('listar')
            .setDescription('List all active visas - USCIS only')),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ flags: [64] });

        const subCmd = interaction.options.getSubcommand();
        const AMERICAN_ROLE_ID = process.env.AMERICAN_ROLE_ID || '1457950212923461632';
        const USCIS_ROLE_ID = process.env.USCIS_ROLE_ID || '1457949662181851415';
        const BillingService = require('../../services/BillingService');

        // Check USCIS permissions for staff commands
        const isUSCIS = interaction.member.roles.cache.has(USCIS_ROLE_ID) || interaction.member.permissions.has('Administrator');

        if (['otorgar', 'revocar', 'listar'].includes(subCmd) && !isUSCIS) {
            return interaction.editReply({
                content: '❌ **Access Denied**\\n\\nOnly USCIS staff can use this command.',
                flags: [64]
            });
        }

        // OTORGAR - Grant visa (with automatic payment)
        if (subCmd === 'otorgar') {
            const targetUser = interaction.options.getUser('usuario');
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const visaType = interaction.options.getString('tipo');
            const cost = VISA_COSTS[visaType];

            // Check if user already has American role
            if (targetMember.roles.cache.has(AMERICAN_ROLE_ID)) {
                return interaction.editReply({
                    content: `❌ **Already American**\\n\\n${targetUser.tag} already has the American role.\\nUse \`/visa ver\` to check their visa status.`,
                    flags: [64]
                });
            }

            // Check if user has DNI
            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .maybeSingle();

            if (!dni) {
                return interaction.editReply({
                    content: `❌ **DNI Required**\\n\\n${targetUser.tag} needs a Mexican DNI first.\\nThey must create one with \`/dni crear\``,
                    flags: [64]
                });
            }

            // Check user balance
            const balance = await BillingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
            const availableFunds = (balance.bank || 0) + (balance.cash || 0);

            if (availableFunds < cost) {
                return interaction.editReply({
                    content: `❌ **Insufficient Funds**\\n\\n${targetUser.tag} doesn't have enough money for this visa.\\n\\n**Required:** $${cost.toLocaleString()}\\n**Available:** $${availableFunds.toLocaleString()} (Bank + Cash)\\n\\nThey need $${(cost - availableFunds).toLocaleString()} more.`,
                    flags: [64]
                });
            }

            // Charge from bank first, then cash if needed
            const bankAmount = Math.min(cost, balance.bank || 0);
            const cashAmount = cost - bankAmount;

            try {
                if (bankAmount > 0) {
                    await BillingService.ubService.removeMoney(
                        interaction.guildId,
                        targetUser.id,
                        bankAmount,
                        `Visa USA ${visaType}`,
                        'bank'
                    );
                }
                if (cashAmount > 0) {
                    await BillingService.ubService.removeMoney(
                        interaction.guildId,
                        targetUser.id,
                        cashAmount,
                        `Visa USA ${visaType}`,
                        'cash'
                    );
                }
            } catch (paymentError) {
                console.error('[visa otorgar] Payment error:', paymentError);
                return interaction.editReply('❌ Error processing payment. Contact an administrator.');
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
                    user_id: targetUser.id,
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
                console.error('[visa otorgar] Error:', visaError);
                // Refund if visa creation failed
                if (bankAmount > 0) {
                    await BillingService.ubService.addMoney(interaction.guildId, targetUser.id, bankAmount, 'Visa refund', 'bank');
                }
                if (cashAmount > 0) {
                    await BillingService.ubService.addMoney(interaction.guildId, targetUser.id, cashAmount, 'Visa refund', 'cash');
                }
                return interaction.editReply('❌ Error creating visa. Payment refunded.');
            }

            // Grant American role
            try {
                await targetMember.roles.add(AMERICAN_ROLE_ID);
            } catch (roleError) {
                console.error('[visa otorgar] Role error:', roleError);
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ US Visa Granted')
                .setColor('#00FF00')
                .setDescription(`US Visa granted to ${targetUser.tag}`)
                .addFields(
                    { name: '👤 Recipient', value: `<@${targetUser.id}>`, inline: true },
                    { name: '📋 Type', value: visaType.charAt(0).toUpperCase() + visaType.slice(1), inline: true },
                    { name: '💰 Cost', value: `$${cost.toLocaleString()}`, inline: true },
                    { name: '🎫 Visa Number', value: `\`${visaNumber}\``, inline: false },
                    { name: '📅 Issued', value: new Date().toLocaleDateString(), inline: true },
                    { name: '⏰ Expires', value: expirationDate ? expirationDate.toLocaleDateString() : 'Never (Permanent)', inline: true },
                    { name: '👮 Issued By', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setFooter({ text: 'American role granted • Payment processed' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

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
                    ]
                });
            } catch (dmError) {
                // User has DMs disabled
            }
        }

        // VER - View visa
        else if (subCmd === 'ver') {
            const { data: visa } = await supabase
                .from('us_visas')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!visa) {
                return interaction.editReply({
                    content: '❌ **No Active Visa**\\n\\nYou don\\'t have an active US visa.\\n\\nContact USCIS to request one via ticket.',
                    flags: [64]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🇺🇸 United States Visa')
                .setColor('#3C3B6E')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 Holder', value: `${interaction.user.tag}`, inline: false },
                    { name: '🎫 Visa Number', value: `\`${visa.visa_number}\``, inline: false },
                    { name: '📋 Type', value: visa.visa_type.charAt(0).toUpperCase() + visa.visa_type.slice(1), inline: true },
                    { name: '📅 Issued', value: new Date(visa.issued_date).toLocaleDateString(), inline: true },
                    { name: '⏰ Expires', value: visa.expiration_date ? new Date(visa.expiration_date).toLocaleDateString() : 'Never (Permanent)', inline: true },
                    { name: '✅ Status', value: 'Active', inline: true }
                )
                .setFooter({ text: 'United States of America - USCIS' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }

        // LISTAR - List visas
        else if (subCmd === 'listar') {
            const { data: visas } = await supabase
                .from('active_us_visas')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .order('issued_date', { ascending: false })
                .limit(20);

            if (!visas || visas.length === 0) {
                return interaction.editReply({
                    content: '📭 **No Active Visas**\\n\\nThere are no active US visas.',
                    flags: [64]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Active US Visas')
                .setColor('#3C3B6E')
                .setDescription(`Total: **${visas.length}** active visa(s)`)
                .setTimestamp();

            visas.slice(0, 10).forEach(visa => {
                const expires = visa.expiration_date ? new Date(visa.expiration_date).toLocaleDateString() : 'Permanent';
                embed.addFields({
                    name: `${visa.nombre} ${visa.apellido} - ${visa.visa_type}`,
                    value: `Visa: \`${visa.visa_number}\`\\nExpires: ${expires}\\nUser: <@${visa.user_id}>`,
                    inline: false
                });
            });

            await interaction.editReply({ embeds: [embed] });
        }

        // REVOCAR - Revoke visa
        else if (subCmd === 'revocar') {
            const targetUser = interaction.options.getUser('usuario');
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const reason = interaction.options.getString('razon');

            const { data: visa } = await supabase
                .from('us_visas')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!visa) {
                return interaction.editReply({
                    content: `❌ **No Active Visa**\\n\\n${targetUser.tag} doesn't have an active visa to revoke.`,
                    flags: [64]
                });
            }

            // Revoke visa
            await supabase
                .from('us_visas')
                .update({
                    status: 'revoked',
                    revoked_by: interaction.user.id,
                    revoked_reason: reason,
                    revoked_at: new Date().toISOString()
                })
                .eq('id', visa.id);

            // Remove American role
            try {
                await targetMember.roles.remove(AMERICAN_ROLE_ID);
            } catch (roleError) {
                console.error('[visa revocar] Role error:', roleError);
            }

            const embed = new EmbedBuilder()
                .setTitle('⛔ Visa Revoked')
                .setColor('#FF0000')
                .addFields(
                    { name: '👤 User', value: `<@${targetUser.id}>`, inline: true },
                    { name: '🎫 Visa Number', value: `\`${visa.visa_number}\``, inline: true },
                    { name: '📝 Reason', value: reason, inline: false },
                    { name: '👮 Revoked By', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // DM the user
            try {
                await targetUser.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⛔ Your US Visa Has Been Revoked')
                        .setColor('#FF0000')
                        .setDescription(`Your US visa (${visa.visa_number}) has been revoked by USCIS.`)
                        .addFields(
                            { name: '📝 Reason', value: reason, inline: false }
                        )
                        .setFooter({ text: 'Contact USCIS for more information' })
                        .setTimestamp()
                    ]
                });
            } catch (dmError) {
                // User has DMs disabled
            }
        }

        else {
            await interaction.editReply({
                content: '⚠️ **Unknown Command**',
                flags: [64]
            });
        }
    }
};
