/**
 * Self-Action Approval Button Handlers
 * 
 * These handlers are called when a superior clicks approve/reject buttons
 * on self-action notifications sent by SelfActionService
 */

const SelfActionService = require('../services/SelfActionService');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

/**
 * Handle self-action approval buttons
 * Button IDs format: sa_approve_{actionType}_{requestId}_{...params}
 * Button IDs format: sa_reject_{actionType}_{requestId}
 */
async function handleSelfActionButtons(interaction, client, supabase) {
    const customId = interaction.customId;

    // Check if this is a self-action button
    if (!customId.startsWith('sa_approve_') && !customId.startsWith('sa_reject_')) {
        return false; // Not handled
    }

    // Security check - only allowed approvers
    const selfActionService = new SelfActionService(client, supabase);
    if (!selfActionService.canApproveSelfAction(interaction.member)) {
        await interaction.reply({
            content: '🛑 **Acceso Denegado:** Solo superiores (Junta Directiva, Encargados) pueden aprobar auto-acciones.',
            flags: [64]
        });
        return true; // Handled but denied
    }

    await interaction.deferUpdate();

    // Parse button ID
    const isApproval = customId.startsWith('sa_approve_');
    const parts = customId.replace('sa_approve_', '').replace('sa_reject_', '').split('_');
    const actionType = parts[0];

    if (isApproval) {
        // APPROVAL LOGIC
        try {
            let result;

            switch (actionType) {
                case 'role':
                    result = await handleRoleApproval(parts, interaction, client, supabase);
                    break;
                case 'removerole':
                    result = await handleRemoveRoleApproval(parts, interaction, client, supabase);
                    break;
                case 'temprole':
                    result = await handleTempRoleApproval(parts, interaction, client, supabase);
                    break;
                case 'money':
                    result = await handleMoneyApproval(parts, interaction, client, supabase);
                    break;
                case 'appeal':
                    result = await handleAppealApproval(parts, interaction, client, supabase);
                    break;
                case 'removesanc':
                    result = await handleRemoveSanctionApproval(parts, interaction, client, supabase);
                    break;
                case 'editwarn':
                    result = await handleEditWarnApproval(parts, interaction, client, supabase);
                    break;
                case 'clearhistory':
                    result = await handleClearHistoryApproval(parts, interaction, client, supabase);
                    break;
                default:
                    result = { success: false, error: 'Tipo de acción desconocido' };
            }

            if (result.success) {
                const successEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#00FF00')
                    .setTitle('✅ AUTO-ACCIÓN APROBADA')
                    .addFields({ name: '👮 Aprobado por', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true });

                await interaction.editReply({
                    embeds: [successEmbed],
                    components: []
                });

                // Notify requester
                const embed = interaction.message.embeds[0];
                const requesterMatch = embed.fields[0].value.match(/<@(\d+)>/);
                if (requesterMatch) {
                    const requesterId = requesterMatch[1];
                    try {
                        const requester = await client.users.fetch(requesterId);
                        await requester.send(`✅ **Auto-Acción Aprobada**\n\nTu solicitud de auto-${getActionLabel(actionType)} ha sido **aprobada** por ${interaction.user.tag}.\n\nLa acción fue ejecutada exitosamente.`);
                    } catch (e) {
                        console.log('[SelfAction] Could not DM requester:', e.message);
                    }
                }
            } else {
                await interaction.followUp({
                    content: `❌ Error ejecutando la acción: ${result.error}`,
                    flags: [64]
                });
            }
        } catch (error) {
            console.error('[SelfAction] Approval error:', error);
            await interaction.followUp({
                content: '❌ Error procesando la aprobación.',
                flags: [64]
            });
        }
    } else {
        // REJECTION LOGIC
        const rejectEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('#FF0000')
            .setTitle('❌ AUTO-ACCIÓN RECHAZADA')
            .addFields({ name: '❌ Rechazado por', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true });

        await interaction.editReply({
            embeds: [rejectEmbed],
            components: []
        });

        // Notify requester
        const embed = interaction.message.embeds[0];
        const requesterMatch = embed.fields[0].value.match(/<@(\d+)>/);
        if (requesterMatch) {
            const requesterId = requesterMatch[1];
            try {
                const requester = await client.users.fetch(requesterId);
                await requester.send(`❌ **Auto-Acción Rechazada**\n\nTu solicitud de auto-${getActionLabel(actionType)} ha sido **rechazada** por ${interaction.user.tag}.\n\nPor favor contacta a un superior si crees que esto es un error.`);
            } catch (e) {
                console.log('[SelfAction] Could not DM requester:', e.message);
            }
        }
    }

    return true; // Handled
}

