// Webhook API endpoint for staff postulante role assignment
app.post('/api/assign-postulante-role', async (req, res) => {
    try {
        // Verify API key
        const apiKey = req.headers.authorization?.replace('Bearer ', '');
        if (apiKey !== process.env.BOT_API_KEY) {
            log('🚫', '[WEBHOOK] Unauthorized request - invalid API key');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { discord_user_id, application_id } = req.body;

        if (!discord_user_id || !application_id) {
            return res.status(400).json({ error: 'Missing discord_user_id or application_id' });
        }

        log('📥', `[WEBHOOK] Received role assignment request for user ${discord_user_id}`);

        // Get the main guild and member
        const GUILD_ID = process.env.GUILD_ID;
        const POSTULANTE_ROLE_ID = '1460071124074233897';

        if (!moderationClient || !moderationClient.isReady()) {
            log('❌', '[WEBHOOK] Discord client not ready yet.');
            return res.status(503).json({ error: 'Discord client not ready' });
        }

        const guild = await moderationClient.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(discord_user_id);

        if (!member) {
            log('❌', `[WEBHOOK] Member ${discord_user_id} not found in guild`);
            return res.status(404).json({ error: 'Member not found in guild' });
        }

        // Assign postulante role
        const role = guild.roles.cache.get(POSTULANTE_ROLE_ID);
        if (!role) {
            log('❌', `[WEBHOOK] Postulante role ${POSTULANTE_ROLE_ID} not found`);
            return res.status(500).json({ error: 'Role not found' });
        }

        await member.roles.add(role);
        log('✅', `[WEBHOOK] Assigned postulante role to ${member.user.tag}`);

        // Send DM to  user
        try {
            const dmEmbed = {
                color: 0x2ecc71,
                title: '✅ Postulación Aceptada',
                description: `¡Felicidades **${member.user.tag}**! Tu postulación para staff ha sido **ACEPTADA**.`,
                fields: [
                    {
                        name: '📋 Próximos Pasos',
                        value: 'Se te ha asignado el rol de **Postulante**. El equipo de administración se pondrá en contacto contigo pronto con más información.'
                    },
                    {
                        name: '📅 Fecha de Aprobación',
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`
                    }
                ],
                footer: { text: 'Nación MX Roleplay - Sistema de Staff' },
                timestamp: new Date().toISOString()
            };

            await member.send({ embeds: [dmEmbed] });
            log('✅', `[WEBHOOK] DM sent to ${member.user.tag}`);
        } catch (dmError) {
            log('⚠️', `[WEBHOOK] Could not send DM to ${member.user.tag}: ${dmError.message}`);
        }

        res.json({ success: true, user: member.user.tag });
    } catch (error) {
        console.error('[WEBHOOK] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
