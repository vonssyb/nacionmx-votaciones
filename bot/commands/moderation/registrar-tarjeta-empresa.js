const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Card Tiers Configuration (Business Only)
const CORPORATE_TIERS = {
    // BUSINESS CREDIT CARDS (9)
    'NMX Business Start': {
        limit: 50000, interest: 2, cost: 8000, max_balance: Infinity, score: 70, tier: 'Business', color: 0x4682B4,
        benefits: ['Emprendedores', 'Crédito renovable', 'Reportes mensuales']
    },
    'NMX Business Gold': {
        limit: 100000, interest: 1.5, cost: 15000, max_balance: Infinity, score: 75, tier: 'Business', color: 0xFFD700,
        benefits: ['Pymes', 'Cashback 1%', 'Tarjetas adicionales']
    },
    'NMX Business Platinum': {
        limit: 200000, interest: 1.2, cost: 20000, max_balance: Infinity, score: 80, tier: 'Business', color: 0xE5E4E2,
        benefits: ['Expansión', 'Acceso prioritario', 'Sin comisiones intl']
    },
    'NMX Business Elite': {
        limit: 500000, interest: 1, cost: 35000, max_balance: Infinity, score: 85, tier: 'Business', color: 0x4B0082,
        benefits: ['Corporativo', 'Línea flexible', 'Seguro viajes']
    },
    'NMX Corporate': {
        limit: 1000000, interest: 0.7, cost: 50000, max_balance: Infinity, score: 90, tier: 'Corporate', color: 0x800020,
        benefits: ['Industrias', 'Beneficio fiscal', 'Asesor dedicado']
    },
    'NMX Corporate Plus': {
        limit: 5000000, interest: 0.5, cost: 100000, max_balance: Infinity, score: 92, tier: 'Corporate', color: 0xCD7F32,
        benefits: ['Grandes Corps', 'Financiamiento proyectos', 'Líneas extra']
    },
    'NMX Enterprise': {
        limit: 10000000, interest: 0.4, cost: 200000, max_balance: Infinity, score: 95, tier: 'Corporate', color: 0x2F4F4F,
        benefits: ['Transnacionales', 'Trade finance', 'Hedging']
    },
    'NMX Conglomerate': {
        limit: 25000000, interest: 0.3, cost: 350000, max_balance: Infinity, score: 98, tier: 'Supreme', color: 0x191970,
        benefits: ['Conglomerados', 'Fiscalidad internacional', 'M&A']
    },
    'NMX Supreme': {
        limit: 50000000, interest: 0.2, cost: 500000, max_balance: Infinity, score: 99, tier: 'Supreme', color: 0xFFFFFF,
        benefits: ['Top Tier', 'Mercado capitales', 'Todo incluido']
    }
};

const LOG_CREACION_TARJETA = '1452346918620500041'; // Registros Banco

