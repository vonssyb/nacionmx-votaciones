const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ver-coches')
        .setDescription('🚗 Ver tus vehículos registrados o los de otro usuario')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Ver vehículos de otro usuario (Opcional)')
                .setRequired(false)),

    async execute(interaction, client, supabase) {
        // Defer immediately as image gen takes time
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('usuario') || interaction.user;

        // Fetch Vehicles
        const { data: vehicles } = await supabase
            .from('vehicles')
            .select('*')
            .eq('guild_id', interaction.guildId)
            .eq('user_id', targetUser.id);

        if (!vehicles || vehicles.length === 0) {
            return interaction.editReply({
                content: targetUser.id === interaction.user.id
                    ? '❌ No tienes vehículos registrados.'
                    : `❌ <@${targetUser.id}> no tiene vehículos registrados.`
            });
        }

        // Fetch DNI for visual card
        const { data: ownerDni } = await supabase
            .from('citizen_dni')
            .select('*')
            .eq('guild_id', interaction.guildId)
            .eq('user_id', targetUser.id)
            .maybeSingle();

        const ImageGenerator = require('../../utils/ImageGenerator');
        const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

        let currentIndex = 0;

        // Function to generate the response payload for a specific index
        const generatePage = async (index) => {
            const vehicle = vehicles[index];
            const embeds = [];
            const files = [];

            // 1. Generate Visual Card
            if (ownerDni) {
                try {
                    const cardBuffer = await ImageGenerator.generateCarCard(vehicle, ownerDni);
                    // Use index in filename to avoid caching issues on update? Discord handles attachments well usually.
                    const fileName = `card_${vehicle.plate}_${index}.png`;
                    files.push(new AttachmentBuilder(cardBuffer, { name: fileName }));

                    const cardEmbed = new EmbedBuilder()
                        .setTitle(`🚗 ${vehicle.model} (${vehicle.plate})`)
                        .setColor('#2ECC71')
                        .setImage(`attachment://${fileName}`)
                        .setDescription(`**Propietario:** <@${targetUser.id}>\n**Índice:** ${index + 1} / ${vehicles.length}`)
                        .addFields(
                            { name: 'Color', value: vehicle.color || 'N/A', inline: true },
                            { name: 'Tipo', value: vehicle.type || 'N/A', inline: true },
                            { name: 'Registro', value: vehicle.created_at ? new Date(vehicle.created_at).toLocaleDateString() : 'N/A', inline: true }
                        )
                        .setFooter({ text: 'Sistema de Control Vehicular • Nación MX' });

                    embeds.push(cardEmbed);

                } catch (e) {
                    console.error('Error generating car card:', e);
                    embeds.push(new EmbedBuilder().setDescription('❌ Error generando tarjeta visual.').setColor('Red'));
                }
            } else {
                embeds.push(new EmbedBuilder()
                    .setTitle(`🚗 ${vehicle.model}`)
                    .setDescription('⚠️ No se puede generar la tarjeta visual porque el usuario no tiene DNI.')
                    .setColor('Yellow'));
            }

            // 2. Buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('⬅️ Anterior')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(index === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Siguiente ➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(index === vehicles.length - 1)
            );

            return { embeds, files, components: [row] };
        };

        // Send Initial Message
        const initialPayload = await generatePage(currentIndex);
        const message = await interaction.editReply(initialPayload);

        // Collector
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '❌ No puedes usar estos controles.', ephemeral: true });
            }

            await i.deferUpdate();

            if (i.customId === 'prev') {
                currentIndex = Math.max(0, currentIndex - 1);
            } else if (i.customId === 'next') {
                currentIndex = Math.min(vehicles.length - 1, currentIndex + 1);
            }

            const newPayload = await generatePage(currentIndex);
            await interaction.editReply(newPayload);
        });

        collector.on('end', () => {
            // Disable buttons on timeout
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Secondary).setDisabled(true)
            );
            interaction.editReply({ components: [disabledRow] }).catch(() => { });
        });
    }
};
