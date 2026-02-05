const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ROLES = require('../../config/roles.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seguridad')
        .setDescription('🛡️ Comandos de la Secretaría de Seguridad')
        .addSubcommand(sub =>
            sub.setName('alerta')
                .setDescription('Cambiar el nivel de alerta (DEFCON)')
                .addIntegerOption(opt =>
                    opt.setName('nivel')
                        .setDescription('Nivel de alerta (1 = Máxima/Guerra, 5 = Paz)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(5)))
        .addSubcommand(sub =>
            sub.setName('buscar')
                .setDescription('Buscar propietario de un vehículo por placa')
                .addStringOption(opt => opt.setName('placa').setDescription('Placa del vehículo').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('boletinar')
                .setDescription('Boletinar un vehículo (Marca como buscado)')
                .addStringOption(opt => opt.setName('placa').setDescription('Placa del vehículo').setRequired(true))
                .addStringOption(opt => opt.setName('razon').setDescription('Motivo de la búsqueda').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('redada')
                .setDescription('Autorizar una redada en zona ilegal')
                .addStringOption(opt =>
                    opt.setName('zona')
                        .setDescription('Zona objetivo')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Barrio Cartel', value: 'cartel' },
                            { name: 'Laboratorio', value: 'lab' },
                            { name: 'Mansion', value: 'mansion' }
                        ))),

    async execute(interaction, client, supabase) {
        // 1. Role Check
        const sspRole = ROLES.police.ssp;
        const sspcRole = ROLES.police.sspc;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasRole = interaction.member.roles.cache.has(sspRole) || interaction.member.roles.cache.has(sspcRole);

        if (!hasRole && !isAdmin) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando. (Secretario de Seguridad)', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'alerta') {
                const level = interaction.options.getInteger('nivel');

                // Define levels
                const levels = {
                    1: { name: 'DEFCON 1: GUERRA / EMERGENCIA MÁXIMA', color: '#FF0000', img: 'https://i.imgur.com/example1.png' }, // Placeholder
                    2: { name: 'DEFCON 2: ALTO RIESGO / TOQUE DE QUEDA', color: '#FF4500', img: '' },
                    3: { name: 'DEFCON 3: OPERATIVOS ACTIVOS', color: '#FFA500', img: '' },
                    4: { name: 'DEFCON 4: VIGILANCIA AUMENTADA', color: '#FFFF00', img: '' },
                    5: { name: 'DEFCON 5: PAZ / NORMALIDAD', color: '#00FF00', img: '' }
                };

                const defcon = levels[level];

                // Update setting
                await supabase.from('server_settings').upsert({
                    guild_id: interaction.guildId,
                    key: 'defcon_level',
                    value: level.toString(),
                    description: 'Nivel de alerta de seguridad'
                });

                const embed = new EmbedBuilder()
                    .setTitle('📢 ALERTA DE SEGURIDAD NACIONAL')
                    .setDescription(`El Secretario de Seguridad ha establecido el nivel de alerta en:\n\n# ${defcon.name}`)
                    .setColor(defcon.color)
                    .setFooter({ text: `Autorizado por: ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

                // Optional: Ping users or send to announcements if configured
                // interaction.channel.send('@here'); 

            } else if (subcommand === 'buscar') {
                const plate = interaction.options.getString('placa').toUpperCase();
                await interaction.deferReply();

                // Join with users or similar requires complex query or multiple steps
                // Simplified: Get sale info
                const { data: vehicle, error } = await supabase
                    .from('dealership_sales')
                    .select('user_id, vehicle_id, plate, wanted, wanted_reason, dealership_catalog(make, model)')
                    .eq('plate', plate)
                    .maybeSingle();

                if (error) throw error;

                if (!vehicle) {
                    return interaction.editReply(`❌ No se encontró ningún vehículo con placa **${plate}** en el registro.`);
                }

                const owner = await client.users.fetch(vehicle.user_id).catch(() => ({ tag: 'Desconocido' }));

                const embed = new EmbedBuilder()
                    .setTitle(`🔍 Resultado Placa: ${plate}`)
                    .addFields(
                        { name: 'Vehículo', value: `${vehicle.dealership_catalog?.make} ${vehicle.dealership_catalog?.model}`, inline: true },
                        { name: 'Propietario', value: `${owner.tag} (<@${vehicle.user_id}>)`, inline: true },
                        { name: 'Estado Legal', value: vehicle.wanted ? '🚨 BOLETINADO / ROBADO' : '✅ Limpio', inline: false }
                    )
                    .setColor(vehicle.wanted ? '#FF0000' : '#00FF00');

                if (vehicle.wanted) {
                    embed.addFields({ name: 'Motivo de Búsqueda', value: vehicle.wanted_reason || 'No especificado' });
                }

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'boletinar') {
                const plate = interaction.options.getString('placa').toUpperCase();
                const reason = interaction.options.getString('razon');

                const { error } = await supabase
                    .from('dealership_sales')
                    .update({ wanted: true, wanted_reason: reason })
                    .eq('plate', plate);

                if (error) throw error;

                // Optionally notify police channel
                const embed = new EmbedBuilder()
                    .setTitle('🚨 VEHÍCULO BOLETINADO')
                    .setDescription(`Se ha emitido una orden de búsqueda para el vehículo con placa **${plate}**.`)
                    .addFields({ name: 'Motivo', value: reason })
                    .setColor('#FF0000')
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'redada') {
                const zone = interaction.options.getString('zona');

                const embed = new EmbedBuilder()
                    .setTitle('👮 OPERATIVO POLICIAL / REDADA')
                    .setDescription(`Se ha autorizado una intervención de alto impacto en: **${zone.toUpperCase()}**.\n\n⚠️ Civiles eviten la zona. Se autoriza uso de fuerza letal si hay resistencia.`)
                    .setImage('https://media.discordapp.net/attachments/1398888916303487028/1398888916303487028/raid.png?width=800') // Placeholder
                    .setColor('#FF0000');

                return interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[Seguridad] Error:', error);
            return interaction.reply({ content: '❌ Error ejecutando el comando.', ephemeral: true });
        }
    }
};
