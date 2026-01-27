const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: {
        name: 'smartrole',
        description: 'Asignar rol condicionalmente (Solo si NO tiene el rol de exclusión)',
        options: [
            {
                name: 'usuario',
                description: 'Usuario a quien asignar el rol',
                type: 6, // USER
                required: true
            },
            {
                name: 'rol_asignar',
                description: 'El rol que quieres dar',
                type: 8, // ROLE
                required: true
            },
            {
                name: 'rol_exclusion',
                description: 'Si tiene este rol, NO se le dará el nuevo',
                type: 8, // ROLE
                required: true
            }
        ],
        type: 1
    },
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: '❌ No tienes permisos para gestionar roles.', ephemeral: true });
        }

        const targetUser = interaction.options.getMember('usuario');
        const roleToGive = interaction.options.getRole('rol_asignar');
        const roleToExclude = interaction.options.getRole('rol_exclusion');

        if (!targetUser) {
            return interaction.reply({ content: '❌ Usuario no encontrado en el servidor.', ephemeral: true });
        }

        // Check for exclusion role
        if (targetUser.roles.cache.has(roleToExclude.id)) {
            return interaction.reply({
                content: `⚠️ **Operación Cancelada**: El usuario ${targetUser} ya tiene el rol ${roleToExclude} (Exclusión), por lo tanto no se le asignó ${roleToGive}.`,
                ephemeral: true
            });
        }

        // Check if already has the target role
        if (targetUser.roles.cache.has(roleToGive.id)) {
            return interaction.reply({ content: `ℹ️ El usuario ya tiene el rol ${roleToGive}.`, ephemeral: true });
        }

        try {
            await targetUser.roles.add(roleToGive);
            return interaction.reply({
                content: `✅ **Éxito**: Se ha asignado el rol ${roleToGive} a ${targetUser} (No tenía ${roleToExclude}).`,
                ephemeral: false
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({
                content: `❌ **Error**: No pude asignar el rol. Verifica que mi rol esté por encima del rol a asignar.`,
                ephemeral: true
            });
        }
    }
};
