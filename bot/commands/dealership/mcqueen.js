const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MCQUEEN_ROLE_ID = '1344686483592810506';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcqueen')
        .setDescription('🏁 Gestión del Concesionario McQueen')
        .addSubcommand(sub =>
            sub.setName('registro')
                .setDescription('📝 Registrar un nuevo vehículo (Solo Empleados)')
                .addUserOption(opt => opt.setName('cliente').setDescription('Cliente que compra el auto').setRequired(true))
                .addStringOption(opt => opt.setName('modelo').setDescription('Modelo del vehículo').setRequired(true))
                .addStringOption(opt => opt.setName('placa').setDescription('Placa (Ej: AAA-123)').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('tipo')
                        .setDescription('Tipo de vehículo')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Particular', value: 'Particular' },
                            { name: 'Deportivo', value: 'Deportivo' },
                            { name: 'SUV', value: 'SUV' },
                            { name: 'Moto', value: 'Moto' },
                            { name: 'Oficial', value: 'Oficial' },
                            { name: 'Pesado', value: 'Pesado' }
                        ))
                .addStringOption(opt => opt.setName('color').setDescription('Color del vehículo').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('editar')
                .setDescription('🔧 Editar datos de un vehículo (Solo Empleados)')
                .addStringOption(opt => opt.setName('placa').setDescription('Placa del vehículo a editar').setRequired(true))
                .addStringOption(opt => opt.setName('modelo').setDescription('Nuevo modelo').setRequired(false))
                .addStringOption(opt => opt.setName('color').setDescription('Nuevo color').setRequired(false))
                .addUserOption(opt => opt.setName('nuevo_dueño').setDescription('Transferir a otro dueño').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('eliminar')
                .setDescription('🗑️ Eliminar un vehículo del sistema (Solo Empleados)')
                .addStringOption(opt => opt.setName('placa').setDescription('Placa del vehículo a eliminar').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('buscar')
                .setDescription('🔍 Buscar vehículos (Solo Empleados)')
                .addStringOption(opt => opt.setName('placa').setDescription('Buscar por placa').setRequired(false))
                .addUserOption(opt => opt.setName('dueño').setDescription('Buscar por dueño').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('📢 Enviar panel de invitación pública (Admin Only)')
                .addChannelOption(opt => opt.setName('canal').setDescription('Canal destino').setRequired(true))
        ),

    async execute(interaction, client, supabase) {
        // --- PERMISSION CHECK ---
        const subcommand = interaction.options.getSubcommand();
        const isEmployee = interaction.member.roles.cache.has(MCQUEEN_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        // Panel command is admin only
        if (subcommand === 'panel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Solo admins pueden enviar el panel.', ephemeral: true });
            }
        }
        // Other commands are Employee only
        else if (!isEmployee) {
            return interaction.reply({ content: '🚫 Acceso denegado. Solo empleados de **McQueen** pueden gestionar la flota.', ephemeral: true });
        }

        await interaction.deferReply();

        // --- SUBCOMMAND HANDLERS ---

        if (subcommand === 'registro') {
            const cliente = interaction.options.getUser('cliente');
            const modelo = interaction.options.getString('modelo');
            const placa = interaction.options.getString('placa').toUpperCase();
            const tipo = interaction.options.getString('tipo');
            const color = interaction.options.getString('color');

            // Check duplicate plate
            const { data: existing } = await supabase.from('vehicles').select('id').eq('plate', placa).maybeSingle();
            if (existing) return interaction.editReply('❌ Ya existe un vehículo con esa placa.');

            // Insert
            const { error } = await supabase.from('vehicles').insert({
                guild_id: interaction.guildId,
                user_id: cliente.id,
                plate: placa,
                model: modelo,
                type: tipo,
                color: color,
                registered_by: interaction.user.id
            });

            if (error) {
                console.error('[McQueen] Register Error:', error);
                return interaction.editReply('❌ Error al registrar vehículo en base de datos.');
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Vehículo Registrado - McQueen')
                .setColor('#FF6B35')
                .setThumbnail(cliente.displayAvatarURL())
                .addFields(
                    { name: '🚗 Modelo', value: modelo, inline: true },
                    { name: '🔢 Placa', value: placa, inline: true },
                    { name: '🎨 Color', value: color, inline: true },
                    { name: '👤 Dueño', value: `<@${cliente.id}>`, inline: true },
                    { name: '📋 Tipo', value: tipo, inline: true },
                    { name: '👮 Registrado por', value: interaction.user.tag, inline: true }
                )
                .setFooter({ text: 'Sistema de Gestión McQueen' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'editar') {
            const placa = interaction.options.getString('placa').toUpperCase();
            const nuevoModelo = interaction.options.getString('modelo');
            const nuevoColor = interaction.options.getString('color');
            const nuevoDueño = interaction.options.getUser('nuevo_dueño');

            if (!nuevoModelo && !nuevoColor && !nuevoDueño) return interaction.editReply('❌ Especifica al menos un cambio.');

            // Check existence
            const { data: vehiculo } = await supabase.from('vehicles').select('*').eq('plate', placa).maybeSingle();
            if (!vehiculo) return interaction.editReply('❌ No existe ese vehículo.');

            // Update
            const updates = {};
            if (nuevoModelo) updates.model = nuevoModelo;
            if (nuevoColor) updates.color = nuevoColor;
            if (nuevoDueño) updates.user_id = nuevoDueño.id;

            const { error } = await supabase.from('vehicles').update(updates).eq('plate', placa);

            if (error) return interaction.editReply('❌ Error al actualizar.');

            const embed = new EmbedBuilder()
                .setTitle('🔧 Vehículo Actualizado')
                .setColor('#F1C40F')
                .setDescription(`Se han actualizado los datos del vehículo **${placa}**`)
                .addFields(
                    { name: 'Modelo', value: nuevoModelo || vehiculo.model, inline: true },
                    { name: 'Color', value: nuevoColor || vehiculo.color, inline: true },
                    { name: 'Dueño', value: nuevoDueño ? `<@${nuevoDueño.id}>` : `<@${vehiculo.user_id}>`, inline: true }
                );

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'eliminar') {
            const placa = interaction.options.getString('placa').toUpperCase();

            // Check existence
            const { data: vehiculo } = await supabase.from('vehicles').select('*').eq('plate', placa).maybeSingle();
            if (!vehiculo) return interaction.editReply('❌ No existe ese vehículo.');

            const { error } = await supabase.from('vehicles').delete().eq('plate', placa);
            if (error) return interaction.editReply('❌ Error al eliminar.');

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Vehículo Eliminado')
                .setColor('#E74C3C')
                .setDescription(`El vehículo con placa **${placa}** ha sido dado de baja del sistema.`)
                .addFields(
                    { name: 'Modelo', value: vehiculo.model, inline: true },
                    { name: 'Ex-Dueño', value: `<@${vehiculo.user_id}>`, inline: true }
                );

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'buscar') {
            const placa = interaction.options.getString('placa')?.toUpperCase();
            const dueño = interaction.options.getUser('dueño');

            let query = supabase.from('vehicles').select('*').eq('guild_id', interaction.guildId);
            if (placa) query = query.ilike('plate', `%${placa}%`);
            if (dueño) query = query.eq('user_id', dueño.id);

            const { data: vehiculos } = await query.limit(10);

            if (!vehiculos || vehiculos.length === 0) return interaction.editReply('❌ No se encontraron resultados.');

            const embed = new EmbedBuilder()
                .setTitle('🔍 Resultados de Búsqueda')
                .setColor('#3498DB');

            vehiculos.forEach(v => {
                embed.addFields({
                    name: `${v.plate} | ${v.model}`,
                    value: `Dueño: <@${v.user_id}>\nColor: ${v.color}\nTipo: ${v.type}`
                });
            });

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'panel') {
            const canal = interaction.options.getChannel('canal');
            if (!canal.isTextBased()) return interaction.editReply('❌ Canal inválido.');

            const embed = new EmbedBuilder()
                .setTitle('✨ McQueen Concesionario & Taller')
                .setDescription(
                    '**¡Tu concesionario de confianza en Nación MX!**\n\n' +
                    'Ofrecemos los mejores vehículos importados, deportivos y utilitarios.\n' +
                    'También contamos con servicio de taller especializado y personalización.\n\n' +
                    '🔗 **Servicios Disponibles**\n' +
                    '• Venta de Vehículos\n' +
                    '• Test Drive\n' +
                    '• Reparaciones y Tuning\n' +
                    '• Financiamiento\n\n' +
                    '*Haz clic abajo para ver opciones:*'
                )
                .setColor('#FF6B35')
                .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeDR3Z29ucmxnNGRmZjg0NHE3dm9qaDRuNGUzbW9kanhsd2MxcTZqOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/mIMsLsQTJzAn6/giphy.gif')
                .setFooter({ text: 'McQueen Auto Group' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('🚗 Ver Catálogo Público').setStyle(ButtonStyle.Link).setURL('https://discord.com/channels/1398888679216513044/1398888679216513044'), // Placeholder link or just info
                new ButtonBuilder().setCustomId('ticket_compra_vehiculo').setLabel('📝 Solicitar Atención').setStyle(ButtonStyle.Success).setEmoji('🗣️')
            );

            // Send to channel
            await canal.send({ embeds: [embed], components: [row] });
            return interaction.editReply(`✅ Panel enviado a ${canal}`);
        }
    }
};
