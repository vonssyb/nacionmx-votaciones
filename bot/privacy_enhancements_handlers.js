// PRIVACY ENHANCEMENTS HANDLERS
// Add these to the /privacidad command handler in index.js

// After existing handlers, add these new subcommands:

else if (subCmd === 'trial') {
    // Check if already used trial
    if (privacyData && privacyData.trial_used) {
        return interaction.editReply('❌ Ya usaste tu prueba gratis de 3 días');
    }

    const { data: existingTrial } = await supabase
        .from('privacy_accounts')
        .select('trial_used')
        .eq('user_id', userId)
        .maybeSingle();

    if (existingTrial?.trial_used) {
        return interaction.editReply('❌ Ya usaste tu prueba gratis');
    }

    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

    await supabase.from('privacy_accounts').upsert({
        user_id: userId,
        level: 'basico',
        expires_at: expiresAt.toISOString(),
        trial_used: true,
        activated_at: new Date().toISOString()
    });

    return interaction.editReply(`🎁 **Prueba Gratis Activada!**\n🥉 Privacidad Básica por 3 días\nExpira: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`);
}

else if (subCmd === 'dashboard') {
    if (!privacyData) {
        return interaction.editReply('❌ No tienes privacidad activa');
    }

    // Calculate privacy score
    const { data: scoreData } = await supabase.rpc('calculate_privacy_score', { p_user_id: userId });
    const score = scoreData || 0;

    const { data: vault } = await supabase.from('privacy_vault').select('amount').eq('user_id', userId).maybeSingle();
    const { data: alertsCount } = await supabase.from('privacy_alerts').select('id', { count: 'exact' }).eq('user_id', userId).eq('read', false);

    const icons = { basico: '🥉', vip: '🥈', elite: '🥇' };
    const daysLeft = Math.ceil((new Date(privacyData.expires_at) - new Date()) / (1000 * 60 * 60 * 24));

    const embed = new EmbedBuilder()
        .setTitle('🕶️ Privacy Dashboard')
        .setColor('#2F3136')
        .addFields(
            { name: '📊 Privacy Score', value: `${score}/100 ${score >= 80 ? '🏆' : score >= 50 ? '⭐' : '📈'}`, inline: true },
            { name: '🎫 Nivel', value: `${icons[privacyData.level]} ${privacyData.level.toUpperCase()}`, inline: true },
            { name: '⏰ Expira en', value: `${daysLeft} días`, inline: true },
            { name: '🔒 Bóveda', value: vault ? `$${vault.amount.toLocaleString()}` : '$0', inline: true },
            { name: '🔔 Alertas', value: `${alertsCount?.count || 0} nuevas`, inline: true },
            { name: '💰 Cashback', value: `$${(privacyData.cashback_earned || 0).toLocaleString()}`, inline: true }
        );

    if (privacyData.offshore_name) {
        embed.addFields({ name: '🏝️ Offshore', value: privacyData.offshore_name, inline: true });
    }

    if (privacyData.auto_renew) {
        embed.addFields({ name: '♻️ Auto-Renovación', value: '✅ Activa', inline: true });
    }

    return interaction.editReply({ embeds: [embed] });
}

else if (subCmd === 'recuperar') {
    if (!privacyData || privacyData.level !== 'elite') {
        return interaction.editReply('❌ Solo usuarios Elite pueden tener modo pánico');
    }

    const pin = interaction.options.getString('pin');

    if (privacyData.panic_pin !== pin) {
        return interaction.editReply('❌ PIN incorrecto');
    }

    // Get vault balance
    const { data: vault } = await supabase.from('privacy_vault').select('*').eq('user_id', userId).maybeSingle();

    if (!vault || vault.amount <= 0) {
        return interaction.editReply('❌ No hay fondos en bóveda');
    }

    // Transfer back to bank
    const halfCash = Math.floor(vault.amount / 2);
    const halfBank = vault.amount - halfCash;

    await billingService.ubService.addMoney(interaction.guildId, userId, halfCash, 'Recuperación Pánico', 'cash');
    await billingService.ubService.addMoney(interaction.guildId, userId, halfBank, 'Recuperación Pánico', 'bank');

    // Clear vault and PIN
    await supabase.from('privacy_vault').update({ amount: 0 }).eq('user_id', userId);
    await supabase.from('privacy_accounts').update({ panic_pin: null }).eq('user_id', userId);

    return interaction.editReply(`🔓 **Modo Pánico Desactivado**\n\n💵 Efectivo: $${halfCash.toLocaleString()}\n🏦 Banco: $${halfBank.toLocaleString()}\n✅ Total recuperado: $${vault.amount.toLocaleString()}`);
}

else if (subCmd === 'alertas') {
    const estado = interaction.options.getString('estado');
    const enabled = estado === 'on';

    await supabase.from('privacy_accounts').upsert({
        user_id: userId,
        alerts_enabled: enabled
    }, { onConflict: 'user_id' });

    return interaction.editReply(`🔔 Alertas ${enabled ? '✅ activadas' : '❌ desactivadas'}`);
}

else if (subCmd === 'autorenovar') {
    if (!privacyData) {
        return interaction.editReply('❌ Primero activa privacidad');
    }

    const estado = interaction.options.getString('estado');
    const enabled = estado === 'on';

    await supabase.from('privacy_accounts').update({ auto_renew: enabled }).eq('user_id', userId);

    return interaction.editReply(`♻️ Auto-renovación ${enabled ? '✅ activada' : '❌ desactivada'}\n${enabled ? 'Se renovará automáticamente cada mes' : 'Deberás renovar manualmente'}`);
}

