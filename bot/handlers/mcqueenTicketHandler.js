const { EmbedBuilder, ChannelType, PermissionFlagBits } = require('discord.js');
const logger = require('../services/Logger');

module.exports = {
    async handleTicketButton(interaction, client, supabase) {
        const customId = interaction.customId;

        // Parse ticket type
        let ticketType = '';
        let ticketEmoji = '';
        let ticketDescription = '';

        if (customId === 'ticket_compra_vehiculo') {
            ticketType = 'Compra de Vehículo';
            ticketEmoji = '🚙';
            ticketDescription = 'Venta de vehículo';
        } else if (customId === 'ticket_soporte_tecnico') {
            ticketType = 'Soporte Técnico';
            ticketEmoji = '🔧';
            ticketDescription = 'Soporte técnico';
        } else if (customId === 'ticket_agendar_cita') {
            ticketType = 'Agendar Cita';
            ticketEmoji = '📅';
            ticketDescription = 'Agendar cita';
        } else if (customId === 'ticket_recursos_humanos') {
            ticketType = 'Recursos Humanos';
            ticketEmoji = '💼';
            ticketDescription = 'Recursos humanos';
        } else {
            return interaction.reply({ content: '❌ Tipo de ticket no reconocido.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Check if user already has an open ticket
            const existingChannels = interaction.guild.channels.cache.filter(
                ch => ch.name.startsWith('ticket-') && ch.topic?.includes(interaction.user.id)
            );

            if (existingChannels.size > 0) {
                return interaction.editReply({
                    content: `❌ Ya tienes un ticket abierto: ${existingChannels.first()}`,
                    ephemeral: true
                });
            }

            // Create ticket channel
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                topic: `${ticketType} | Usuario: ${interaction.user.id}`,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagBits.ViewChannel, PermissionFlagBits.SendMessages, PermissionFlagBits.ReadMessageHistory]
                    },
                    {
                        id: '1466558863342964800', // Asesor de ventas role
                        allow: [PermissionFlagBits.ViewChannel, PermissionFlagBits.SendMessages, PermissionFlagBits.ReadMessageHistory]
                    }
                ]
            });

            // Save to database
            await supabase.from('tickets').insert({
                guild_id: interaction.guildId,
                user_id: interaction.user.id,
                channel_id: ticketChannel.id,
                ticket_type: ticketType,
                status: 'open',
                created_at: new Date().toISOString()
            });

            // Create welcome embed
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`${ticketEmoji} ${ticketType}`)
                .setDescription(
                    `¡Hola ${interaction.user}! Gracias por contactar a McQueen Concesionario.\\n\\n` +
                    `Un asesor estará contigo pronto para ayudarte con: **${ticketDescription}**`
                )
                .setColor('#FF6B35')
                .setFooter({ text: 'McQueen Concesionario' })
                .setTimestamp();

            await ticketChannel.send({
                content: `${interaction.user} <@&1466558863342964800>`,
                embeds: [welcomeEmbed]
            });

            await interaction.editReply({
                content: `✅ Ticket creado: ${ticketChannel}`,
                ephemeral: true
            });

        } catch (error) {
            logger.error('Error creating McQueen ticket:', error);
            await interaction.editReply({
                content: '❌ Error al crear el ticket. Intenta de nuevo.',
                ephemeral: true
            });
        }
    }
};
