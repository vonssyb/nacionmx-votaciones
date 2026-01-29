const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Helper for parsing time locally
function parseTime(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)([smhd])$/);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case 's': return val * 1000;
        case 'm': return val * 60 * 1000;
        case 'h': return val * 3600 * 1000;
        case 'd': return val * 86400 * 1000;
        default: return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Sistema de sorteos')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Inicia un sorteo')
                .addStringOption(opt => opt.setName('duration').setDescription('Duración (ej: 1m, 1h, 1d)').setRequired(true))
                .addIntegerOption(opt => opt.setName('winners').setDescription('Número de ganadores').setRequired(true))
                .addStringOption(opt => opt.setName('prize').setDescription('Premio del sorteo').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('end')
                .setDescription('Termina un sorteo anticipadamente')
                .addStringOption(opt => opt.setName('message_id').setDescription('ID del mensaje del sorteo').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('reroll')
                .setDescription('Elige nuevo ganador')
                .addStringOption(opt => opt.setName('message_id').setDescription('ID del mensaje del sorteo').setRequired(true))
        ),
    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'start') {
            const durationStr = interaction.options.getString('duration');
            const winnerCount = interaction.options.getInteger('winners');
            const prize = interaction.options.getString('prize');

            const duration = parseTime(durationStr);
            if (!duration) return interaction.reply({ content: '❌ Formato de tiempo inválido. Usa: 1m, 1h, 1d', ephemeral: true });

            const endTime = Date.now() + duration;
            const endTimestamp = Math.floor(endTime / 1000);

            const embed = new EmbedBuilder()
                .setTitle('🎉 ¡NUEVO SORTEO!')
                .setDescription(`Premio: **${prize}**\n\nGanadores: **${winnerCount}**\nTermina: <t:${endTimestamp}:R>\nOrganizado por: ${interaction.user}`)
                .setColor('#FFD700')
                .setFooter({ text: 'Reacciona con 🎉 para participar!' })
                .setTimestamp(endTime);

            const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
            await msg.react('🎉');

            // Set Timeout (Note: In-memory only for this simple implementation as requested)
            setTimeout(async () => {
                const fetchedMsg = await interaction.channel.messages.fetch(msg.id).catch(() => null);
                if (!fetchedMsg) return;

                const users = await fetchedMsg.reactions.resolve('🎉').users.fetch();
                const filtered = users.filter(u => !u.bot);

                if (filtered.size === 0) {
                    fetchedMsg.reply('😢 Nadie participó en el sorteo.');
                    return;
                }

                const winners = filtered.random(Math.min(winnerCount, filtered.size));
                const winnerList = Array.isArray(winners) ? winners.map(w => w.toString()).join(', ') : winners.toString();

                const endEmbed = EmbedBuilder.from(fetchedMsg.embeds[0])
                    .setTitle('🎉 SORTEO FINALIZADO')
                    .setDescription(`Premio: **${prize}**\n\nGanadores: ${winnerList}\nTerminó: <t:${endTimestamp}:R>`)
                    .setColor('#2ecc71');

                await fetchedMsg.edit({ embeds: [endEmbed] });
                await fetchedMsg.reply(`🎉 ¡Felicidades ${winnerList}! Ganaste: **${prize}**`);
            }, duration);

        } else if (sub === 'end' || sub === 'reroll') {
            const msgId = interaction.options.getString('message_id');
            const msg = await interaction.channel.messages.fetch(msgId).catch(() => null);

            if (!msg) return interaction.reply({ content: '❌ Mensaje no encontrado en este canal.', ephemeral: true });

            const users = await msg.reactions.resolve('🎉').users.fetch();
            const filtered = users.filter(u => !u.bot);

            if (filtered.size === 0) return interaction.reply('❌ No hay participantes válidos.');

            const winner = filtered.random();
            await msg.reply(`🎉 Nuevo ganador: ${winner.toString()}!`);
            await interaction.reply({ content: '✅ Reroll exitoso.', ephemeral: true });
        }
    }
};
