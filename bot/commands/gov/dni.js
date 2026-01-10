const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const ImageGenerator = require('../../utils/ImageGenerator');

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
                    )))
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
                    )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Ver DNI de un ciudadano')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario (opcional - por defecto tú)').setRequired(false))),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply({}); // All DNI commands are public

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

            // 1. Normalization
            const nombreClean = nombre.trim();
            const apellidoClean = apellido.trim();

            if (nombreClean.length < 2 || apellidoClean.length < 2) {
                return interaction.editReply('❌ El nombre y apellido deben tener al menos 2 caracteres.');
            }

            // 2. Check if USER already has a DNI (One per person)
            const { data: existingUser } = await supabase
                .from('citizen_dni')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .maybeSingle();

            if (existingUser) {
                return interaction.editReply(`❌ ${targetUser.tag} ya tiene un DNI registrado. Usa \`/dni editar\` para modificarlo.`);
            }

            // 3. DUPLICATE IDENTITY CHECK (Name Collision)
            // Prevent same name usage (Case Insensitive)
            // "letras similares" -> We rely on ILIKE which handles case.
            // Ideally we'd use 'unaccent' but it requires extension. 
            // We'll check for exact case-insensitive match for now.
            const { data: duplicateName } = await supabase
                .from('citizen_dni')
                .select('user_id')
                .ilike('nombre', nombreClean)
                .ilike('apellido', apellidoClean)
                .neq('user_id', targetUser.id) // Should be implied since user has no DNI, but safe check
                .maybeSingle();

            if (duplicateName) {
                return interaction.editReply(`⛔ **Nombre No Disponible**\n\nYa existe un ciudadano registrado con el nombre **${nombreClean} ${apellidoClean}** (o muy similar).\nPor favor elige otro nombre para evitar duplicidad de identidad.`);
            }

            // Check logic ends here, continue with creation...

            // Calculate fecha_nacimiento
            const currentYear = new Date().getFullYear();
            const birthYear = currentYear - edad;
            const fechaNacimiento = `${birthYear}-01-01`; // Placeholder date

            // Get Discord profile picture
            const fotoUrl = targetUser.displayAvatarURL({ extension: 'png', size: 512 });

            // Insert DNI
            const { data: newDni, error } = await supabase
                .from('citizen_dni')
                .insert({
                    guild_id: interaction.guildId,
                    user_id: targetUser.id,
                    nombre,
                    apellido,
                    edad,
                    fecha_nacimiento: fechaNacimiento,
                    genero,
                    foto_url: fotoUrl, // Discord avatar
                    created_by: interaction.user.id
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    // Unique constraint violation (Race condition caught)
                    return interaction.editReply(`❌ ${targetUser.tag} ya tiene un DNI registrado. Usa \`/dni editar\` para modificarlo.`);
                }
                console.error('[dni] Error creating DNI:', error);
                return interaction.editReply('❌ Error al crear el DNI.');
            }

            // Generate Image
            const dniImageBuffer = await ImageGenerator.generateDNI(newDni);
            const attachment = new AttachmentBuilder(dniImageBuffer, { name: 'dni.png' });

            const embed = new EmbedBuilder()
                .setTitle('✅ DNI Creado')
                .setColor('#00FF00')
                .setDescription(`Se ha creado exitosamente el DNI para <@${targetUser.id}>`)
                .setImage('attachment://dni.png')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], files: [attachment] });

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

            try {
                if (!dni.user_tag) {
                    dni.user_tag = targetUser.tag;
                }

                // Fallback: If no photo in DB, use current Discord Avatar
                if (!dni.foto_url) {
                    dni.foto_url = targetUser.displayAvatarURL({ extension: 'png', size: 512 });
                }

                // Generate Image
                const dniImageBuffer = await ImageGenerator.generateDNI(dni);
                const attachment = new AttachmentBuilder(dniImageBuffer, { name: 'dni.png' });

                const embed = new EmbedBuilder()
                    .setTitle('🪪 Documento Nacional de Identidad')
                    .setColor('#00AAC0')
                    .setDescription(`Documento oficial de identidad de <@${targetUser.id}>`)
                    .setImage('attachment://dni.png')
                    .setFooter({ text: `Registrado: ${new Date(dni.created_at).toLocaleDateString('es-MX')}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed], files: [attachment] });
            } catch (err) {
                console.error('DNI Gen Error:', err);
                await interaction.editReply(`❌ Error generando DNI: ${err.message}\n\`\`\`${err.stack}\`\`\``);
            }
        }
    }
};
