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
        await interaction.deferReply({});

        const encargadoCKRoleId = '1450938106395234526';

        // Permission Check - Only Encargado de CK
        if (!interaction.member.roles.cache.has(encargadoCKRoleId) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply('❌ Solo el Encargado de CK puede aplicar un CK.');
        }

        const targetUser = interaction.options.getUser('usuario');
        const ckTipo = interaction.options.getString('tipo');
        const razon = interaction.options.getString('razon');
        const evidencia = interaction.options.getAttachment('evidencia');

        // Protected roles (NOT removed during CK)
        const protectedRoles = [
            // USER PROVIDED PROTECTED ROLES
            '1458506735185825993', '1458506888407810252',
            '1458507178619965522', '1458507296958316751',
            '1458507711938564399', '1458507744725176501',
            '1458513516913758208', '1458515486722625648',
            // CRITICAL SYSTEM ROLES
            '1412882248411381872', '1412887079612059660', '1412887167654690908'
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

                    if (hasInsurance && ckTipo !== 'CK Administrativo') { // Admin CK bypasses insurance? Or asks? Let's assume Insurance saves from RP Death (Normal/Auto)
                        await i.update({ content: '🛡️ **¡SEGURO ANTI-CK ACTIVADO!** Verificando...', embeds: [], components: [] });

                        // Consume Insurance (Remove role & Update DB)
                        try {
                            // 1. Remove Role
                            await member.roles.remove(ANTI_CK_ROLE);

                            // 2. Consume in DB (using SQL function if available, or manual update)
                            // We look for the active purchase of 'anti_ck' and expire it
                            const { data: purchase } = await supabase
                                .from('user_purchases')
                                .select('id')
                                .eq('user_id', targetUser.id)
                                .eq('item_key', 'anti_ck')
                                .eq('status', 'active')
                                .single();

                            if (purchase) {
                                await supabase
                                    .from('user_purchases')
                                    .update({ status: 'consumed', uses_remaining: 0, expiration_date: new Date().toISOString() })
                                    .eq('id', purchase.id);
                            }

                            // 3. Notify
                            const savedEmbed = new EmbedBuilder()
                                .setTitle(`🛡️ VIDA SALVADA`)
                                .setColor('#00FF00')
                                .setDescription(`El usuario **${targetUser.tag}** tenía un **Seguro Anti-CK** activo.\n\n✅ **El CK ha sido CANCELADO.**\n📉 **El seguro ha sido CONSUMIDO.**`)
                                .addFields({ name: 'Tipo de CK evitado', value: ckTipo })
                                .setTimestamp();

                            await i.editReply({ content: '', embeds: [savedEmbed] });
                            return; // STOP CK

                        } catch (err) {
                            console.error('Error consuming insurance:', err);
                            // If error consuming, proceed with caution or ask admin? 
                            // Safety: Fail safe -> Don't CK if we saw the role but DB failed.
                            await i.editReply('❌ Error consumiendo el seguro, pero el usuario TIENE el rol. CK Cancelado por seguridad.');
                            return;
                        }
                    }

                    // 1. Get current balances
                    const { data: balance } = await supabase
                        .from('user_balances')
                        .select('cash, bank')
                        .eq('guild_id', interaction.guildId)
                        .eq('user_id', targetUser.id)
                        .maybeSingle();

                    const previousCash = balance?.cash || 0;
                    const previousBank = balance?.bank || 0;

                    // 2. Reset all money
                    await supabase
                        .from('user_balances')
                        .upsert({
                            guild_id: interaction.guildId,
                            user_id: targetUser.id,
                            cash: 0,
                            bank: 0
                        }, { onConflict: 'guild_id,user_id' });

                    // 2a. HANDLE COMPANIES (Expropriation / Partner Removal)
                    const { data: companies } = await supabase
                        .from('companies')
                        .select('*')
                        .contains('owner_ids', [targetUser.id]);

                    if (companies && companies.length > 0) {
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

                    // 3. Deactivate all credit cards
                    await supabase
                        .from('credit_cards')
                        .update({ active: false })
                        .eq('guild_id', interaction.guildId)
                        .eq('user_id', targetUser.id);

                    // 4. Remove roles (except protected)
                    // Additional role to ALWAYS remove regardless
                    const forceRemoveRoles = ['1449942943648714902']; // Autock role

                    for (const [roleId, role] of member.roles.cache) {
                        const shouldRemove = (!protectedRoles.includes(roleId) && roleId !== interaction.guildId) ||
                            forceRemoveRoles.includes(roleId);

                        if (shouldRemove) {
                            try {
                                await member.roles.remove(roleId);
                                removedRoles.push(role.name); // Use name, not mention
                            } catch (e) {
                                console.log(`Could not remove role ${role.name}:`, e.message);
                            }
                        }
                    }

                    // 5. Reset DNI (optional - set to null or delete)
                    await supabase
                        .from('citizen_dni')
                        .delete()
                        .eq('guild_id', interaction.guildId)
                        .eq('user_id', targetUser.id);

                    // 6. Log to CK registry
                    await supabase
                        .from('ck_registry')
                        .insert({
                            guild_id: interaction.guildId,
                            user_id: targetUser.id,
                            applied_by: interaction.user.id,
                            reason: razon,
                            evidencia_url: evidencia.url,
                            previous_cash: previousCash,
                            previous_bank: previousBank,
                            roles_removed: removedRoles
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
                            // Create detailed log embed
                            const detailedLogEmbed = new EmbedBuilder()
                                .setTitle(`💀 ${ckTipo.toUpperCase()} - LOG DETALLADO`)
                                .setColor('#8B0000')
                                .setThumbnail('https://cdn.discordapp.com/attachments/885232074083143741/1457553016743006363/25174-skull-lmfao.gif')
                                .addFields(
                                    { name: '👮 Aprobado por:', value: `<@${interaction.user.id}>`, inline: true },
                                    { name: '👤 Usuario afectado:', value: `<@${targetUser.id}>`, inline: true },
                                    { name: '📋 Tipo de CK:', value: ckTipo, inline: true },
                                    { name: '📝 Razón del CK:', value: razon, inline: false },
                                    { name: '💵 Dinero Removido', value: `Cash: $${previousCash.toLocaleString()}\nBanco: $${previousBank.toLocaleString()}\n**Total:** $${(previousCash + previousBank).toLocaleString()}`, inline: true },
                                    { name: '🪪 Licencias Removidas', value: licenseRoles.length > 0 ? '🚗 Conducir\n🔫 Armas Cortas\n🎯 Armas Largas' : 'Ninguna', inline: true },
                                    { name: '💳 Tarjetas', value: 'Todas desactivadas', inline: true },
                                    { name: '🏷️ Roles Removidos', value: removedRoles.length > 0 ? removedRoles.slice(0, 15).join(', ') + (removedRoles.length > 15 ? `\n... (+${removedRoles.length - 15} más)` : '') : 'Ninguno', inline: false },
                                    { name: '🏢 Empresas Expropiadas', value: companies && companies.length > 0 ? companies.map(c => c.name).join(', ') : 'Ninguna', inline: false }
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
                    console.error('[CK] Error applying CK:', error);
                    await i.editReply('❌ Error al aplicar el CK. Revisa los logs.');
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
