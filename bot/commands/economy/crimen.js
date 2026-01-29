const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crimen')
        .setDescription('Comete un crimen de alto riesgo para ganar dinero sucio.'),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

        // 1. DNI Check
        const { data: crimenDni, error: crimenDniError } = await supabase
            .from('citizen_dni')
            .select('id, nombre, apellido')
            .eq('guild_id', interaction.guildId)
            .eq('user_id', interaction.user.id)
            .maybeSingle();

        if (crimenDniError) {
            console.error('[crimen] DNI query error:', crimenDniError);
            return interaction.editReply({
                content: `❌ **Error al verificar DNI**\nDetalle: ${crimenDniError.message}\nContacta a un administrador.`,
            });
        }

        if (!crimenDni) {
            return interaction.editReply({
                content: '❌ **DNI Requerido**\nNecesitas un DNI para cometer crímenes. Usa `/dni crear` o ve al registro civil.',
            });
        }

        // 2. Cooldown System (Memory-based)
        const CRIME_COOLDOWN = 120 * 60 * 1000; // 2 hours
        if (!client.cooldowns) client.cooldowns = new Map();
        const cooldownKey = `crime_${interaction.user.id}`;
        const lastCrime = client.cooldowns.get(cooldownKey) || 0;
        const now = Date.now();

        if (now - lastCrime < CRIME_COOLDOWN) {
            const minutesLeft = Math.ceil((CRIME_COOLDOWN - (now - lastCrime)) / 60000);
            return interaction.editReply(`🚓 **Buscado por la policía**\nEscóndete **${minutesLeft} minutos** antes de volver a intentar.`);
        }

        // 3. Define Crimes
        const crimes = [
            { title: '💣 Bomba Nuclear', desc: 'Cable correcto: VERDE', type: 'wires', wire: 'VERDE', opts: ['🔴 ROJO', '🟢 VERDE', '🔵 AZUL', '🟡 AMARILLO', '⚫ NEGRO'], pay: [40000, 65000], fine: [15000, 25000] },
            { title: '🏛️ Museo Nacional', desc: 'Sala 3 - Código 842', type: 'memory', code: 'Sala 3 - 842', opts: ['Sala 3 - 842', 'Sala 2 - 842', 'Sala 3 - 824', 'Sala 4 - 842', 'Sala 3 - 248'], pay: [35000, 55000], fine: [12000, 20000] },
            { title: '🚓 Persecución', desc: 'Escapar a la IZQUIERDA', type: 'nav', dir: 'IZQUIERDA', opts: ['⬅️ IZQUIERDA', '➡️ DERECHA', '⬆️ ACELERAR', '⬇️ FRENAR'], pay: [25000, 40000], fine: [8000, 15000] },
            { title: '💎 Mansión', desc: 'Cruzar jardín minado', type: 'luck', opts: ['🚶 RUTA A', '🚶 RUTA B', '🚶 RUTA C', '🚶 RUTA D', '🚶 RUTA E'], luck: 0.20, pay: [45000, 70000], fine: [18000, 30000] },
            { title: '💻 Hackeo Banco', desc: 'inject_root_sql_bypass_admin', type: 'typing', cmd: 'inject_root_sql_bypass_admin', pay: [30000, 50000], fine: [10000, 18000] },
            { title: '🔐 Caja Fuerte Federal', desc: 'Código: 9-1-8-3-7', type: 'memory', code: '9-1-8-3-7', opts: ['9-1-8-3-7', '9-1-7-3-8', '1-9-8-3-7', '9-8-1-3-7', '9-1-3-8-7'], pay: [50000, 80000], fine: [20000, 35000] },
            { title: '🚁 Escape Aéreo', desc: 'Huir al NORTE entre edificios', type: 'nav', dir: 'NORTE', opts: ['⬆️ NORTE', '⬇️ SUR', '⬅️ OESTE', '➡️ ESTE', '💨 VERTICAL'], pay: [42000, 62000], fine: [16000, 28000] }
        ];

        const crime = crimes[Math.floor(Math.random() * crimes.length)];

        // 4. Initial Embed
        const embed = new EmbedBuilder()
            .setTitle(`☠️ ${crime.title}`)
            .setColor(0x880000)
            .setDescription(`**Misión:** ${crime.desc}\n\n💰 Botín: $${crime.pay[0].toLocaleString()} - $${crime.pay[1].toLocaleString()}\n🚨 Multa si fallas: $${crime.fine[0].toLocaleString()} - $${crime.fine[1].toLocaleString()}`)
            .setFooter({ text: '⚠️ ALTÍSIMO RIESGO - Tienes 20 Segundos' })
            .setTimestamp();

        // 5. Minigame Setup
        const components = [];

        if (crime.type === 'memory') {
            embed.addFields({ name: '🔐 MEMORIZA EL PLAN:', value: `\`\`\`\n${crime.code}\n\`\`\`` });
            await interaction.editReply({ embeds: [embed] });

            // Countdown to hide info
            for (let i = 3; i > 0; i--) {
                await new Promise(r => setTimeout(r, 1000));
                embed.setFooter({ text: `⏰ Destruyendo evidencia en ${i}...` });
                await interaction.editReply({ embeds: [embed] });
            }

            embed.setDescription(`🕵️ ¿Cuál era el plan?`);
            // Remove the code field (index 0)
            embed.spliceFields(0, 1);
            embed.setFooter({ text: 'Selecciona la opción correcta' });

            const row = new ActionRowBuilder();
            crime.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`crime_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Danger))
            );
            components.push(row);
            await interaction.editReply({ embeds: [embed], components });

        } else if (crime.type === 'wires') {
            embed.addFields({
                name: '💣 BOMBA NUCLEAR',
                value: `\`\`\`\n╔═══════════╗\n║  ☢️ PELIGRO ☢️  ║\n║  🔴 🟢 🔵  ║\n║  10:00:00  ║\n╚═══════════╝\n\`\`\`\n⚠️ ¡CORTA EL CABLE ${crime.wire}!`
            });
            const row = new ActionRowBuilder();
            crime.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`crime_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Danger))
            );
            components.push(row);
            await interaction.editReply({ embeds: [embed], components });

        } else if (crime.type === 'nav') {
            embed.addFields({
                name: '🚔 PERSECUCIÓN',
                value: `\`\`\`\n  🚗💨\n━━━┃━━━\n🚓 ↑ 🚧\n━━━━━━━\n\`\`\`\n⚡ Gira a la ${crime.dir} ¡YA!`
            });
            const row = new ActionRowBuilder();
            crime.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`crime_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Danger))
            );
            components.push(row);
            await interaction.editReply({ embeds: [embed], components });

        } else if (crime.type === 'luck') {
            embed.addFields({
                name: '🏰 JARDÍN MINADO',
                value: `\`\`\`\n🏰 MANSIÓN 🏰\n[A] [B] [C] [D] [E]\n 💀  ?  💀  ?  💀\n\`\`\`\n⚠️ Probabilidad de éxito: 20-30%`
            });
            const row = new ActionRowBuilder();
            crime.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`crime_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Danger))
            );
            components.push(row);
            await interaction.editReply({ embeds: [embed], components });

        } else if (crime.type === 'typing') {
            embed.addFields({
                name: '🖥️ TERMINAL BANCARIA',
                value: `\`\`\`bash\n🏦 BANCO CENTRAL\n> ACCESO DENEGADO\n> BYPASS...\n$ ${crime.cmd}\n\`\`\`\n⌨️ Escribe el comando EXACTO en el chat.`
            });
            await interaction.editReply({ embeds: [embed] });
        }


        // 6. Handle Interaction/Chat Collection
        let win = false;
        let collectedInteraction = null; // For buttons
        let collectedMessage = null; // For typing

        try {
            if (crime.type === 'typing') {
                const filter = m => m.author.id === interaction.user.id;
                const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 20000, errors: ['time'] });
                collectedMessage = collected.first();
                if (collectedMessage.content.trim() === crime.cmd) {
                    win = true;
                }
            } else {
                const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('crime_');
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 20000, max: 1 });

                const collected = await new Promise((resolve, reject) => {
                    collector.on('collect', i => resolve(i));
                    collector.on('end', collected => {
                        if (collected.size === 0) reject(new Error('timeout'));
                    });
                });

                collectedInteraction = collected;
                const selected = collectedInteraction.customId.replace('crime_', '');

                if (crime.type === 'memory') win = selected === crime.code;
                else if (crime.type === 'wires') win = selected.includes(crime.wire);
                else if (crime.type === 'nav') win = selected.includes(crime.dir);
                else if (crime.type === 'luck') win = Math.random() > (crime.luck || 0.75);

                // Immediately defer update on the button to prevent "Interaction Failed"
                await collectedInteraction.deferUpdate();
            }
        } catch (e) {
            // Timeout or error
            if (!client.cooldowns.has(cooldownKey)) client.cooldowns.set(cooldownKey, Date.now()); // Set cooldown on fail? Yes.

            const timeoutEmbed = new EmbedBuilder()
                .setTitle('⏰ TIEMPO AGOTADO')
                .setColor(0x000000)
                .setDescription('La policía te ha atrapado por tardar demasiado.')
                .setFooter({ text: 'Ahora estás arrestado.' });

            return interaction.editReply({ embeds: [timeoutEmbed], components: [] });
        }

        // 7. Process Result
        if (win) {
            const basePay = Math.floor(Math.random() * (crime.pay[1] - crime.pay[0] + 1)) + crime.pay[0];

            // Detect Roles
            const BENEFIT_ROLES = {
                PREMIUM: '1412887172503175270',
                BOOSTER: '1423520675158691972',
                ULTRAPASS: '1414033620636532849',
                EVASOR: '1449950636371214397'
            };

            const member = interaction.member;
            const isPremium = member.roles.cache.has(BENEFIT_ROLES.PREMIUM);
            const isBooster = member.roles.cache.has(BENEFIT_ROLES.BOOSTER);
            const isUltraPass = member.roles.cache.has(BENEFIT_ROLES.ULTRAPASS);
            const hasEvasorRole = member.roles.cache.has(BENEFIT_ROLES.EVASOR);

            // Bonus Logic
            let bonusMultiplier = 1.0;
            let bonusLabel = '';
            if (isUltraPass) { bonusMultiplier = 1.10; bonusLabel = '👑 UltraPass +10%'; }
            else if (isPremium) { bonusMultiplier = 1.10; bonusLabel = '⭐ Premium +10%'; }
            else if (isBooster) { bonusMultiplier = 1.10; bonusLabel = '🚀 Booster +10%'; }

            const grossPay = Math.floor(basePay * bonusMultiplier);

            // Tax Logic: CRIME IS TAX FREE
            let taxRate = 0.0;
            const taxAmount = 0;
            const netPay = grossPay;

            // Pay
            await client.services.billing.ubService.addMoney(interaction.guildId, interaction.user.id, netPay, `Crimen: ${crime.title}`, 'cash');
            client.cooldowns.set(cooldownKey, Date.now());

            const fields = [
                { name: '💰 Botín Base', value: `$${basePay.toLocaleString()}`, inline: true }
            ];

            if (bonusLabel) {
                const bonusAmount = grossPay - basePay;
                fields.push({ name: '⭐ Bonus', value: `+$${bonusAmount.toLocaleString()} (${bonusLabel})`, inline: true });
            }

            fields.push(
                { name: '✅ Botín Neto', value: `$${netPay.toLocaleString()}`, inline: false }
            );

            const successEmbed = new EmbedBuilder()
                .setTitle('💸 ¡ÉXITO CRIMINAL!')
                .setColor(0x00FF00)
                .setDescription(`Completaste: **${crime.title}**`)
                .addFields(fields)
                .setFooter({ text: `${bonusLabel || 'Criminal Estándar'} | Libre de Impuestos | Escóndete 2 horas` })
                .setTimestamp();

            if (collectedMessage) await collectedMessage.react('😈');
            await interaction.editReply({ embeds: [successEmbed], components: [] });

        } else {
            // Fail
            const fine = Math.floor(Math.random() * (crime.fine[1] - crime.fine[0] + 1)) + crime.fine[0];
            await client.services.billing.ubService.removeMoney(interaction.guildId, interaction.user.id, fine, `Multa: ${crime.title}`, 'cash');
            client.cooldowns.set(cooldownKey, Date.now());

            if (collectedMessage) await collectedMessage.react('🚔');

            const failEmbed = new EmbedBuilder()
                .setTitle('🚨 ¡ARRESTADO!')
                .setColor(0xFF0000)
                .setDescription(`Fallaste en **${crime.title}** y la policía te atrapó.`)
                .addFields({ name: '💸 Multa Pagada', value: `$${fine.toLocaleString()}` })
                .setFooter({ text: 'Suerte para la próxima... en 2 horas.' });

            await interaction.editReply({ embeds: [failEmbed], components: [] });
        }
    }
};