function getActionLabel(actionType) {
    const labels = {
        role: 'asignación de rol',
        removerole: 'remoción de rol',
        temprole: 'asignación de rol temporal',
        money: 'modificación de dinero',
        appeal: 'aprobación de apelación',
        removesanc: 'eliminación de sanción',
        editwarn: 'edición de warn',
        clearhistory: 'limpieza de historial'
    };
    return labels[actionType] || 'acción';
}

// Individual approval handlers
async function handleRoleApproval(parts, interaction, client, supabase) {
    // parts: [role, requestId, roleId]
    const roleId = parts[2];
    const embed = interaction.message.embeds[0];
    const requesterMatch = embed.fields[0].value.match(/<@(\d+)>/);

    if (!requesterMatch) return { success: false, error: 'No se pudo identificar al usuario' };

    const userId = requesterMatch[1];
    const member = await interaction.guild.members.fetch(userId);
    const role = await interaction.guild.roles.fetch(roleId);

    if (!role) return { success: false, error: 'Rol no encontrado' };

    await member.roles.add(role);
    return { success: true };
}

async function handleRemoveRoleApproval(parts, interaction, client, supabase) {
    const roleId = parts[2];
    const embed = interaction.message.embeds[0];
    const requesterMatch = embed.fields[0].value.match(/<@(\d+)>/);

    if (!requesterMatch) return { success: false, error: 'No se pudo identificar al usuario' };

    const userId = requesterMatch[1];
    const member = await interaction.guild.members.fetch(userId);
    const role = await interaction.guild.roles.fetch(roleId);

    if (!role) return { success: false, error: 'Rol no encontrado' };

    await member.roles.remove(role);
    return { success: true };
}

async function handleTempRoleApproval(parts, interaction, client, supabase) {
    // Similar to role approval but with expiration
    const roleId = parts[2];
    const duration = parts[3];
    const embed = interaction.message.embeds[0];
    const requesterMatch = embed.fields[0].value.match(/<@(\d+)>/);

    if (!requesterMatch) return { success: false, error: 'No se pudo identificar al usuario' };

    const userId = requesterMatch[1];
    const member = await interaction.guild.members.fetch(userId);
    const role = await interaction.guild.roles.fetch(roleId);

    if (!role) return { success: false, error: 'Rol no encontrado' };

    await member.roles.add(role);

    // Calculate expiration (simplified, you may need moment.js parsing from duration string)
    const moment = require('moment-timezone');
    let durationMinutes = 0;
    const match = duration.match(/(\d+)([mhdw])/);
    if (match) {
        const amount = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 'm': durationMinutes = amount; break;
            case 'h': durationMinutes = amount * 60; break;
            case 'd': durationMinutes = amount * 1440; break;
            case 'w': durationMinutes = amount * 10080; break;
        }
    }

    const expiresAt = moment().add(durationMinutes, 'minutes');

    await supabase.from('temp_roles').insert({
        guild_id: interaction.guildId,
        user_id: userId,
        role_id: roleId,
        expires_at: expiresAt.toISOString(),
        assigned_by: userId // Self-assigned but approved
    });

    return { success: true };
}

async function handleMoneyApproval(parts, interaction, client, supabase) {
    // parts: [money, subcommand, requestId, amount]
    const subCmd = parts[1]; // 'añadir' or 'quitar'
    const amount = parseInt(parts[3]);
    const embed = interaction.message.embeds[0];
    const requesterMatch = embed.fields[0].value.match(/<@(\d+)>/);

    if (!!!requesterMatch) return { success: false, error: 'No se pudo identificar al usuario' };

    const userId = requesterMatch[1];

    const UnbelievaBoatService = require('../services/UnbelievaBoatService');
    const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);

    if (subCmd === 'añadir') {
        await ubService.addMoney(interaction.guildId, userId, amount, 'Auto-aprobado por superior', 'cash');
    } else {
        await ubService.removeMoney(interaction.guildId, userId, amount, 'Auto-aprobado por superior', 'cash');
    }

    return { success: true };
}

