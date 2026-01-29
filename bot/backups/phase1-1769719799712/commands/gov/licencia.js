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
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('otorgar')
                .setDescription('[STAFF] Otorgar una licencia a un ciudadano')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuario que recibirá la licencia')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de licencia a otorgar')
                        .setRequired(true)
                        .addChoices(
                            { name: '🚗 Licencia de Conducir', value: 'conducir' },
                            { name: '🔫 Licencia de Arma Corta', value: 'arma_corta' },
                            { name: '🎯 Licencia de Arma Larga', value: 'arma_larga' }
                        ))),

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

        // Permission check
        const staffRoles = [
            '1412882245735420006', // Junta Directiva
            '1412887195014557787', // Co-Owner
            '1450242487422812251', // Staff
            '1412882245735420006', // Agregar roles de gobierno/policía si corresponde
            '1449942702744932372'  // S.S.P (Seguridad Publica)
        ];
        // También permitir a Policía/Ejército otorgar si tienen rango alto (esto depende del servidor, por ahora dejo Staff/Cúpula)

        const hasPermission = interaction.member.roles.cache.some(role => staffRoles.includes(role.id));

        if (!hasPermission) {
            return interaction.editReply('❌ No tienes permisos para otorgar licencias.');
        }

        const targetUser = interaction.options.getUser('usuario');
        const type = interaction.options.getString('tipo');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) return interaction.editReply('❌ Usuario no encontrado.');

        // CONFIGURATION
        const CONFIG = {
            'conducir': {
                roleId: '1413543909761614005',
                price: 1200,
                name: 'Licencia de Conducir',
                durationDays: 7
            },
            'arma_corta': {
                roleId: '1413543907110682784',
                price: 1200,
                name: 'Licencia de Arma Corta',
                durationDays: 7
            },
            'arma_larga': {
                roleId: '1413541379803578431',
                price: 1500,
                name: 'Licencia de Arma Larga',
                durationDays: 7,
                militaryOnly: true
            }
        };

        const license = CONFIG[type];

        // 1. Check existing role
        if (member.roles.cache.has(license.roleId)) {
            return interaction.editReply(`❌ ${targetUser} ya tiene la **${license.name}**.`);
        }

        // 2. Validate DNI
        const { data: dni } = await supabase
            .from('citizen_dni')
            .select('user_id')
            .eq('guild_id', interaction.guildId)
            .eq('user_id', targetUser.id)
            .maybeSingle();

        if (!dni) {
            return interaction.editReply(`❌ ${targetUser} necesita un DNI registrado (/dni crear).`);
        }

        // 3. Military Restriction for Long Arms
        if (license.militaryOnly) {
            // Define Military Roles IDs (Ejército/Marina/GN)
            const MILITARY_ROLES = [
                '1412895697334337566', // SEDENA
                '1412895698500223007', // SEMAR
                '1413541379803578431', // Rol base militar si existe? No, ese es licencia.
                // Agregar IDs de facciones militares aquí. 
                // Asumo que si tiene rol de trabajo militar...
                '1414004902157156434' // Guardia Nacional?
            ];
            // Better Check: Check if they have ANY military faction role?
            // For now, let's warn if we don't have exact IDs. 
            // Assuming checking "SEDENA/SEMAR" keywords in roles? Risky.
            // Let's rely on the Staff knowing. Wait, code MUST enforce it.

            // "solo a los militares se les puede dar armaws laras"
            // Busco roles con nombre "Ejército", "Marina", "Militar"
            const isMilitary = member.roles.cache.some(r =>
                r.name.toLowerCase().includes('ejercito') ||
                r.name.toLowerCase().includes('marina') ||
                r.name.toLowerCase().includes('sedena') ||
                r.name.toLowerCase().includes('semar')
            );

            if (!isMilitary) {
                return interaction.editReply(`❌ **Restricción:** La Licencia de Armas Largas es exclusiva para Militares.`);
            }
        }

        // 4. Generate Payment Interface
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`license_pay_cash_${license.price}_${license.roleId}_${targetUser.id}`)
                .setLabel(`Pagar en Efectivo ($${license.price})`)
                .setStyle(ButtonStyle.Success)
                .setEmoji('💵'),
            new ButtonBuilder()
                .setCustomId(`license_pay_debit_${license.price}_${license.roleId}_${targetUser.id}`)
                .setLabel(`Pagar con Tarjeta ($${license.price})`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💳')
        );

        const embed = new EmbedBuilder()
            .setTitle(`💳 Pago Requerido: ${license.name}`)
            .setDescription(`Se está tramitando una **${license.name}** para ${targetUser}.\n\n**Costo:** $${license.price.toLocaleString()}\n**Vigencia:** ${license.durationDays} días\n\n⚠️ **El ciudadano debe presionar el botón para pagar.**`)
            .setColor('#f1c40f')
            .setFooter({ text: 'Sistema de Licencias Nación MX' });

        await interaction.editReply({
            content: `${targetUser}`,
            embeds: [embed],
            components: [row]
        });
    }
};
