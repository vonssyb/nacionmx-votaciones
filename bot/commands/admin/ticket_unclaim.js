const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket_unclaim')
        .setDescription('ADMIN: Libera forzosamente un ticket reclamado')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, supabase) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        if (!interaction.channel.name.includes('ticket') && !interaction.channel.topic?.includes('ID:')) {
            return interaction.reply({ content: '❌ Este no parece ser un canal de ticket.', ephemeral: true });
        }

        const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).maybeSingle();
        if (!ticket) return interaction.reply({ content: '❌ Ticket no encontrado en base de datos.', ephemeral: true });

        if (!ticket.claimed_by_id) return interaction.reply({ content: '⚠️ Este ticket no está reclamado.', ephemeral: true });

        // Force Unclaim Logic
        await supabase.from('tickets').update({ claimed_by_id: null }).eq('channel_id', interaction.channel.id);

        // Restore Role Perms (Guessing from Panel or Default)
        // Since we don't have the role ID handy in the command context easily without DB join, 
        // we will try to find the "Muted" role in the overwrites or just reset Everyone deny.

        // Better: Fetch panel to get role
        const { data: panel } = await supabase.from('ticket_panels').select('support_role_id').eq('id', ticket.panel_id).maybeSingle();
        if (panel?.support_role_id) {
            await interaction.channel.permissionOverwrites.edit(panel.support_role_id, {
                ViewChannel: true,
                SendMessages: false
            });
        }

        // Remove the claimer's specific overwrite
        await interaction.channel.permissionOverwrites.delete(ticket.claimed_by_id).catch(() => { });

        await interaction.channel.setTopic(interaction.channel.topic.replace(/ \| Staff: .*/, ''));

        await interaction.reply(`🚨 **ADMIN FORCE:** Ticket liberado por ${interaction.user.tag}.`);
    }
};
