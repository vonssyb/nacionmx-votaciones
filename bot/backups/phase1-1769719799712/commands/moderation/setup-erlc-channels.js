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

            // Category where to create the channel
            const CATEGORY_ID = '1398888365817856152';

            // Emergency roles
            const emergencyRoles = Object.values(config.EMERGENCY_ROLES);

            // Create #911-emergencias (read-only for emergency roles)
            const emergencyChannel = await guild.channels.create({
                name: '911-emergencias',
                type: ChannelType.GuildText,
                parent: CATEGORY_ID,
                topic: '🚨 Alertas de emergencia desde ERLC - SOLO LECTURA',
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
                    })),
                    // Allow admins to see and manage
                    {
                        id: '1412882248411381872', // Administración
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]
                    }
                ]
            });

            const statusMsg = `✅ **Canal creado exitosamente**\n\n` +
                `📢 Canal: <#${emergencyChannel.id}>\n` +
                `📁 Categoría: Existente\n\n` +
                `🔒 **Permisos configurados:**\n` +
                `✅ Policía, Bomberos, Paramédicos, Militares - **Solo lectura**\n` +
                `✅ Administración - **Completo**\n` +
                `❌ @everyone - **Oculto**\n\n` +
                `📝 **ID del canal:** \`${emergencyChannel.id}\`\n` +
                `⚠️ Actualiza este ID en \`erlcEconomyEmergency.js\` si es necesario`;

            await interaction.editReply(statusMsg);

        } catch (error) {
            console.error('[setup-erlc-channels] Error:', error);
            await interaction.editReply('❌ Error creando canal: ' + error.message);
        }
    }
};
