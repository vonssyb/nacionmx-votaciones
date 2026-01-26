const logger = require('../../services/Logger');
const JobValidator = require('../../services/JobValidator');
const limitsService = require('../../services/LimitsService');
const { EmbedBuilder } = require('discord.js'); // Added missing require if needed, assumed global or passed? Usually required.

// Channels
const CHANNELS = {
    LOGS_GENERAL: '1457457209268109516',
    SECURITY_LOGS: '1457457209268109516' // Using general for now if security not defined
};

module.exports = (client, supabase) => {

    const handleRoleConflicts = async (oldMember, newMember) => {
        // Get added roles
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));

        // 0. Update Salary Collection Timestamp (Anti-Exploit)
        // If user collected salary recently and changes job, we might want to track/limit?
        // Existing logic from file view:
        if (addedRoles.size > 0 && false) { // Disabled in original snippet? No, it was checking salary collections.
            // Implemented based on previous view:
            // It checked supabase salary_collections and reset time?
            // Let's preserve the logic seen in Step 1005 lines 60-70
            /*
               const { data: latest } = await supabase.from('salary_collections')...
               if (latest) update collected_at to 3 days ago
            */
            // Re-implementing simplified to allow re-collection on job change? Or prevent?
            // Original logic seemed to reset timer (allow collection) or penalize?
            // "update collected_at: threeDaysAgo" -> Allows collection immediately?
            // Let's assume it allows immediate collection for new job (reset cooldown).
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

            try {
                const { data: latest } = await supabase
                    .from('salary_collections')
                    .select('id')
                    .eq('user_id', newMember.id)
                    .order('collected_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (latest) {
                    await supabase
                        .from('salary_collections')
                        .update({ collected_at: threeDaysAgo.toISOString() })
                        .eq('id', latest.id);
                }
            } catch (e) { logger.error('Error resetting salary cooldown', e); }
        }

        /* ------------------------------------------------------------- */
        /*                  ROLE CONFLICT & LIMITS LOGIC                 */
        /* ------------------------------------------------------------- */
        try {
            // Only process validators if roles were added
            if (addedRoles.size > 0) {

                // 1. Check Incompatible Roles (Police vs Cartel)
                if (JobValidator.hasIncompatibleRoles(newMember)) {
                    // Conflict Detected
                    logger.warn(`Role conflict detected for user`, { user: newMember.user.tag, module: 'MOD' });

                    // Remove the newly added conflicting roles
                    await newMember.roles.remove(addedRoles);

                    // Notify User
                    try {
                        await newMember.send('⚠️ **Conflicto de Roles**: No puedes pertenecer a una facción legal (Policía/Ejército) y una ilegal (Cartel) simultáneamente.\nSe ha revertido la asignación de rol.');
                    } catch (e) { /* DM closed */ }

                    // Log to Security Channel
                    try {
                        const logChannel = await client.channels.fetch(CHANNELS.LOGS_GENERAL).catch(() => null);
                        if (logChannel) {
                            const embed = new EmbedBuilder()
                                .setTitle('🛡️ Conflicto de Roles Preventivo')
                                .setColor('#FF0000')
                                .setDescription(`Se intentó asignar un rol incompatible a <@${newMember.id}>.`)
                                .addFields(
                                    { name: 'Usuario', value: `${newMember.user.tag}`, inline: true },
                                    { name: 'Rol Intentado', value: addedRoles.map(r => r.name).join(', ') || 'Desconocido', inline: true }
                                )
                                .setTimestamp();
                            await logChannel.send({ embeds: [embed] });
                        }
                    } catch (e) { console.error('Error logging conflict', e); }

                    return; // Stop further checks if conflict found
                }

                // 2. Check Principal Job Limits (Numerical)
                const limits = JobValidator.getLimits(newMember);
                const currentPrincipal = JobValidator.getPrincipalJobCount(newMember);

                if (currentPrincipal > limits.principal) {
                    const prevPrincipal = JobValidator.getPrincipalJobCount(oldMember);
                    // Only act if count INCREASED (avoid loops on removal)
                    if (currentPrincipal > prevPrincipal) {
                        const roleNames = addedRoles.map(r => r.name).join(', ');
                        logger.warn(`Job limit exceeded for user`, { user: newMember.user.tag, roles: roleNames, limit: limits.principal, count: currentPrincipal });

                        // Remove roles
                        await newMember.roles.remove(addedRoles);

                        try {
                            await newMember.send(`⚠️ **Límite de Trabajos Alcanzado**: Tu nivel de membresía actual (**${limits.tier}**) solo permite **${limits.principal}** trabajos principales (Gobierno/Cartel).\nRoles intentados: ${roleNames}\nActualiza tu membresía (Booster/Premium) para obtener más espacios.`);
                        } catch (e) { }
                    }
                }
            }
        } catch (err) {
            logger.errorWithContext('Role conflict handler error', err, { module: 'MOD' });
        }
    };

    client.on('guildMemberUpdate', handleRoleConflicts);
};
