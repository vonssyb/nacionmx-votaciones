const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const CasinoService = require('../../services/CasinoService');
const EventService = require('../../services/EventService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pvp')
        .setDescription('⚔️ Juegos de Casino PvP (Jugador vs Jugador)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('dados')
                .setDescription('🎲 Duelo de dados contra otro usuario')
                .addUserOption(option => option.setName('oponente').setDescription('Usuario a desafiar').setRequired(true))
                .addIntegerOption(option => option.setName('apuesta').setDescription('Cantidad de fichas a apostar').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('coinflip')
                .setDescription('🪙 Duelo de Cara o Cruz')
                .addUserOption(option => option.setName('oponente').setDescription('Usuario a desafiar').setRequired(true))
                .addIntegerOption(option => option.setName('apuesta').setDescription('Cantidad de fichas a apostar').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rps')
                .setDescription('✂️ Piedra, Papel o Tijera')
                .addUserOption(option => option.setName('oponente').setDescription('Usuario a desafiar').setRequired(true))
                .addIntegerOption(option => option.setName('apuesta').setDescription('Cantidad de fichas a apostar').setRequired(true).setMinValue(1))),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred) await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const opponent = interaction.options.getUser('oponente');
        const betAmount = interaction.options.getInteger('apuesta');
        const challenger = interaction.user;

        // Validations
        if (opponent.id === challenger.id) return interaction.editReply('❌ No puedes desafiarte a ti mismo.');
        if (opponent.bot) return interaction.editReply('❌ No puedes desafiar a un bot.');

        const casinoService = new CasinoService(supabase);

        // Check balances for both players
        const challengerCheck = await casinoService.checkChips(challenger.id, betAmount);
        if (!challengerCheck.hasEnough) return interaction.editReply(`❌ No tienes suficientes fichas. Tienes: ${challengerCheck.balance}`);

        const opponentCheck = await casinoService.checkChips(opponent.id, betAmount);
        if (!opponentCheck.hasEnough) return interaction.editReply(`❌ <@${opponent.id}> no tiene suficientes fichas.`);

        // Determine House Fee (Tax) based on Events
        // If 'LUCKY_DAY' or 'CASINO_LUCK' event is active, fee is 0%
        let houseFeePercent = 0.05; // 5% default
        const activeEvent = await EventService.getActiveEvent(supabase);

        if (activeEvent && (activeEvent.event_type === 'LUCKY_DAY' || activeEvent.event_type === 'CASINO_LUCK')) {
            houseFeePercent = 0;
        }

        const totalPot = betAmount * 2;
        const houseFee = Math.floor(totalPot * houseFeePercent);
        const winnerPrize = totalPot - houseFee;

        // Challenge Embed
        const embed = new EmbedBuilder()
            .setTitle(`⚔️ Desafío PvP: ${subcommand.toUpperCase()}`)
            .setDescription(`<@${challenger.id}> desafía a <@${opponent.id}> por **${betAmount.toLocaleString()} fichas** cada uno.`)
            .addFields(
                { name: '💰 Pozo Total', value: `${totalPot.toLocaleString()}`, inline: true },
                { name: '🏆 Premio Ganador', value: `${winnerPrize.toLocaleString()}`, inline: true },
                { name: '🏦 Tarifa Casa', value: `${houseFee.toLocaleString()} (${houseFeePercent * 100}%)`, inline: true }
            )
            .setColor('#F1C40F')
            .setFooter({ text: 'Tienen 30 segundos para aceptar.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept').setLabel('✅ Aceptar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('deny').setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.editReply({ content: `<@${opponent.id}>`, embeds: [embed], components: [row] });

        // Collector
        const filter = i => [challenger.id, opponent.id].includes(i.user.id) && ['accept', 'deny'].includes(i.customId);
        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'deny') {
                if (i.user.id !== opponent.id && i.user.id !== challenger.id) return i.reply({ content: 'No puedes cancelar este duelo.', ephemeral: true });

                await i.update({ content: '🚫 Desafío cancelado.', components: [] });
                return collector.stop('cancelled');
            }

            if (i.customId === 'accept') {
                if (i.user.id !== opponent.id) return i.reply({ content: 'Solo el oponente puede aceptar.', ephemeral: true });

                // Re-check balances before starting (atomic-like check)
                const cCheck = await casinoService.checkChips(challenger.id, betAmount);
                const oCheck = await casinoService.checkChips(opponent.id, betAmount);

                if (!cCheck.hasEnough || !oCheck.hasEnough) {
                    await i.update({ content: '❌ Alguien ya no tiene suficientes fichas. Desafío cancelado.', components: [] });
                    return collector.stop('insufficient_funds');
                }

                // Deduct chips from both
                await casinoService.removeChips(challenger.id, betAmount);
                await casinoService.removeChips(opponent.id, betAmount);

                // Start Game Logic
                let winnerId = null;
                let gameDescription = '';

                if (subcommand === 'dados') {
                    const roll1 = Math.floor(Math.random() * 6) + 1;
                    const roll2 = Math.floor(Math.random() * 6) + 1;

                    gameDescription = `🎲 **${challenger.username}** tiró: \`${roll1}\`\n🎲 **${opponent.username}** tiró: \`${roll2}\`\n\n`;

                    if (roll1 > roll2) winnerId = challenger.id;
                    else if (roll2 > roll1) winnerId = opponent.id;
                    else {
                        // Tie - Refund
                        await casinoService.addChips(challenger.id, betAmount);
                        await casinoService.addChips(opponent.id, betAmount);
                        await i.update({
                            content: null,
                            embeds: [new EmbedBuilder().setTitle('🤝 Empate').setDescription(gameDescription + '¡Nadie gana! Se devolvieron las apuestas.').setColor('#95A5A6')],
                            components: []
                        });
                        return collector.stop('finished');
                    }
                } else if (subcommand === 'coinflip') {
                    const outcome = Math.random() < 0.5 ? 'Cara' : 'Cruz';
                    // Challenger picks 'Cara' by default for simplicity in V1
                    const winner = outcome === 'Cara' ? challenger : opponent;
                    winnerId = winner.id;
                    gameDescription = `🪙 La moneda cayó en: **${outcome}**\n`;
                } else if (subcommand === 'rps') {
                    // Quick simulation for RPS as interactions are tricky in a single flow without more buttons
                    // For V1, we simulate random choices to keep it fast
                    const choices = ['Piedra 🪨', 'Papel 📄', 'Tijera ✂️'];
                    const cChoice = choices[Math.floor(Math.random() * 3)];
                    const oChoice = choices[Math.floor(Math.random() * 3)];

                    gameDescription = `**${challenger.username}**: ${cChoice}\n**${opponent.username}**: ${oChoice}\n\n`;

                    if (cChoice === oChoice) {
                        await casinoService.addChips(challenger.id, betAmount);
                        await casinoService.addChips(opponent.id, betAmount);
                        await i.update({
                            content: null,
                            embeds: [new EmbedBuilder().setTitle('🤝 Empate').setDescription(gameDescription + '¡Nadie gana! Se devolvieron las apuestas.').setColor('#95A5A6')],
                            components: []
                        });
                        return collector.stop('finished');
                    }

                    if (
                        (cChoice.includes('Piedra') && oChoice.includes('Tijera')) ||
                        (cChoice.includes('Papel') && oChoice.includes('Piedra')) ||
                        (cChoice.includes('Tijera') && oChoice.includes('Papel'))
                    ) {
                        winnerId = challenger.id;
                    } else {
                        winnerId = opponent.id;
                    }
                }

                // Payout Winner
                await casinoService.addChips(winnerId, winnerPrize);
                // Update stats
                await casinoService.updateStats(winnerId, winnerPrize, true);
                const loserId = winnerId === challenger.id ? opponent.id : challenger.id;
                await casinoService.updateStats(loserId, betAmount, false);

                await i.update({
                    content: null,
                    embeds: [new EmbedBuilder()
                        .setTitle(`🏆 Ganador: ${winnerId === challenger.id ? challenger.username : opponent.username}`)
                        .setDescription(gameDescription + `Ganó **${winnerPrize.toLocaleString()} fichas**!`)
                        .setColor('#F1C40F')
                        .setFooter({ text: houseFee > 0 ? `Tarifa de la casa: ${houseFee} fichas` : '🔥 ¡Sin tarifa de la casa por Evento!' })
                    ],
                    components: []
                });

                collector.stop('finished');
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                msg.edit({ content: '⏱️ Tiempo agotado. Desafío cancelado.', components: [] });
            }
        });
    }
};
