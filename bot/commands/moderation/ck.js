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
                .addStringOption(option => option.setName('razon').setDescription('Razón del CK').setRequired(true))
                .addAttachmentOption(option => option.setName('evidencia').setDescription('Screenshot de evidencia').setRequired(true))),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: false });

        const juntaDirectivaRoleId = '1412882245735420006';

        // Permission Check - Only Junta Directiva
        if (!interaction.member.roles.cache.has(juntaDirectivaRoleId) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply('❌ Solo la Junta Directiva puede aplicar un CK.');
        }

        const targetUser = interaction.options.getUser('usuario');
        const razon = interaction.options.getString('razon');
        const evidencia = interaction.options.getAttachment('evidencia');

        // Protected roles (NOT removed during CK)
        const protectedRoles = [
            '1412882235547189362',
            '1413545285975801918',
            '1412887170267480215',
            '1412887179281305772',
            '1412891685008052276',
            '1424534280725463071',
            '1412899401000685588',
            '1413541382869618731',
            '1412899404167512064',
            '1449948588166611078'
        ];

        // License roles to remove
        const licenseRoles = [
            '1413543909761614005', // Conducir
            '1413543907110682784', // Armas Cortas
            '1413541379803578431'  // Armas Largas
        ];

        // Confirmation with buttons
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ CONFIRMACIÓN DE CHARACTER KILL')
            .setColor('#FF0000')
            .setDescription(`Estás a punto de aplicar un CK a **${targetUser.tag}**. Esta acción es **IRREVERSIBLE** y realizará:\n\n` +
                `- ❌ Quitar TODO el dinero (cash + banco)\n` +
                `- ❌ Eliminar tarjetas de crédito/débito\n` +
                `- ❌ Remover TODOS los roles (excepto ${protectedRoles.length} protegidos)\n` +
                `- ❌ Eliminar licencias\n` +
                `- ❌ Resetear DNI\n\n` +
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

                    // 3. Deactivate all credit cards
                    await supabase
                        .from('credit_cards')
                        .update({ active: false })
                        .eq('guild_id', interaction.guildId)
                        .eq('user_id', targetUser.id);

                    // 4. Remove roles (except protected)
                    for (const [roleId, role] of member.roles.cache) {
                        if (!protectedRoles.includes(roleId) && roleId !== interaction.guildId) {
                            try {
                                await member.roles.remove(roleId);
                                removedRoles.push(role.name);
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
                        .setTitle('💀 CK NORMAL')
                        .setColor('#8B0000')
                        .setThumbnail('https://cdn.discordapp.com/attachments/885232074083143741/1457553016743006363/25174-skull-lmfao.gif')
                        .addFields(
                            { name: 'Aprobado por:', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Usuario afectado:', value: `<@${targetUser.id}>`, inline: true },
                            { name: 'Razón del CK:', value: razon, inline: false },
                            { name: 'Roles removidos:', value: removedRoles.length > 0 ? removedRoles.slice(0, 10).join(', ') + (removedRoles.length > 10 ? `... (+${removedRoles.length - 10} más)` : '') : 'Ninguno', inline: false }
                        )
                        .setImage(evidencia.url)
                        .setFooter({ text: `${new Date().toLocaleDateString('es-MX')}, ${new Date().toLocaleTimeString('es-MX')}` })
                        .setTimestamp();

                    await i.editReply({ content: '', embeds: [resultEmbed] });

                    // 9. Send to audit channel
                    const AUDIT_CHANNEL_ID = process.env.AUDIT_LOGS_CHANNEL_ID || '1450610756663115879';
                    const auditChannel = await client.channels.fetch(AUDIT_CHANNEL_ID);
                    if (auditChannel) {
                        await auditChannel.send({ embeds: [resultEmbed] });
                    }

                    // 10. Notify user via DM
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('💀 Character Kill Aplicado')
                            .setColor('#FF0000')
                            .setDescription(`Tu personaje en Nación MX ha sido reseteado completamente.`)
                            .addFields(
                                { name: 'Razón', value: razon, inline: false },
                                { name: '¿Qué perdiste?', value: 'Dinero, roles, licencias, tarjetas, y DNI', inline: false }
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