module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar-tarjeta-empresa')
        .setDescription('🏢 Registrar tarjeta corporativa para una empresa (Solo Banqueros)')
        .addUserOption(option => option.setName('usuario').setDescription('Usuario dueño de la empresa').setRequired(true))
        .addStringOption(option => option.setName('empresa').setDescription('Nombre exacto de la empresa').setRequired(true))
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de Tarjeta Corporativa')
                .setRequired(true)
                .addChoices(
                    { name: 'Business Start ($50k)', value: 'NMX Business Start' },
                    { name: 'Business Gold ($100k)', value: 'NMX Business Gold' },
                    { name: 'Business Platinum ($200k)', value: 'NMX Business Platinum' },
                    { name: 'Business Elite ($500k)', value: 'NMX Business Elite' },
                    { name: 'NMX Corporate ($1M)', value: 'NMX Corporate' },
                    { name: 'NMX Corporate Plus ($5M)', value: 'NMX Corporate Plus' },
                    { name: 'NMX Enterprise ($10M)', value: 'NMX Enterprise' },
                    { name: 'NMX Conglomerate ($25M)', value: 'NMX Conglomerate' },
                    { name: 'NMX Supreme ($50M)', value: 'NMX Supreme' }
                ))
        .addStringOption(option => option.setName('notas').setDescription('Notas adicionales para el contrato').setRequired(false)),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

        try {
            // === ROLE-BASED AUTHORIZATION ===
            const BANKER_ROLES = {
                REGULAR: '1450591546524307689',      // Banquero
                EXECUTIVE: '1451291919320748275'     // Ejecutivo Banquero
            };

            const isExecutiveBanker = interaction.member.roles.cache.has(BANKER_ROLES.EXECUTIVE);
            const isRegularBanker = interaction.member.roles.cache.has(BANKER_ROLES.REGULAR);
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isExecutiveBanker && !isRegularBanker && !isAdmin) {
                return interaction.editReply('⛔ **Permiso Denegado**\n\nSolo el personal bancario puede registrar tarjetas.\n👥 Roles requeridos: Banquero o Ejecutivo Banquero');
            }

            const targetUser = interaction.options.getUser('usuario');
            const companyNameInput = interaction.options.getString('empresa');
            const cardType = interaction.options.getString('tipo');
            const notes = interaction.options.getString('notas') || 'Sin notas';

            // SECURITY: Self-Target Check
            if (targetUser.id === interaction.user.id) {
                return interaction.editReply('⛔ **Seguridad:** No puedes registrarte una tarjeta a ti mismo. Pide a otro banquero que lo haga.');
            }

            // === COMPANY VALIDATION ===
            // Find company owned by targetUser with exact name match
            const { data: companies } = await supabase
                .from('companies')
                .select('id, name, owner_id, owner_ids')
                .contains('owner_ids', [targetUser.id]);

            if (!companies || companies.length === 0) {
                return interaction.editReply(`⛔ **Error:** El usuario <@${targetUser.id}> no posee ninguna empresa registrada.`);
            }

            const targetCompany = companies.find(c => c.name.toLowerCase() === companyNameInput.toLowerCase());

            if (!targetCompany) {
                return interaction.editReply(`⛔ **Error:** No se encontró la empresa **"${companyNameInput}"** propiedad de <@${targetUser.id}>.\nEmpresas disponibles: ${companies.map(c => c.name).join(', ')}`);
            }

            const companyId = targetCompany.id;
            const companyName = targetCompany.name;

            // === FIND CITIZEN (Owner) ===
            let { data: citizen } = await supabase.from('citizens').select('id, full_name').eq('discord_id', targetUser.id).limit(1).maybeSingle();

            if (!citizen) {
                return interaction.editReply({
                    content: `❌ **Error:** El dueño <@${targetUser.id}> no está registrado en el censo.\n⚠️ **Acción Requerida:** Comando \`/dni crear\`.`
                });
            }

            const stats = CORPORATE_TIERS[cardType];

            // === SEND OFFER ===
            const offerEmbed = new EmbedBuilder()
                .setTitle('🏢 Oferta de Tarjeta Corporativa')
                .setColor(stats.color)
                .setDescription(`Hola <@${targetUser.id}>,\nEl Banco Nacional ofrece una tarjeta **${cardType}** para su empresa.\n\n**Empresa Titular:** ${companyName}\n**Representante:** ${citizen.full_name}\n\n**Detalles del Contrato:**`)
                .addFields(
                    { name: 'Límite', value: `$${stats.limit.toLocaleString()}`, inline: true },
                    { name: 'Interés Semanal', value: `${stats.interest}%`, inline: true },
                    { name: 'Costo Apertura', value: `$${stats.cost.toLocaleString()}`, inline: true },
                    { name: 'Notas', value: notes }
                )
                .setFooter({ text: 'Tienes 5 minutos para aceptar. La deuda será responsabilidad de la empresa.' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('btn_terms_corp').setLabel('📄 Términos').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('btn_accept_corp').setLabel('✅ Aceptar y Pagar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_reject_corp').setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
                );

            const message = await interaction.channel.send({ content: `<@${targetUser.id}>`, embeds: [offerEmbed], components: [row] });
            await interaction.editReply(`✅ Oferta corporativa enviada para **${companyName}**.`);

            // COLLECTOR
            const filter = i => i.user.id === targetUser.id;
            const collector = message.createMessageComponentCollector({ filter, time: 300000 });

            let processed = false;
            collector.on('collect', async i => {
                if (processed) return;

                if (i.customId === 'btn_terms_corp') {
                    await i.reply({ content: '📜 **Términos Corporativos:**\n1. La empresa asume la deuda total.\n2. El representante legal es aval solidario.\n3. Impago resulta en embargo de activos empresariales.', flags: 64 });
                }
                else if (i.customId === 'btn_reject_corp') {
                    await i.update({ content: '❌ Oferta corporativa rechazada.', components: [] });
                    collector.stop();
                }
                else if (i.customId === 'btn_accept_corp') {
                    const payRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('reg_corp_cash').setLabel('💵 Efectivo (Dueño)').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('reg_corp_bank').setLabel('🏦 Cuenta Empresa').setStyle(ButtonStyle.Secondary) // Future: Pay with company balance?
                    );
                    await i.update({ content: '💳 **Selecciona origen de fondos para apertura:**', embeds: [], components: [payRow] });
                }
                else if (['reg_corp_cash', 'reg_corp_bank'].includes(i.customId)) {
                    await i.deferUpdate();
                    try {
                        const BillingService = require('../../services/BillingService');
                        const billingService = new BillingService(client);
                        const chargeAmount = stats.cost;

                        // CHARGE LOGIC
                        if (chargeAmount > 0) {
                            if (i.customId === 'reg_corp_cash') {
                                // Charge User Cash
                                const bal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                                if ((bal.cash || 0) < chargeAmount) return i.followUp({ content: `❌ Efectivo insuficiente.`, flags: 64 });
                                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, chargeAmount, `Apertura Corp ${cardType}`, 'cash');
                            } else {
                                // Charge Company Balance (Requires manually checking company balance)
                                // Simplified: Charge User Bank for now, or implement Company Balance charge
                                // Let's charge User Bank for simplicity as "Company Account" implies access to funds
                                const bal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                                if ((bal.bank || 0) < chargeAmount) return i.followUp({ content: `❌ Fondos insuficientes en banco personal.`, flags: 64 });
                                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, chargeAmount, `Apertura Corp ${cardType}`, 'bank');
                            }
                        }

                        processed = true;

                        // INSERT CARD
                        const { error: insertError } = await supabase.from('credit_cards').insert([{
                            citizen_id: citizen.id,
                            discord_user_id: targetUser.id,
                            discord_id: targetUser.id,
                            card_type: cardType,
                            card_name: cardType,
                            card_limit: stats.limit,
                            current_balance: 0,
                            interest_rate: stats.interest,
                            status: 'active',
                            next_payment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                            company_id: companyId
                        }]);

                        if (insertError) throw new Error(insertError.message);

                        // LOG
                        const logEmbed = new EmbedBuilder()
                            .setTitle('🏢 Nueva Tarjeta Corporativa')
                            .setColor('#800020')
                            .addFields(
                                { name: '🏢 Empresa', value: companyName, inline: false },
                                { name: '👤 Representante', value: `<@${targetUser.id}>`, inline: true },
                                { name: '💳 Tipo', value: cardType, inline: true },
                                { name: '👮 Registrado por', value: `<@${interaction.user.id}>`, inline: false }
                            )
                            .setTimestamp();

                        try {
                            const logChannel = await client.channels.fetch(LOG_CREACION_TARJETA);
                            if (logChannel) logChannel.send({ embeds: [logEmbed] });
                        } catch (e) { }

                        await message.edit({
                            content: `✅ **Tarjeta Corporativa Activada** para **${companyName}**.\n💳 Tipo: ${cardType}`,
                            components: []
                        });

                    } catch (err) {
                        console.error(err);
                        await i.followUp({ content: `❌ Error: ${err.message}`, flags: 64 });
                    }
                    collector.stop();
                }
            });

        } catch (error) {
            console.error('Error', error);
            await interaction.editReply('❌ Error fatal.');
        }
    }
};
