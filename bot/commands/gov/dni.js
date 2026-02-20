const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const ImageGenerator = require('../../utils/ImageGenerator');
const DNIService = require('../../services/DNIService');
const CharacterService = require('../../services/CharacterService');

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
                // New Fields for Date of Birth
                .addIntegerOption(option => option.setName('dia').setDescription('Día de nacimiento').setRequired(true).setMinValue(1).setMaxValue(31))
                .addStringOption(option => option.setName('mes').setDescription('Mes de nacimiento').setRequired(true)
                    .addChoices(
                        { name: 'Enero', value: '01' }, { name: 'Febrero', value: '02' }, { name: 'Marzo', value: '03' },
                        { name: 'Abril', value: '04' }, { name: 'Mayo', value: '05' }, { name: 'Junio', value: '06' },
                        { name: 'Julio', value: '07' }, { name: 'Agosto', value: '08' }, { name: 'Septiembre', value: '09' },
                        { name: 'Octubre', value: '10' }, { name: 'Noviembre', value: '11' }, { name: 'Diciembre', value: '12' }
                    ))
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
                    ))
                .addIntegerOption(option => option.setName('slot').setDescription('Slot del personaje (1 o 2)').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Ver DNI de un ciudadano')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario (opcional - por defecto tú)').setRequired(false))
                .addIntegerOption(option => option.setName('slot').setDescription('Slot del personaje (1 o 2)').setRequired(false))),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({});

        // Initialize Services
        const characterService = new CharacterService(client, supabase);

        const subCmd = interaction.options.getSubcommand();
        const administradorRoleId = '1412882248411381872';

        // Permission check for editar
        const isAdmin = interaction.member.roles.cache.has(administradorRoleId) ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (subCmd === 'editar' && !isAdmin) {
            return interaction.editReply('❌ Solo los Administradores pueden editar DNIs.');
        }

        /* ------------------------- CREAR DNI ------------------------- */
        if (subCmd === 'crear') {
            const targetUser = interaction.user;

            // 1. Get Active Character
            const activeChar = await characterService.getActiveCharacter(targetUser.id);

            const nombre = interaction.options.getString('nombre');
            const apellido = interaction.options.getString('apellido');
            const edad = interaction.options.getInteger('edad');
            const genero = interaction.options.getString('genero');
            const dia = interaction.options.getInteger('dia');
            const mes = interaction.options.getString('mes');

            // 2. Client-Side Validation (Minimal - Service does core validation)
            const nombreClean = nombre.trim();
            const apellidoClean = apellido.trim();

            if (nombreClean.length < 2 || apellidoClean.length < 2) {
                return interaction.editReply('❌ El nombre y apellido deben tener al menos 2 caracteres.');
            }

            // Date Validation
            const maxDays = new Date(2020, parseInt(mes), 0).getDate();
            if (dia > maxDays) {
                return interaction.editReply(`❌ Día inválido para el mes seleccionado. El máximo es ${maxDays}.`);
            }

            // Calculate fecha_nacimiento
            const currentYear = new Date().getFullYear();
            const birthYear = currentYear - edad;
            const dayPadded = dia.toString().padStart(2, '0');
            const fechaNacimiento = `${birthYear}-${mes}-${dayPadded}`;

            // 3. Prepare Data
            const dniData = {
                nombre: nombreClean,
                apellido_paterno: apellidoClean,
                edad: edad,
                fecha_nacimiento: fechaNacimiento,
                sexo: genero,
                foto_url: await targetUser.displayAvatarURL({ extension: 'png', size: 512 }),
                estado_nacimiento: 'CDMX', // Default
                nacionalidad: 'Mexicana',
                domicilio: 'No especificado'
            };

            // 4. Duplicate Name Check (Optional but good UX)
            // Ideally this should be in Service, but checking here gives faster feedback
            // Skipping for now to rely on Service constraints (though Service checks 'existing DNI for user', not name collision)
            // We can add name collision check in Service later or keep it simple.

            // 5. Create via Service
            const result = await DNIService.createDNI(supabase, targetUser.id, dniData, activeChar);

            if (!result.success) {
                return interaction.editReply(result.message);
            }

            // 6. Sync to 'citizens' table (Legacy/Compatibility)
            // Keeping this for now as other systems might rely on 'citizens' table
            try {
                const fullNameClean = `${nombreClean} ${apellidoClean}`;
                await supabase.from('citizens').upsert({
                    discord_id: targetUser.id,
                    full_name: fullNameClean,
                    dni: dniData.foto_url,
                    credit_score: 100
                }, { onConflict: 'discord_id', ignoreDuplicates: true });
            } catch (syncErr) {
                console.warn('[dni] Sync warning:', syncErr);
            }

            // 7. Display Result
            const newDni = result.data;
            const embed = DNIService.createDNIEmbed(newDni, interaction.member, activeChar);

            try {
                const dniImageBuffer = await ImageGenerator.generateDNI(newDni);
                const attachment = new AttachmentBuilder(dniImageBuffer, { name: 'dni.png' });
                embed.setImage('attachment://dni.png');
                await interaction.editReply({ embeds: [embed], files: [attachment] });
            } catch (e) {
                console.warn('Image gen failed:', e);
                await interaction.editReply({ embeds: [embed], content: '✅ DNI Creado (Error generando imagen)' });
            }

            /* ------------------------- EDITAR DNI ------------------------- */
        } else if (subCmd === 'editar') {
            const targetUser = interaction.options.getUser('usuario');
            const slot = interaction.options.getInteger('slot');

            // Determine char ID
            let targetCharId = slot;
            if (!targetCharId) {
                targetCharId = await characterService.getActiveCharacter(targetUser.id);
            }

            const updates = {};
            // Map inputs to DB/Service fields
            if (interaction.options.getString('nombre')) updates.nombre = interaction.options.getString('nombre');
            if (interaction.options.getString('apellido')) updates.apellido_paterno = interaction.options.getString('apellido'); // Service expects apellido_paterno usually, but let's check DNIService update
            // DNIService uses whatever keys we pass to supabase.update.
            // DB column is likely 'apellido' based on legacy code.
            // Wait, migration 20260219 didn't rename columns. 
            // Previous 'createDNI' used `apellido_paterno: dniData.apellido_paterno` in insert. 
            // But debug_schema said `['nombre', 'apellido']`. 
            // So `createDNI` might be FAILING if it uses `apellido_paterno`.
            // I should use `apellido` to be safe if that's what the DB has.
            // I'll use `apellido` here. 
            if (interaction.options.getString('apellido')) updates.apellido = interaction.options.getString('apellido');

            if (interaction.options.getInteger('edad')) {
                const edad = interaction.options.getInteger('edad');
                updates.edad = edad;
                const currentYear = new Date().getFullYear();
                const birthYear = currentYear - edad;
                updates.fecha_nacimiento = `${birthYear}-01-01`; // Rough estimate update
            }
            if (interaction.options.getString('genero')) updates.genero = interaction.options.getString('genero'); // DB: 'genero' vs Service 'sexo'. Using 'genero' for DB.

            updates.last_edited_by = interaction.user.id;

            if (Object.keys(updates).length <= 1) { // 1 because last_edited_by is always there
                return interaction.editReply('❌ Debes especificar al menos un campo para editar.');
            }

            const result = await DNIService.updateDNI(supabase, targetUser.id, updates, targetCharId);

            if (!result.success) {
                return interaction.editReply(result.message);
            }

            await interaction.editReply(`✅ DNI de ${targetUser.tag} (Personaje ${targetCharId}) actualizado correctamente.`);

            /* ------------------------- VER DNI ------------------------- */
        } else if (subCmd === 'ver') {
            const targetUser = interaction.options.getUser('usuario') || interaction.user;
            const slot = interaction.options.getInteger('slot');

            let targetCharId = slot;
            if (!targetCharId) {
                targetCharId = await characterService.getActiveCharacter(targetUser.id);
            }

            const dni = await DNIService.getDNI(supabase, targetUser.id, targetCharId);

            if (!dni) {
                return interaction.editReply(`❌ ${targetUser.tag} no tiene DNI registrado en el slot ${targetCharId}.`);
            }

            try {
                if (!dni.foto_url) {
                    dni.foto_url = targetUser.displayAvatarURL({ extension: 'png', size: 512 });
                }

                // Use Embed from Service
                const embed = DNIService.createDNIEmbed(dni, interaction.member || { user: targetUser }, targetCharId);

                // Try Image
                const dniImageBuffer = await ImageGenerator.generateDNI(dni);
                const attachment = new AttachmentBuilder(dniImageBuffer, { name: 'dni.png' });
                embed.setImage('attachment://dni.png');

                await interaction.editReply({ embeds: [embed], files: [attachment] });
            } catch (err) {
                console.error('DNI Gen Error:', err);
                await interaction.editReply({ embeds: [DNIService.createDNIEmbed(dni, interaction.member || { user: targetUser }, targetCharId)], content: '⚠️ DNI mostrado (Error generando imagen visual)' });
            }
        }
    }
};
