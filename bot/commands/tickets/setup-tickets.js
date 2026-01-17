const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase logic inside execute or globally if safe
// Using the same env connection logic as the rest of the bot
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Configura un nuevo panel de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('El canal donde se enviará el panel')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
        .addRoleOption(option =>
            option.setName('rol_soporte')
                .setDescription('El rol que atenderá los tickets')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('categoria')
                .setDescription('Categoría donde se crearán los tickets (Vacío = crear nueva)')
                .addChannelTypes(ChannelType.GuildCategory))
        .addStringOption(option =>
            option.setName('titulo')
                .setDescription('Título del Embed del panel'))
        .addStringOption(option =>
            option.setName('descripcion')
                .setDescription('Descripción del panel'))
        .addStringOption(option =>
            option.setName('label_boton')
                .setDescription('Texto del botón (Ej: Crear Ticket)'))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('Emoji para el botón (Ej: 📩)')),

    async execute(interaction) {
        // Defer reply as DB + Discord API calls might take time
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.options.getChannel('canal');
            const role = interaction.options.getRole('rol_soporte');
            const category = interaction.options.getChannel('categoria');
            const title = interaction.options.getString('titulo') || 'Soporte y Tickets';
            const description = interaction.options.getString('descripcion') || 'Haz clic en el botón de abajo para contactar con el equipo de soporte.';
            const buttonLabel = interaction.options.getString('label_boton') || 'Crear Ticket';
            const emoji = interaction.options.getString('emoji') || '📩';

            // Validate permissions in target channel
            if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
                return interaction.editReply({ content: `❌ No tengo permisos para enviar mensajes en ${channel}.` });
            }

            // Create the Embed
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(0x2B2D31) // Dark theme
                .setFooter({ text: 'Sistema de Tickets', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            // Create the Button
            const btn = new ButtonBuilder()
                .setCustomId('btn_create_ticket_panel') // This will be the trigger. NOTE: We need to store the panel config to know WHAT to do.
                // We will encode the panel ID in the customId properly later, or look it up via message ID.
                .setLabel(buttonLabel)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(emoji);

            const row = new ActionRowBuilder().addComponents(btn);

            // Send to channel
            const sentMessage = await channel.send({ embeds: [embed], components: [row] });

            // Store in Database
            // Note: We use the message ID to look up the config when the button is clicked!
            const { data, error } = await supabase
                .from('ticket_panels')
                .insert([
                    {
                        guild_id: interaction.guild.id,
                        channel_id: channel.id,
                        message_id: sentMessage.id,
                        title: title,
                        description: description,
                        button_label: buttonLabel,
                        button_style: 'Primary',
                        emoji: emoji,
                        category_id: category ? category.id : null, // If null, handler should find/create 'Tickets' category
                        support_role_id: role.id,
                        naming_format: 'ticket-{username}'
                    }
                ])
                .select();

            if (error) {
                console.error('Error creating ticket panel in DB:', error);
                await sentMessage.delete(); // Rollback discord message
                return interaction.editReply({ content: `❌ Error guardando configuración en base de datos: ${error.message}\n Asegúrate de haber ejecutado el script SQL.` });
            }

            const feedback = new EmbedBuilder()
                .setTitle('✅ Panel Creado')
                .setDescription(`El panel de tickets ha sido enviado a ${channel}.\n\n**ID Panel:** \`${data[0].id}\`\n**Rol Soporte:** ${role}`)
                .setColor(0x57F287);

            await interaction.editReply({ embeds: [feedback] });

        } catch (err) {
            console.error(err);
            await interaction.editReply({ content: '❌ Ocurrió un error inesperado al crear el panel.' });
        }
    }
};
