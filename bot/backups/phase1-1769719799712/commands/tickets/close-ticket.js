const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close-ticket')
        .setDescription('Cerrar ticket inmediatamente sin valoración (Solo Staff)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        // Verify it's a ticket channel
        const { data: ticket } = await supabase
            .from('tickets')
            .select('*')
            .eq('channel_id', interaction.channel.id)
            .maybeSingle();

        if (!ticket) {
            return interaction.editReply('❌ Este comando solo funciona en canales de tickets.');
        }

        if (ticket.status === 'CLOSED') {
            return interaction.editReply('❌ Este ticket ya está cerrado.');
        }

        if (ticket.status === 'PAUSED') {
            return interaction.editReply('⛔ **Ticket Pausado**\nEste ticket está en pausa. Debes reanudarlo con `/ticket reanudar` antes de cerrarlo.');
        }

        try {
            // Generate transcript
            const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                limit: -1,
                returnType: 'attachment',
                filename: `force-close-${interaction.channel.name}.html`,
                saveImages: true
            });

            // Log to transcripts channel
            const LOG_TRANSCRIPTS = '1414065296704016465';
            const logChannel = client.channels.cache.get(LOG_TRANSCRIPTS);
            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🔒 Ticket Cerrado (Forzado)')
                        .addFields(
                            { name: 'Ticket', value: interaction.channel.name, inline: true },
                            { name: 'Cerrado por', value: `${interaction.user.tag}`, inline: true },
                            { name: 'Razón', value: 'Comando /close-ticket', inline: true }
                        )
                        .setColor(0xE74C3C)
                    ],
                    files: [attachment]
                });
            }

            // Send DM to creator
            if (ticket.creator_id) {
                try {
                    const creator = await client.users.fetch(ticket.creator_id);
                    await creator.send({
                        content: `🔒 Tu ticket fue cerrado por un miembro del Staff sin valoración.`,
                        files: [attachment]
                    });
                } catch (e) { }
            }

            // Update DB
            await supabase
                .from('tickets')
                .update({
                    status: 'CLOSED',
                    closed_at: new Date().toISOString(),
                    closed_by_id: interaction.user.id,
                    closure_reason: 'force_close_command'
                })
                .eq('id', ticket.id);

            await interaction.editReply('✅ Ticket cerrado. El canal se eliminará en 3 segundos...');

            setTimeout(() => {
                interaction.channel.delete('Force closed by staff').catch(() => { });
            }, 3000);

        } catch (error) {
            console.error('Error force-closing ticket:', error);
            return interaction.editReply('❌ Error al cerrar el ticket: ' + error.message);
        }
    }
};
