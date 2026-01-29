const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../services/Logger');
const { CHANNELS } = require('../../config/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sugerencia')
        .setDescription('Administrar sugerencias')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub =>
            sub.setName('aceptar')
                .setDescription('Aceptar una sugerencia')
                .addIntegerOption(opt => opt.setName('id').setDescription('ID de la sugerencia').setRequired(true))
                .addStringOption(opt => opt.setName('razon').setDescription('Razón de la aceptación').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('rechazar')
                .setDescription('Rechazar una sugerencia')
                .addIntegerOption(opt => opt.setName('id').setDescription('ID de la sugerencia').setRequired(true))
                .addStringOption(opt => opt.setName('razon').setDescription('Razón del rechazo').setRequired(true))
        ),

    async execute(interaction, client, supabase) {
        const subCmd = interaction.options.getSubcommand();
        const id = interaction.options.getInteger('id');
        const razon = interaction.options.getString('razon');
        const isAccept = subCmd === 'aceptar';

        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. Fetch Suggestion
            const { data: suggestion, error } = await supabase
                .from('suggestions')
                .select('*')
                .eq('id', id)
                .single();

            if (!suggestion || error) {
                return interaction.editReply('❌ No se encontró la sugerencia con ese ID.');
            }

            // 2. Fetch Channel and Message
            const channel = await client.channels.fetch(suggestion.channel_id).catch(() => null);
            if (!channel) return interaction.editReply('❌ No se encontró el canal de sugerencias.');

            const message = await channel.messages.fetch(suggestion.message_id).catch(() => null);
            if (!message) return interaction.editReply('❌ No se encontró el mensaje original (pudo ser borrado).');

            // 3. Update DB
            const newStatus = isAccept ? 'approved' : 'rejected';
            await supabase.from('suggestions').update({ status: newStatus }).eq('id', id);

            // 4. Update Embed
            const oldEmbed = message.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed);

            newEmbed.setColor(isAccept ? '#00FF00' : '#FF0000'); // Green or Red

            // Update Status Field
            const statusText = isAccept ? '✅ Aceptada' : '❌ Rechazada';
            newEmbed.spliceFields(0, 1, { name: 'Estado', value: statusText, inline: true });

            // Add Admin Response Field (or update footer)
            newEmbed.addFields({ name: isAccept ? 'Comentario Staff' : 'Razón de Rechazo', value: razon });

            // Remove Buttons (Voting closed)
            await message.edit({ embeds: [newEmbed], components: [] });

            // 5. Notify User (Optional)
            if (suggestion.user_id) {
                try {
                    const user = await client.users.fetch(suggestion.user_id);
                    await user.send(`Tu sugerencia #${id} ha sido **${isAccept ? 'ACEPTADA' : 'RECHAZADA'}**.\n\n**Razón:** ${razon}`);
                } catch (e) { } // User might have DMs closed
            }

            return interaction.editReply(`✅ Sugerencia #${id} ${isAccept ? 'aceptada' : 'rechazada'} correctamente.`);

        } catch (error) {
            logger.errorWithContext('Error managing suggestion', error);
            return interaction.editReply('❌ Ocurrió un error procesando el comando.');
        }
    }
};
