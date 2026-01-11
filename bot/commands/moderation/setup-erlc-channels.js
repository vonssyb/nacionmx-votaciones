const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-erlc-channels')
        .setDescription('🔧 Crear canales ERLC automáticamente con permisos configurados (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;
            const config = require('../../config/erlcEconomyEmergency');

            // Emergency roles
            const emergencyRoles = Object.values(config.EMERGENCY_ROLES);

            let statusMsg = '🔧 **Creando estructura de canales ERLC...**\n\n';

            // 1. Create category
            const category = await guild.channels.create({
                name: '🚨 ERLC EMERGENCIAS',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            });

            statusMsg += `✅ Categoría creada: ${category.name}\n`;

            // 2. Create #911-emergencias (read-only for emergency roles)
            const emergencyChannel = await guild.channels.create({
                name: '911-emergencias',
                type: ChannelType.GuildText,
                parent: category.id,
                topic: '🚨 Alertas de emergencia desde ERLC',
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    // Allow all emergency roles to VIEW but not SEND
                    ...emergencyRoles.map(roleId => ({
                        id: roleId,
                        allow: [PermissionFlagsBits.ViewChannel],
                        deny: [PermissionFlagsBits.SendMessages]
                    }))
                ]
            });

            statusMsg += `✅ Canal creado: #${emergencyChannel.name} (solo lectura para servicios de emergencia)\n`;

            // 3. Create #logs-staff (admins only)
            const staffLogsChannel = await guild.channels.create({
                name: 'logs-staff',
                type: ChannelType.GuildText,
                parent: category.id,
                topic: '📊 Logs de transacciones y cobros ERLC',
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: '1412882248411381872', // Administración
                        allow: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: '1412887079612059660', // Staff
                        allow: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            });

            statusMsg += `✅ Canal creado: #${staffLogsChannel.name} (solo staff)\n\n`;

            // Update config file
            statusMsg += `📝 **IDs de Canales Creados:**\n`;
            statusMsg += `\`\`\`\n`;
            statusMsg += `EMERGENCY_911: '${emergencyChannel.id}'\n`;
            statusMsg += `STAFF_LOGS: '${staffLogsChannel.id}'\n`;
            statusMsg += `\`\`\`\n\n`;
            statusMsg += `⚠️ **Siguiente paso:** Actualiza estos IDs en \`bot/config/erlcEconomyEmergency.js\``;

            await interaction.editReply(statusMsg);

        } catch (error) {
            console.error('[setup-erlc-channels] Error:', error);
            await interaction.editReply('❌ Error creando canales: ' + error.message);
        }
    }
};
