const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aceptar')
        .setDescription('✅ Gestión de aceptación')
        .addSubcommand(subcommand =>
            subcommand
                .setName('postu')
                .setDescription('Aceptar una postulación de staff')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID de la postulación')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuario que aplicó')
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
            const POSTULANTE_ROLE_ID = '1460071124074233897';
            const MAIN_GUILD_ID = process.env.GUILD_ID || '1398525215134318713';

            try {
                // 1. Verify application exists and is pending
                // Check if applicationId is UUID format or numeric
                const isUUID = applicationId.includes('-');

                let query = supabase
                    .from('applications')
                    .select('*');

                if (isUUID) {
                    // Search by UUID in id column
                    query = query.eq('id', applicationId);
                } else {
                    // Search by numeric id
                    query = query.eq('id', parseInt(applicationId));
                }

                const { data: application, error: fetchError } = await query.maybeSingle();

                if (fetchError || !application) {
                    return interaction.editReply('❌ No se encontró la postulación con ese ID.');
                }

                if (application.status !== 'pending') {
                    return interaction.editReply(`⚠️ Esta postulación ya fue ${application.status === 'approved' ? 'aceptada' : 'denegada'}.`);
                }

                // 2. Update application status
                const { error: updateError } = await supabase
                    .from('applications')
                    .update({
                        status: 'approved',
                        reviewed_by: interaction.user.id,
                        reviewed_at: new Date().toISOString()
                    })
                    .eq('id', applicationId);

                if (updateError) {
                    console.error('Error updating application:', updateError);
                    return interaction.editReply('❌ Error al actualizar la postulación en la base de datos.');
                }

                // 3. Assign "Postulante" role in Main Guild
                try {
                    const mainGuild = await client.guilds.fetch(MAIN_GUILD_ID);
                    const member = await mainGuild.members.fetch(targetUser.id);
                    const postulanteRole = mainGuild.roles.cache.get(POSTULANTE_ROLE_ID);

                    if (!postulanteRole) {
                        console.error(`Role ${POSTULANTE_ROLE_ID} not found in guild ${MAIN_GUILD_ID}`);
                        return interaction.editReply('❌ No se encontró el rol de "Postulante" en el servidor principal.');
                    }

                    await member.roles.add(postulanteRole);

                    // 4. Send success embed
                    const embed = new EmbedBuilder()
                        .setTitle('✅ POSTULACIÓN ACEPTADA')
                        .setColor(0x00FF00)
                        .setDescription(`**Usuario:** ${targetUser} (${targetUser.tag})\n**ID Postulación:** \`${applicationId}\`\n**Rol Asignado:** <@&${POSTULANTE_ROLE_ID}>\n**Revisado por:** ${interaction.user.tag}`)
                        .setThumbnail(targetUser.displayAvatarURL())
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                    // 5. Notify user via DM
                    try {
                        await targetUser.send(`🎉 **¡FELICIDADES!**\n\nTu postulación para staff en **Nación MX** ha sido **ACEPTADA**.\n\nSe te ha asignado el rol de **Postulante**. Recibirás más información pronto sobre los próximos pasos.\n\n👮 **Revisado por:** ${interaction.user.tag}`);
                    } catch (dmError) {
                        console.log('Could not DM user:', dmError.message);
                    }

                } catch (roleError) {
                    console.error('Error assigning role:', roleError);
                    // Update status back to pending if role assignment failed
                    await supabase
                        .from('applications')
                        .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
                        .eq('id', applicationId);

                    return interaction.editReply('❌ Error al asignar el rol. El usuario podría no estar en el servidor principal.');
                }

            } catch (error) {
                console.error('[Aceptar Postu] Error:', error);
                return interaction.editReply('❌ Error crítico al procesar la aceptación.');
            }
        }
    }
};
