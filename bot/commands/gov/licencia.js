const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const ImageGenerator = require('../../utils/ImageGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('licencia')
        .setDescription('🪪 Ver tus licencias oficiales (Conducir, Armas)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Ver una de tus licencias')
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de licencia a visualizar')
                        .setRequired(true)
                        .addChoices(
                            { name: '🚗 Licencia de Conducir', value: 'conducir' },
                            { name: '🔫 Licencia de Arma Corta', value: 'arma_corta' },
                            { name: '🎯 Licencia de Arma Larga', value: 'arma_larga' }
                        ))
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Ver licencia de otro usuario (Solo Staff/Policía)')
                        .setRequired(false))),

    async execute(interaction, client, supabase) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'ver') {
            return this.handleVer(interaction, client, supabase);
        } else if (subcommand === 'otorgar') {
            return this.handleOtorgar(interaction, client, supabase);
        }
    },

    async handleVer(interaction, client, supabase) {
        await interaction.deferReply();
        const type = interaction.options.getString('tipo');
        const targetUser = interaction.options.getUser('usuario') || interaction.user;

        // Retrieve DNI
        const { data: dni, error } = await supabase
            .from('citizen_dni')
            .select('*')
            .eq('guild_id', interaction.guildId)
            .eq('user_id', targetUser.id)
            .maybeSingle();

        if (dni && !dni.foto_url) {
            dni.foto_url = targetUser.displayAvatarURL({ extension: 'png', size: 512 });
        }

        if (error || !dni) {
            return interaction.editReply({
                content: targetUser.id === interaction.user.id
                    ? '❌ No tienes DNI registrado. Usa `/dni crear` primero.'
                    : `❌ ${targetUser.tag} no tiene DNI registrado.`
            });
        }

        // Role Configuration (Must match those in legacyEconomyHandler)
        // conducir: 1413543909761614005
        // arma_corta: 1413543907110682784
        // arma_larga: 1413541379803578431

        const ROLE_MAP = {
            'conducir': '1413543909761614005',
            'arma_corta': '1413543907110682784',
            'arma_larga': '1413541379803578431'
        };

        const roleId = ROLE_MAP[type];
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.editReply('❌ Usuario no encontrado en el servidor.');
        }

        // Check ownership of license (Role based)
        const hasLicense = member.roles.cache.has(roleId);

        // Allow checking others if (implied logic: viewing is public or strict? Let's make it public like DNI for now, OR show separate message)
        // Usually licenses are public in RP context if shown, but strictly speaking "ver" implied checking validity.
        // If target doesn't have it:
        if (!hasLicense) {
            return interaction.editReply(`❌ <@${targetUser.id}> no tiene la licencia **${type.replace('_', ' ').toUpperCase()}** activa.`);
        }

        try {
            // Generate License
            // Expiration: Fake it for now, 1 year from now or look up DB if specific license table exists (Logic in legacy was role-based, no specific expiration table apparent yet minus maybe 'user_licenses'?).
            // For now, static valid year '2026' or dynamic.
            const expDate = new Date();
            expDate.setFullYear(expDate.getFullYear() + 1);
            const expString = expDate.toLocaleDateString('es-MX');

            const buffer = await ImageGenerator.generateLicense(dni, type, expString);
            const attachment = new AttachmentBuilder(buffer, { name: 'licencia.png' });

            const embed = new EmbedBuilder()
                .setTitle(`🪪 Licencia Digital: ${type.toUpperCase().replace('_', ' ')}`)
                .setColor(type === 'conducir' ? '#2980b9' : '#c0392b')
                .setImage('attachment://licencia.png')
                .setDescription(`Licencia válida de <@${targetUser.id}>`)
                .setFooter({ text: 'Documento Oficial Nación MX' });

            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (err) {
            console.error('License Gen Error:', err);
            await interaction.editReply('❌ Error generando la imagen de la licencia.');
        }
    },

    async handleOtorgar(interaction, client, supabase) {
        await interaction.deferReply();

        // Permission check - only admins/staff can grant licenses
        const staffRoles = ['1412882245735420006', '1412887195014557787']; // Junta Directiva, Co-Owner
        const hasPermission = interaction.member.roles.cache.some(role => staffRoles.includes(role.id));

        if (!hasPermission) {
            return interaction.editReply('❌ No tienes permisos para otorgar licencias.');
        }

        const targetUser = interaction.options.getUser('usuario');
        const type = interaction.options.getString('tipo');

        const ROLE_MAP = {
            'conducir': '1413543909761614005',
            'arma_corta': '1413543907110682784',
            'arma_larga': '1413541379803578431'
        };

        const roleId = ROLE_MAP[type];
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.editReply('❌ Usuario no encontrado en el servidor.');
        }

        // Check if user has DNI
        const { data: dni, error } = await supabase
            .from('citizen_dni')
            .select('*')
            .eq('guild_id', interaction.guildId)
            .eq('user_id', targetUser.id)
            .maybeSingle();

        if (error || !dni) {
            return interaction.editReply(`❌ ${targetUser.tag} necesita tener DNI antes de recibir una licencia. Pídele que use \`/dni crear\`.`);
        }

        // Check if already has the license
        if (member.roles.cache.has(roleId)) {
            return interaction.editReply(`❌ ${targetUser.tag} ya tiene la licencia **${type.replace('_', ' ').toUpperCase()}**.`);
        }

        try {
            // Grant role
            await member.roles.add(roleId);

            // Log to database (optional: create licenses table for tracking)
            // For now we'll just rely on role assignment

            const embed = new EmbedBuilder()
                .setTitle('✅ Licencia Otorgada')
                .setColor('#27ae60')
                .setDescription(`Se ha otorgado la **${type.replace('_', ' ').toUpperCase()}** a ${targetUser}`)
                .addFields(
                    { name: '👤 Ciudadano', value: `${targetUser.tag}`, inline: true },
                    { name: '🪪 Licencia', value: type.replace('_', ' ').toUpperCase(), inline: true },
                    { name: '👮 Otorgado por', value: interaction.user.tag, inline: true }
                )
                .setFooter({ text: 'Gobierno de Nación MX' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('Error granting license:', err);
            await interaction.editReply('❌ Error al otorgar la licencia. Verifica los permisos del bot.');
        }
    }
};
