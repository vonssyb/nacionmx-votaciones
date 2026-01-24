const logger = require('../services/Logger');
const { CHANNELS, GUILDS, ROLES } = require('../config/constants');
const { EmbedBuilder } = require('discord.js');

function initRealtimeMonitor(client, supabase) {
    // console.log('🛡️ Realtime Application Monitor started.');

    const channel = supabase
        .channel('applications_db_changes')
        .on(
            'postgres_changes',
            {
                event: '*', // Listen to ALL events (INSERT + UPDATE)
                schema: 'public',
                table: 'applications',
            },
            async (payload) => {
                // HANDLE NEW APPLICATIONS
                if (payload.eventType === 'INSERT') {
                    // console.log('📨 New staff application detected!');
                    const app = payload.new;
                    const NOTIFY_CHANNEL_ID = CHANNELS.LOGS_SECURITY;
                    const targetChannel = await client.channels.fetch(NOTIFY_CHANNEL_ID).catch(() => null);

                    if (targetChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle('📜 Nueva Solicitud de Staff (Opos)')
                            .setColor('#FFD700')
                            .setThumbnail('https://i.imgur.com/8QG5BZr.png') // Nación MX Logo
                            .addFields(
                                { name: '👤 Candidato', value: `${app.applicant_username}`, inline: true },
                                { name: '📝 Tipo', value: `${app.type}`, inline: true },
                                { name: '📅 Fecha', value: new Date(app.created_at).toLocaleString(), inline: true },
                                { name: '🔗 Enlace Administrativo', value: '[Ir al Panel de Opos](https://gonzalez-puebla.github.io/nacionmx-portal/dashboard/applications)' }
                            )
                            .setDescription('Se ha recibido una nueva postulación desde el portal web. Por favor revisa los detalles en el panel administrativo.')
                            .setFooter({ text: 'Nación MX Portal System • Realtime Monitor' })
                            .setTimestamp();

                        await targetChannel.send({ content: '🔔 **@everyone ¡Atención Mandos! Nueva postulación recibida.**', embeds: [embed] });
                    }
                }

                // HANDLE APPROVED APPLICATIONS (Role Assignment)
                if (payload.eventType === 'UPDATE') {
                    const newRecord = payload.new;
                    const oldRecord = payload.old;

                    // Check if status changed to 'approved'
                    if (newRecord.status === 'approved') {
                        // console.log(`[APP] ✅ Application approved for ${newRecord.applicant_username} (${newRecord.applicant_discord_id})`);

                        // DEFAULT FALLBACKS
                        let STAFF_GUILD_ID = GUILDS.STAFF;
                        // Default roles if no config
                        let ROLES_TO_ADD = [
                            // Add specific hardcoded defaults only if necessary or keep empty
                        ];

                        try {
                            // FETCH DYNAMIC CONFIG
                            const { data: settings } = await supabase
                                .from('bot_settings')
                                .select('*')
                                .in('key', ['staff_approval_roles', 'staff_guild_id']);

                            if (settings) {
                                const guildConf = settings.find(s => s.key === 'staff_guild_id');
                                const rolesConf = settings.find(s => s.key === 'staff_approval_roles');

                                if (guildConf && guildConf.value) STAFF_GUILD_ID = guildConf.value;
                                if (rolesConf && Array.isArray(rolesConf.value)) ROLES_TO_ADD = rolesConf.value;

                                // console.log(`[APP] ⚙️ Loaded config: Guild=${STAFF_GUILD_ID}, Roles=${ROLES_TO_ADD.length}`);
                            }
                        } catch (confError) {
                            console.error('[APP] ⚠️ Error loading settings, using defaults:', confError.message);
                        }

                        try {
                            const guild = await client.guilds.fetch(STAFF_GUILD_ID).catch(() => null);
                            if (!guild) {
                                console.error(`[APP] ❌ Staff Guild (${STAFF_GUILD_ID}) not found!`);
                                return;
                            }

                            const member = await guild.members.fetch(newRecord.applicant_discord_id).catch(() => null);
                            if (!member) {
                                console.error(`[APP] ❌ Member (${newRecord.applicant_discord_id}) not found in Staff Guild!`);
                                return;
                            }

                            if (ROLES_TO_ADD.length > 0) {
                                await member.roles.add(ROLES_TO_ADD);
                                // console.log(`[APP] 🎉 Roles assigned to ${member.user.tag} in Staff Guild.`);
                            }

                            // Optional: Log success to a channel
                            const LOG_CHANNEL_ID = CHANNELS.LOGS_SECURITY;
                            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                            if (logChannel) {
                                const embed = new EmbedBuilder()
                                    .setTitle('✅ Staff Aceptado (Auto-Rol)')
                                    .setColor('#2ecc71')
                                    .setDescription(`El usuario **${member.user.tag}** ha sido aprobado en el portal.`)
                                    .addFields(
                                        { name: 'Roles Asignados', value: `${ROLES_TO_ADD.length} roles` },
                                        { name: 'Procesado por', value: newRecord.processed_by || 'Admin' }
                                    )
                                    .setTimestamp();
                                logChannel.send({ embeds: [embed] });
                            }

                        } catch (err) {
                            logger.errorWithContext('Error assigning roles to approved applicant', err);
                        }
                    }
                }
            }
        )
        .subscribe();

    return channel;
}

module.exports = initRealtimeMonitor;
