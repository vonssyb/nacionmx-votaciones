const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/erlcEconomyEmergency');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('911')
        .setDescription('Reportar una emergencia al 911')
        .addStringOption(option =>
            option.setName('ubicacion')
                .setDescription('📍 Ubicación de la emergencia')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('descripcion')
                .setDescription('📝 Descripción de lo que está sucediendo')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const location = interaction.options.getString('ubicacion');
        const description = interaction.options.getString('descripcion');
        const caller = interaction.user.username; // Usamos el nombre de Discord como referencia inicial
        const callerDiscordId = interaction.user.id;

        try {
            // Create emergency record in DB
            const { data: emergency, error } = await supabase
                .from('emergency_calls')
                .insert({
                    caller_roblox: caller,
                    caller_discord_id: callerDiscordId,
                    location: location,
                    emergency_description: description
                })
                .select()
                .maybeSingle();

            if (error) throw error;

            // Create embed
            const guild = interaction.guild;
            const channel = await guild.channels.fetch(config.CHANNELS.EMERGENCY_911);

            if (!channel) {
                return interaction.editReply({ content: '❌ El canal de emergencias no está configurado correctamente.' });
            }

            const embed = new EmbedBuilder()
                .setTitle('🚨 **EMERGENCIA 911**')
                .setColor('#FF0000')
                .setDescription(`**📍 Ubicación:** ${location}\n**📝 Descripción:** ${description}`)
                .addFields(
                    { name: '👤 Reportante', value: `<@${callerDiscordId}> (${caller})`, inline: true },
                    { name: '🕐 Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: `ID Emergencia: ${emergency.id}` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`emergency_respond_${emergency.id}`)
                    .setLabel('🚨 Unirse a Emergencia')
                    .setStyle(ButtonStyle.Success)
            );

            // Ping emergency roles
            const rolesToPing = config.EMERGENCY_CATEGORIES.todos.map(roleKey => `<@&${config.EMERGENCY_ROLES[roleKey]}>`).join(' ');

            const message = await channel.send({
                content: `${rolesToPing}\n🚨 **EMERGENCIA ACTIVA**`,
                embeds: [embed],
                components: [row]
            });

            // Update DB with message ID
            await supabase
                .from('emergency_calls')
                .update({ message_id: message.id, channel_id: channel.id })
                .eq('id', emergency.id);

            // Broadcast to emergency voice channels if possible
            if (client.services.erlcPolling && client.services.erlcPolling.broadcastEmergencyToVoice) {
                await client.services.erlcPolling.broadcastEmergencyToVoice(location, description);
            }

            await interaction.editReply({
                content: `✅ **Emergencia reportada con éxito.**\nID: \`${emergency.id}\`\nLos servicios de emergencia han sido notificados.`
            });

            console.log(`[Slash Command] 🚨 /911 Emergency ${emergency.id} created by ${caller}`);

        } catch (error) {
            console.error('[Slash Command] /911 Error:', error);
            await interaction.editReply({
                content: '❌ Error al reportar la emergencia. Por favor, intenta de nuevo.'
            });
        }
    }
};
