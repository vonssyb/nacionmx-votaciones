const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
                parent: '1466551872750878769', // CATEGORY ID
                topic: `${ticketType} | Usuario: ${interaction.user.id}`,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: '1466558863342964800', // Asesor de ventas role
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    }
                ]
            });

            // Save to database
            const { data: insertedTicket, error: dbError } = await supabase.from('tickets').insert({
                guild_id: interaction.guildId,
                user_id: interaction.user.id,
                creator_id: interaction.user.id,
                channel_id: ticketChannel.id,
                ticket_type: ticketType,
                status: 'open',
                created_at: new Date().toISOString()
            }).select().single();

            if (dbError) {
                logger.error('[McQueen Ticket] Database insert failed:', dbError);
                await ticketChannel.delete('Failed to save ticket to database');
                return interaction.editReply({
                    content: '❌ Error al guardar el ticket. Por favor contacta a un administrador.',
                    ephemeral: true
                });
            }

            logger.info(`[McQueen Ticket] Created ticket #${insertedTicket.id} for ${interaction.user.tag}`);

            // Create welcome embed
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`${ticketEmoji} ${ticketType}`)
                .setDescription(
                    `¡Hola ${interaction.user}! Gracias por contactar a McQueen Concesionario.\n\n` +
                    `Un asesor estará contigo pronto para ayudarte con: **${ticketDescription}**`
                )
                .setColor('#FF6B35')
                .setFooter({ text: 'McQueen Concesionario' })
                .setTimestamp();

            // Create Control Buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_cerrar')
                    .setLabel('Cerrar Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_claim')
                    .setLabel('Reclamar Ticket')
                    .setEmoji('🙋‍♂️')
                    .setStyle(ButtonStyle.Primary)
            );

            await ticketChannel.send({
                content: `${interaction.user} <@&1466558863342964800>`,
                embeds: [welcomeEmbed],
                components: [row]
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
