const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-mcqueen-panel')
        .setDescription('🚗 Crear panel de tickets para McQueen Concesionario')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal donde se enviará el panel')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('canal');

        if (!channel.isTextBased()) {
            return interaction.editReply('❌ Debes seleccionar un canal de texto.');
        }

        try {
            const embed = new EmbedBuilder()
                .setTitle('🚗 McQueen Concesionario')
                .setDescription(
                    '**¡Bienvenido al mejor concesionario de Liberty County!**\n\n' +
                    '¿Buscas tu próximo vehículo? Estás en el lugar correcto.\n\n' +
                    '**Servicios disponibles:**\n' +
                    '🚙 **Comprar Vehículo** - Explora nuestro catálogo y adquiere tu auto ideal\n' +
                    '🔧 **Soporte Técnico** - Ayuda con tu compra o problemas técnicos\n' +
                    '📅 **Agendar Cita** - Programa una visita personalizada\n' +
                    '💼 **Recursos Humanos** - Únete a nuestro equipo de vendedores\n\n' +
                    '**Haz clic en el botón correspondiente para comenzar:**'
                )
                .setColor('#FF6B35') // Naranja/rojo tipo McQueen
                .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeDR3Z29ucmxnNGRmZjg0NHE3dm9qaDRuNGUzbW9kanhsd2MxcTZqOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/mIMsLsQTJzAn6/giphy.gif')
                .setFooter({ text: 'McQueen Concesionario - Tu mejor opción en vehículos' })
                .setTimestamp();

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_compra_vehiculo')
                    .setLabel('🚙 Comprar Vehículo')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('ticket_soporte_tecnico')
                    .setLabel('🔧 Soporte Técnico')
                    .setStyle(ButtonStyle.Primary)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_agendar_cita')
                    .setLabel('📅 Agendar Cita')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket_recursos_humanos')
                    .setLabel('💼 Recursos Humanos')
                    .setStyle(ButtonStyle.Secondary)
            );

            await channel.send({
                embeds: [embed],
                components: [row1, row2]
            });

            await interaction.editReply(`✅ Panel de McQueen creado exitosamente en ${channel}`);

        } catch (error) {
            console.error('Error al crear panel de McQueen:', error);
            await interaction.editReply('❌ Error al crear el panel. Verifica mis permisos.');
        }
    }
};
