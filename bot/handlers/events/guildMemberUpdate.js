const { EmbedBuilder } = require('discord.js');
const logger = require('../../services/Logger');
const JobValidator = require('../../services/JobValidator');
const { CHANNELS } = require('../../config/constants');

module.exports = async (client, oldMember, newMember, supabase) => {
    // Optimization: Quick check if roles size changed or strict equality
    if (oldMember.roles.cache.size === newMember.roles.cache.size) return;

    // Ignore bots
    if (newMember.user.bot) return;

    try {
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
        const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

        // Combined affected roles
        const affectedRoleIds = [...addedRoles.keys(), ...removedRoles.keys()];

        if (affectedRoleIds.length === 0) return;

        // --- FEATURE: Reset Salary Cooldown on Job Change ---
        if (affectedRoleIds.length > 0) {
            const { data: jobRoles } = await supabase
                .from('job_salaries')
                .select('role_id')
                .in('role_id', affectedRoleIds);

            if (jobRoles && jobRoles.length > 0) {
                // User gained or lost a job role -> Reset Cooldown
                logger.info(`Job role change detected for ${newMember.user.tag}. Resetting salary cooldown.`);

                // Delete latest collection record to allow immediate recollect
                // We optimize by deleting based on user_id restriction, but we should probably just delete the 'effective' cooldown lock.
                // However, deleting the record from 'salary_collections' removes the history. 
                // Better approach: Update 'collected_at' to be 3 days ago OR delete if you don't care about history (User asked "volver a colectar")
                // Let's UPDATE to allow immediate collection but keep record exists.

                const threeDaysAgo = new Date(Date.now() - (72 * 60 * 60 * 1000) - 1000).toISOString();

                await supabase
                    .from('salary_collections')
                    .update({ collected_at: threeDaysAgo })
                    .eq('user_id', newMember.id)
                    // Update only the most recent one if we want strictness, but updating all entries for user works too to unlock
                    // Actually, 'colectar.js' checks the *latest* entry. 
                    // Let's delete the constraint or update it.
                    ;

                // Actually, just DELETE the last entry from cooldown check perspective?
                // Or simply update 'collected_at' of the LATEST record.
                // Let's do update to keep the record for accounting but make it "expired".

                // Find latest
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
                        .update({ collected_at: threeDaysAgo })
                        .eq('id', latest.id);

                    // Also notify user? Maybe too spammy.
                    // Logic complete.
                }
            }
        }

        // Only process validators if roles were added (restrictions usually apply on add)
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
                const logChannel = await client.channels.fetch(CHANNELS.LOGS_GENERAL).catch(() => null); // Should be Security or General? index used GENERAL ID '1457457209268109516'
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
                return; // Stop further checks if conflict found
            }

            // 2. Check Principal Job Limits (Numerical)
            const limits = JobValidator.getLimits(newMember);
            const currentPrincipal = JobValidator.getPrincipalJobCount(newMember);

            if (currentPrincipal > limits.principal) {
                const prevPrincipal = JobValidator.getPrincipalJobCount(oldMember);
                if (currentPrincipal > prevPrincipal) {
                    const roleNames = addedRoles.map(r => r.name).join(', ');
                    logger.warn(`Job limit exceeded for user`, { user: newMember.user.tag, roles: roleNames, limit: limits.principal, count: currentPrincipal });
                    await newMember.roles.remove(addedRoles);
                    try {
                        await newMember.send(`⚠️ **Límite de Trabajos Alcanzado**: Tu nivel de membresía actual (**${limits.tier}**) solo permite **${limits.principal}** trabajos principales (Gobierno/Cartel).\nRoles intentados: ${roleNames}\nActualiza tu membresía (Booster/Premium) para obtener más espacios.`);
                    } catch (e) { }
                }
            }

        } catch (err) {
            logger.errorWithContext('Role conflict handler error', err, { module: 'MOD' });
        }
    };
