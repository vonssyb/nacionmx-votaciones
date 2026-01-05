const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dni')
        .setDescription('🪪 Sistema de Identificación Ciudadana')
        .addSubcommand(subcommand =>
            subcommand
                .setName('crear')
                .setDescription('Crear tu DNI ciudadano')
                .addStringOption(option => option.setName('nombre').setDescription('Nombre').setRequired(true))
                .addStringOption(option => option.setName('apellido').setDescription('Apellido').setRequired(true))
                .addIntegerOption(option => option.setName('edad').setDescription('Edad (18-99)').setRequired(true).setMinValue(18).setMaxValue(99))
                .addStringOption(option => option.setName('genero').setDescription('Género').setRequired(true)
                    .addChoices(
                        { name: 'Masculino', value: 'Masculino' },
                        { name: 'Femenino', value: 'Femenino' },
                        { name: 'Otro', value: 'Otro' }
                    ))
                .addStringOption(option => option.setName('nacionalidad').setDescription('Nacionalidad').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('editar')
                .setDescription('Editar DNI existente (Solo Staff)')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario').setRequired(true))
                .addStringOption(option => option.setName('nombre').setDescription('Nombre').setRequired(false))
                .addStringOption(option => option.setName('apellido').setDescription('Apellido').setRequired(false))
                .addIntegerOption(option => option.setName('edad').setDescription('Edad (18-99)').setRequired(false).setMinValue(18).setMaxValue(99))
                .addStringOption(option => option.setName('genero').setDescription('Género').setRequired(false)
                    .addChoices(
                        { name: 'Masculino', value: 'Masculino' },
                        { name: 'Femenino', value: 'Femenino' },
                        { name: 'Otro', value: 'Otro' }
                    ))
                .addStringOption(option => option.setName('nacionalidad').setDescription('Nacionalidad').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Ver DNI de un ciudadano')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario (opcional - por defecto tú)').setRequired(false))),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: false }); // All DNI commands are public

        const subCmd = interaction.options.getSubcommand();
        const administradorRoleId = '1412882248411381872';

        // Permission check ONLY for editar - only Administrador role
        const isAdmin = interaction.member.roles.cache.has(administradorRoleId) ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (subCmd === 'editar' && !isAdmin) {
            return interaction.editReply('❌ Solo los Administradores pueden editar DNIs.');
        }

        if (subCmd === 'crear') {
            const targetUser = interaction.user; // Usuario que ejecuta el comando
            const nombre = interaction.options.getString('nombre');
            const apellido = interaction.options.getString('apellido');
            const edad = interaction.options.getInteger('edad');
            const genero = interaction.options.getString('genero');
            const nacionalidad = interaction.options.getString('nacionalidad');

            // Check if DNI already exists
            const { data: existing } = await supabase
                .from('citizen_dni')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .maybeSingle();

            if (existing) {
                return interaction.editReply(`❌ ${targetUser.tag} ya tiene un DNI registrado. Usa \`/dni editar\` para modificarlo.`);
            }

            // Calculate fecha_nacimiento
            const currentYear = new Date().getFullYear();
            const birthYear = currentYear - edad;
            const fechaNacimiento = `${birthYear}-01-01`; // Placeholder date

            // Get Discord profile picture
            const fotoUrl = targetUser.displayAvatarURL({ dynamic: true, size: 512 });

            // Insert DNI
            const { error } = await supabase
                .from('citizen_dni')
                .insert({
                    guild_id: interaction.guildId,
                    user_id: targetUser.id,
                    nombre,
                    apellido,
                    edad,
                    fecha_nacimiento: fechaNacimiento,
                    genero,
                    nacionalidad,
                    foto_url: fotoUrl, // Discord avatar
                    created_by: interaction.user.id
                });

            if (error) {
                console.error('[dni] Error creating DNI:', error);
                return interaction.editReply('❌ Error al crear el DNI.');
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ DNI Creado')
                .setColor('#00FF00')
                .addFields(
                    { name: '👤 Ciudadano', value: `<@${targetUser.id}>`, inline: false },
                    { name: '📝 Nombre Completo', value: `${nombre} ${apellido}`, inline: true },
                    { name: '🎂 Edad', value: `${edad} años`, inline: true },
                    { name: '⚧️ Género', value: genero, inline: true },
                    { name: '🌍 Nacionalidad', value: nacionalidad, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } else if (subCmd === 'editar') {
            const targetUser = interaction.options.getUser('usuario');
            const updates = {};

            if (interaction.options.getString('nombre')) updates.nombre = interaction.options.getString('nombre');
            if (interaction.options.getString('apellido')) updates.apellido = interaction.options.getString('apellido');
            if (interaction.options.getInteger('edad')) {
                const edad = interaction.options.getInteger('edad');
                updates.edad = edad;
                const currentYear = new Date().getFullYear();
                const birthYear = currentYear - edad;
                updates.fecha_nacimiento = `${birthYear}-01-01`;
            }
            if (interaction.options.getString('genero')) updates.genero = interaction.options.getString('genero');
            if (interaction.options.getString('nacionalidad')) updates.nacionalidad = interaction.options.getString('nacionalidad');

            if (Object.keys(updates).length === 0) {
                return interaction.editReply('❌ Debes especificar al menos un campo para editar.');
            }

            updates.last_edited_by = interaction.user.id;

            const { error } = await supabase
                .from('citizen_dni')
                .update(updates)
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id);

            if (error) {
                console.error('[dni] Error updating DNI:', error);
                return interaction.editReply('❌ Error al actualizar el DNI o no existe.');
            }

            await interaction.editReply(`✅ DNI de ${targetUser.tag} actualizado correctamente.`);

        } else if (subCmd === 'ver') {
            const targetUser = interaction.options.getUser('usuario') || interaction.user;

            const { data: dni, error } = await supabase
                .from('citizen_dni')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .maybeSingle();

            if (error || !dni) {
                return interaction.editReply(`❌ ${targetUser.tag} no tiene DNI registrado.`);
            }

            const embed = new EmbedBuilder()
                .setTitle('🪪 Documento Nacional de Identidad')
                .setColor('#00AAC0')
                .addFields(
                    { name: '👤 Ciudadano', value: `<@${targetUser.id}>`, inline: false },
                    { name: '📝 Nombre Completo', value: `${dni.nombre} ${dni.apellido}`, inline: false },
                    { name: '🎂 Edad', value: `${dni.edad} años`, inline: true },
                    { name: '📅 Fecha de Nacimiento', value: new Date(dni.fecha_nacimiento).toLocaleDateString('es-MX'), inline: true },
                    { name: '⚧️ Género', value: dni.genero, inline: true },
                    { name: '🌍 Nacionalidad', value: dni.nacionalidad, inline: true }
                )
                .setFooter({ text: `Registrado: ${new Date(dni.created_at).toLocaleDateString('es-MX')}` })
                .setTimestamp();

            if (dni.foto_url) {
                embed.setThumbnail(dni.foto_url);
            }

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
