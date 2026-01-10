const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const moment = require('moment-timezone');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('temprole')
        .setDescription('⏳ Asignar un rol temporal a un usuario')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a quien dar el rol')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('Rol a asignar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tiempo')
                .setDescription('Duración (ej: 1d, 2h, 30m, 1w)')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        // Permission check
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: '❌ No tienes permisos para gestionar roles.', flags: [64] });
        }

        const targetUser = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('rol');
        const timeString = interaction.options.getString('tiempo'); // "1d", "2h"

        // Basic check to prevent assigning admin roles
        if (role.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ No puedes asignar roles de Administrador temporalmente por seguridad.', flags: [64] });
        }

        // await interaction.deferReply();
        const member = await interaction.guild.members.fetch(targetUser.id);

        // Parse time manually since we don't have a sophisticated parser lib
        let durationMinutes = 0;
        const match = timeString.match(/(\d+)([mhdwd])/);
        if (!match) {
            return interaction.editReply('❌ Formato de tiempo inválido. Usa: 30m, 2h, 1d, 1w.');
        }

        const amount = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'm': durationMinutes = amount; break;
            case 'h': durationMinutes = amount * 60; break;
            case 'd': durationMinutes = amount * 1440; break;
            case 'w': durationMinutes = amount * 10080; break;
        }

        const expiresAt = moment().add(durationMinutes, 'minutes');

        try {
            await member.roles.add(role.id);
        } catch (e) {
            return interaction.editReply('❌ No pude dar el rol. Verifica mi jerarquía de roles.');
        }

        // Save to DB
        await supabase.from('temp_roles').insert({
            guild_id: interaction.guildId,
            user_id: targetUser.id,
            role_id: role.id,
            expires_at: expiresAt.toISOString(),
            assigned_by: interaction.user.id
        });

        const embed = new EmbedBuilder()
            .setTitle('⏳ Rol Temporal Asignado')
            .setColor('#F1C40F')
            .addFields(
                { name: 'Usuario', value: `<@${targetUser.id}>`, inline: true },
                { name: 'Rol', value: `<@&${role.id}>`, inline: true },
                { name: 'Duración', value: timeString, inline: true },
                { name: 'Expira', value: `<t:${Math.floor(expiresAt.valueOf() / 1000)}:R>`, inline: false }
            );

        await interaction.editReply({ embeds: [embed] });
    }
};
