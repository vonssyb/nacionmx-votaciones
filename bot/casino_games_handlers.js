// Casino Games Handlers - Add to index.js after existing /jugar handlers

// In the /jugar command handler, add these cases:

else if (game === 'ruleta') {
    const bet = interaction.options.getInteger('apuesta');
    const color = interaction.options.getString('color');

    if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes. Tienes: ${userChips.chips}`);

    await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

    const wheel = ['rojo', 'negro', 'verde', 'rojo', 'negro', 'rojo', 'negro', 'rojo', 'negro', 'rojo', 'negro', 'rojo', 'negro', 'rojo'];
    const result = wheel[Math.floor(Math.random() * wheel.length)];

    await interaction.editReply('🎯 Girando la ruleta...');
    await sleep(1500);

    let win = 0;
    if (result === color) {
        win = color === 'verde' ? bet * 14 : bet * 2;
    }

    if (win > 0) {
        await supabase.from('casino_chips').update({ chips: userChips.chips - bet + win, total_won: (userChips.total_won || 0) + win, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
        return interaction.editReply(`🎯 **${result.toUpperCase()}**\n✅ ¡GANASTE! +${win} fichas`);
    } else {
        await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
        return interaction.editReply(`🎯 **${result.toUpperCase()}**\n❌ Perdiste ${bet} fichas`);
    }
}

else if (game === 'crash') {
    const bet = interaction.options.getInteger('apuesta');

    if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes`);

    await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

    const crashPoint = (Math.random() * 9 + 1).toFixed(2); // 1.00x to 10.00x
    let currentMultiplier = 1.00;

    const embed = new EmbedBuilder()
        .setTitle('🚀 CRASH GAME')
        .setColor('#FFA500')
        .setDescription(`Multiplicador: **${currentMultiplier.toFixed(2)}x**\nApuesta: ${bet} fichas`)
        .setFooter({ text: 'Presiona SALIR para cobrar' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('crash_cashout')
                .setLabel('💰 SALIR')
                .setStyle(ButtonStyle.Success)
        );

    await interaction.editReply({ embeds: [embed], components: [row] });

    const filter = i => i.user.id === interaction.user.id && i.customId === 'crash_cashout';
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 10000, max: 1 });

    const interval = setInterval(async () => {
        currentMultiplier += 0.10;
        if (currentMultiplier >= parseFloat(crashPoint)) {
            clearInterval(interval);
            embed.setDescription(`💥 **CRASH EN ${crashPoint}x**\nPerdiste ${bet} fichas`);
            embed.setColor('#FF0000');
            await interaction.editReply({ embeds: [embed], components: [] });
            await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            collector.stop();
        } else {
            embed.setDescription(`Multiplicador: **${currentMultiplier.toFixed(2)}x**\nPotencial: ${Math.floor(bet * currentMultiplier)} fichas`);
            await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => { });
        }
    }, 500);

    collector.on('collect', async i => {
        clearInterval(interval);
        const winAmount = Math.floor(bet * currentMultiplier);
        await supabase.from('casino_chips').update({ chips: userChips.chips - bet + winAmount, total_won: (userChips.total_won || 0) + winAmount, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
        embed.setDescription(`✅ **Saliste en ${currentMultiplier.toFixed(2)}x**\nGanaste ${winAmount} fichas`);
        embed.setColor('#00FF00');
        await i.update({ embeds: [embed], components: [] });
    });
}

else if (game === 'caballos') {
    const bet = interaction.options.getInteger('apuesta');
    const caballo = interaction.options.getInteger('caballo');

    if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes`);

    await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

    await interaction.editReply('🏇 Carrera iniciando...');
    await sleep(800);

    const winner = Math.floor(Math.random() * 4) + 1;

    if (winner === caballo) {
        const winAmount = bet * 3;
        await supabase.from('casino_chips').update({ chips: userChips.chips - bet + winAmount, total_won: (userChips.total_won || 0) + winAmount, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
        return interaction.editReply(`🏇 Caballo ${winner} GANÓ!\n✅ ¡Acertaste! +${winAmount} fichas`);
    } else {
        await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
        return interaction.editReply(`🏇 Caballo ${winner} ganó\n❌ Perdiste ${bet} fichas`);
    }
}

else if (game === 'gallos') {
    const bet = interaction.options.getInteger('apuesta');
    const gallo = interaction.options.getString('gallo');

    if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes`);

    await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

    await interaction.editReply('🐓 Pelea iniciando...');
    await sleep(1200);

    const winner = Math.random() > 0.5 ? 'rojo' : 'azul';

    if (winner === gallo) {
        const winAmount = bet * 2;
        await supabase.from('casino_chips').update({ chips: userChips.chips - bet + winAmount, total_won: (userChips.total_won || 0) + winAmount, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
        return interaction.editReply(`🐓 Gallo ${winner.toUpperCase()} ganó!\n✅ +${winAmount} fichas`);
    } else {
        await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
        return interaction.editReply(`🐓 Gallo ${winner.toUpperCase()} ganó\n❌ -${bet} fichas`);
    }
}

else if (game === 'rusa') {
    const bet = interaction.options.getInteger('apuesta');

    if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes`);

    await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

    await interaction.editReply('🔫 Girando el tambor...');
    await sleep(1500);

    const died = Math.random() < (1 / 6); // 1 in 6 chance

    if (died) {
        const loss = bet * 3;
        await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + loss, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
        return interaction.editReply(`🔫💀 **¡BANG!**\nPerdiste ${loss} fichas`);
    } else {
        const winAmount = bet * 2;
        await supabase.from('casino_chips').update({ chips: userChips.chips - bet + winAmount, total_won: (userChips.total_won || 0) + winAmount, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
        return interaction.editReply(`🔫😅 **¡Click! Sobreviviste**\n+${winAmount} fichas`);
    }
}
