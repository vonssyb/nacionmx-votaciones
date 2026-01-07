const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gestionar-coche')
        .setDescription('🔧 Gestionar vehículos registrados (Solo Staff)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('editar')
                .setDescription('Editar un vehículo existente')
                .addStringOption(option => option.setName('placa').setDescription('Placa del vehículo a editar').setRequired(true))
                .addStringOption(option => option.setName('modelo').setDescription('Nuevo modelo').setRequired(false))
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Nuevo tipo de vehículo')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Particular', value: 'Particular' },
                            { name: 'SUV', value: 'SUV' },
                            { name: 'Oficial', value: 'Oficial' },
                            { name: 'Pesado', value: 'Pesado' }
                        ))
                .addStringOption(option => option.setName('color').setDescription('Nuevo color').setRequired(false))
                .addUserOption(option => option.setName('nuevo_dueño').setDescription('Transferir a nuevo dueño').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('eliminar')
                .setDescription('Eliminar un vehículo del registro')
                .addStringOption(option => option.setName('placa').setDescription('Placa del vehículo a eliminar').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('buscar')
                .setDescription('Buscar vehículos por placa o dueño')
                .addStringOption(option => option.setName('placa').setDescription('Buscar por placa').setRequired(false))
                .addUserOption(option => option.setName('dueño').setDescription('Buscar por dueño').setRequired(false))),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply();

        // Permission Check - Staff only
        const staffRoleId = '1412882245735420006'; // Junta Directiva
        const isStaff = interaction.member.roles.cache.has(staffRoleId) ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isStaff) {
            return interaction.editReply('❌ Solo el staff puede gestionar vehículos.');
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'editar') {
            const placa = interaction.options.getString('placa').toUpperCase();
            const nuevoModelo = interaction.options.getString('modelo');
            const nuevoTipo = interaction.options.getString('tipo');
            const nuevoColor = interaction.options.getString('color');
            const nuevoDueño = interaction.options.getUser('nuevo_dueño');

            // Check if vehicle exists
            const { data: vehiculo, error: fetchError } = await supabase
                .from('vehicles')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('plate', placa)
                .maybeSingle();

            if (fetchError || !vehiculo) {
                return interaction.editReply(`❌ No se encontró ningún vehículo con placa **${placa}**.`);
            }

            // Build update object
            const updates = {};
            if (nuevoModelo) updates.model = nuevoModelo;
            if (nuevoTipo) updates.type = nuevoTipo;
            if (nuevoColor) updates.color = nuevoColor;
            if (nuevoDueño) updates.user_id = nuevoDueño.id;

            if (Object.keys(updates).length === 0) {
                return interaction.editReply('❌ Debes especificar al menos un campo para editar.');
            }

            // Update vehicle
            const { error: updateError } = await supabase
                .from('vehicles')
                .update(updates)
                .eq('guild_id', interaction.guildId)
                .eq('plate', placa);

            if (updateError) {
                console.error('[gestionar-coche] Update error:', updateError);
                return interaction.editReply('❌ Error al actualizar el vehículo.');
            }

            const cambios = [];
            if (nuevoModelo) cambios.push(`Modelo: **${nuevoModelo}**`);
            if (nuevoTipo) cambios.push(`Tipo: **${nuevoTipo}**`);
            if (nuevoColor) cambios.push(`Color: **${nuevoColor}**`);
            if (nuevoDueño) cambios.push(`Nuevo Dueño: <@${nuevoDueño.id}>`);

            const embed = new EmbedBuilder()
                .setTitle('✅ Vehículo Editado')
                .setColor('#00FF00')
                .addFields(
                    { name: '🚗 Placa', value: placa, inline: true },
                    { name: '📝 Cambios Realizados', value: cambios.join('\n'), inline: false },
                    { name: '👤 Editado por', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'eliminar') {
            const placa = interaction.options.getString('placa').toUpperCase();

            // Check if vehicle exists
            const { data: vehiculo, error: fetchError } = await supabase
                .from('vehicles')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('plate', placa)
                .maybeSingle();

            if (fetchError || !vehiculo) {
                return interaction.editReply(`❌ No se encontró ningún vehículo con placa **${placa}**.`);
            }

            // Delete vehicle
            const { error: deleteError } = await supabase
                .from('vehicles')
                .delete()
                .eq('guild_id', interaction.guildId)
                .eq('plate', placa);

            if (deleteError) {
                console.error('[gestionar-coche] Delete error:', deleteError);
                return interaction.editReply('❌ Error al eliminar el vehículo.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Vehículo Eliminado')
                .setColor('#FF0000')
                .addFields(
                    { name: '🚗 Placa', value: placa, inline: true },
                    { name: '🚙 Modelo', value: vehiculo.model, inline: true },
                    { name: '👤 Dueño Anterior', value: `<@${vehiculo.user_id}>`, inline: true },
                    { name: '🗑️ Eliminado por', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'buscar') {
            const placa = interaction.options.getString('placa')?.toUpperCase();
            const dueño = interaction.options.getUser('dueño');

            if (!placa && !dueño) {
                return interaction.editReply('❌ Debes especificar una placa o un dueño para buscar.');
            }

            let query = supabase
                .from('vehicles')
                .select('*')
                .eq('guild_id', interaction.guildId);

            if (placa) {
                query = query.ilike('plate', `%${placa}%`);
            }

            if (dueño) {
                query = query.eq('user_id', dueño.id);
            }

            const { data: vehiculos, error } = await query;

            if (error) {
                console.error('[gestionar-coche] Search error:', error);
                return interaction.editReply('❌ Error al buscar vehículos.');
            }

            if (!vehiculos || vehiculos.length === 0) {
                return interaction.editReply('❌ No se encontraron vehículos con los criterios especificados.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🔍 Resultados de Búsqueda')
                .setColor('#00AAC0')
                .setDescription(`Se encontraron **${vehiculos.length}** vehículo(s):`)
                .setTimestamp();

            vehiculos.slice(0, 10).forEach(v => {
                embed.addFields({
                    name: `🚗 ${v.plate}`,
                    value: `**Modelo:** ${v.model}\n**Tipo:** ${v.type}\n**Color:** ${v.color || 'N/A'}\n**Dueño:** <@${v.user_id}>`,
                    inline: true
                });
            });

            if (vehiculos.length > 10) {
                embed.setFooter({ text: `Mostrando 10 de ${vehiculos.length} resultados` });
            }

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
