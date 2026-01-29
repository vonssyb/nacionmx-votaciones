const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const BackupService = require('../../services/BackupService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('🗄️ Sistema de backups de base de datos (Solo Administradores)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('crear')
                .setDescription('Crear backup manual de la base de datos'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('estado')
                .setDescription('Ver estado de backups recientes')),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply({ flags: [64] });

        // Permission Check - Only Administrators
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply('❌ Solo los administradores pueden gestionar backups.');
        }

        const subCmd = interaction.options.getSubcommand();
        const backupService = new BackupService(supabase);

        if (subCmd === 'crear') {
            await interaction.editReply('⏳ Iniciando backup completo de la base de datos...');

            const result = await backupService.performFullBackup();

            if (result.success) {
                const embed = new EmbedBuilder()
                    .setTitle('✅ Backup Completado')
                    .setColor('#00FF00')
                    .setDescription(`Backup guardado en: \`${path.basename(result.folder)}\``)
                    .setTimestamp();

                // Add results
                for (const [table, info] of Object.entries(result.results)) {
                    if (info.success) {
                        embed.addFields({
                            name: `📊 ${table}`,
                            value: `${info.records} registros exportados`,
                            inline: true
                        });
                    }
                }

                embed.setFooter({ text: `Backups se mantienen por ${backupService.retentionDays} días` });

                await interaction.editReply({ content: '', embeds: [embed] });
            } else {
                await interaction.editReply(`❌ Error creando backup: ${result.error}`);
            }
        }

        else if (subCmd === 'estado') {
            const stats = await backupService.getBackupStats();

            if (!stats || stats.length === 0) {
                return interaction.editReply('📊 No se encontraron backups recientes.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🗄️ Estado de Backups')
                .setDescription(`Últimos ${stats.length} backups disponibles`)
                .setColor('#00AAC0')
                .setTimestamp();

            const backupText = stats.map(b => {
                const date = new Date(b.timestamp).toLocaleString('es-MX');
                const totalRecords = Object.values(b.results)
                    .filter(r => r.success)
                    .reduce((sum, r) => sum + r.records, 0);

                return `**${b.name}**\n📅 ${date}\n📊 ${totalRecords} registros totales`;
            }).join('\n\n');

            embed.addFields({
                name: '📋 Backups Disponibles',
                value: backupText.substring(0, 1024)
            });

            embed.setFooter({ text: `Retención: ${backupService.retentionDays} días` });

            await interaction.editReply({ embeds: [embed] });
        }
    }
};

