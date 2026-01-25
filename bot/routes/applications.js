const express = require('express');
const logger = require('../services/Logger');

/**
 * Application Management Routes
 * Handles role assignment and application status updates
 */
module.exports = (client, supabase) => {
    const router = express.Router();

    /**
     * POST /api/assign-postulante-role
     * Assigns "Postulante" role to approved applicants
     */
    router.post('/assign-postulante-role', async (req, res) => {
        try {
            // Verify API Key
            const authHeader = req.headers.authorization;
            const expectedKey = `Bearer ${process.env.PORTAL_API_KEY || 'default-key-change-this'}`;

            if (authHeader !== expectedKey) {
                logger.warn('[Applications API] Unauthorized role assignment attempt', {
                    ip: req.ip,
                    headers: req.headers
                });
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
                });
            }

            const { discord_user_id, application_id } = req.body;

            // Validation
            if (!discord_user_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing discord_user_id'
                });
            }

            // Guild and Role IDs
            const MAIN_GUILD_ID = '1412882245735419973';
            const POSTULANTE_ROLE_ID = '1460064522684551239';

            // Fetch Guild
            const guild = await client.guilds.fetch(MAIN_GUILD_ID);
            if (!guild) {
                logger.error('[Applications API] Main guild not found', { guildId: MAIN_GUILD_ID });
                return res.status(500).json({
                    success: false,
                    error: 'Guild not found'
                });
            }

            // Fetch Member
            let member;
            try {
                member = await guild.members.fetch(discord_user_id);
            } catch (fetchError) {
                logger.warn('[Applications API] Member not found in guild', {
                    userId: discord_user_id,
                    error: fetchError.message
                });
                return res.status(404).json({
                    success: false,
                    error: 'User not found in server'
                });
            }

            // Check if role already assigned
            if (member.roles.cache.has(POSTULANTE_ROLE_ID)) {
                logger.info('[Applications API] User already has Postulante role', {
                    userId: discord_user_id,
                    username: member.user.tag
                });
                return res.json({
                    success: true,
                    message: 'Role already assigned',
                    alreadyHad: true
                });
            }

            // Assign Role
            await member.roles.add(POSTULANTE_ROLE_ID, 'Postulación aprobada via Portal');

            logger.info('[Applications API] Postulante role assigned successfully', {
                userId: discord_user_id,
                username: member.user.tag,
                applicationId: application_id
            });

            // Optional: Send welcome DM
            try {
                await member.send({
                    embeds: [{
                        title: '🎉 ¡Bienvenido al Equipo de Staff!',
                        description: '**Tu postulación ha sido aprobada.**\n\nSe te ha asignado el rol de **Postulante**.\n\nRevisa el canal de orientación para los próximos pasos.',
                        color: 0xFFD700,
                        footer: { text: 'Nación MX | Sistema de Postulaciones' },
                        timestamp: new Date().toISOString()
                    }]
                });
            } catch (dmError) {
                logger.warn('[Applications API] Could not send welcome DM', {
                    userId: discord_user_id,
                    error: dmError.message
                });
                // Don't fail the request if DM fails
            }

            res.json({
                success: true,
                message: 'Role assigned successfully',
                user: member.user.tag
            });

        } catch (error) {
            logger.error('[Applications API] Error assigning role', {
                error: error.message,
                stack: error.stack,
                body: req.body
            });

            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    });

    /**
     * GET /api/application-status/:discord_id
     * Check application status for a user
     */
    router.get('/application-status/:discord_id', async (req, res) => {
        try {
            const { discord_id } = req.params;

            const { data, error } = await supabase
                .from('applications')
                .select('id, status, type, created_at, processed_at')
                .eq('applicant_discord_id', discord_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            res.json({
                success: true,
                application: data
            });

        } catch (error) {
            logger.error('[Applications API] Error fetching status', {
                error: error.message,
                discordId: req.params.discord_id
            });

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
};
