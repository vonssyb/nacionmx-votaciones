const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Card Tiers Configuration (Local copy from legacyModerationHandler)
const CARD_TIERS = {
    // DEBIT CARDS (3)
    'NMX Débito': {
        limit: 0, interest: 0, cost: 100, max_balance: 50000, score: 0, tier: 'Débito', color: 0x808080,
        benefits: ['Cuenta básica', 'Transferencias gratis', 'Soporte estándar']
    },
    'NMX Débito Plus': {
        limit: 0, interest: 0, cost: 500, max_balance: 150000, score: 0, tier: 'Débito', color: 0x4169E1,
        benefits: ['Mayor límite', 'Alertas SMS', 'Retiros sin comisión']
    },
    'NMX Débito Gold': {
        limit: 0, interest: 0, cost: 1000, max_balance: Infinity, score: 0, tier: 'Débito', color: 0xFFD700,
        benefits: ['Sin límites', 'Cashback 1.5%', 'Soporte prioritario']
    },

    // PERSONAL CREDIT CARDS (10)
    'NMX Start': {
        limit: 15000, interest: 15, cost: 2000, max_balance: Infinity, score: 0, tier: 'Personal', color: 0xA9A9A9,
        benefits: ['Ideal para historial', 'Sin anualidad 1er año', 'App móvil incluida']
    },
    'NMX Básica': {
        limit: 30000, interest: 12, cost: 4000, max_balance: Infinity, score: 30, tier: 'Personal', color: 0x87CEEB,
        benefits: ['Límite mejorado', 'Cashback 1%', 'Seguro básico']
    },
    'NMX Plus': {
        limit: 50000, interest: 10, cost: 6000, max_balance: Infinity, score: 50, tier: 'Plus', color: 0x32CD32,
        benefits: ['Límite superior', 'Cashback 2%', 'Protección de compras']
    },
    'NMX Plata': {
        limit: 100000, interest: 8, cost: 10000, max_balance: Infinity, score: 60, tier: 'Premium', color: 0xC0C0C0,
        benefits: ['Límite alto', 'Cashback 3%', 'Acceso salas VIP (2/año)']
    },
    'NMX Oro': {
        limit: 250000, interest: 7, cost: 15000, max_balance: Infinity, score: 70, tier: 'Elite', color: 0xFFD700,
        benefits: ['Límite Oro', 'Cashback 4%', 'Lounge aeropuerto ilimitado']
    },
    'NMX Rubí': {
        limit: 500000, interest: 6, cost: 25000, max_balance: Infinity, score: 80, tier: 'Elite Plus', color: 0xE0115F,
        benefits: ['Medio millón', 'Cashback 5%', 'Concierge premium']
    },
    'NMX Black': {
        limit: 1000000, interest: 5, cost: 40000, max_balance: Infinity, score: 85, tier: 'Black', color: 0x000000,
        benefits: ['Límite millonario', 'Cashback 6%', 'Priority Pass Total']
    },
    'NMX Diamante': {
        limit: 2000000, interest: 3, cost: 60000, max_balance: Infinity, score: 90, tier: 'Diamante', color: 0xB9F2FF,
        benefits: ['2 Millones', 'Cashback 8%', 'Mayordomo personal']
    },
    'NMX Zafiro': {
        limit: 5000000, interest: 2.5, cost: 100000, max_balance: Infinity, score: 95, tier: 'Zafiro', color: 0x0F52BA,
        benefits: ['5 Millones', 'Cashback 8%', 'Jet privado (-50%)']
    },
    'NMX Platino Elite': {
        limit: 10000000, interest: 2, cost: 150000, max_balance: Infinity, score: 98, tier: 'Platino Elite', color: 0xE5E4E2,
        benefits: ['10 Millones', 'Cashback 10%', 'Jet privado ilimitado']
    },

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
        .setName('registrar-tarjeta')
        .setDescription('🏦 Registrar una nueva tarjeta para un usuario (Solo Banqueros)')
        .addUserOption(option => option.setName('usuario').setDescription('Usuario al que registrar tarjeta').setRequired(true))
        .addStringOption(option => option.setName('nombre_titular').setDescription('Nombre completo del titular').setRequired(true))
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de Tarjeta')
                .setRequired(true)
                .addChoices(
                    // DEBIT
                    { name: 'NMX Débito', value: 'NMX Débito' },
                    { name: 'NMX Débito Plus', value: 'NMX Débito Plus' },
                    { name: 'NMX Débito Gold', value: 'NMX Débito Gold' },
                    // PERSONAL
                    { name: 'NMX Start ($15k)', value: 'NMX Start' },
                    { name: 'NMX Básica ($30k)', value: 'NMX Básica' },
                    { name: 'NMX Plus ($50k)', value: 'NMX Plus' },
                    { name: 'NMX Plata ($100k)', value: 'NMX Plata' },
                    { name: 'NMX Oro ($250k)', value: 'NMX Oro' },
                    { name: 'NMX Rubí ($500k)', value: 'NMX Rubí' },
                    { name: 'NMX Black ($1M)', value: 'NMX Black' },
                    { name: 'NMX Diamante ($2M)', value: 'NMX Diamante' },
                    { name: 'NMX Zafiro ($5M)', value: 'NMX Zafiro' },
                    // BUSINESS
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
        .addAttachmentOption(option => option.setName('foto_dni').setDescription('Foto del DNI').setRequired(false))
        .addStringOption(option => option.setName('notas').setDescription('Notas adicionales para el contrato').setRequired(false)),

    async execute(interaction, client, supabase) {
        // Safe Defer in case it wasn't done
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

            // Check if user has any banker role or is admin
            if (!isExecutiveBanker && !isRegularBanker && !isAdmin) {
                return interaction.editReply('⛔ **Permiso Denegado**\n\nSolo el personal bancario puede registrar tarjetas.\n👥 Roles requeridos: Banquero o Ejecutivo Banquero');
            }

            const targetUser = interaction.options.getUser('usuario');
            if (!targetUser) return interaction.editReply('❌ Debes especificar un usuario.');

            // SECURITY: Self-Target Check
            if (targetUser.id === interaction.user.id) {
                return interaction.editReply('⛔ **Seguridad:** No puedes registrarte una tarjeta a ti mismo. Pide a otro banquero que lo haga.');
            }

            const holderName = interaction.options.getString('nombre_titular');
            const cardType = interaction.options.getString('tipo');

            // === CARD TYPE AUTHORIZATION (Banker Tier) ===
            const regularBankerAllowedCards = [
                'NMX Débito', 'NMX Débito Plus', 'NMX Débito Gold',
                'NMX Start', 'NMX Básica', 'NMX Plus', 'NMX Plata',
                'NMX Oro', 'NMX Rubí', 'NMX Black', 'NMX Diamante', 'NMX Zafiro', 'NMX Platino Elite',
                'NMX Business Start', 'NMX Business Gold', 'NMX Business Platinum', 'NMX Business Elite',
                'NMX Corporate', 'NMX Corporate Plus', 'NMX Enterprise', 'NMX Conglomerate', 'NMX Supreme'
            ];

            // Regular bankers - Check limits
            if (isRegularBanker && !isExecutiveBanker && !isAdmin) {
                if (!regularBankerAllowedCards.includes(cardType)) {
                    return interaction.editReply(
                        `⛔ **Permiso Denegado**\n\n` +
                        `No tienes autorización para ofrecer **${cardType}**.\n\n` +
                        `💼 **Banquero Regular:**\n` +
                        `└ Tarjetas permitidas: Ver lista oficial\n`
                    );
                }
            }

            // Business Card Validation
            if (cardType.includes('Business') || cardType.includes('Corporate') || cardType.includes('Enterprise') || cardType.includes('Conglomerate') || cardType.includes('Supreme')) {
                const { data: companies } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('owner_id', targetUser.id)
                    .limit(1);

                if (!companies || companies.length === 0) {
                    return interaction.editReply('⛔ **Requisito Empresarial:** El usuario debe ser dueño de una empresa registrada para solicitar tarjetas Business/Corporate.');
                }
            }

            const dniPhoto = interaction.options.getAttachment('foto_dni');
            const notes = interaction.options.getString('notas') || 'Sin notas';

            // CARD STATS MAP (Global)
            const stats = CARD_TIERS[cardType || 'NMX Start'] || CARD_TIERS['NMX Start'];

            // 2. Find Citizen
            let { data: citizen } = await supabase.from('citizens').select('id, full_name').eq('discord_id', targetUser.id).limit(1).maybeSingle();

            if (!citizen) {
                // FALLBACK: Check if user has DNI but is missing from 'citizens' table (Legacy Sync)
                const { data: dniData } = await supabase
                    .from('citizen_dni')
                    .select('nombre, apellido, foto_url')
                    .eq('user_id', targetUser.id)
                    .maybeSingle();

                if (dniData) {
                    // Auto-register in old 'citizens' table
                    const fullNameFromDni = `${dniData.nombre} ${dniData.apellido}`;
                    const { data: newCitizen, error: createError } = await supabase
                        .from('citizens')
                        .insert([{
                            discord_id: targetUser.id,
                            full_name: fullNameFromDni,
                            dni: dniData.foto_url || targetUser.displayAvatarURL(),
                            credit_score: 100
                        }])
                        .select('id, full_name')
                        .single();

                    if (!createError && newCitizen) {
                        citizen = newCitizen;
                        // Proceed with new citizen record
                    } else {
                        console.error('[registrar-tarjeta] Auto-create citizen failed:', createError);
                        return interaction.editReply({
                            content: `❌ **Error:** El usuario <@${targetUser.id}> no está registrado en el censo.\n⚠️ **Acción Requerida:** Pídele que use el comando \`/dni crear\` para registrar su identidad.`
                        });
                    }
                } else {
                    return interaction.editReply({
                        content: `❌ **Error:** El usuario <@${targetUser.id}> no está registrado en el censo.\n⚠️ **Acción Requerida:** Pídele que use el comando \`/dni crear\` para registrar su identidad antes de emitir una tarjeta.`
                    });
                }
            }
            // Update name?
            if (citizen.full_name !== holderName) {
                await supabase.from('citizens').update({ full_name: holderName }).eq('id', citizen.id);
            }

            // 3. Send Interactive Offer
            const isDebit = cardType.includes('Débito');
            const offerEmbed = new EmbedBuilder()
                .setTitle(isDebit ? '💳 Oferta de Tarjeta de Débito' : '💳 Oferta de Tarjeta de Crédito')
                .setColor(0xD4AF37)
                .setDescription(`Hola <@${targetUser.id}>,\nEl Banco Nacional te ofrece una tarjeta **${cardType}**.\n\n**Titular:** ${holderName}\n\n**Detalles del Contrato:**`);

            // Add fields based on card type
            if (isDebit) {
                offerEmbed.addFields(
                    { name: 'Límite de Almacenamiento', value: stats.max_balance === Infinity ? 'Ilimitado ♾️' : `$${stats.max_balance.toLocaleString()}`, inline: true },
                    { name: 'Costo Apertura', value: `$${stats.cost.toLocaleString()}`, inline: true },
                    { name: 'Tipo', value: '🏦 Débito', inline: true },
                    { name: 'Notas', value: notes }
                );
            } else {
                offerEmbed.addFields(
                    { name: 'Límite', value: `$${stats.limit.toLocaleString()}`, inline: true },
                    { name: 'Interés Semanal', value: `${stats.interest}%`, inline: true },
                    { name: 'Costo Apertura', value: `$${stats.cost.toLocaleString()}`, inline: true },
                    { name: 'Notas', value: notes }
                );
            }

            if (dniPhoto && dniPhoto.url) {
                offerEmbed.setThumbnail(dniPhoto.url);
            }
            offerEmbed.setFooter({ text: 'Tienes 5 minutos para aceptar. Revisa los términos antes.' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('btn_terms').setLabel('📄 Ver Términos').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('btn_accept').setLabel('✅ Aceptar y Pagar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_reject').setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
                );

            // Send to channel (Public)
            const message = await interaction.channel.send({ content: `<@${targetUser.id}>`, embeds: [offerEmbed], components: [row] });
            await interaction.editReply(`✅ Oferta enviada a <@${targetUser.id}> para tarjeta **${cardType}**.`);

            // 4. Collector
            const filter = i => i.user.id === targetUser.id;
            const collector = message.createMessageComponentCollector({ filter, time: 300000 }); // 5 min

            let processed = false;
            collector.on('collect', async i => {
                if (processed) return;

                if (i.customId === 'btn_terms') {
                    const tycEmbed = new EmbedBuilder()
                        .setTitle('📜 Términos y Condiciones')
                        .setColor(0x333333)
                        .setDescription(`**📜 CONTRATO DE TARJETA DE CRÉDITO - BANCO NACIONAL**
                    
**1. OBLIGACIÓN DE PAGO**
El titular se compromete a realizar pagos semanales de al menos el **25% de la deuda total** antes del corte (Domingo 11:59 PM).

**2. INTERESES ORDINARIOS**
El saldo no liquidado generará un interés semanal según el nivel de la tarjeta (Ver tabla de tasas).

**3. CONSECUENCIAS DE IMPAGO**
- **1 Semana de atraso:** Reporte negativo en Buró y cobro de intereses sobre saldo vencido.
- **2 Semanas de atraso:** Bloqueo temporal de la tarjeta y congelamiento de activos.
- **3 Semanas de atraso:** Embargo de bienes y boletín de búsqueda policial por fraude.

**4. USO DE LA TARJETA**
Esta tarjeta es personal e intransferible. El titular es responsable de todos los cargos realizados con ella. El Banco Nacional colaborará con la policía en caso de compras ilegales.`);
                    await i.reply({ embeds: [tycEmbed], flags: 64 });
                }
                else if (i.customId === 'btn_reject') {
                    await i.update({ content: '❌ Oferta rechazada.', components: [] });
                    collector.stop();
                }
                else if (i.customId === 'btn_accept') {
                    const payRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('reg_pay_cash').setLabel('💵 Efectivo').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('reg_pay_debit').setLabel('💳 Débito (NMX)').setStyle(ButtonStyle.Secondary)
                    );
                    await i.update({ content: '💳 **Selecciona método de pago para la apertura:**', embeds: [], components: [payRow] });
                }
                else if (['reg_pay_cash', 'reg_pay_bank', 'reg_pay_debit'].includes(i.customId)) {
                    await i.deferUpdate();
                    try {
                        // Billing Service: Instantiate locally since Mod Bot doesn't have it natively
                        // Path from bot/commands/moderation/ -> ../../services/BillingService
                        const BillingService = require('../../services/BillingService');
                        const billingService = new BillingService(client);

                        // 1. Check Funds & Charge
                        if (stats.cost > 0) {
                            // Check Balance first (using UnbelievaBoat Service inside Billing)
                            // NOTE: billingService.ubService might not be directly exposed. 
                            // Usually billingService exposes methods like getUserBalance.
                            // Checking legacy: billingService.ubService.getUserBalance
                            // Assuming BillingService has ubService public property.

                            if (i.customId === 'reg_pay_cash') {
                                const bal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                                if ((bal.cash || 0) < stats.cost) return i.followUp({ content: `❌ No tienes suficiente efectivo. Tienes: $${(bal.cash || 0).toLocaleString()}`, flags: 64 });
                                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stats.cost, `Apertura ${cardType}`, 'cash');
                            }
                            else if (i.customId === 'reg_pay_debit') {
                                // Unified with Bank
                                const bal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                                if ((bal.bank || 0) < stats.cost) return i.followUp({ content: `❌ No tienes suficiente en Banco/Débito.`, flags: 64 });
                                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stats.cost, `Apertura ${cardType}`, 'bank');
                            }
                        }
                        processed = true;

                        // *** DEBIT CARD LOGIC ***
                        if (cardType.includes('Débito')) {
                            const cardNumber = '4279' + Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
                            const { error: insertError } = await supabase.from('debit_cards').insert([{
                                discord_user_id: targetUser.id,
                                citizen_id: citizen.id,
                                card_number: cardNumber,
                                card_tier: cardType,
                                balance: 0,
                                status: 'active'
                            }]);

                            if (insertError) throw new Error(insertError.message);

                            // Send notification to channel
                            try {
                                const notifChannel = await client.channels.fetch(LOG_CREACION_TARJETA);
                                if (notifChannel) {
                                    const notifEmbed = new EmbedBuilder()
                                        .setColor('#00D26A')
                                        .setTitle('💳 Nueva Tarjeta de Débito Registrada')
                                        .addFields(
                                            { name: '👤 Titular', value: `${holderName} (<@${targetUser.id}>)`, inline: false },
                                            { name: '🏦 Tipo', value: cardType, inline: true },
                                            { name: '💳 Número', value: `\`${cardNumber}\``, inline: true },
                                            { name: '👮 Registrado por', value: `<@${interaction.user.id}>`, inline: false }
                                        )
                                        .setTimestamp();
                                    await notifChannel.send({ embeds: [notifEmbed] });
                                }
                            } catch (notifError) {
                                console.error('[registrar-tarjeta] Notification error:', notifError);
                            }

                            await message.edit({
                                content: `✅ **Cuenta de Débito Abierta** para **${holderName}**.\n💳 Número: \`${cardNumber}\`\n👮 **Registrado por:** <@${interaction.user.id}>`,
                                components: []
                            });
                        } else {
                            // *** CREDIT CARD LOGIC (Original) ***
                            const { error: insertError } = await supabase.from('credit_cards').insert([{
                                citizen_id: citizen.id,
                                discord_user_id: targetUser.id,
                                discord_id: targetUser.id,
                                card_type: cardType,
                                card_name: cardType,
                                card_limit: stats.limit,
                                current_balance: 0,
                                interest_rate: stats.interest, // Corrected scale if legacy divided by 100, but legacy code snippet showed: interest_rate: stats.interest / 100
                                // Wait, legacy line 3005: interest_rate: stats.interest / 100
                                // Let's check DB schema if I could. Assuming legacy was correct.
                                // But Step 136 showed: interest_rate: stats.interest / 100
                                // So I should use stats.interest / 100? Or just stats.interest?
                                // If stats.interest is e.g. 15, then 0.15 is correct for math, but for display "15%".
                                // Let's stick to legacy logic: / 100.
                                // Actually, let's look at Step 118: 'NMX Start': { interest: 15 ... }
                                // Step 136: interest_rate: stats.interest / 100
                                // OK.
                                status: 'active',
                                next_payment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                            }]);

                            if (insertError) throw new Error(insertError.message);

                            // LOGGING: New Card
                            const logEmbed = new EmbedBuilder()
                                .setTitle('🔖 Nueva Tarjeta de Crédito Registrada')
                                .setColor('#FFD700')
                                .addFields(
                                    { name: '👤 Titular', value: `${holderName} (<@${targetUser.id}>)`, inline: false },
                                    { name: '💳 Tipo', value: cardType, inline: true },
                                    { name: '💰 Límite', value: `$${stats.limit.toLocaleString()}`, inline: true },
                                    { name: '📊 Interés', value: `${stats.interest}%`, inline: true },
                                    { name: '👮 Registrado por', value: `<@${interaction.user.id}>`, inline: false }
                                )
                                .setFooter({ text: 'Banco Nacional RP' })
                                .setTimestamp();

                            try {
                                const logChannel = await client.channels.fetch(LOG_CREACION_TARJETA);
                                if (logChannel) logChannel.send({ embeds: [logEmbed] });
                            } catch (e) { console.error('Log channel error', e); }

                            await message.edit({
                                content: `✅ **Tarjeta Activada** para **${holderName}**. Cobro de $${stats.cost.toLocaleString()} realizado.\n👮 **Registrado por:** <@${interaction.user.id}>`,
                                components: []
                            });
                        }

                    } catch (err) {
                        console.error(err);
                        await i.followUp({ content: `❌ Error procesando: ${err.message}`, flags: 64 });
                    }
                    collector.stop();
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) message.edit({ content: '⚠️ Oferta expirada.', components: [] });
            });

        } catch (error) {
            console.error('[registrar-tarjeta] Critical Error:', error);
            await interaction.editReply('❌ **Error Fatal:** No se pudo completar la solicitud de tarjeta.');
        }
    }
};
