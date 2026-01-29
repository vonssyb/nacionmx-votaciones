const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { applyRoleBenefits } = require('../../services/EconomyHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trabajar')
        .setDescription('💼 Realiza trabajos rápidos para ganar dinero legal'),

    async execute(interaction, client, supabase) {
        // Billing Service for Payments
        const billingService = client.services.billing;

        // 1. DNI Check (Required for legal work)
        try {
            const { data: jobDni, error: dniError } = await supabase
                .from('citizen_dni')
                .select('id, nombre, apellido')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .maybeSingle();

            if (dniError) {
                console.error('[trabajar] DNI query error:', dniError);
                return interaction.editReply({ content: '❌ **Error verificando identidad.** Contacta a soporte.' });
            }

            if (!jobDni) {
                return interaction.editReply({
                    content: '❌ **DNI Requerido**\nNecesitas un DNI válido para trabajar legalmente.\nusa `/dni crear` para registrarte.',
                });
            }
        } catch (e) {
            console.error('[trabajar] Critical DNI Check Error:', e);
            return interaction.editReply('❌ Error interno verificando requisitos.');
        }

        // 2. Cooldown Check
        // Using a global or service-based cooldown would be better, but for now we follow the pattern.
        // Ideally: client.services.cooldowns.check(userId, 'work');
        // We will stick to the "casinoSessions" pattern used in legacy but maybe map it to a Collection in client if possible?
        // Actually, let's look at how legacy used `casinoSessions`. It was a global object in the file.
        // Since we are in a module, we can use a module-level Map, but it will reset on reload.
        // Better: Attach to client.cooldowns if exists, or use a static Map here.

        if (!client.cooldowns) client.cooldowns = new Map();
        const JOB_COOLDOWN = 60 * 60 * 1000; // 1 Hour
        const cooldownKey = `job_${interaction.user.id}`;
        const lastJob = client.cooldowns.get(cooldownKey) || 0;

        if (Date.now() - lastJob < JOB_COOLDOWN) {
            const remaining = Math.ceil((JOB_COOLDOWN - (Date.now() - lastJob)) / 60000);
            return interaction.editReply(`⏳ **Estás cansado**\nDebes descansar **${remaining} minutos** antes de volver a trabajar.`);
        }

        // 3. Job Configuration
        const jobs = [
            { title: '🧠 Bibliotecario', desc: 'Código: XJ-9-DELTA', type: 'memory', code: 'XJ-9-DELTA', opts: ['XJ-9-DELTA', 'XK-9-DELTA', 'XJ-8-DELTA'], pay: [2000, 3000] },
            { title: '💣 Técnico EOD', desc: 'Cable correcto: VERDE', type: 'wires', wire: 'VERDE', opts: ['🔴 ROJO', '🟢 VERDE', '🔵 AZUL'], pay: [3000, 5000] },
            { title: '🚁 Piloto Rescate', desc: 'Víctima al NORTE', type: 'nav', dir: 'NORTE', opts: ['⬆️ NORTE', '⬇️ SUR', '⬅️ OESTE'], pay: [3500, 5500] },
            { title: '⛏️ Minero', desc: 'Elige veta (suerte)', type: 'luck', opts: ['⛏️ VETA 1', '⛏️ VETA 2', '⛏️ VETA 3'], pay: [4000, 7000] },
            { title: '💻 Programador', desc: 'sudo rm -rf /virus', type: 'typing', cmd: 'sudo rm -rf /virus', pay: [5500, 8500] },
            { title: '🧮 Contador', desc: '8500 - 3200 = ?', type: 'math', ans: '5300', pay: [2500, 3500] }
        ];

        const job = jobs[Math.floor(Math.random() * jobs.length)];

        // 4. Render Job UI
        const embed = new EmbedBuilder()
            .setTitle(`💼 Trabajo: ${job.title}`)
            .setColor(0xFFA500)
            .setDescription(`**Tarea:** ${job.desc}\n\n💰 Pago Estimado: $${job.pay[0].toLocaleString()} - $${job.pay[1].toLocaleString()}`)
            .setFooter({ text: '⏱️ Tienes 20 segundos para completar la tarea' })
            .setTimestamp();

        let components = [];

        // Game Logic Setup
        if (job.type === 'memory') {
            embed.addFields({ name: '📚 MEMORIZA:', value: `\`\`\`\n${job.code}\n\`\`\`` });
            await interaction.editReply({ embeds: [embed] });

            // Countdown visual
            for (let i = 3; i > 0; i--) {
                await new Promise(r => setTimeout(r, 1000));
                embed.setFooter({ text: `⏰ Desapareciendo en ${i}...` });
                await interaction.editReply({ embeds: [embed] });
            }

            embed.setDescription(`¿Cuál era el código?`);
            embed.spliceFields(0, 1);
            embed.setFooter({ text: '❓ Selecciona la respuesta correcta' });

            const row = new ActionRowBuilder();
            job.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`job_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary))
            );
            components = [row];

        } else if (job.type === 'wires') {
            embed.addFields({
                name: '💣 PANEL DE CONTROL',
                value: `\`\`\`\n🔴 ROJO\n🟢 VERDE\n🔵 AZUL\n\`\`\`\n⚠️ ¡Corta el cable ${job.wire}!`
            });
            const row = new ActionRowBuilder();
            job.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`job_${opt}`)
                    .setLabel(opt)
                    .setStyle(opt.includes('VERDE') ? ButtonStyle.Success : ButtonStyle.Danger))
            );
            components = [row];

        } else if (job.type === 'nav') {
            embed.addFields({
                name: '🗺️ MAPA',
                value: `\`\`\`\n     🏔️\n  ⬅️ 🚁 ➡️\n     ⬇️\n\`\`\`\n🎯 Destino: **${job.dir}**`
            });
            const row = new ActionRowBuilder();
            job.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`job_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary))
            );
            components = [row];

        } else if (job.type === 'luck') {
            embed.addFields({
                name: '⛏️ MINA DE ORO',
                value: `\`\`\`\n[1] 💎 ?\n[2] 💎 ?\n[3] 💎 ?\n\`\`\`\n🎲 Probabilidad: 50%`
            });
            const row = new ActionRowBuilder();
            job.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`job_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Secondary))
            );
            components = [row];

        } else if (job.type === 'typing') {
            embed.addFields({ name: '💻 TERMINAL', value: `\`\`\`bash\n$ ${job.cmd}\n> _\n\`\`\`\n⌨️ Escribe el comando exacto en el chat` });
        } else if (job.type === 'math') {
            embed.addFields({ name: '🧮 CALCULADORA', value: `\`\`\`\n${job.desc}\n= ???\n\`\`\`\n🔢 Escribe tu respuesta numérica` });
        }

        // Send Initial UI
        await interaction.editReply({ embeds: [embed], components: components });

        // 5. Handle Input (Collector)
        try {
            let win = false;
            let collectedInteraction = null; // For button interactions to reply to

            if (job.type === 'typing' || job.type === 'math') {
                const filter = m => m.author.id === interaction.user.id;
                const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 20000, errors: ['time'] });
                const m = collected.first();
                const userAnswer = m.content.trim();

                win = (job.type === 'typing' && userAnswer === job.cmd) ||
                    (job.type === 'math' && userAnswer === job.ans);

                if (win) await m.react('✅');
                else await m.react('❌');

            } else {
                // Button Collector
                const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('job_');
                const collected = await interaction.channel.awaitMessageComponent({ filter, time: 20000 });
                collectedInteraction = collected;

                await collected.deferUpdate(); // Acknowledge button click

                const selected = collected.customId.replace('job_', '');

                if (job.type === 'memory') win = selected === job.code;
                else if (job.type === 'wires') win = selected.includes(job.wire);
                else if (job.type === 'nav') win = selected.includes(job.dir);
                else if (job.type === 'luck') win = Math.random() > 0.5;
            }

            // 6. Payout or Fail
            if (win) {
                const basePay = Math.floor(Math.random() * (job.pay[1] - job.pay[0] + 1)) + job.pay[0];

                // Fetch member for role benefits
                const member = interaction.member; // Already available in interaction
                const { amount: finalAmount, perks } = applyRoleBenefits(member, basePay, 'job');

                // Validation
                if (isNaN(finalAmount) || finalAmount < 1) {
                    throw new Error(`Calculated invalid pay amount: ${finalAmount}`);
                }

                // Process Payment
                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, finalAmount, `Trabajo: ${job.title}`, 'cash');

                // Set Cooldown
                client.cooldowns.set(cooldownKey, Date.now());

                const successEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ ¡Trabajo Completado!')
                    .setDescription(`Has completado la tarea de **${job.title}**.`)
                    .addFields(
                        { name: '💰 Pago Base', value: `$${basePay.toLocaleString()}`, inline: true },
                        { name: '💵 Total Recibido', value: `**$${finalAmount.toLocaleString()}**`, inline: true }
                    );

                if (perks.length > 0) {
                    successEmbed.addFields({ name: '🎁 Bonos', value: perks.join('\n'), inline: false });
                }

                if (collectedInteraction) {
                    await collectedInteraction.editReply({ embeds: [successEmbed], components: [] });
                } else {
                    await interaction.followUp({ embeds: [successEmbed] });
                }

            } else {
                // Fail
                client.cooldowns.set(cooldownKey, Date.now()); // Set cooldown even on fail to prevent spamming
                const failMsg = '❌ **Fallaste la tarea.** Inténtalo de nuevo más tarde.';

                if (collectedInteraction) {
                    await collectedInteraction.editReply({ content: failMsg, embeds: [], components: [] });
                } else {
                    await interaction.followUp({ content: failMsg, embeds: [], components: [] });
                }
            }

        } catch (error) {
            if (error.code === 'InteractionCollectorError') { // Time ran out
                await interaction.editReply({ content: '⏰ **¡Se acabó el tiempo!**', embeds: [], components: [] });
            } else {
                console.error('[trabajar] Execution Error:', error);
                await interaction.followUp({ content: `⚠️ **Error procesando el pago:** ${error.message}. Contacta a soporte.` });
            }
        }
    }
};
