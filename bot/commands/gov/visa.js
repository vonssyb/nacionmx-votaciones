const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ImageGenerator = require('../../utils/ImageGenerator');

// Visa costs (automatically charged)
const VISA_COSTS = {
    turista: 10000,
    trabajo: 25000,
    estudiante: 50000,
    residente: 150000
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('visa')
        .setDescription('🇺🇸 US Visa System')
        .addSubcommand(sub => sub
            .setName('ver')
            .setDescription('Ver tu visa actual'))
        .addSubcommand(sub => sub
            .setName('otorgar')
            .setDescription('Otorgar visa - USCIS Only')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Usuario a otorgar')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('tipo')
                .setDescription('Tipo de visa')
                .setRequired(true)
                .addChoices(
                    { name: '🛂 Turista (B-2) - $10,000', value: 'turista' },
                    { name: '💼 Trabajo (H-1B) - $25,000', value: 'trabajo' },
                    { name: '📚 Estudiante (F-1) - $50,000', value: 'estudiante' },
                    { name: '🏠 Residente (Green Card) - $150,000', value: 'residente' }
                )))
        .addSubcommand(sub => sub
            .setName('revocar')
            .setDescription('Revocar una visa - USCIS only')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Usuario a revocar')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('razon')
                .setDescription('Motivo de revocación')
                .setRequired(true))),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const subCmd = interaction.options.getSubcommand();
        const AMERICAN_ROLE_ID = process.env.AMERICAN_ROLE_ID || '1457950212923461632';
        const USCIS_ROLE_ID = process.env.USCIS_ROLE_ID || '1457949662181851415';

        // Check USCIS permissions (only for otorgar and revocar)
        const isUSCIS = interaction.member.roles.cache.has(USCIS_ROLE_ID) || interaction.member.permissions.has('Administrator');

        if (['otorgar', 'revocar'].includes(subCmd) && !isUSCIS) {
            return interaction.editReply({
                content: `❌ **Acceso Denegado**\n\nSolo el personal de USCIS (<@&${USCIS_ROLE_ID}>) puede usar este comando.`,
                flags: [64]
            });
        }

        // OTORGAR - Grant visa directly (USCIS Only)
        if (subCmd === 'otorgar') {
            const targetUser = interaction.options.getUser('usuario');
            const visaType = interaction.options.getString('tipo');
            const cost = VISA_COSTS[visaType];

            const targetMember = await interaction.guild.members.fetch(targetUser.id);

            // Check if user already has American role
            if (targetMember.roles.cache.has(AMERICAN_ROLE_ID)) {
                return interaction.editReply({
                    content: `❌ **Already American**\n\n${targetUser.tag} already has the American role.\nUse \`/visa ver\` to check their visa status.`,
                    flags: [64]
                });
            }

            // Check if user has DNI
            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('id, nombre, apellido, foto_url')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .maybeSingle();

            if (!dni) {
                return interaction.editReply({
                    content: `❌ **DNI Required**\n\n${targetUser.tag} needs a Mexican DNI first.\nThey must create one with \`/dni crear\``,
                    flags: [64]
                });
            }

            // Check user balance for affordability check
            const balance = await client.services.billing.ubService.getUserBalance(interaction.guildId, targetUser.id);
            const { data: cards } = await supabase
                .from('credit_cards')
                .select('id, card_number, available_credit')
                .eq('user_id', targetUser.id)
                .eq('status', 'active');

            const availableFunds = (balance.bank || 0) + (balance.cash || 0);
            const totalCredit = cards ? cards.reduce((sum, c) => sum + (c.available_credit || 0), 0) : 0;
            const totalAvailable = availableFunds + totalCredit;

            if (totalAvailable < cost) {
                return interaction.editReply({
                    content: `❌ **Insufficient Funds**\n\n${targetUser.tag} doesn't have enough money for this visa.\n\n**Required:** $${cost.toLocaleString()}\n**Available:** $${totalAvailable.toLocaleString()} (Bank + Cash + Credit)\n\nThey need $${(cost - totalAvailable).toLocaleString()} more.`,
                    flags: [64]
                });
            }

            // Show payment method selection
            const paymentButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`visa_pay_bank_${targetUser.id}_${visaType}_${cost}`)
                    .setLabel('🏦 Banco')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled((balance.bank || 0) < cost),
                new ButtonBuilder()
                    .setCustomId(`visa_pay_credit_${targetUser.id}_${visaType}_${cost}`)
                    .setLabel('💳 Tarjeta')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!cards || cards.length === 0 || totalCredit < cost),
                new ButtonBuilder()
                    .setCustomId(`visa_pay_cash_${targetUser.id}_${visaType}_${cost}`)
                    .setLabel('💵 Efectivo')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled((balance.cash || 0) < cost)
            );

            const embed = new EmbedBuilder()
                .setTitle('💳 US Visa Payment')
                .setColor('#0099FF')
                .setDescription(`Select payment method to grant visa to ${targetUser.tag}`)
                .addFields(
                    { name: '📋 Visa Type', value: visaType.charAt(0).toUpperCase() + visaType.slice(1), inline: true },
                    { name: '💰 Cost', value: `$${cost.toLocaleString()}`, inline: true },
                    { name: '👤 Applicant', value: `<@${targetUser.id}>`, inline: false },
                    {
                        name: '💵 Available', value:
                            `🏦 Bank: $${(balance.bank || 0).toLocaleString()}\n` +
                            `💳 Credit: $${totalCredit.toLocaleString()}\n` +
                            `💵 Cash: $${(balance.cash || 0).toLocaleString()}`,
                        inline: false
                    }
                )
                .setFooter({ text: 'Select a payment method • 30 second timeout' })
                .setTimestamp();

            const reply = await interaction.editReply({
                embeds: [embed],
                components: [paymentButtons]
            });

            // Collector for button interaction (30 seconds)
            const collector = reply.createMessageComponentCollector({
                time: 30000,
                filter: i => i.user.id === interaction.user.id
            });

            collector.on('collect', async (buttonInteraction) => {
                // Payment handling is done in visaPaymentHandler.js
                await buttonInteraction.deferUpdate();
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    // Timeout
                    await interaction.editReply({
                        embeds: [embed.setColor('#FF0000').setFooter({ text: 'Payment timeout - request cancelled' })],
                        components: []
                    });
                }
            });
        }

        // VER - View visa
        else if (subCmd === 'ver') {
            const { data: visa } = await supabase
                .from('us_visas')
                .select('*')
                .eq('user_id', interaction.user.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!visa) {
                return interaction.editReply({
                    content: '❌ **No Active Visa**\n\nYou don\'t have an active US visa.',
                    flags: [64]
                });
            }

            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('nombre, apellido, foto_url')
                .eq('id', visa.citizen_dni_id)
                .maybeSingle();

            // Generate visa image
            const visaData = {
                ...visa,
                nombre: dni.nombre,
                apellido: dni.apellido,
                nombre_completo: `${dni.nombre} ${dni.apellido}`,
                foto_url: dni.foto_url || interaction.user.displayAvatarURL({ extension: 'png', size: 512 })
            };

            const visaImageBuffer = await ImageGenerator.generateVisa(visaData);
            const attachment = new AttachmentBuilder(visaImageBuffer, { name: 'visa.png' });

            const embed = new EmbedBuilder()
                .setTitle('🇺🇸 Your US Visa')
                .setColor('#002868')
                .setImage('attachment://visa.png')
                .addFields(
                    { name: '📋 Type', value: visa.visa_type.charAt(0).toUpperCase() + visa.visa_type.slice(1), inline: true },
                    { name: '🎫 Visa Number', value: `\`${visa.visa_number}\``, inline: true },
                    { name: '⏰ Expires', value: visa.expiration_date ? new Date(visa.expiration_date).toLocaleDateString() : 'Permanent', inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], files: [attachment] });
        }

        // REVOCAR - Revoke a visa
        else if (subCmd === 'revocar') {
            const targetUser = interaction.options.getUser('usuario');
            const reason = interaction.options.getString('razon');

            const { data: visa, error: visaError } = await supabase
                .from('us_visas')
                .update({ status: 'revoked' })
                .eq('user_id', targetUser.id)
                .eq('status', 'active')
                .select()
                .maybeSingle();

            if (visaError || !visa) {
                return interaction.editReply(`❌ ${targetUser.tag} does not have an active visa.`);
            }

            // Remove American role
            try {
                const targetMember = await interaction.guild.members.fetch(targetUser.id);
                await targetMember.roles.remove(AMERICAN_ROLE_ID);
            } catch (e) {
                console.error('[visa revocar] Role error:', e);
            }

            const embed = new EmbedBuilder()
                .setTitle('🚫 US Visa Revoked')
                .setColor('#FF0000')
                .setDescription(`Visa revoked for ${targetUser.tag}`)
                .addFields(
                    { name: '👤 User', value: `<@${targetUser.id}>`, inline: true },
                    { name: '🎫 Visa Number', value: `\`${visa.visa_number}\``, inline: true },
                    { name: '📋 Type', value: visa.visa_type.charAt(0).toUpperCase() + visa.visa_type.slice(1), inline: true },
                    { name: '📝 Reason', value: reason, inline: false },
                    { name: '👮 Revoked By', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // DM the user
            try {
                await targetUser.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🚫 Your US Visa Has Been Revoked')
                        .setColor('#FF0000')
                        .setDescription(`Your US visa has been revoked by USCIS.`)
                        .addFields(
                            { name: '📝 Reason', value: reason },
                            { name: '🎫 Visa Number', value: `\`${visa.visa_number}\`` }
                        )
                        .setTimestamp()
                    ]
                });
            } catch (dmError) {
                // User has DMs disabled
            }
        }
    }
};