else if (subCmd === 'viaje') {
    const horas = interaction.options.getInteger('horas');
    const costo = 5000 * (horas / 24); // $5k por día

    const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
    if ((balance.cash || 0) < costo) {
        return interaction.editReply(`❌ Fondos insuficientes\nCosto: $${costo.toLocaleString()}`);
    }

    await billingService.ubService.removeMoney(interaction.guildId, userId, costo, 'Modo Viaje', 'cash');

    const expiresAt = new Date(Date.now() + horas * 60 * 60 * 1000);

    await supabase.from('privacy_accounts').upsert({
        user_id: userId,
        level: 'basico',
        expires_at: expiresAt.toISOString(),
        activated_at: new Date().toISOString()
    });

    return interaction.editReply(`✈️ **Modo Viaje Activado**\n🥉 Privacidad Básica por ${horas}h\nCosto: $${costo.toLocaleString()}\nExpira: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`);
}

else if (subCmd === 'referir') {
    const targetUser = interaction.options.getUser('usuario');

    if (targetUser.id === userId) {
        return interaction.editReply('❌ No puedes referirte a ti mismo');
    }

    // Generate or get referral code
    let referralCode = privacyData?.referral_code;
    if (!referralCode) {
        referralCode = `PRIV${userId.slice(-6)}`;
        await supabase.from('privacy_accounts').update({ referral_code: referralCode }).eq('user_id', userId);
    }

    // Check if already referred
    const { data: existingRef } = await supabase
        .from('privacy_referrals')
        .select('*')
        .eq('referee_id', targetUser.id)
        .maybeSingle();

    if (existingRef) {
        return interaction.editReply('❌ Este usuario ya fue referido');
    }

    // Create referral
    await supabase.from('privacy_referrals').insert({
        referrer_id: userId,
        referee_id: targetUser.id
    });

    try {
        await targetUser.send(`🎁 **¡${interaction.user.tag} te refirió al Sistema de Privacidad!**\n\nActiva privacidad con tu código de referido: \`${referralCode}\`\n\n✅ Ambos recibirán 10% de descuento`);
    } catch (e) {
        // DM closed
    }

    return interaction.editReply(`✅ Referencia enviada a ${targetUser.tag}\nCódigo: \`${referralCode}\`\n\nCuando se suscriba, ambos recibirán 10% descuento`);
}

else if (subCmd === 'familia') {
    if (!privacyData || privacyData.level === 'basico') {
        return interaction.editReply('❌ Requiere nivel VIP o Elite');
    }

    const accion = interaction.options.getString('accion');

    if (accion === 'add') {
        const miembro = interaction.options.getUser('miembro');

        if (!miembro) {
            return interaction.editReply('❌ Especifica un miembro');
        }

        const extraCost = privacyData.level === 'vip' ? 75000 : 250000; // 50% extra

        const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
        if ((balance.cash || 0) < extraCost) {
            return interaction.editReply(`❌ Costo adicional: $${extraCost.toLocaleString()}`);
        }

        await billingService.ubService.removeMoney(interaction.guildId, userId, extraCost, 'Plan Familiar', 'cash');

        await supabase.from('privacy_family').insert({
            owner_id: userId,
            member_id: miembro.id,
            status: 'active'
        });

        // Give same privacy level to member
        await supabase.from('privacy_accounts').upsert({
            user_id: miembro.id,
            level: privacyData.level,
            expires_at: privacyData.expires_at,
            activated_at: new Date().toISOString()
        });

        return interaction.editReply(`👨‍👩‍👧 **Familia Actualizada**\n✅ ${miembro.tag} agregado\nCosto: $${extraCost.toLocaleString()}\nNivel compartido: ${privacyData.level.toUpperCase()}`);
    }

    else if (accion === 'list') {
        const { data: family } = await supabase
            .from('privacy_family')
            .select('member_id')
            .eq('owner_id', userId)
            .eq('status', 'active');

        if (!family || family.length === 0) {
            return interaction.editReply('👨‍👩‍👧 No tienes miembros familiares');
        }

        const members = family.map(f => `<@${f.member_id}>`).join(', ');
        return interaction.editReply(`👨‍👩‍👧 **Tu Familia:**\n${members}\n\nTodos comparten tu nivel: ${privacyData.level.toUpperCase()}`);
    }
}

else if (subCmd === 'score') {
    const { data: scoreData } = await supabase.rpc('calculate_privacy_score', { p_user_id: userId });
    const score = scoreData || 0;

    let rank = '📈 Principiante';
    if (score >= 80) rank = '🏆 Elite Master';
    else if (score >= 60) rank = '⭐ Experto';
    else if (score >= 40) rank = '🎯 Intermedio';

    const embed = new EmbedBuilder()
        .setTitle('📊 Privacy Score')
        .setColor('#2F3136')
        .setDescription(`Tu puntuación: **${score}/100**\nRango: ${rank}`)
        .addFields(
            { name: '💡 Cómo Mejorar', value: '• Mantén privacidad activa\n• Usa la bóveda\n• Activa auto-renovación\n• Completa verificación' }
        );

    return interaction.editReply({ embeds: [embed] });
}
