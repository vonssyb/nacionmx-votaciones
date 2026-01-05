// PRIVACY SYSTEM HANDLER
// Add this to index.js

else if (commandName === 'privacidad') {
    await interaction.deferReply({ flags: [64] });
    const subCmd = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // Get current privacy status
    const { data: privacyData } = await supabase
        .from('privacy_accounts')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (subCmd === 'activar') {
        const nivel = interaction.options.getString('nivel');
        const costs = { basico: 50000, vip: 150000, elite: 500000 };
        const cost = costs[nivel];

        const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
        if ((balance.cash || 0) < cost) {
            return interaction.editReply(`❌ **Fondos Insuficientes**\nRequieres: $${cost.toLocaleString()}\nTienes: $${(balance.cash || 0).toLocaleString()}`);
        }

        await billingService.ubService.removeMoney(interaction.guildId, userId, cost, `Activación Privacidad ${nivel}`, 'cash');

        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await supabase.from('privacy_accounts').upsert({
            user_id: userId,
            level: nivel,
            expires_at: expiresAt.toISOString(),
            activated_at: new Date().toISOString()
        });

        const icons = { basico: '🥉', vip: '🥈', elite: '🥇' };
        const embed = new EmbedBuilder()
            .setTitle('🕶️ Privacidad Activada')
            .setColor('#2F3136')
            .setDescription(`Nivel: ${icons[nivel]} **${nivel.toUpperCase()}**`)
            .addFields(
                { name: 'Costo', value: `$${cost.toLocaleString()}`, inline: true },
                { name: 'Duración', value: '30 días', inline: true },
                { name: 'Expira', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Tu información bancaria ahora está protegida' });

        return interaction.editReply({ embeds: [embed] });
    }

    else if (subCmd === 'desactivar') {
        if (!privacyData) {
            return interaction.editReply('❌ No tienes privacidad activa');
        }

        await supabase.from('privacy_accounts').delete().eq('user_id', userId);
        return interaction.editReply('✅ Privacidad desactivada');
    }

    else if (subCmd === 'estado') {
        if (!privacyData) {
            return interaction.editReply('❌ No tienes privacidad activa\nUsa `/privacidad activar` para protegerte');
        }

        const icons = { basico: '🥉', vip: '🥈', elite: '🥇' };
        const now = new Date();
        const expires = new Date(privacyData.expires_at);
        const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

        const embed = new EmbedBuilder()
            .setTitle('🕶️ Tu Privacidad')
            .setColor('#2F3136')
            .setDescription(`Nivel: ${icons[privacyData.level]} **${privacyData.level.toUpperCase()}**`)
            .addFields(
                { name: 'Activado', value: `<t:${Math.floor(new Date(privacyData.activated_at).getTime() / 1000)}:R>`, inline: true },
                { name: 'Expira en', value: `${daysLeft} días`, inline: true },
                { name: 'Offshore', value: privacyData.offshore_name || 'No configurado', inline: true }
            );

        if (privacyData.level === 'basico') {
            embed.addFields({ name: '✅ Beneficios', value: '• Saldo oculto\n• Inmunidad a robos\n• Transacciones privadas' });
        } else if (privacyData.level === 'vip') {
            embed.addFields({ name: '✅ Beneficios', value: '• Todo lo de Básico\n• Transferencias anónimas\n• Historial privado\n• Alertas de seguridad' });
        } else if (privacyData.level === 'elite') {
            embed.addFields({ name: '✅ Beneficios', value: '• Todo lo de VIP\n• Cuenta Offshore\n• Modo Fantasma\n• Bóveda de Emergencia\n• Anti-Secuestro' });
        }

        return interaction.editReply({ embeds: [embed] });
    }

    else if (subCmd === 'upgrade') {
        if (!privacyData) {
            return interaction.editReply('❌ Primero activa un nivel con `/privacidad activar`');
        }

        const newLevel = interaction.options.getString('nuevo_nivel');
        const costs = { vip: 150000, elite: 500000 };
        const currentCosts = { basico: 50000, vip: 150000 };

        if (privacyData.level === 'elite') {
            return interaction.editReply('❌ Ya tienes el nivel máximo');
        }

        if (privacyData.level === 'vip' && newLevel === 'vip') {
            return interaction.editReply('❌ Ya tienes este nivel');
        }

        const upgradeCost = costs[newLevel] - currentCosts[privacyData.level];

        const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
        if ((balance.cash || 0) < upgradeCost) {
            return interaction.editReply(`❌ **Fondos Insuficientes** para upgrade\nRequieres: $${upgradeCost.toLocaleString()}`);
        }

        await billingService.ubService.removeMoney(interaction.guildId, userId, upgradeCost, `Upgrade Privacidad a ${newLevel}`, 'cash');
        await supabase.from('privacy_accounts').update({ level: newLevel }).eq('user_id', userId);

        return interaction.editReply(`✅ Privacidad mejorada a **${newLevel.toUpperCase()}**\nCosto: $${upgradeCost.toLocaleString()}`);
    }

    else if (subCmd === 'boveda') {
        if (!privacyData || privacyData.level !== 'elite') {
            return interaction.editReply('❌ Requiere nivel **Elite**');
        }

        const accion = interaction.options.getString('accion');
        const monto = interaction.options.getNumber('monto');

        const { data: vault } = await supabase
            .from('privacy_vault')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (accion === 'depositar') {
            if (!monto) return interaction.editReply('❌ Especifica un monto');

            const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
            if ((balance.cash || 0) < monto) {
                return interaction.editReply(`❌ Fondos insuficientes`);
            }

            await billingService.ubService.removeMoney(interaction.guildId, userId, monto, 'Depósito Bóveda', 'cash');

            if (vault) {
                await supabase.from('privacy_vault').update({
                    amount: vault.amount + monto,
                    locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                }).eq('user_id', userId);
            } else {
                await supabase.from('privacy_vault').insert({
                    user_id: userId,
                    amount: monto,
                    locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                });
            }

            return interaction.editReply(`🔒 **Depositado en Bóveda**\n$${monto.toLocaleString()}\nBLoqueado por 7 días`);
        }

        else if (accion === 'retirar') {
            if (!vault || vault.amount <= 0) {
                return interaction.editReply('❌ Bóveda vacía');
            }

            const lockTime = new Date(vault.locked_until);
            if (lockTime > new Date()) {
                return interaction.editReply(`🔒 Bóveda bloqueada hasta <t:${Math.floor(lockTime.getTime() / 1000)}:R>`);
            }

            const amount = monto || vault.amount;
            if (amount > vault.amount) {
                return interaction.editReply(`❌ No tienes suficiente en bóveda\nDisponible: $${vault.amount.toLocaleString()}`);
            }

            await billingService.ubService.addMoney(interaction.guildId, userId, amount, 'Retiro Bóveda', 'cash');
            await supabase.from('privacy_vault').update({ amount: vault.amount - amount }).eq('user_id', userId);

            return interaction.editReply(`✅ Retirado de Bóveda: $${amount.toLocaleString()}`);
        }

        else if (accion === 'ver') {
            if (!vault) {
                return interaction.editReply('📭 Bóveda vacía\nUsa `/privacidad boveda depositar` para agregar fondos');
            }

            const lockTime = new Date(vault.locked_until);
            const locked = lockTime > new Date();

            return interaction.editReply(`🔒 **Bóveda de Emergencia**\nBalance: $${vault.amount.toLocaleString()}\nEstado: ${locked ? `Bloqueada hasta <t:${Math.floor(lockTime.getTime() / 1000)}:R>` : '🔓 Disponible'}`);
        }
    }

    else if (subCmd === 'offshore') {
        if (!privacyData || privacyData.level !== 'elite') {
            return interaction.editReply('❌ Requiere nivel **Elite**');
        }

        const nombre = interaction.options.getString('nombre');

        await supabase.from('privacy_accounts').update({ offshore_name: nombre }).eq('user_id', userId);

        return interaction.editReply(`✅ Nombre Offshore configurado: **${nombre}**\nTus transferencias ahora mostrarán este nombre`);
    }

    else if (subCmd === 'panico') {
        if (!privacyData || privacyData.level !== 'elite') {
            return interaction.editReply('❌ Requiere nivel **Elite**');
        }

        const pin = interaction.options.getString('pin');

        if (pin.length !== 6 || !/^\d+$/.test(pin)) {
            return interaction.editReply('❌ El PIN debe ser de 6 dígitos numéricos');
        }

        // Transfer all money to vault
        const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
        const totalCash = balance.cash || 0;
        const totalBank = balance.bank || 0;
        const total = totalCash + totalBank;

        if (total > 0) {
            if (totalCash > 0) await billingService.ubService.removeMoney(interaction.guildId, userId, totalCash, 'Modo Pánico', 'cash');
            if (totalBank > 0) await billingService.ubService.removeMoney(interaction.guildId, userId, totalBank, 'Modo Pánico', 'bank');

            const { data: vault } = await supabase.from('privacy_vault').select('*').eq('user_id', userId).maybeSingle();

            if (vault) {
                await supabase.from('privacy_vault').update({
                    amount: vault.amount + total,
                    locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                }).eq('user_id', userId);
            } else {
                await supabase.from('privacy_vault').insert({
                    user_id: userId,
                    amount: total,
                    locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                });
            }

            await supabase.from('privacy_accounts').update({ panic_pin: pin }).eq('user_id', userId);

            return interaction.editReply(`🚨 **MODO PÁNICO ACTIVADO**\n$${total.toLocaleString()} transferidos a Bóveda\nTus cuentas muestran $0\nPIN guardado: usa el mismo PIN para recuperar`);
        } else {
            return interaction.editReply('❌ No tienes fondos para transferir');
        }
    }
}
