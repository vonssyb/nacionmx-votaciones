const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('solicitar-mod')
        .setDescription('🆘 Solicitar ayuda a un miembro del Staff')
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Describe brevemente tu problema')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply({ flags: [64] });

        const motivo = interaction.options.getString('motivo');
        const STAFF_ROLE_ID = '1450242487422812251';
        // Or specific Support role: '1451703422800625777' (Soporte) from previous contexts?
        // Using provided STAFF role for now. 

        // Channel to send requests to (Support Channel)
        const SUPPORT_CHANNEL_ID = '1398888949824491630'; // #ayuda-soporte general? Or admin chat?
        // Better: Find a specific channel for tickets or alerts. 
        // Using "security alerts" channel for now as fallback or user general channel if not defined.
        // Let's assume there is a staff logs channel.
        const ALERT_CHANNEL = '1398891838890311732'; // Same as logs for visibility

        const alertEmbed = new EmbedBuilder()
            .setTitle('🆘 Solicitud de Ayuda')
            .setColor('#E74C3C')
            .setDescription(`**Usuario:** <@${interaction.user.id}>\n**Canal:** <#${interaction.channelId}>\n**Motivo:**\n${motivo}`)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_ticket') // Handled by generic handler maybe?
                .setLabel('Atender (WIP)')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
        );

        try {
            const channel = await client.channels.fetch(ALERT_CHANNEL);
            if (channel) {
                await channel.send({ content: `<@&${STAFF_ROLE_ID}>`, embeds: [alertEmbed], components: [row] });
                await interaction.editReply('✅ **Solicitud Enviada.** Un miembro del staff ha sido notificado y te atenderá pronto.');
            } else {
                await interaction.editReply('❌ Error de configuración: Canal de soporte no encontrado.');
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al enviar la solicitud.');
        }
    }
};
