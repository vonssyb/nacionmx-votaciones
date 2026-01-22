const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('🎫 Gestión avanzada de tickets')
        .addSubcommand(sub => sub
            .setName('cerrar')
            .setDescription('Cerrar el ticket actual'))
        .addSubcommand(sub => sub
            .setName('reclamar')
            .setDescription('Reclamar el ticket actual para atenderlo'))
        .addSubcommand(sub => sub
            .setName('transferir')
            .setDescription('Transferir el ticket a otro staff')
            .addUserOption(opt => opt
                .setName('staff')
                .setDescription('Staff al que transferir')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('añadir')
            .setDescription('Añadir un usuario al ticket')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Usuario a añadir')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('remover')
            .setDescription('Remover un usuario del ticket')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Usuario a remover')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('renombrar')
            .setDescription('Cambiar el nombre del ticket')
            .addStringOption(opt => opt
                .setName('nombre')
                .setDescription('Nuevo nombre del canal')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('blacklist')
            .setDescription('Vetar a un usuario de crear tickets')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Usuario a vetar')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('razon')
                .setDescription('Razón del veto')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('unblacklist')
            .setDescription('Quitar veto de tickets a un usuario')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Usuario a desvetar')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('stats')
            .setDescription('Ver estadísticas de tickets')
            .addUserOption(opt => opt
                .setName('staff')
                .setDescription('Ver stats de otro staff (opcional)')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('info')
            .setDescription('Ver información detallada del ticket actual'))
        .addSubcommandGroup(group => group
            .setName('admin')
            .setDescription('Comandos administrativos de tickets')
            .addSubcommand(sub => sub
                .setName('unclaim')
                .setDescription('Libera forzosamente un ticket reclamado'))),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup();

        // Staff role check for most commands
        const STAFF_ROLES = [
            '1412887167654690908', // Staff
            '1412882248411381872', // Administración
            '1412887079612059660'  // Staff General
        ];

        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
            interaction.member.roles.cache.some(r => STAFF_ROLES.includes(r.id));

        // Commands that require staff permissions
        if (['reclamar', 'transferir', 'añadir', 'remover', 'renombrar', 'blacklist', 'unblacklist'].includes(subcommand) && !isStaff && !subcommandGroup) {
            return interaction.editReply('❌ Solo el Staff puede usar este comando.');
        }

        if (subcommandGroup === 'admin') {
            // Admin check
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
                interaction.member.roles.cache.has('1412882245735420006'); // Junta Directiva

            if (!isAdmin) {
                return interaction.editReply('❌ Solo Administradores o Junta Directiva pueden usar este comando.');
            }

            if (subcommand === 'unclaim') {
                return handleAdminUnclaim(interaction, supabase);
            }
        }

        switch (subcommand) {
            case 'cerrar':
                return handleCerrar(interaction, supabase);

            case 'reclamar':
                return handleReclamar(interaction, supabase);

            case 'transferir':
                return handleTransferir(interaction, supabase, client);

            case 'añadir':
                return handleAñadir(interaction, supabase);

            case 'remover':
                return handleRemover(interaction, supabase);

            case 'renombrar':
                return handleRenombrar(interaction, supabase);

            case 'blacklist':
                return handleBlacklist(interaction, supabase);

            case 'unblacklist':
                return handleUnblacklist(interaction, supabase);

            case 'stats':
                return handleStats(interaction, supabase);

            case 'info':
                return handleInfo(interaction, supabase);
        }
    }
};

async function handleCerrar(interaction, supabase) {
    const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('channel_id', interaction.channel.id)
        .single();

    if (!ticket) {
        // ORPHAN TICKET HANDLING
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

        if (isStaff) {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('force_close_ticket') // Handled by global interaction handler or need new one? 
                    // Since buttons usually need a handler, we might need to handle this right here if it was a component collector, 
                    // but for persistent buttons we rely on the main handler. 
                    // HOWEVER, for simplicity in a quick fix, let's just use a confirmation interaction collector locally OR a distinct ID.
                    // The existing button handler likely won't recognize 'force_close_ticket'.
                    // Let's use a simple collector here since it's an edge case.
                    .setLabel('🗑️ Forzar Eliminación (Orphan)')
                    .setStyle(ButtonStyle.Danger)
            );

            const msg = await interaction.editReply({
                content: '⚠️ **Error de Base de Datos**: Este canal no está registrado como ticket en el sistema.\n\n¿Deseas **forzar la eliminación** del canal de todas formas?',
                components: [row]
            });

            const filter = i => i.customId === 'force_close_ticket' && i.user.id === interaction.user.id;
            try {
                const confirmation = await msg.awaitMessageComponent({ filter, time: 15000 });
                await confirmation.update({ content: '🗑️ Eliminando canal huérfano...', components: [] });
                await interaction.channel.delete('Ticket Huérfano - Forzado por Staff');
            } catch (e) {
                await interaction.editReply({ content: '❌ Cancelado / Tiempo agotado.', components: [] });
            }
            return;
        }

        return interaction.editReply('❌ Este no es un canal de ticket válido.');
    }

    // Only creator or staff can close
    const isCreator = ticket.creator_id === interaction.user.id;
    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!isCreator && !isStaff) {
        return interaction.editReply('❌ Solo el creador del ticket o el staff pueden cerrarlo.');
    }

    await interaction.editReply('✅ Cerrando ticket...');

    // Trigger the close flow (same as button)
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const embed = new EmbedBuilder()
        .setTitle('🔒 Finalizado')
        .setDescription('Califica la atención:\n\n⭐ Da clic en **Calificar** para escribir tu calificación (1-5 estrellas) y comentarios.')
        .setColor(0xFEE75C);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_rating_modal')
            .setEmoji('✍️')
            .setLabel('Calificar')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('feedback_s')
            .setLabel('Omitir')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({
        content: `<@${ticket.creator_id}>`,
        embeds: [embed],
        components: [row]
    });
}