async function handleAppealApproval(parts, interaction, client, supabase) {
    // parts: [appeal, requestId, sanctionId]
    const sanctionId = parts[2];

    if (!client.services || !client.services.sanctions) {
        return { success: false, error: 'Servicio de sanciones no disponible' };
    }

    await client.services.sanctions.appealSanction(sanctionId, 'Auto-apelación aprobada por superior');
    return { success: true };
}

async function handleRemoveSanctionApproval(parts, interaction, client, supabase) {
    // parts: [removesanc, requestId, sanctionId]
    const sanctionId = parts[2];

    if (!client.services || !client.services.sanctions) {
        return { success: false, error: 'Servicio de sanciones no disponible' };
    }

    await client.services.sanctions.voidSanction(sanctionId, 'Auto-eliminación aprobada por superior', interaction.user.id);
    return { success: true };
}

async function handleEditWarnApproval(parts, interaction, client, supabase) {
    // parts: [editwarn, requestId, sanctionId]
    const sanctionId = parts[2];

    // Get the metadata from the embed to retrieve the pending updates
    const embed = interaction.message.embeds[0];

    // Try to extract metadata from embed fields
    // The metadata was stored when the approval request was created
    // We need to parse it from the embed or reconstruct it

    // For now, we'll extract from the "Detalles" field
    const detailsField = embed.fields.find(f => f.name === '📝 Detalles');
    if (!detailsField) {
        return { success: false, error: 'No se encontraron los detalles de edición' };
    }

    const details = detailsField.value;
    const reasonMatch = details.match(/Nuevo Motivo: (.+?)(?:\n|$)/);
    const evidenceMatch = details.match(/Nueva Evidencia: (.+?)(?:\n|$)/);

    const updates = {};
    if (reasonMatch && reasonMatch[1] !== 'Sin cambios') {
        updates.reason = reasonMatch[1];
    }
    if (evidenceMatch && evidenceMatch[1] !== 'Sin cambios') {
        updates.evidence_url = evidenceMatch[1];
    }

    if (Object.keys(updates).length === 0) {
        return { success: false, error: 'No hay cambios para aplicar' };
    }

    if (!client.services || !client.services.sanctions) {
        return { success: false, error: 'Servicio de sanciones no disponible' };
    }

    try {
        await client.services.sanctions.updateSanction(sanctionId, updates);

        // Notify the user about the edit
        const existing = await client.services.sanctions.getSanctionById(sanctionId);
        if (existing && existing.discord_user_id) {
            try {
                const user = await client.users.fetch(existing.discord_user_id);
                const { EmbedBuilder } = require('discord.js');

                const dmEmbed = new EmbedBuilder()
                    .setTitle('✏️ Sanción Editada / Actualizada')
                    .setColor('#FFA500')
                    .setDescription(`Los detalles de tu sanción en **${interaction.guild.name}** han sido modificados (aprobado por superior).`)
                    .addFields({ name: '🆔 ID Sanción', value: `\`${sanctionId}\``, inline: true });

                if (updates.reason) dmEmbed.addFields({ name: '📄 Nuevo Motivo', value: updates.reason, inline: false });
                if (updates.evidence_url) {
                    dmEmbed.addFields({ name: '📎 Nueva Evidencia', value: updates.evidence_url, inline: false });
                    dmEmbed.setImage(updates.evidence_url);
                }

                await user.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.error('[EditWarn] Could not DM user:', dmError);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('[EditWarn] Error applying edit:', error);
        return { success: false, error: error.message };
    }
}

async function handleClearHistoryApproval(parts, interaction, client, supabase) {
    // parts: [clearhistory, requestId, months]
    const months = parseInt(parts[2]);
    const embed = interaction.message.embeds[0];
    const requesterMatch = embed.fields[0].value.match(/<@(\d+)>/);

    if (!requesterMatch) return { success: false, error: 'No se pudo identificar al usuario' };

    const userId = requesterMatch[1];

    if (!client.services || !client.services.sanctions) {
        return { success: false, error: 'Servicio de sanciones no disponible' };
    }

    await client.services.sanctions.archiveOldSanctions(userId, months);
    return { success: true };
}

module.exports = { handleSelfActionButtons };
