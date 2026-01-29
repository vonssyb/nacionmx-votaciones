const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const AuditService = require('../../services/AuditService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ck')
        .setDescription('💀 Sistema de Character Kill - Reseteo completo de personaje')
        .addSubcommand(subcommand =>
            subcommand
                .setName('aplicar')
                .setDescription('Aplicar CK a un usuario (reseteo total)')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario a resetear').setRequired(true))
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de CK')
                        .setRequired(true)
                        .addChoices(
                            { name: 'CK Normal', value: 'CK Normal' },
                            { name: 'CK Administrativo', value: 'CK Administrativo' },
                            { name: 'Auto CK', value: 'Auto CK' }
                        ))
                .addStringOption(option => option.setName('razon').setDescription('Razón del CK').setRequired(true))
                .addAttachmentOption(option => option.setName('evidencia').setDescription('Screenshot de evidencia').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('revertir')
                .setDescription('♻️ Revertir un CK (Solo Encargado)')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario a restaurar').setRequired(true))
                .addStringOption(option => option.setName('razon').setDescription('Motivo de la reversión').setRequired(true))),

    async execute(interaction, client, supabase) {

        const subcommand = interaction.options.getSubcommand();
        const rKRole = '1450938106395234526'; // Encargado CK

        // --- REVERTIR LOGIC ---
        if (subcommand === 'revertir') {
            // await interaction.deferReply();

            // Check Permissions (Strict)
            if (!interaction.member.roles.cache.has(rKRole) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply('❌ Solo el Encargado de CK puede revertir una muerte.');
            }

            const targetUser = interaction.options.getUser('usuario');

            try {
                // 1. Find last CK record with backup
                const { data: ckRecord, error } = await supabase
                    .from('ck_registry')
                    .select('*')
                    .eq('user_id', targetUser.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (error || !ckRecord) {
                    return interaction.editReply('❌ No se encontró un registro de CK para este usuario o no tiene backup.');
                }

                const backup = ckRecord.backup_data;
                const rolesToRestore = ckRecord.roles_removed || [];

                if (!backup) {
                    return interaction.editReply('⚠️ El registro de CK existe pero es ANTIGUO y no tiene datos de respaldo (DNI/Empresas). Solo se puede devolver roles y dinero manualmente.');
                }

                await interaction.editReply(`⏳ **Iniciando Resurrección de ${targetUser.tag}...**\nRecuperando DNI, Bienes y Roles.`);

                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (!member) return interaction.editReply('❌ El usuario no está en el servidor.');

                // A. Restore Money
                await supabase.from('user_balances').upsert({
                    guild_id: interaction.guildId,
                    user_id: targetUser.id,
                    cash: ckRecord.previous_cash,
                    bank: ckRecord.previous_bank
                }, { onConflict: 'guild_id,user_id' });

                // B. Restore DNI
                if (backup.dni) {
                    await supabase.from('citizen_dni').upsert(backup.dni);
                }

                // C. Restore Credit Cards
                if (backup.cards && backup.cards.length > 0) {
                    const cardIds = backup.cards.map(c => c.id);
                    await supabase.from('credit_cards').update({ active: true }).in('id', cardIds);
                }

                // D. Restore Companies (Expropriation Reversal)
                if (backup.companies && backup.companies.length > 0) {
                    for (const comp of backup.companies) {
                        const { data: currentComp } = await supabase.from('companies').select('owner_ids, status').eq('id', comp.id).single();

                        if (currentComp) {
                            let newOwners = currentComp.owner_ids || [];
                            if (!newOwners.includes(targetUser.id)) {
                                newOwners.push(targetUser.id);
                            }
                            const newStatus = currentComp.status === 'government_seized' ? 'active' : currentComp.status;
                            await supabase.from('companies').update({
                                owner_ids: newOwners,
                                status: newStatus,
                                name: comp.name
                            }).eq('id', comp.id);
                        }
                    }
                }

                // D2. Restore Purchases (Re-insert from backup since they were deleted)
                if (backup.purchases && backup.purchases.length > 0) {
                    // First, delete any existing records to avoid conflicts
                    await supabase
                        .from('user_purchases')
                        .delete()
                        .eq('user_id', targetUser.id);

                    // Then insert the backed up purchases with ALL original fields
                    const purchasesToInsert = backup.purchases.map(pch => {
                        // Create a copy of the purchase object
                        const purchase = { ...pch };

                        // Remove auto-generated fields that shouldn't be manually inserted
                        delete purchase.id;
                        delete purchase.created_at;
                        delete purchase.updated_at;

                        // Ensure status is active for restoration
                        purchase.status = 'active';

                        return purchase;
                    });

                    const { error: insertError } = await supabase
                        .from('user_purchases')
                        .insert(purchasesToInsert);

                    if (insertError) {
                        console.error('[CK Revert] Failed to restore purchases:', insertError);
                    }
                }

                // E. Restore Roles
                let rolesRestoredCount = 0;
                for (const roleName of rolesToRestore) {
                    const role = interaction.guild.roles.cache.find(r => r.name === roleName);
                    if (role) {
                        try {
                            await member.roles.add(role);
                            rolesRestoredCount++;
                        } catch (e) { console.error(`Failed to give role ${roleName}`); }
                    }
                }

                // F. Notify
                const successEmbed = new EmbedBuilder()
                    .setTitle('♻️ CK REVERTIDO - RESURRECCIÓN')
                    .setColor('#00FF00')
                    .setDescription(`Se ha restaurado exitosamente a **${targetUser.tag}**.`)
                    .addFields(
                        { name: '💰 Dinero Restaurado', value: `$${(Number(ckRecord.previous_cash) + Number(ckRecord.previous_bank)).toLocaleString()}`, inline: true },
                        { name: '🪪 DNI', value: backup.dni ? 'Restaurado' : 'No encontrado', inline: true },
                        { name: '🎭 Roles', value: `${rolesRestoredCount} recuperados`, inline: true },
                        { name: '🏢 Empresas', value: backup.companies ? `${backup.companies.length} devueltas` : 'Ninguna', inline: true }
                    )
                    .setFooter({ text: `Autorizado por: ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ content: '', embeds: [successEmbed] });

                // LOGGING CHANNELS
                const CHANNELS = {
                    PUBLIC: '1412957234824089732',
                    PRIVATE_LOG: '1457576874602659921',
                    EXPIRED_ITEMS: '1455691472362934475' // CK Revert Log
                };

                // A. Public Log
                try {
                    const publicChan = await client.channels.fetch(CHANNELS.PUBLIC);
                    if (publicChan) await publicChan.send({ embeds: [successEmbed] });
                } catch (e) { console.error('[CK Revert] Failed public log:', e); }

                // B. Private Log (Detailed)
                try {
                    const ch = await client.channels.fetch(CHANNELS.PRIVATE_LOG);
                    if (ch) await ch.send({
                        content: `⚠️ **REVERSIÓN DE CK EJECUTADA**`,
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#FFFF00')
                                .addFields(
                                    { name: 'Admin', value: `<@${interaction.user.id}>`, inline: true },
                                    { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                                    { name: 'Razón Reversión', value: interaction.options.getString('razon'), inline: false },
                                    { name: 'Datos Restaurados', value: `Dinero: $${(Number(ckRecord.previous_cash) + Number(ckRecord.previous_bank)).toLocaleString()}\nDNI: ${backup.dni ? 'Sí' : 'No'}\nRoles: ${rolesRestoredCount}`, inline: false }
                                )
                                .setTimestamp()
                        ]
                    });
                } catch (e) { console.error('[CK Revert] Failed private log:', e); }

                // C. Expired Items Log (Restoration Entry) - REMOVED PER USER REQUEST
                // try {
                //     const expiredChan = await client.channels.fetch(CHANNELS.EXPIRED_ITEMS);
                //     if (expiredChan) {
                //         const restoreEmbed = new EmbedBuilder()
                //             .setTitle('♻️ RESTAURACIÓN ADMIN: CK REVERTIDO')
                //             .setColor('#00FFFF')
                //             .setDescription(`Se ha revertido un CK, restaurando bienes y estado al usuario.`)
                //             .addFields(
                //                 { name: 'Usuario', value: `<@${targetUser.id}>`, inline: true },
                //                 { name: 'Admin Responsable', value: `<@${interaction.user.id}>`, inline: true },
                //                 { name: 'Motivo', value: interaction.options.getString('razon'), inline: false }
                //             )
                //             .setTimestamp();
                //         await expiredChan.send({ embeds: [restoreEmbed] });
                //     }
                // } catch (e) { console.error('[CK Revert] Failed expired log:', e); }

            } catch (err) {
                console.error('[CK Revert] Error:', err);
                await interaction.editReply('❌ Error crítico al revertir. Consulta los logs.');
            }
            return;
        }

        // --- APLICAR LOGIC (Original Flow) ---
        // await interaction.deferReply({});
        const ckTipo = interaction.options.getString('tipo');
        const targetUser = interaction.options.getUser('usuario');
        const razon = interaction.options.getString('razon');
        const evidencia = interaction.options.getAttachment('evidencia');

        // Protected roles (NOT removed during CK)
        // Protected roles (NOT removed during CK)
        const protectedRoles = [
            // USER PROVIDED PROTECTED ROLES (UPDATED LIST)
            '1412882245735420006', // Junta Directiva
            '1412882248411381872', // Administrador
            '1412887079612059660', // Staff ⬆️
            '1457558479287091417', // Staff en entrenamiento
            '1412887167654690908', // Staff
            '1413545285975801918', // Sanciones (separador)
            '1456028933995630701', // SA 5
            '1456028797638934704', // SA 4
            '1456028699718586459', // SA 3
            '1454636391932756049', // SA 2
            '1450997809234051122', // SA 1
            '1412882235547189362', // Roles administrativos (separador)
            '1450242210636365886', // Key admistrador
            '1450242319121911848', // Key moderador
            '1450242487422812251', // 🔐
            '1456020936229912781', // Encargado de sanciones
            '1451703422800625777', // Encargado de apelaciones
            '1454985316292100226', // Encargado de economía
            '1457919110947016879', // Encargado de política
            '1457776641056047115', // Encargado del civil
            '1455654563158954096', // Encargado de postulaciones
            '1455654847717048473', // Encargado de entrevistas
            '1450938106395234526', // Encargado de ck
            '1456348822296068326', // Encargado de facciones
            '1450688555503587459', // Encargado de empresas
            '1454986744004087839', // Encargado de eventos
            '1450688588155981976', // Encargado de banco
            '1457897953376207021', // Rank locked
            '1458294156568039536', // Sospechoso de raideo
            '1449883899051114627', // Sospechoso de cheats
            '1413709747244240896', // Baneado de 30 días
            '1413718347052351529', // Baneado de 15 días
            '1413545369119490089', // Baneado de 7 días
            '1451860028653834300', // Blacklist moderación
            '1413714060423200778', // Blacklist facciones policiales
            '1449930883762225253', // Blacklist cartel
            '1413714467287470172', // Blacklist política
            '1413714540834852875', // Blacklist empresas
            '1412887170267480215', // Roles especiales
            '1414033620636532849', // UltraPASS
            '1412887172503175270', // Premium
            '1423520675158691972', // Booster
            '1412887176827375768', // Influencer
            '1437614205393047622', // Diseñador
            '1412887179281305772', // Gobierno (separador)
            '1412891685008052276', // Trabajos (separador)
            '1424534280725463071', // Civil (separador)
            '1457950212923461632', // Civil americano
            // ADDITIONAL ROLES RESTORED/ADDED
            '1449948588166611078',
            '1458506735185825993',
            '1413541382869618731',
            '1458506888407810252',
            '1458507178619965522',
            '1458507296958316751',
            '1458507711938564399',
            '1458507744725176501',
            '1458513516913758208',
            '1458515486722625648',
            '1459240544017453238',
            // NEW PROTECTED ROLES (USER REQUESTED)
            '1460051693092995174',
            '1460050867473612840',
            '1460050977246679164',
            '1460051059568545884',
            '1460051141071995104',
            '1460051219186843670',
            '1460051350199996640',
            '1460051433331232893',
            '1460051534053380219',
            '1460051629184385146'
        ];

        // License roles to remove
        const licenseRoles = [
            '1413543909761614005', // Conducir
            '1413543907110682784', // Armas Cortas
            '1413541379803578431'  // Armas Largas
        ];

        // Confirmation with buttons
        const confirmEmbed = new EmbedBuilder()
            .setTitle(`⚠️ CONFIRMACIÓN DE ${ckTipo.toUpperCase()}`)
            .setColor('#FF0000')
            .setDescription(`Estás a punto de aplicar un **${ckTipo}** a **${targetUser.tag}**. Esta acción es **IRREVERSIBLE** y realizará:\n\n` +
                `- ❌ Quitar TODO el dinero (cash + banco)\n` +
                `- ❌ Eliminar tarjetas de crédito/débito\n` +
                `- ❌ Remover TODOS los roles (excepto ${protectedRoles.length} protegidos)\n` +
                `- ❌ Eliminar licencias y **Vehículos**\n` +
                `- ❌ Resetear DNI y **Roles Temporales**\n\n` +
                `**Razón:** ${razon}`)
            .setFooter({ text: 'Confirma esta acción usando los botones' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`ck_confirm_${targetUser.id}`)
                    .setLabel('✅ CONFIRMAR CK')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ck_cancel')
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmMsg = await interaction.editReply({
            embeds: [confirmEmbed],
            components: [row]
        });

        // Wait for button confirmation
        const filter = i => i.user.id === interaction.user.id;
        const collector = confirmMsg.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'ck_cancel') {
                await i.update({ content: '❌ CK cancelado.', embeds: [], components: [] });
                collector.stop();
                return;
            }

            if (i.customId === `ck_confirm_${targetUser.id}`) {
                await i.update({ content: '⏳ Aplicando CK...', embeds: [], components: [] });

                try {
                    const member = await interaction.guild.members.fetch(targetUser.id);
                    const removedRoles = [];

                    // 0. CHECK FOR ANTI-CK INSURANCE (Role: 1449950413993410651)
                    const ANTI_CK_ROLE = '1449950413993410651';
                    const hasInsurance = member.roles.cache.has(ANTI_CK_ROLE);

                    if (hasInsurance && ckTipo !== 'CK Administrativo') {
                        await i.editReply({ content: '🛡️ **¡SEGURO ANTI-CK ACTIVADO!** Verificando...', embeds: [], components: [] });

                        // Fetch Purchase Record (Handle potential duplicates gracefully with limit 1)
                        const { data: purchases } = await supabase
                            .from('user_purchases')
                            .select('*')
                            .eq('user_id', targetUser.id)
                            .eq('item_key', 'anti_ck')
                            .eq('status', 'active')
                            .limit(1);

                        const purchase = purchases && purchases.length > 0 ? purchases[0] : null;

                        // Consume Insurance (Remove role & Update DB)
                        try {
                            // 1. Remove Role
                            await member.roles.remove(ANTI_CK_ROLE);

                            // 2a. Expire the DB purchase
                            if (purchase) {
                                await supabase
                                    .from('user_purchases')
                                    .update({ status: 'consumed', uses_remaining: 0, expiration_date: new Date().toISOString() })
                                    .eq('id', purchase.id);

                                // Remove the Role
                                if (member.roles.cache.has(ANTI_CK_ROLE)) {
                                    await member.roles.remove(ANTI_CK_ROLE).catch(e => console.error('Failed to remove Anti-CK role:', e));
                                }
                            }

                            // 3. Prepare Notification Data
                            const savedMessages = [
                                "tenía un chaleco antibalas de alta tecnología y sobrevivió milagrosamente.",
                                "fue atendido rápidamente por los paramédicos y lograron estabilizarlo.",
                                "tuvo una suerte increíble y las balas no tocaron órganos vitales.",
                                "fingió su muerte de manera magistral y escapó en el último segundo.",
                                "llevaba una placa de metal en el pecho que detuvo el impacto fatal.",
                                "fue rescatado por un equipo de extracción táctica justo a tiempo.",
                                "despertó en el hospital sin recordar nada, pero vivo."
                            ];
                            const randomMsg = savedMessages[Math.floor(Math.random() * savedMessages.length)];
                            const usageReason = "Uso en enfrentamiento / Situación de riesgo mortal";

                            // Embed for Interaction & Public
                            const savedEmbed = new EmbedBuilder()
                                .setTitle(`🛡️ VIDA SALVADA - ANTI CK`)
                                .setColor('#00FF00')
                                .setDescription(`El usuario **${targetUser.tag}** ha sobrevivido a un intento de CK.\n\n✅ **El CK ha sido CANCELADO.**\n📖 **Roleplay:** El usuario ${randomMsg}`)
                                .addFields(
                                    { name: '👤 Usuario', value: `<@${targetUser.id}>`, inline: true },
                                    { name: '🛡️ Item Usado', value: 'Seguro Anti-CK', inline: true },
                                    { name: '📉 Estado', value: 'Consumido (1/1)', inline: true }
                                )
                                .setFooter({ text: 'Nación MX | Sistema de Vida Extra' })
                                .setTimestamp();

                            // Update Interaction (Origin)
                            await i.editReply({ content: '', embeds: [savedEmbed] });

                            // LOGGING CHANNELS
                            const CHANNELS = {
                                PUBLIC: '1412957234824089732',
                                PRIVATE_LOG: '1457576874602659921',
                                EXPIRED_ITEMS: '1455691472362934475'
                            };

                            // A. Log to Public Channel
                            try {
                                const publicChan = await client.channels.fetch(CHANNELS.PUBLIC);
                                if (publicChan) await publicChan.send({ embeds: [savedEmbed] });
                            } catch (e) { console.error('Failed to log Anti-CK public:', e); }

                            // B. Log to ID Private Log (Security)
                            try {
                                const privateEmbed = new EmbedBuilder()
                                    .setTitle(`🛡️ ANTI-CK ACTIVADO`)
                                    .setColor('#FFFF00')
                                    .addFields(
                                        { name: 'Usuario', value: `<@${targetUser.id}> (${targetUser.id})`, inline: true },
                                        { name: 'Trigger', value: `Intento de CK por <@${interaction.user.id}>`, inline: true },
                                        { name: 'Razón Original CK', value: razon, inline: false },
                                        { name: 'Resultado', value: 'CK Cancelado - Item Consumido', inline: false }
                                    )
                                    .setTimestamp();
                                const privateChan = await client.channels.fetch(CHANNELS.PRIVATE_LOG);
                                if (privateChan) await privateChan.send({ embeds: [privateEmbed] });
                            } catch (e) { console.error('Failed to log Anti-CK private:', e); }

                            // C. Log to Expired Items (The specific request)
                            try {
                                const expiredEmbed = new EmbedBuilder()
                                    .setTitle('📉 ITEM CONSUMIDO: SEGURO ANTI-CK')
                                    .setColor('#FFA500')
                                    .setDescription(`El usuario **${targetUser.tag}** ha consumido su seguro de vida.`)
                                    .addFields(
                                        { name: 'Usuario', value: `<@${targetUser.id}>`, inline: true },
                                        { name: 'Motivo de Consumo', value: usageReason, inline: false },
                                        { name: 'Fecha', value: new Date().toLocaleDateString('es-MX'), inline: true }
                                    )
                                    .setTimestamp();
                                const expiredChan = await client.channels.fetch(CHANNELS.EXPIRED_ITEMS);
                                if (expiredChan) await expiredChan.send({ embeds: [expiredEmbed] });
                            } catch (e) { console.error('Failed to log Anti-CK expired:', e); }

                            return; // STOP CK EXECUTION

                        } catch (e) {
                            console.error('Anti-CK Logic Error:', e);
                            await i.editReply({ content: `❌ Error procesando el Anti-CK: ${e.message}`, embeds: [], components: [] });
                        }
                        return; // Stop execution
                    }

                    // 1. CAPTURE BACKUP DATA (Snapshot before deletion)
                    const backupData = { dni: null, cards: [], companies: [], purchases: [] };

                    // Backup DNI
                    const { data: bDni } = await supabase.from('citizen_dni').select('*').eq('user_id', targetUser.id).maybeSingle();
                    backupData.dni = bDni;

                    // Backup Cards
                    const { data: bCards } = await supabase.from('credit_cards').select('*').eq('user_id', targetUser.id);
                    backupData.cards = bCards || [];

                    // Backup Purchases (Active ones)
                    const { data: bPurchases } = await supabase
                        .from('user_purchases')
                        .select('*')
                        .eq('user_id', targetUser.id)
                        .eq('status', 'active');
                    backupData.purchases = bPurchases || [];

                    // 1b. Get current balances (TRY UNBELIEVABOAT FIRST FOR ACCURACY)
                    let previousCash = 0;
                    let previousBank = 0;

                    if (process.env.UNBELIEVABOAT_TOKEN) {
                        try {
                            const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
                            const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);
                            const ubBalance = await ubService.getUserBalance(interaction.guildId, targetUser.id);
                            if (ubBalance) {
                                previousCash = ubBalance.cash || 0;
                                previousBank = ubBalance.bank || 0;
                            }
                        } catch (e) { console.error('UB Balance Fetch Failed:', e); }
                    }

                    // Fallback to Supabase if UB failed or returned 0 (optional logic, usually UB is authority)
                    if (previousCash === 0 && previousBank === 0) {
                        const { data: balance } = await supabase
                            .from('user_balances')
                            .select('cash, bank')
                            .eq('guild_id', interaction.guildId)
                            .eq('user_id', targetUser.id)
                            .maybeSingle();
                        if (balance) {
                            previousCash = balance.cash || 0;
                            previousBank = balance.bank || 0;
                        }
                    }


                    // 2. Reset Ecosystem (Money) - USE SET BALANCE TO 0
                    if (process.env.UNBELIEVABOAT_TOKEN) {
                        try {
                            const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
                            const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);

                            // SET BALANCE TO 0 DIRECTLY (More reliable than remove)
                            await ubService.setBalance(interaction.guildId, targetUser.id, { cash: 0, bank: 0 }, `CK: ${razon}`);

                        } catch (ubError) {
                            console.error('[CK] Failed to reset UnbelievaBoat balance:', ubError);
                        }
                    }

                    // 2a. HANDLE COMPANIES (Expropriation / Partner Removal)
                    const { data: companies } = await supabase
                        .from('companies')
                        .select('*')
                        .contains('owner_ids', [targetUser.id]);

                    if (companies && companies.length > 0) {
                        // Store companies state in backup before modification
                        backupData.companies = JSON.parse(JSON.stringify(companies));

                        for (const company of companies) {
                            const newOwners = company.owner_ids.filter(id => id !== targetUser.id);

                            if (newOwners.length > 0) {
                                // Still has partners -> Just remove user
                                await supabase
                                    .from('companies')
                                    .update({ owner_ids: newOwners })
                                    .eq('id', company.id);
                            } else {
                                // Sole owner -> SEIZE FOR GOVERNMENT
                                await supabase
                                    .from('companies')
                                    .update({
                                        owner_ids: [],
                                        status: 'government_seized',
                                        name: `${company.name} (Expropiada)`
                                    })
                                    .eq('id', company.id);
                            }
                        }
                    }

                    // 3. DELETE (Not just Deactivate) ALL CARDS

                    // Fetch Citizen ID first (Credit Cards are linked to citizen_id)
                    const { data: citizenData } = await supabase
                        .from('citizens')
                        .select('id')
                        .eq('discord_id', targetUser.id)
                        .maybeSingle();

                    if (citizenData && citizenData.id) {
                        try {
                            // Delete Credit Cards
                            await supabase
                                .from('credit_cards')
                                .delete()
                                .eq('citizen_id', citizenData.id);

                            // Delete Debit Cards (If linked by citizen_id)
                            await supabase
                                .from('debit_cards')
                                .delete()
                                .eq('citizen_id', citizenData.id);
                        } catch (cardErr) {
                            console.error('[CK] Error deleting cards by ID:', cardErr);
                        }
                    }

                    // Fallback: Delete Debit Cards by discord_user_id (Debit often has this col)
                    // Fallback: Delete Debit Cards by discord_user_id (Debit often has this col)
                    const { error: dErr1 } = await supabase
                        .from('debit_cards')
                        .delete()
                        .eq('discord_user_id', targetUser.id);
                    if (dErr1) console.log('Debit delete by discord_user_id failed/skipped');

                    // Also try 'discord_id' just in case schema differs
                    const { error: dErr2 } = await supabase
                        .from('debit_cards')
                        .delete()
                        .eq('discord_id', targetUser.id);
                    if (dErr2) console.log('Debit delete by discord_id failed/skipped');

                    // Also try 'user_id' for credit_cards just in case
                    const { error: cErr1 } = await supabase
                        .from('credit_cards')
                        .delete()
                        .eq('user_id', targetUser.id);
                    if (cErr1) console.log('Credit delete by user_id failed/skipped');

                    // 4. Remove roles (except protected)
                    // Additional role to ALWAYS remove regardless
                    const forceRemoveRoles = ['1449942943648714902']; // Autock role

                    const removedRoleIds = []; // For Database Cooldowns

                    // Roles that are removed but NOT blocked (Licenses, Passes)
                    const COOLDOWN_EXEMPT_ROLES = [
                        '1413541379803578431', '1413543907110682784', '1413543909761614005', // Licencias
                        '1449947645383675939', '1449948475935424583', '1449949468517470285', // Pases/Items
                        '1449949722050691132', '1449949914154012878', '1449950079887605880',
                        '1449950535166726317', '1449950636371214397', '1449950778499268619',
                        '1449951345611378841'
                    ];

                    for (const [roleId, role] of member.roles.cache) {
                        const protectedNames = ['Civil Mexicano', 'Roles administrativos', 'Soporte', 'Staff', 'Booster', 'Server Booster'];
                        // Normalize strings for comparison (trim + lowercase)
                        const roleNameLower = role.name.trim().toLowerCase();
                        const isProtectedByName = protectedNames.some(p => roleNameLower.includes(p.trim().toLowerCase()));

                        const shouldRemove = (!protectedRoles.includes(roleId)
                            && !isProtectedByName
                            && !role.managed
                            && roleId !== interaction.guildId)
                            || forceRemoveRoles.includes(roleId);

                        if (shouldRemove) {
                            try {
                                await member.roles.remove(roleId);
                                removedRoles.push(role.name); // Keep for logs

                                // Only add to Cooldown DB if NOT exempt
                                if (!COOLDOWN_EXEMPT_ROLES.includes(roleId)) {
                                    removedRoleIds.push({ id: roleId, name: role.name });
                                }
                            } catch (e) {
                                console.log(`Could not remove role ${role.name}:`, e.message);
                            }
                        }
                    }

                    // 5. Reset DNI (Delete by user_id only - guild_id may not exist on all records)
                    await supabase
                        .from('citizen_dni')
                        .delete()
                        .eq('user_id', targetUser.id);

                    // 5a. DELETE STORE PURCHASES (And related transactions)
                    // First delete transactions to avoid foreign key constraint
                    const { data: userPurchases } = await supabase
                        .from('user_purchases')
                        .select('id')
                        .eq('user_id', targetUser.id);

                    if (userPurchases && userPurchases.length > 0) {
                        const purchaseIds = userPurchases.map(p => p.id);

                        // Delete transactions first
                        await supabase
                            .from('purchase_transactions')
                            .delete()
                            .in('purchase_id', purchaseIds);
                    }

                    // Then delete the purchases themselves
                    await supabase
                        .from('user_purchases')
                        .delete()
                        .eq('user_id', targetUser.id);


                    // 5b. INSERT ROLE COOLDOWNS (2 Weeks)
                    const cooldownExpiry = new Date();
                    cooldownExpiry.setDate(cooldownExpiry.getDate() + 14); // 2 Weeks

                    if (removedRoleIds.length > 0) {
                        const cooldownInserts = removedRoleIds.map(r => ({
                            user_id: targetUser.id,
                            role_id: r.id,
                            role_name: r.name,
                            expires_at: cooldownExpiry.toISOString()
                        }));

                        const { error: cdError } = await supabase.from('role_cooldowns').upsert(cooldownInserts, { onConflict: 'user_id,role_id' });
                        if (cdError) console.error('[CK] Failed to insert role cooldowns:', cdError);
                    }

                    // 6. Log to CK registry
                    await supabase
                        .from('ck_registry')
                        .insert({
                            guild_id: interaction.guildId,
                            user_id: targetUser.id,
                            applied_by: interaction.user.id,
                            reason: razon,
                            evidencia_url: evidencia.url,
                            previous_cash: Number(previousCash),
                            previous_bank: Number(previousBank),
                            roles_removed: removedRoles,
                            backup_data: backupData
                        });

                    // 7. Log to audit
                    const auditService = new AuditService(supabase, client);
                    await auditService.logTransaction({
                        guildId: interaction.guildId,
                        userId: targetUser.id,
                        transactionType: 'character_kill',
                        amount: -(previousCash + previousBank),
                        currencyType: 'combined',
                        reason: `CK aplicado: ${razon}`,
                        metadata: {
                            applied_by: interaction.user.id,
                            roles_removed: removedRoles.length,
                            evidencia: evidencia.url
                        },
                        createdBy: interaction.user.id,
                        createdByTag: interaction.user.tag,
                        commandName: 'ck',
                        interactionId: interaction.id,
                        canRollback: false
                    });

                    // 8. Create result embed
                    const resultEmbed = new EmbedBuilder()
                        .setTitle(`💀 ${ckTipo.toUpperCase()}`)
                        .setColor('#8B0000')
                        .setThumbnail('https://cdn.discordapp.com/attachments/885232074083143741/1457553016743006363/25174-skull-lmfao.gif')
                        .addFields(
                            { name: 'Aprobado por:', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Usuario afectado:', value: `<@${targetUser.id}>`, inline: true },
                            { name: 'Tipo de CK:', value: ckTipo, inline: true },
                            { name: 'Razón del CK:', value: razon, inline: false },
                            { name: 'Roles removidos:', value: removedRoles.length > 0 ? removedRoles.slice(0, 10).join(', ') + (removedRoles.length > 10 ? `... (+${removedRoles.length - 10} más)` : '') : 'Ninguno', inline: false }
                        )
                        .setImage(evidencia.url)
                        .setFooter({ text: `${new Date().toLocaleDateString('es-MX')}, ${new Date().toLocaleTimeString('es-MX')}` })
                        .setTimestamp();

                    await i.editReply({ content: '', embeds: [resultEmbed] });

                    // 9a. PUBLIC LOG (To Announcements)
                    const LOG_PUBLIC_ID = '1412957234824089732';
                    try {
                        const publicChannel = await client.channels.fetch(LOG_PUBLIC_ID);
                        if (publicChannel) await publicChannel.send({ embeds: [resultEmbed] });
                    } catch (e) { console.error('[CK] Error sending public log:', e); }

                    // 9b. PRIVATE LOG (Detailed Security)
                    const LOG_PRIVATE_ID = '1457576874602659921';
                    try {
                        const privateChannel = await client.channels.fetch(LOG_PRIVATE_ID);
                        if (privateChannel) {
                            // 9. Embed Calculations
                            const cardsList = backupData.cards.length > 0
                                ? backupData.cards.map(c => `💳 ${c.card_type.toUpperCase()} (...${c.card_number.slice(-4)})`).join('\n')
                                : 'Todas desactivadas';

                            const moneyFormatted = `Cash: $${Number(previousCash).toLocaleString()}\nBanco: $${Number(previousBank).toLocaleString()}\n**Total:** $${(Number(previousCash) + Number(previousBank)).toLocaleString()}`;

                            const detailedLogEmbed = new EmbedBuilder()
                                .setTitle(`💀 ${ckTipo.toUpperCase()} - LOG DETALLADO`)
                                .setColor('#8B0000')
                                .setThumbnail('https://cdn.discordapp.com/attachments/885232074083143741/1457553016743006363/25174-skull-lmfao.gif')
                                .addFields(
                                    { name: '👮 Aprobado por:', value: `<@${interaction.user.id}>`, inline: true },
                                    { name: '👤 Usuario afectado:', value: `<@${targetUser.id}>`, inline: true },
                                    { name: '📋 Tipo de CK:', value: ckTipo, inline: true },
                                    { name: '📝 Razón del CK:', value: razon, inline: false },
                                    { name: '💵 Dinero Removido', value: moneyFormatted, inline: true },
                                    { name: '🪪 Licencias Removidas', value: licenseRoles.length > 0 ? '🚗 Conducir\n🔫 Armas Cortas\n🎯 Armas Largas' : 'Ninguna', inline: true },
                                    { name: '💳 Tarjetas', value: cardsList, inline: true },
                                    { name: '🏷️ Roles Removidos', value: removedRoles.length > 0 ? removedRoles.slice(0, 15).join(', ') + (removedRoles.length > 15 ? `\n... (+${removedRoles.length - 15} más)` : '') : 'Ninguno', inline: false },
                                    { name: '🏢 Empresas', value: backupData.companies && backupData.companies.length > 0 ? backupData.companies.map(c => c.name).join(', ') : 'Ninguna', inline: false },
                                    { name: '💾 Backup', value: '✅ Guardado para Reversión', inline: true }
                                )
                                .setImage(evidencia.url)
                                .setFooter({ text: `CK Registry | ${new Date().toLocaleDateString('es-MX')}, ${new Date().toLocaleTimeString('es-MX')}` })
                                .setTimestamp();

                            await privateChannel.send({ embeds: [detailedLogEmbed] });
                        }
                    } catch (e) {
                        console.error('[CK] Error sending private log:', e);
                    }

                    // 10. Notify user via DM
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle(`💀 ${ckTipo} Aplicado`)
                            .setColor('#FF0000')
                            .setDescription(`Tu personaje en Nación MX ha sido reseteado completamente.`)
                            .addFields(
                                { name: 'Tipo de CK', value: ckTipo, inline: false },
                                { name: 'Razón', value: razon, inline: false },
                                { name: '¿Qué perdiste?', value: 'Dinero, roles, licencias, tarjetas, y DNI', inline: false },
                                { name: '⚠️ Importante', value: 'Debes crear un nuevo DNI usando `/dni crear`', inline: false }
                            )
                            .setFooter({ text: 'Puedes volver a empezar desde cero' })
                            .setTimestamp();

                        await targetUser.send({ embeds: [dmEmbed] });
                    } catch (e) {
                        console.log('Could not DM user:', e.message);
                    }

                } catch (error) {
                    console.error('Error applying CK:', error);
                    // await i.editReply({ content: `❌ Error al aplicar el CK: ${error.message}` });
                    // Use followUp to avoid "InteractionAlreadyReplied" if editReply was already called in a race condition
                    try {
                        if (i.deferred || i.replied) {
                            await i.followUp({ content: `❌ Error al aplicar el CK: ${error.message}`, ephemeral: true });
                        } else {
                            await i.reply({ content: `❌ Error al aplicar el CK: ${error.message}`, ephemeral: true });
                        }
                    } catch (e) { console.error('Failed to send error message:', e); }
                }

                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: '❌ Tiempo agotado. CK cancelado.', embeds: [], components: [] });
            }
        });
    }
};