async function handleReclamar(interaction, supabase) {
    const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('channel_id', interaction.channel.id)
        .single();

    if (!ticket) {
        return interaction.editReply('❌ Este no es un canal de ticket válido.');
    }

    // Check if already claimed by same user
    if (ticket.claimed_by_id === interaction.user.id) {
        return interaction.editReply('✅ Ya tienes este ticket reclamado.');
    }

    // Check if claimed by someone else
    if (ticket.claimed_by_id) {
        return interaction.editReply(`⚠️ Este ticket ya está siendo atendido por <@${ticket.claimed_by_id}>.`);
    }

    // Claim the ticket
    await supabase
        .from('tickets')
        .update({ claimed_by_id: interaction.user.id })
        .eq('channel_id', interaction.channel.id);

    // Get support role to hide from others
    const { data: panel } = await supabase
        .from('ticket_panels')
        .select('support_role_id')
        .eq('id', ticket.panel_id)
        .single();

    const roleId = panel?.support_role_id;

    // Hide from other staff, show for claimer
    if (roleId) {
        await interaction.channel.permissionOverwrites.edit(roleId, {
            ViewChannel: false
        });
    }

    // Add claimer explicitly
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true
    });

    await interaction.channel.setTopic(`${interaction.channel.topic} | Staff: ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
        .setDescription(`✋ **Atendido por** <@${interaction.user.id}>\nEl ticket ahora es privado entre tú y el usuario.`)
        .setColor(0x2ECC71);

    await interaction.editReply({ embeds: [embed] });
    await interaction.channel.send({ embeds: [embed] });
}

async function handleTransferir(interaction, supabase, client) {
    const targetStaff = interaction.options.getUser('staff');

    const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('channel_id', interaction.channel.id)
        .single();

    if (!ticket) {
        return interaction.editReply('❌ Este no es un canal de ticket válido.');
    }

    if (ticket.claimed_by_id !== interaction.user.id) {
        return interaction.editReply('❌ Solo quien tiene reclamado el ticket puede transferirlo.');
    }

    // Transfer to new staff
    await supabase
        .from('tickets')
        .update({ claimed_by_id: targetStaff.id })
        .eq('channel_id', interaction.channel.id);

    // Update permissions
    await interaction.channel.permissionOverwrites.delete(interaction.user.id);
    await interaction.channel.permissionOverwrites.edit(targetStaff.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true
    });

    await interaction.channel.setTopic(interaction.channel.topic.replace(interaction.user.tag, targetStaff.tag));

    const embed = new EmbedBuilder()
        .setTitle('🔄 Ticket Transferido')
        .setDescription(`De: <@${interaction.user.id}>\nA: <@${targetStaff.id}>`)
        .setColor(0x3498DB);

    await interaction.editReply({ embeds: [embed] });
    await interaction.channel.send({ embeds: [embed] });
}

async function handleAñadir(interaction, supabase) {
    const targetUser = interaction.options.getUser('usuario');

    const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('channel_id', interaction.channel.id)
        .single();

    if (!ticket) {
        return interaction.editReply('❌ Este no es un canal de ticket válido.');
    }

    await interaction.channel.permissionOverwrites.edit(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true
    });

    await interaction.editReply(`✅ ${targetUser} fue añadido al ticket.`);
    await interaction.channel.send(`➕ <@${targetUser.id}> fue añadido al ticket por <@${interaction.user.id}>.`);
}

async function handleRemover(interaction, supabase) {
    const targetUser = interaction.options.getUser('usuario');

    const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('channel_id', interaction.channel.id)
        .single();

    if (!ticket) {
        return interaction.editReply('❌ Este no es un canal de ticket válido.');
    }

    if (ticket.creator_id === targetUser.id) {
        return interaction.editReply('❌ No puedes remover al creador del ticket.');
    }

    await interaction.channel.permissionOverwrites.delete(targetUser.id);

    await interaction.editReply(`✅ ${targetUser} fue removido del ticket.`);
    await interaction.channel.send(`➖ <@${targetUser.id}> fue removido del ticket por <@${interaction.user.id}>.`);
}

async function handleRenombrar(interaction, supabase) {
    const nuevoNombre = interaction.options.getString('nombre')
        .toLowerCase()
        .replace(/[^a-z0-9\-_]/g, '')
        .substring(0, 50);

    const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('channel_id', interaction.channel.id)
        .single();

    if (!ticket) {
        return interaction.editReply('❌ Este no es un canal de ticket válido.');
    }

    const nombreAnterior = interaction.channel.name;
    await interaction.channel.setName(nuevoNombre);

    await interaction.editReply(`✅ Canal renombrado de **${nombreAnterior}** a **${nuevoNombre}**.`);
}

async function handleBlacklist(interaction, supabase) {
    const targetUser = interaction.options.getUser('usuario');
    const razon = interaction.options.getString('razon');

    // Only admins can blacklist
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply('❌ Solo administradores pueden vetar usuarios.');
    }

    const { error } = await supabase
        .from('ticket_blacklist')
        .insert({
            guild_id: interaction.guildId,
            user_id: targetUser.id,
            reason: razon,
            blacklisted_by: interaction.user.id,
            blacklisted_at: new Date().toISOString()
        });

    if (error) {
        if (error.code === '23505') {
            return interaction.editReply('⚠️ Este usuario ya está en la blacklist de tickets.');
        }
        console.error('[Blacklist] Error:', error);
        return interaction.editReply('❌ Error al añadir a la blacklist.');
    }

    const embed = new EmbedBuilder()
        .setTitle('🚫 Usuario Vetado de Tickets')
        .addFields(
            { name: '👤 Usuario', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: '👮 Por', value: interaction.user.tag, inline: true },
            { name: '📝 Razón', value: razon, inline: false }
        )
        .setColor(0xFF0000)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleUnblacklist(interaction, supabase) {
    const targetUser = interaction.options.getUser('usuario');

    // Only admins can remove from blacklist
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply('❌ Solo administradores pueden quitar vetos.');
    }

    const { error } = await supabase
        .from('ticket_blacklist')
        .delete()
        .eq('user_id', targetUser.id)
        .eq('guild_id', interaction.guildId);

    if (error) {
        console.error('[Unblacklist] Error:', error);
        return interaction.editReply('❌ Error al quitar de la blacklist.');
    }

    await interaction.editReply(`✅ ${targetUser.tag} fue removido de la blacklist de tickets.`);
}

async function handleStats(interaction, supabase) {
    const targetUser = interaction.options.getUser('staff') || interaction.user;

    const { data: tickets, count: totalTickets } = await supabase
        .from('tickets')
        .select('*', { count: 'exact' })
        .eq('claimed_by_id', targetUser.id);

    const { count: closedTickets } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('claimed_by_id', targetUser.id)
        .eq('status', 'CLOSED');

    const { count: openTickets } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('claimed_by_id', targetUser.id)
        .eq('status', 'OPEN');

    // Calculate average rating
    const { data: ratedTickets } = await supabase
        .from('tickets')
        .select('rating')
        .eq('claimed_by_id', targetUser.id)
        .not('rating', 'is', null);

    let avgRating = 0;
    if (ratedTickets && ratedTickets.length > 0) {
        const sum = ratedTickets.reduce((acc, t) => acc + (t.rating || 0), 0);
        avgRating = (sum / ratedTickets.length).toFixed(2);
    }

    const embed = new EmbedBuilder()
        .setTitle('📊 Estadísticas de Tickets')
        .setDescription(`Stats de ${targetUser}`)
        .addFields(
            { name: '📥 Total Reclamados', value: `${totalTickets || 0}`, inline: true },
            { name: '🔒 Cerrados', value: `${closedTickets || 0}`, inline: true },
            { name: '🟢 Activos', value: `${openTickets || 0}`, inline: true },
            { name: '⭐ Rating Promedio', value: avgRating > 0 ? `${avgRating}/5 (${ratedTickets.length} ratings)` : 'Sin ratings', inline: false }
        )
        .setColor(0x5865F2)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleInfo(interaction, supabase) {
    const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('channel_id', interaction.channel.id)
        .single();

    if (!ticket) {
        return interaction.editReply('❌ Este no es un canal de ticket válido.');
    }

    const creator = await interaction.client.users.fetch(ticket.creator_id).catch(() => null);
    const claimer = ticket.claimed_by_id ? await interaction.client.users.fetch(ticket.claimed_by_id).catch(() => null) : null;

    const createdDate = new Date(ticket.created_at);
    const now = new Date();
    const duration = Math.floor((now - createdDate) / 1000 / 60); // minutes

    const embed = new EmbedBuilder()
        .setTitle('ℹ️ Información del Ticket')
        .addFields(
            { name: '🆔 ID', value: ticket.id.toString(), inline: true },
            { name: '📊 Estado', value: ticket.status, inline: true },
            { name: '👤 Creador', value: creator ? `${creator.tag}` : 'Desconocido', inline: true },
            { name: '👮 Atendido por', value: claimer ? `${claimer.tag}` : 'Sin reclamar', inline: true },
            { name: '📅 Creado', value: `<t:${Math.floor(createdDate.getTime() / 1000)}:R>`, inline: true },
            { name: '⏱️ Duración', value: `${duration} minutos`, inline: true }
        )
        .setColor(0x5865F2)
        .setTimestamp();

    if (ticket.rating) {
        embed.addFields({ name: '⭐ Rating', value: '⭐'.repeat(ticket.rating), inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleAdminUnclaim(interaction, supabase) {
    try {
        const { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .select('*')
            .eq('channel_id', interaction.channel.id)
            .maybeSingle();

        if (ticketError) throw ticketError;

        if (!ticket) {
            return interaction.editReply('❌ Este no es un canal de ticket válido.');
        }

        if (!ticket.claimed_by_id) {
            return interaction.editReply('⚠️ Este ticket no está reclamado por nadie.');
        }

        const previousClaimerId = ticket.claimed_by_id;

        // 1. Reset DB
        await supabase
            .from('tickets')
            .update({ claimed_by_id: null })
            .eq('channel_id', interaction.channel.id);

        // 2. Restore Support/Staff Role Visibility
        let roleId = '1412887167654690908'; // Default fallback

        if (ticket.panel_id) {
            const { data: panel } = await supabase
                .from('ticket_panels')
                .select('support_role_id')
                .eq('id', ticket.panel_id)
                .maybeSingle();

            if (panel?.support_role_id) roleId = panel.support_role_id;
        }

        if (roleId) {
            await interaction.channel.permissionOverwrites.edit(roleId, {
                ViewChannel: true,
                SendMessages: true
            }).catch(err => console.error('Error resetting staff role perms:', err));
        }

        // 3. Remove Previous Claimer's Exclusive Perms
        await interaction.channel.permissionOverwrites.delete(previousClaimerId).catch(() => { });

        // 4. Update Topic
        const newTopic = interaction.channel.topic ? interaction.channel.topic.replace(/ \| Staff: .*/, '') : 'Ticket';
        await interaction.channel.setTopic(newTopic).catch(() => { });

        // 5. Notify
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle('🔓 Ticket Liberado (Admin)')
            .setDescription(`El ticket ha sido liberado forzosamente por <@${interaction.user.id}>.\n\n👤 **Anterior Staff:** <@${previousClaimerId}>\n📢 **Estado:** Visible para todo el Staff.`)
            .setColor(0xE67E22)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        await interaction.channel.send({ content: `🚨 <@&${roleId}> Ticket liberado y disponible.`, embeds: [embed] });

    } catch (error) {
        console.error('[Ticket Unclaim Error]', error);
        await interaction.editReply(`❌ Error fatal: ${error.message}`);
    }
}
