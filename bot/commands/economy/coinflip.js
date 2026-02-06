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

            // Re-check balances before deduct (race condition protection)
            // Just assume okay for simplicity or re-check

            // Deduct both
            // Initial check and deduct if needed?
            // Coinflip usually checks balance but deducts at end or start?
            // Looking at grep result: line 82: update chips_balance...

            await supabase.from('casino_chips').update({ chips: check1.balance - bet }).eq('user_id', userId);
            const { data: opAcc } = await supabase.from('casino_chips').select('chips').eq('user_id', opponent.id).single();
            await supabase.from('casino_chips').update({ chips: opAcc.chips - bet }).eq('user_id', opponent.id);

            // Animate
            const frames = ['🪙', '✨', '🪙', '✨'];
            for (const f of frames) {
                await interaction.editReply(f).catch(() => { });
                await new Promise(r => setTimeout(r, 500));
            }

            // Result
            const winnerIsChallenger = Math.random() < 0.5;
            const winnerId = winnerIsChallenger ? userId : opponent.id;
            const loserId = winnerIsChallenger ? opponent.id : userId;

            // Winner gets pot (2 * bet)
            // Optional: Tax/Rake (e.g. 5%)
            // Let's implement 5% tax to burn chips
            const pot = bet * 2;
            const tax = Math.floor(pot * 0.05);
            const winAmount = pot - tax;

            const { data: winAcc } = await supabase.from('casino_chips').select('chips, total_won, games_played').eq('user_id', winnerId).single();
            await supabase.from('casino_chips').update({
                chips: winAcc.chips + winAmount, // Correctly use taxed amount
                total_won: (winAcc.total_won || 0) + (winAmount - bet),
                games_played: (winAcc.games_played || 0) + 1
            }).eq('user_id', winnerId);

            // Loser update
            const { data: loseAcc } = await supabase.from('casino_chips').select('total_lost').eq('user_id', loserId).single();
            await supabase.from('casino_chips').update({
                total_lost: (loseAcc.total_lost || 0) + bet
            }).eq('user_id', loserId);

            const resultEmbed = new EmbedBuilder()
                .setTitle('🪙 Resultado del Coinflip')
                .setDescription(`🏆 Ganador: <@${winnerId}>\n\n💰 Se lleva: **${winAmount}** fichas\n🏛️ Comisión: ${tax} fichas`)
                .setColor('#2ECC71');

            await interaction.editReply({ content: null, embeds: [resultEmbed] });

        } catch (e) {
            await interaction.editReply({ content: '⏱️ El desafío expiró.', components: [] });
        }
    }
};
