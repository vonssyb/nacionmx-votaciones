const express = require('express');
const router = express.Router();
const voiceConfig = require('../config/erlcVoiceChannels');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const discordTTS = require('discord-tts');

// Queue system for TTS
const audioQueue = [];
let isPlaying = false;

async function processQueue() {
    if (isPlaying || audioQueue.length === 0) return;
    isPlaying = true;

    const { connection, resource, channelName } = audioQueue.shift();
    const player = createAudioPlayer();

    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        isPlaying = false;
        // Keep connection open for a bit, or close if queue empty?
        // For now, keep it open to avoid constant join/leave
        setTimeout(() => {
            if (audioQueue.length === 0 && !isPlaying && connection) {
                // connection.destroy(); // Optional: Auto-leave
            }
        }, 30000);

        processQueue();
    });

    player.on('error', error => {
        console.error(`[TTS Error] ${error.message}`);
        isPlaying = false;
        processQueue();
    });
}

/**
 * POST /api/erlc/talk
 * Recibe mensaje de ERLC y lo reproduce como TTS en el canal de voz
 */
router.post('/talk', async (req, res) => {
    const { roblox_username, message, api_key } = req.body;

    // 1. Validar API Key
    if (api_key !== process.env.ERLC_API_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!roblox_username || !message) {
        return res.status(400).json({ success: false, error: 'Missing data' });
    }

    try {
        const { client, supabase } = req.app.locals;

        // 2. Buscar usuario Discord vinculado
        // PRIORITY 1: Manual Link (roblox_discord_links)
        let { data: link } = await supabase
            .from('roblox_discord_links')
            .select('discord_user_id')
            .eq('roblox_username', roblox_username)
            .maybeSingle();

        // PRIORITY 2: Auto-Detect from Citizens Table (Economy System)
        if (!link) {
            const { data: citizen } = await supabase
                .from('citizens')
                .select('discord_id')
                .eq('roblox_username', roblox_username)
                .maybeSingle();

            if (citizen) {
                link = { discord_user_id: citizen.discord_id };
                console.log(`[ERLC] Found auto-link for ${roblox_username} in citizens table`);
            }
        }

        // PRIORITY 3: Nickname Search (Last Resort - Expensive & Less Accurate)
        if (!link) {
            const guild = client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
            if (guild) {
                // Try to find member by nickname matching roblox username
                // Cuidado: Esto puede ser lento en servidores grandes
                // Simplificación: Solo buscar si no hay link
                /* 
                const member = guild.members.cache.find(m => 
                    m.nickname === roblox_username || 
                    m.user.username === roblox_username ||
                    (m.nickname && m.nickname.includes(roblox_username))
                );
                if (member) link = { discord_user_id: member.id };
                */
            }
        }

        if (!link) {
            return res.status(404).json({ error: 'Account not linked. Register in economy or use /vincular-roblox' });
        }

        const guild = client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
        if (!guild) return res.status(500).json({ error: 'Guild not found' });

        const member = await guild.members.fetch(link.discord_user_id).catch(() => null);
        if (!member) return res.status(404).json({ error: 'Member not found' });

        // 3. Verificar canal de voz
        const voiceState = member.voice;
        if (!voiceState || !voiceState.channelId) {
            return res.status(400).json({ error: 'User not in voice channel' });
        }

        const channelId = voiceState.channelId;
        const channelInfo = voiceConfig.getChannelInfo(channelId); // Check whitelist

        if (!channelInfo) {
            return res.status(400).json({ error: 'Voice channel not supported for TTS' });
        }

        // 4. Conectar y Reproducir TTS
        const stream = discordTTS.getVoiceStream(`${roblox_username} dice: ${message}`, { lang: 'es' });
        const resource = createAudioResource(stream);

        // Join connection
        let connection = getVoiceConnection(guild.id);

        // If not connected or in different channel, join/rejoin
        if (!connection || connection.joinConfig.channelId !== channelId) {
            connection = joinVoiceChannel({
                channelId: channelId,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });
        }

        // Add to queue
        audioQueue.push({ connection, resource, channelName: channelInfo.name });
        processQueue();

        // 5. Log & Chat Backup
        console.log(`[ERLC TTS] Speaking in ${channelInfo.name}: "${message}"`);

        // Send text backup just in case
        const channel = await client.channels.fetch(channelId); // Usually voice channels support text now
        if (channel) {
            channel.send(`🔊 **[TTS] ${roblox_username}:** ${message}`).catch(() => { });
        }

        await supabase.from('erlc_talk_logs').insert({
            roblox_username,
            discord_user_id: link.discord_user_id,
            voice_channel_id: channelId,
            message
        });

        res.json({ success: true, message: 'TTS Queued' });

    } catch (err) {
        console.error('[ERLC TTS Error]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/erlc/vc
 * Comando para mover usuarios de canal de voz
 * :log vc [abreviacion]
 * Ej: :log vc p1 -> Mueve a Policía 1
 */
router.post('/vc', async (req, res) => {
    const { roblox_username, abbreviation, api_key } = req.body;

    if (api_key !== process.env.ERLC_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roblox_username || !abbreviation) {
        return res.status(400).json({ error: 'Missing data' });
    }

    try {
        const { client, supabase } = req.app.locals;

        // 1. Resolver Canal Destino
        const targetChannelId = voiceConfig.getIdFromAlias(abbreviation);
        if (!targetChannelId) {
            return res.status(400).json({ error: `Canal "${abbreviation}" no encontrado` });
        }

        // 2. Buscar usuario Discord
        let { data: link } = await supabase
            .from('roblox_discord_links')
            .select('discord_user_id')
            .eq('roblox_username', roblox_username)
            .maybeSingle();

        if (!link) {
            const { data: citizen } = await supabase
                .from('citizens')
                .select('discord_id')
                .eq('roblox_username', roblox_username)
                .maybeSingle();
            if (citizen) link = { discord_user_id: citizen.discord_id };
        }

        if (!link) return res.status(404).json({ error: 'Account not linked' });

        const guild = client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
        if (!guild) return res.status(500).json({ error: 'Guild not found' });

        const member = await guild.members.fetch(link.discord_user_id).catch(() => null);
        if (!member) return res.status(404).json({ error: 'Discord member not found' });

        // 3. Mover Usuario
        if (!member.voice.channelId) {
            return res.status(400).json({ error: 'Debes estar conectado a un canal de voz primero' });
        }

        await member.voice.setChannel(targetChannelId);

        const channelName = voiceConfig.CHANNELS[targetChannelId];
        console.log(`[ERLC VC] Moved ${roblox_username} to ${channelName} (${abbreviation})`);

        res.json({
            success: true,
            message: `Movido a ${channelName}`,
            channel: channelName
        });

    } catch (err) {
        console.error('[ERLC VC Error]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
