const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('🪙 Duelo de Cara o Cruz (1v1)')
        .addUserOption(option =>
            option.setName('oponente')
                .setDescription('Usuario a desafiar')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas a apostar')
                .setRequired(true)
                .setMinValue(50)
                .setMaxValue(10000)),

    async execute(interaction, client, supabase) {
        const userId = interaction.user.id;
        const opponent = interaction.options.getUser('oponente');
        const bet = interaction.options.getInteger('apuesta');

        if (opponent.id === userId) return interaction.reply({ content: '❌ No puedes jugar contra ti mismo.', ephemeral: true });
        if (opponent.bot) return interaction.reply({ content: '❌ No puedes jugar contra bots.', ephemeral: true });

        // Load Service
        // Assuming client.casinoService is available, or use new instance for simple transactions
        let casino = client.casinoService;
        if (!casino) casino = new CasinoService(supabase);

        // Check challenger balance
        const check1 = await casino.checkChips(userId, bet);
        if (!check1.hasEnough) return interaction.reply({ content: check1.message, ephemeral: true });

        // Check opponent balance (we assume they have it for now, but really should check before challenging)
        // But we can't block unless we query. Let's query.
        const check2 = await casino.checkChips(opponent.id, bet);
        if (!check2.hasEnough) {
            return interaction.reply({
                content: `❌ <@${opponent.id}> no tiene suficientes fichas para aceptar la apuesta.`,
                ephemeral: true
            });
        }

        // Send challenge
        const embed = new EmbedBuilder()
            .setTitle('🪙 Desafío de Coinflip')
            .setDescription(`<@${userId}> ha desafiado a <@${opponent.id}> a un duelo.\n\n💰 **Apuesta:** ${bet} fichas`)
            .setColor('#F1C40F')
            .setFooter({ text: 'Tienen 30 segundos para aceptar' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cf_accept').setLabel('Aceptar').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('cf_decline').setLabel('Rechazar').setStyle(ButtonStyle.Danger).setEmoji('✖️')
        );

        const msg = await interaction.reply({
            content: `<@${opponent.id}>`,
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        const filter = i => i.user.id === opponent.id && (i.customId === 'cf_accept' || i.customId === 'cf_decline');

        try {
            const confirmation = await msg.awaitMessageComponent({ filter, time: 30000 });

            if (confirmation.customId === 'cf_decline') {
                await confirmation.update({ content: '❌ Desafío rechazado.', embeds: [], components: [] });
                return;
            }

            // Accepted
            await confirmation.update({ content: '✅ Desafío aceptado. Girando moneda...', components: [] });

            // Animate
            const frames = ['🪙', '✨', '🪙', '✨'];
            for (const f of frames) {
                await interaction.editReply(f).catch(() => { });
                await new Promise(r => setTimeout(r, 500));
            }

            // Execute via CasinoService (Atomic PvP)
            const result = await casino.playCoinflipDuel(userId, opponent.id, bet);

            if (result.error) {
                return interaction.editReply({
                    content: null,
                    embeds: [new EmbedBuilder().setTitle('❌ Error').setDescription(result.error).setColor('#E74C3C')]
                });
            }

            // Build Result Embed
            const resultEmbed = new EmbedBuilder()
                .setTitle('🪙 Resultado del Coinflip')
                .setDescription(
                    `🏆 Ganador: <@${result.winnerId}>\n` +
                    `💀 Perdedor: <@${result.loserId}>\n\n` +
                    `💰 Pozo: **${bet * 2}** fichas\n` +
                    `🏛️ Comisión (5%): **${result.tax}** fichas\n` +
                    `💵 Ganancia Neta: **${result.winAmount}** fichas\n\n` +
                    `📊 Balance Ganador: **${result.winnerNewBalance.toLocaleString()}**\n` +
                    `📉 Balance Perdedor: **${result.loserNewBalance.toLocaleString()}**`
                )
                .setColor('#2ECC71')
                .setThumbnail(result.winnerId === userId ? interaction.user.displayAvatarURL() : opponent.displayAvatarURL());

            await interaction.editReply({ content: null, embeds: [resultEmbed] });

        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: '⏱️ El desafío expiró o ocurrió un error.', components: [] });
        }
    }
};
