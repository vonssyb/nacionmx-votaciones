const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('🏛️ Ver comandos de Gobierno y Trámites'),

    async execute(interaction, client, supabase) {
        const initialEmbed = new EmbedBuilder()
            .setTitle('🏛️ Gobierno Nación MX - Ayuda')
            .setColor(0xFFFFFF) // White
            .setDescription('**Servicios Ciudadanos y Legales**\nSelecciona una categoría.')
            .setFooter({ text: 'Bot de Gobierno' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_gov_category')
            .setPlaceholder('Menú de Gobierno...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Documentos').setDescription('DNI, Visa, Pasaporte').setValue('docs').setEmoji('🪪'),
                new StringSelectMenuOptionBuilder().setLabel('Vehículos').setDescription('Registro de coches, Traspasos').setValue('cars').setEmoji('🚗'),
                new StringSelectMenuOptionBuilder().setLabel('Policía').setDescription('Multas (Gestión básica)').setValue('police').setEmoji('👮'),
                new StringSelectMenuOptionBuilder().setLabel('Social').setDescription('Información y estado').setValue('social').setEmoji('ℹ️'),
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const response = await interaction.editReply({ embeds: [initialEmbed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });

        collector.on('collect', async i => {
            if (i.customId !== 'help_gov_category') return;
            if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Menú ajeno.', flags: [64] });

            const category = i.values[0];
            const newEmbed = new EmbedBuilder().setColor(0xFFFFFF).setTimestamp();

            switch (category) {
                case 'docs':
                    newEmbed.setTitle('🪪 Documentos')
                        .addFields(
                            { name: '`/dni solicitar`', value: 'Tramitar identificación oficial.' },
                            { name: '`/dni ver`', value: 'Ver tu DNI.' },
                            { name: '`/visa solicitar`', value: 'Tramitar visa americana.' },
                            { name: '`/visa procesar`', value: '(Staff) Aprobar visas.' },
                            { name: '`/american-id`', value: 'ID de residente americano.' }
                        );
                    break;
                case 'cars':
                    newEmbed.setTitle('🚗 Trámites Vehiculares')
                        .addFields(
                            { name: '`/registrar-coche`', value: 'Alta de vehículo nuevo.' },
                            { name: '`/gestionar-coche`', value: 'Venta y traspaso de autos.' }
                        );
                    break;
                case 'police':
                    newEmbed.setTitle('👮 Policía (Gobierno)')
                        .setDescription('Comandos administrativos policiales.')
                        .addFields(
                            { name: '`/multar`', value: 'Crear boletas de infracción.' }
                        );
                    break;
                case 'social':
                    newEmbed.setTitle('ℹ️ Utilidades')
                        .addFields(
                            { name: '`/info`', value: 'Información del servidor.' },
                            { name: '`/ping`', value: 'Estado de latencia.' }
                        );
                    break;
            }
            await i.update({ embeds: [newEmbed], components: [row] });
        });
    }
};
