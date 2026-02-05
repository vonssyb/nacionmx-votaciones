const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ROLES = require('../../config/roles.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('salud')
        .setDescription('🏥 Comandos de la Secretaría de Salud')
        .addSubcommand(sub =>
            sub.setName('licencia')
                .setDescription('Otorgar o revocar una licencia médica')
                .addUserOption(opt => opt.setName('usuario').setDescription('Paciente').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('tipo')
                        .setDescription('Tipo de licencia')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Marihuana Medicinal', value: 'medical_weed' },
                            { name: 'Porte de Medicamentos Controlados', value: 'controlled_meds' },
                            { name: 'Incapacidad Laboral', value: 'sick_leave' }
                        )))
        .addSubcommand(sub =>
            sub.setName('revivir')
                .setDescription('Revivir a un usuario (Admin/Emergencia)')
                .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a revivir').setRequired(true))),

    async execute(interaction, client, supabase) {
        // 1. Role Check
        const saludRole = ROLES.government.secretario_salud;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasRole = interaction.member.roles.cache.has(saludRole);

        if (!hasRole && !isAdmin) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando. (Secretario de Salud)', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'licencia') {
            const target = interaction.options.getMember('usuario');
            const type = interaction.options.getString('tipo');

            // Ideally assign a role. Since we don't have IDs for these specific roles in roles.json yet,
            // we will simulate the process with an Official Embed.
            // If the user adds the roles to roles.json later, we can uncomment assignment logic.

            let title = '';
            let desc = '';

            switch (type) {
                case 'medical_weed':
                    title = '🌿 Licencia de Cannabis Medicinal';
                    desc = `Se certifica que **${target.user.tag}** está autorizado para el consumo y porte de dosis personales de cannabis con fines terapéuticos.`;
                    break;
                case 'controlled_meds':
                    title = '💊 Licencia de Medicamentos Controlados';
                    desc = `Se autoriza el porte de medicamentos restringidos para tratamiento médico en curso.`;
                    break;
                case 'sick_leave':
                    title = '🛌 Incapacidad Laboral';
                    desc = `El paciente requiere reposo absoluto y está exento de actividades laborales por 24 horas.`;
                    break;
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏥 Secretaría de Salud: ${title}`)
                .setDescription(desc)
                .addFields(
                    { name: 'Paciente', value: `${target}`, inline: true },
                    { name: 'Doctor/Secretario', value: `${interaction.user}`, inline: true },
                    { name: 'Vigencia', value: '30 Días', inline: true }
                )
                .setColor('#2E8B57') // Sea Green
                .setThumbnail(target.displayAvatarURL())
                .setFooter({ text: 'Nación MX - Sistema de Salud' })
                .setTimestamp();

            // Send to channel and user DM
            await interaction.reply({ embeds: [embed] });
            target.send({ content: 'Has recibido una licencia médica oficial.', embeds: [embed] }).catch(() => { });

        } else if (subcommand === 'revivir') {
            const target = interaction.options.getMember('usuario');

            // Logic to revive would involve:
            // 1. Removing 'Unconscious' role if exists
            // 2. Setting health to 100 in DB (if health system exists)
            // 3. Teleporting? (Not possible via bot simply)

            // For now, removing 'arrested' role if accidental death in custody? No, strictly medical.
            // Assume we just announce the revive.

            const embed = new EmbedBuilder()
                .setTitle('✨ REANIMACIÓN EXITOSA')
                .setDescription(`El usuario **${target}** ha sido reanimado por la intervención de la Secretaría de Salud.`)
                .setColor('#00FFFF');

            await interaction.reply({ embeds: [embed] });
        }
    }
};
