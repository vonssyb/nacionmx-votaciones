const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const AuditService = require('../../services/AuditService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('auditar')
        .setDescription('🔍 Ver registros de auditoría y transacciones (Staff)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('usuario')
                .setDescription('Ver historial de transacciones de un usuario')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario a consultar').setRequired(true))
                .addIntegerOption(option => option.setName('limite').setDescription('Cantidad de registros (máx 50)').setMinValue(5).setMaxValue(50)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('sospechosas')
                .setDescription('Ver transacciones sospechosas recientes')),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply({ flags: [64] });

        const juntaDirectivaRoleId = '1412882245735420006';

        // Permission Check
        if (!interaction.member.roles.cache.has(juntaDirectivaRoleId) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply('❌ Solo el staff puede acceder a los registros de auditoría.');
        }

        const subCmd = interaction.options.getSubcommand();
        const auditService = new AuditService(supabase, client);

        if (subCmd === 'usuario') {
            const targetUser = interaction.options.getUser('usuario');
            const limit = interaction.options.getInteger('limite') || 20;

            const transactions = await auditService.getUserTransactionHistory(
                interaction.guildId,
                targetUser.id,
                limit
            );

            if (!transactions || transactions.length === 0) {
                return interaction.editReply(`📊 No se encontraron transacciones para ${targetUser.tag}.`);
            }

            const embed = new EmbedBuilder()
                .setTitle(`📋 Historial de Transacciones`)
                .setDescription(`Usuario: ${targetUser.tag}\nÚltimas ${transactions.length} transacciones`)
                .setColor('#00AAC0')
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            const transactionText = transactions.slice(0, 10).map(t => {
                const date = new Date(t.created_at).toLocaleDateString('es-MX');
                const time = new Date(t.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                const amount = t.amount ? `$${Math.abs(t.amount).toLocaleString()}` : 'N/A';
                const status = t.rolled_back ? ' ❌ (REVERTIDO)' : '';
                return `\`${date} ${time}\` | **${t.transaction_type}** | ${amount}${status}\n   ${t.reason || 'Sin razón'}`;
            }).join('\n\n');

            embed.addFields({
                name: '📊 Transacciones',
                value: transactionText.substring(0, 1024)
            });

            if (transactions.length > 10) {
                embed.setFooter({ text: `Mostrando 10 de ${transactions.length} registros` });
            }

            await interaction.editReply({ embeds: [embed] });
        }

        else if (subCmd === 'sospechosas') {
            const suspicious = await auditService.getSuspiciousTransactions(interaction.guildId);

            if (!suspicious || suspicious.length === 0) {
                return interaction.editReply('✅ No se detectaron transacciones sospechosas recientes.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🚨 Transacciones Sospechosas')
                .setDescription(`Se encontraron ${suspicious.length} transacciones que requieren revisión`)
                .setColor('#FF0000')
                .setTimestamp();

            const suspiciousText = suspicious.slice(0, 5).map(t => {
                const date = new Date(t.created_at).toLocaleDateString('es-MX');
                const amount = t.amount ? `$${Math.abs(t.amount).toLocaleString()}` : 'N/A';
                return `**ID: #${t.id}**\n` +
                    `👤 <@${t.user_id}> | ${t.transaction_type}\n` +
                    `💰 ${amount} | ${t.suspicion_reason}\n` +
                    `📝 ${t.reason || 'Sin razón'} | \`${date}\``;
            }).join('\n\n');

            embed.addFields({
                name: '⚠️ Alertas Detectadas',
                value: suspiciousText
            });

            embed.setFooter({ text: 'Revisa estas transacciones y toma acción si es necesario' });

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
