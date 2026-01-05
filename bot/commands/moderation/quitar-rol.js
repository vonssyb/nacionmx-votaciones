const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quitar-rol')
        .setDescription('➖ Quitar un rol de un usuario (Solo Staff)')
        .addUserOption(option => option.setName('usuario').setDescription('Usuario al que quitar rol').setRequired(true))
        .addRoleOption(option => option.setName('rol').setDescription('Rol a quitar').setRequired(true))
        .addStringOption(option => option.setName('razon').setDescription('Razón del cambio').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Staff role check
        const STAFF_ROLE_ID = '1412887167654690908';
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isStaff) {
            return interaction.editReply('❌ Solo el staff puede gestionar roles.');
        }

        const targetUser = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('rol');
        const razon = interaction.options.getString('razon') || 'No especificada';

        try {
            const member = await interaction.guild.members.fetch(targetUser.id);

            // Check if user doesn't have the role
            if (!member.roles.cache.has(role.id)) {
                return interaction.editReply(`⚠️ ${targetUser.tag} no tiene el rol ${role.name}.`);
            }

            // Remove role
            await member.roles.remove(role);

            const embed = new EmbedBuilder()
                .setTitle('✅ Rol Removido')
                .setColor('#FF0000')
                .addFields(
                    { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
                    { name: '🎭 Rol', value: `${role.name}`, inline: true },
                    { name: '👮 Por', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Razón', value: razon, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[quitar-rol] Error:', error);
            await interaction.editReply('❌ Error al quitar el rol. Verifica que el bot tenga permisos suficientes.');
        }
    }
};
