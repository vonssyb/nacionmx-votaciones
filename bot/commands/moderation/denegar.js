const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('denegar')
        .setDescription('❌ Gestión de denegación')
        .addSubcommand(subcommand =>
            subcommand
                .setName('postu')
                .setDescription('Denegar una postulación de staff')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID de la postulación')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuario que aplicó')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('razon')
                        .setDescription('Razón del rechazo')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'postu') {
            const applicationId = interaction.options.getString('id');
            const targetUser = interaction.options.getUser('usuario');
            const reason = interaction.options.getString('razon');

            try {
                // 1. Verify application exists and is pending
                const { data: application, error: fetchError } = await supabase
                    .from('applications')
                    .select('*')
                    .eq('id', applicationId)
                    .eq('discord_user_id', targetUser.id)
                    .maybeSingle();

                if (fetchError || !application) {
                    return interaction.editReply('❌ No se encontró la postulación con ese ID para ese usuario.');
                }

                if (application.status !== 'pending') {
                    return interaction.editReply(`⚠️ Esta postulación ya fue ${application.status === 'approved' ? 'aceptada' : 'denegada'}.`);
                }

                // 2. Update application status
                const { error: updateError } = await supabase
                    .from('applications')
                    .update({
                        status: 'rejected',
                        reviewed_by: interaction.user.id,
                        reviewed_at: new Date().toISOString(),
                        rejection_reason: reason
                    })
                    .eq('id', applicationId);

                if (updateError) {
                    console.error('Error updating application:', updateError);
                    return interaction.editReply('❌ Error al actualizar la postulación en la base de datos.');
                }

                // 3. Send success embed
                const embed = new EmbedBuilder()
                    .setTitle('❌ POSTULACIÓN DENEGADA')
                    .setColor(0xFF0000)
                    .setDescription(`**Usuario:** ${targetUser} (${targetUser.tag})\n**ID Postulación:** \`${applicationId}\`\n**Razón:** ${reason}\n**Revisado por:** ${interaction.user.tag}`)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // 4. Notify user via DM
                try {
                    await targetUser.send(`❌ **POSTULACIÓN RECHAZADA**\n\nTu postulación para staff en **Nación MX** ha sido **DENEGADA**.\n\n📝 **Razón:** ${reason}\n\nPuedes volver a aplicar en el futuro si cumples con los requisitos.\n\n👮 **Revisado por:** ${interaction.user.tag}`);
                } catch (dmError) {
                    console.log('Could not DM user:', dmError.message);
                }

            } catch (error) {
                console.error('[Denegar Postu] Error:', error);
                return interaction.editReply('❌ Error crítico al procesar el rechazo.');
            }
        }
    }
};
