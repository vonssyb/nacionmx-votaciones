const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const AuditService = require('../../services/AuditService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dinero')
        .setDescription('💰 Gestión de dinero en efectivo (Solo Junta Directiva)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('añadir')
                .setDescription('Añadir efectivo a un usuario')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario al que añadir dinero').setRequired(true))
                .addIntegerOption(option => option.setName('cantidad').setDescription('Cantidad de efectivo a añadir').setRequired(true).setMinValue(1))
                .addStringOption(option => option.setName('razon').setDescription('Razón administrativa').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('quitar')
                .setDescription('Quitar efectivo a un usuario')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario al que quitar dinero').setRequired(true))
                .addIntegerOption(option => option.setName('cantidad').setDescription('Cantidad de efectivo a quitar').setRequired(true).setMinValue(1))
                .addStringOption(option => option.setName('razon').setDescription('Razón administrativa').setRequired(true))),

    async execute(interaction, client, supabase) {


        const encargadoEconomiaRoleId = '1457554145719488687';

        // Permission Check - Only Encargado de Economía
        if (!interaction.member.roles.cache.has(encargadoEconomiaRoleId) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply('❌ Solo el Encargado de Economía puede gestionar dinero administrativo.');
        }

        const subCmd = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('usuario');
        const cantidad = interaction.options.getInteger('cantidad');
        const razon = interaction.options.getString('razon');

        // SELF-ACTION DETECTION
        if (targetUser.id === interaction.user.id) {
            const SelfActionService = require('../../services/SelfActionService');
            const selfActionService = new SelfActionService(client, supabase);

            if (!selfActionService.canApproveSelfAction(interaction.member)) {
                const requestId = `${Date.now()}_${interaction.user.id}`;
                await selfActionService.requestSuperiorApproval({
                    actionType: subCmd === 'añadir' ? 'money_add' : 'money_remove',
                    executor: interaction.user,
                    target: targetUser,
                    guildId: interaction.guildId,
                    details: `Intento de ${subCmd === 'añadir' ? 'auto-adición' : 'auto-remoción'} de dinero\nCantidad: $${cantidad.toLocaleString()}\nRazón: ${razon}`,
                    approveButtonId: `sa_approve_money_${subCmd}_${requestId}_${cantidad}`,
                    rejectButtonId: `sa_reject_money_${requestId}`,
                    metadata: {
                        amount: cantidad,
                        subcommand: subCmd,
                        reason: razon
                    }
                });

                return interaction.editReply('⚠️ **Auto-Manipulación de Dinero Detectada**\n\nNo puedes modificar tu propio dinero sin aprobación.\nSe ha enviado una solicitud a un superior para revisión.');
            }
            console.log(`[SelfAction] Superior ${interaction.user.tag} self-${subCmd} money ${cantidad} - Allowed`);
        }

        // Initialize UnbelievaBoat Service
        const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
        const ubToken = process.env.UNBELIEVABOAT_TOKEN;

        if (!ubToken) {
            return interaction.editReply('❌ Error de configuración: UNBELIEVABOAT_TOKEN no definido.');
        }

        const ubService = new UnbelievaBoatService(ubToken, supabase);

        try {
            // Check Current Balance First
            const balancePromise = ubService.getUserBalance(interaction.guildId, targetUser.id);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('UB Timeout')), 10000));
            const balance = await Promise.race([balancePromise, timeoutPromise]);

            const currentCash = balance.cash || 0;
            const currentBank = balance.bank || 0;

            if (subCmd === 'quitar' && currentCash < cantidad) {
                return interaction.editReply(`❌ ${targetUser.tag} solo tiene $${currentCash.toLocaleString()} en efectivo. No se puede quitar $${cantidad.toLocaleString()}.`);
            }

            // Execute Transaction
            let transactionResult;
            if (subCmd === 'añadir') {
                transactionResult = await ubService.addMoney(interaction.guildId, targetUser.id, cantidad, `Admin: ${razon}`, 'cash');
            } else {
                transactionResult = await ubService.removeMoney(interaction.guildId, targetUser.id, cantidad, `Admin: ${razon}`, 'cash');
            }

            if (!transactionResult || !transactionResult.newBalance) {
                throw new Error('Transaction result invalid');
            }

            const newCash = transactionResult.newBalance.cash;

            // Log to enhanced audit system
            const auditService = new AuditService(supabase, client);
            await auditService.logTransaction({
                guildId: interaction.guildId,
                userId: targetUser.id,
                transactionType: subCmd === 'añadir' ? 'admin_add' : 'admin_remove',
                amount: subCmd === 'añadir' ? cantidad : -cantidad,
                currencyType: 'cash',
                reason: razon,
                metadata: {
                    previous_balance: currentCash,
                    new_balance: newCash,
                    admin_action: true
                },
                createdBy: interaction.user.id,
                createdByTag: interaction.user.tag,
                commandName: 'dinero',
                interactionId: interaction.id,
                canRollback: true
            }).catch(e => console.error('[AUDIT] Failed to log:', e.message));

            // Log to audit
            const auditEmbed = new EmbedBuilder()
                .setTitle(`💰 ${subCmd === 'añadir' ? 'Dinero Añadido' : 'Dinero Quitado'}`)
                .setColor(subCmd === 'añadir' ? '#00FF00' : '#FFA500')
                .addFields(
                    { name: '👤 Usuario Afectado', value: `<@${targetUser.id}>`, inline: true },
                    { name: '💵 Cantidad', value: `$${cantidad.toLocaleString()}`, inline: true },
                    { name: '💼 Balance Anterior', value: `$${currentCash.toLocaleString()}`, inline: true },
                    { name: '💼 Balance Nuevo', value: `$${newCash.toLocaleString()}`, inline: true },
                    { name: '👮 Autorizado por', value: `<@${interaction.user.id}>`, inline: false },
                    { name: '📝 Razón', value: razon, inline: false }
                )
                .setTimestamp();

            // Log to audit channel
            const AUDIT_CHANNEL_ID = process.env.AUDIT_LOGS_CHANNEL_ID || '1450610756663115879';
            console.log(`[DINERO] Audit Logging: Target ID=${AUDIT_CHANNEL_ID}`);

            try {
                const logChannel = await client.channels.fetch(AUDIT_CHANNEL_ID).catch(err => {
                    console.error(`[DINERO] Failed to fetch audit channel ${AUDIT_CHANNEL_ID}:`, err.message);
                    return null;
                });

                if (logChannel) {
                    console.log(`[DINERO] Audit channel found: ${logChannel.name}. Sending log...`);
                    await logChannel.send({ embeds: [auditEmbed] })
                        .then(() => console.log(`[DINERO] Audit log sent successfully to ${AUDIT_CHANNEL_ID}`))
                        .catch(err => console.error(`[DINERO] Failed to send audit log to ${AUDIT_CHANNEL_ID}:`, err.message));
                } else {
                    console.warn(`[DINERO] Audit channel NOT FOUND or bot has no access: ${AUDIT_CHANNEL_ID}`);
                }
            } catch (e) {
                console.error('[DINERO] Error in audit logging block:', e.message);
            }

            // Success response
            const successEmbed = new EmbedBuilder()
                .setTitle(`✅ Operación Completada`)
                .setColor('#00FF00')
                .setDescription(`Se ${subCmd === 'añadir' ? 'añadió' : 'quitó'} **$${cantidad.toLocaleString()}** ${subCmd === 'añadir' ? 'a' : 'de'} ${targetUser.tag}`)
                .addFields(
                    { name: '💼 Balance Nuevo', value: `$${newCash.toLocaleString()}`, inline: true },
                    { name: '📝 Razón', value: razon, inline: false }
                )
                .setFooter({ text: `Operación administrativa por ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ content: null, embeds: [successEmbed] });

            // Notify user via DM
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`💰 Ajuste Administrativo`)
                    .setColor(subCmd === 'añadir' ? '#00FF00' : '#FFA500')
                    .setDescription(`Se ${subCmd === 'añadir' ? 'añadió' : 'quitó'} **$${cantidad.toLocaleString()}** ${subCmd === 'añadir' ? 'a' : 'de'} tu balance de efectivo.`)
                    .addFields(
                        { name: '💼 Nuevo Balance', value: `$${newCash.toLocaleString()}`, inline: true },
                        { name: '📝 Razón', value: razon, inline: false }
                    )
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] }).catch(() => { });
            } catch (dmError) {
                console.log('Could not DM user:', dmError.message);
            }
        } catch (error) {
            console.error('[DINERO] Error:', error);
            const errorMsg = error.message === 'UB Timeout'
                ? '🕒 La API de UnbelievaBoat está tardando demasiado. El dinero se procesará en segundo plano, pero no puedo confirmar el balance ahora.'
                : '❌ Error al procesar la transacción con UnbelievaBoat.';

            try {
                await interaction.editReply({ content: errorMsg });
            } catch (e) {
                console.error('[DINERO] FailReply error:', e.message);
            }
        }
    }
};
