const logger = require('../../services/Logger');
const JobValidator = require('../../services/JobValidator');
const limitsService = require('../../services/LimitsService');
const { EmbedBuilder } = require('discord.js');

const CHANNELS = {
    LOGS_GENERAL: '1457457209268109516',
    SECURITY_LOGS: '1457457209268109516'
};

/**
 * Guild Member Update Handler
 * Now a pure function, not a listener attacher.
 */
module.exports = async (client, oldMember, newMember, supabase) => {

    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));

    // 0. Update Salary Collection Timestamp (Anti-Exploit)
    if (addedRoles.size > 0 && false) {
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
        if (addedRoles.size > 0) {
            // 1. Check Incompatible Roles
            if (JobValidator.hasIncompatibleRoles(newMember)) {
                logger.warn(`Role conflict detected for user`, { user: newMember.user.tag, module: 'MOD' });

                await newMember.roles.remove(addedRoles);

                try {
                    await newMember.send('⚠️ **Conflicto de Roles**: No puedes pertenecer a una facción legal y una ilegal simultáneamente.\nSe ha revertido la asignación.');
                } catch (e) { }

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

                return;
            }

            // 2. Check Principal Job Limits
            const limits = JobValidator.getLimits(newMember);
            const currentPrincipal = JobValidator.getPrincipalJobCount(newMember);

            if (currentPrincipal > limits.principal) {
                const prevPrincipal = JobValidator.getPrincipalJobCount(oldMember);
                if (currentPrincipal > prevPrincipal) {
                    const roleNames = addedRoles.map(r => r.name).join(', ');
                    logger.warn(`Job limit exceeded for user`, { user: newMember.user.tag, roles: roleNames });

                    await newMember.roles.remove(addedRoles);

                    try {
                        await newMember.send(`⚠️ **Límite de Trabajos Alcanzado**: Tu nivel (${limits.tier}) permite ${limits.principal} trabajos.\nRoles intentados: ${roleNames}`);
                    } catch (e) { }
                }
            }
        }
    } catch (err) {
        logger.errorWithContext('Role conflict handler error', err, { module: 'MOD' });
    }
};
