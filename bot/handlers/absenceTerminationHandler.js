const { EmbedBuilder, PermissionFlagBits } = require('discord.js');
const logger = require('../services/Logger');

const ROLE_AUSENTE = '1465141044768276631';
const LOG_CHANNEL = '1457457209268109516';

// High command roles that can terminate any absence
const HIGH_COMMAND_ROLES = [
    '1457457207309082644', // Example: Director General
    '1457457207309082643', // Example: Subdirector
    // Add more high command role IDs as needed
];

/**
 * Handler for Absence Termination Button
 * Handles: end_absence_{userId}_{creatorId}
 */
module.exports = async (interaction, client, supabase) => {
    try {
        if (!interaction.customId.startsWith('end_absence_')) {
            return false;
        }

        await interaction.deferReply({ ephemeral: true });

        const parts = interaction.customId.split('_');
        const targetUserId = parts[2];
        const creatorId = parts[3];

        // Fetch target member
        const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
        if (!targetMember) {
            return interaction.editReply('❌ No se pudo encontrar al usuario.');
        }

        // Permission check: Must be the person on leave OR high command
        const isTargetUser = interaction.user.id === targetUserId;
        const isHighCommand = interaction.member.roles.cache.some(role => HIGH_COMMAND_ROLES.includes(role.id));
        const hasManageRoles = interaction.member.permissions.has(PermissionFlagBits.ManageRoles);

        if (!isTargetUser && !isHighCommand && !hasManageRoles) {
            return interaction.editReply('❌ Solo el staff en ausencia, alto mando, o alguien con permisos de gestión de roles puede finalizar esta ausencia.');
        }

        // Remove role
        if (targetMember.roles.cache.has(ROLE_AUSENTE)) {
            await targetMember.roles.remove(ROLE_AUSENTE, `Ausencia finalizada por ${interaction.user.tag}`);
        }

        const endEmbed = new EmbedBuilder()
            .setTitle('✅ Ausencia Finalizada Anticipadamente')
            .setDescription(`La ausencia de **${targetMember.displayName}** ha sido finalizada.`)
            .addFields(
                { name: '👤 Usuario', value: `${targetMember}`, inline: true },
                { name: '🛡️ Finalizado por', value: `${interaction.user}`, inline: true },
                { name: '📅 Fecha', value: new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }
            )
            .setColor('#00FF00')
            .setTimestamp();

        // Update original message
        await interaction.message.edit({
            embeds: [interaction.message.embeds[0]],
            components: [] // Remove button
        });

        await interaction.editReply({ embeds: [endEmbed] });

        // Send log
        const logChannel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
        if (logChannel) {
            await logChannel.send({ embeds: [endEmbed] });
        }

        return true;

    } catch (error) {
        logger.errorWithContext('Absence termination handler error', error, interaction);
        await interaction.editReply('❌ Error al finalizar la ausencia.').catch(() => { });
        return false;
    }
};
