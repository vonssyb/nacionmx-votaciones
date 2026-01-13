const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Comandos de usuario')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Muestra información detallada de un usuario')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('El usuario a consultar (opcional)')
                        .setRequired(false))),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const joinDate = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)` : 'N/A';
        const createDate = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F> (<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>)`;

        const roles = member
            ? member.roles.cache
                .filter(role => role.name !== '@everyone')
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString())
                .join(' ')
            : 'N/A';

        const embed = new EmbedBuilder()
            .setColor(member ? member.displayHexColor : '#0099ff')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
            .addFields(
                { name: '🆔 ID', value: targetUser.id, inline: true },
                { name: '👤 Nickname', value: member ? member.displayName : 'N/A', inline: true },
                { name: '🤖 Bot', value: targetUser.bot ? 'Sí' : 'No', inline: true },
                { name: '📅 Fecha de Creación', value: createDate, inline: false },
                { name: '📥 Fecha de Ingreso', value: joinDate, inline: false },
                { name: '🎭 Roles', value: roles.length > 1024 ? `${roles.substring(0, 1020)}...` : (roles || 'Ninguno') }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
