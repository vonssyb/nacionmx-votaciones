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

        // Only process if roles were added
        if (addedRoles.size === 0) return;

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
