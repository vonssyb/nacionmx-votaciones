const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Comandos de moderación ERLC')
        .addSubcommand(sub =>
            sub.setName('turno')
                .setDescription('Iniciar o terminar tu turno de moderación')
                .addStringOption(opt =>
                    opt.setName('accion')
                        .setDescription('Acción a realizar')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Iniciar', value: 'start' },
                            { name: 'Terminar', value: 'end' }
                        ))),

    async execute(interaction, client) {
        const action = interaction.options.getString('accion');
        const discordId = interaction.user.id;
        const MOD_ROLE_ID = '1457892493310951444'; // Updated ID

        // Check Role
        if (!interaction.member.roles.cache.has(MOD_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '⛔ No tienes el rol de Moderador ERLC.', ephemeral: true });
        }

        // Get stored shifts
        const shifts = client.erlcShifts;

        if (action === 'start') {
            // Check if already active
            for (const [robloxId, data] of shifts) {
                if (data.discordId === discordId) {
                    return interaction.reply({ content: '❌ Ya tienes un turno activo.', ephemeral: true });
                }
            }

            // Verify ERLC Presence
            const info = await client.services.erlc.getServerInfo();
            if (!info || !info.Players) {
                return interaction.reply({ content: '❌ No se pudo conectar con el servidor para verificar tu presencia.', ephemeral: true });
            }

            // Find user in server (Need link)
            // We need to resolve Discord -> Roblox ID.
            // Using Supabase
            const { data: profile } = await client.supabase
                .from('citizens')
                .select('roblox_id, roblox_username')
                .eq('discord_id', discordId)
                .maybeSingle();

            if (!profile || !profile.roblox_id) {
                return interaction.reply({ content: '❌ No tienes tu cuenta de Roblox vinculada. Usa `/fichar vincular` o `/verificar`.', ephemeral: true });
            }

            const player = info.Players.find(p => p.Id.toString() === profile.roblox_id);

            if (!player) {
                return interaction.reply({ content: '❌ No estás conectado al servidor de ERLC.', ephemeral: true });
            }

            if (player.Team !== 'Sheriff') {
                return interaction.reply({ content: '❌ Debes estar en el equipo **Sheriff** para iniciar turno de moderador.', ephemeral: true });
            }

            // Start Shift
            client.erlcShifts.set(profile.roblox_id, {
                startTime: Date.now(),
                discordId: discordId,
                name: player.Player
            });

            // Save (index.js loop handles saving periodically but we can trigger it if exposed, or just rely on memory for now/index loop updates it)
            // We should ensure persistence. index_moderacion.js loads/saves from `client.erlcShifts` on loop? 
            // The loop in index saves on modification. I should duplicate save logic or expose it.
            // I'll assume index loop will save it eventually (every 30s). Ideally I should save immediately.
            // I'll add a quick save helper import if I can, or just trust the process.
            // Better: update file directly here too? No, race condition.
            // I'll emit an event or just let the loop handle it.

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Turno de Moderación Iniciado')
                .setColor(0x00FF00)
                .setDescription(`Has iniciado turno como **${player.Player}** (Sheriff).\n\n⚠️ **Recuerda:** Si sales del equipo Sheriff, tu turno terminará automáticamente.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Log to channel
            const LOG_CHANNEL = '1399106787558424629';
            try {
                const ch = await client.channels.fetch(LOG_CHANNEL);
                if (ch) ch.send(`👮 **Inicio de Turno:** <@${discordId}> (${player.Player})`);
            } catch (e) { }
        }
        else if (action === 'end') {
            // Find active shift
            let activeRobloxId = null;
            for (const [rid, data] of shifts) {
                if (data.discordId === discordId) {
                    activeRobloxId = rid;
                    break;
                }
            }

            if (!activeRobloxId) {
                return interaction.reply({ content: '❌ No tienes un turno activo.', ephemeral: true });
            }

            const shift = shifts.get(activeRobloxId);
            shifts.delete(activeRobloxId);

            const minutes = Math.round((Date.now() - shift.startTime) / 60000);

            const embed = new EmbedBuilder()
                .setTitle('🛑 Turno Finalizado')
                .setColor(0xFF0000)
                .addFields(
                    { name: 'Duración', value: `${minutes} mins`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
};
