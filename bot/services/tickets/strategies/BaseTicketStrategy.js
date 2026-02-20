const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const TICKET_CONFIG = require('../../../config/TicketConfig');

class BaseTicketStrategy {
    constructor(configKey) {
        this.configKey = configKey;
        this.config = TICKET_CONFIG.TYPES[configKey];
    }

    /**
     * Show the creation modal to the user
     */
    async showModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId(`modal_create_ticket:${this.configKey}`)
            .setTitle(this.config.title.substring(0, 45));

        const fields = this.getModalFields();
        fields.forEach(field => {
            modal.addComponents(new ActionRowBuilder().addComponents(field));
        });

        await interaction.showModal(modal);
    }

    /**
     * Abstract method to get modal fields
     * @returns {TextInputBuilder[]}
     */
    getModalFields() {
        throw new Error('getModalFields must be implemented');
    }

    /**
     * Handle the modal submission and create the ticket
     */
    /**
     * Handle the modal submission and create the ticket
     */
    async handleModalSubmit(interaction, client, supabase) {
        // 1. Gather Data
        const formData = this.getFormData(interaction);
        await this.createTicket(interaction, formData, client, supabase);
    }

    /**
     * Core logic to create the ticket channel and DB entry
     */
    async createTicket(interaction, formData, client, supabase) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

        const description = this.formatDescription(interaction, formData);

        // 2. Create Channel
        const channelName = this.getChannelName(interaction.user);
        const parentId = TICKET_CONFIG.CATEGORIES[this.config.categoryId];

        // Validation: Check category exists
        const guild = interaction.guild;

        try {
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: parentId,
                topic: `ID: ${interaction.user.id} | ${this.config.title}`,
                permissionOverwrites: this.getPermissionOverwrites(interaction, client)
            });

            // 3. Save to DB
            const { error: insertError, data: ticketData } = await supabase.from('tickets').insert([{
                guild_id: interaction.guild.id,
                channel_id: ticketChannel.id,
                user_id: interaction.user.id,
                status: 'OPEN',
                ticket_type: this.config.prefix,
                metadata: { formData } // Store form data for later reference
            }]).select().single();

            if (insertError) {
                await ticketChannel.delete('DB Insert Failed');
                throw insertError;
            }

            // 4. Send Initial Messages
            await this.sendWelcomeMessage(ticketChannel, interaction, description, client, supabase);

            // 5. Post-creation hooks (pinging staff, etc.)
            await this.onTicketCreated(ticketChannel, interaction, ticketData, client, supabase);

            await interaction.editReply(`✅ Ticket creado: ${ticketChannel}`);

        } catch (error) {
            console.error('Error handling ticket creation:', error);
            await interaction.editReply('❌ Error al crear el ticket. Contacta a un administrador.');
        }
    }

    getFormData(interaction) {
        // Default implementation: just map all fields
        const data = {};
        interaction.fields.fields.forEach(field => {
            data[field.customId] = field.value;
        });
        return data;
    }

    formatDescription(interaction, formData) {
        let desc = `**Tipo:** ${this.config.title}\n**Usuario:** ${interaction.user}\n\n`;
        for (const [key, value] of Object.entries(formData)) {
            desc += `**${key}:** ${value}\n`;
        }
        return desc;
    }

    getChannelName(user) {
        const cleanName = user.username.replace(/[^a-z0-9\-_]/g, '').toLowerCase().substring(0, 15);
        return `${this.config.prefix}-${cleanName}`;
    }

    getPermissionOverwrites(interaction, client) {
        const overwrites = [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ];

        // Add Role permission
        const roleId = TICKET_CONFIG.ROLES[this.config.roleId];
        if (roleId) {
            overwrites.push({
                id: roleId,
                allow: [PermissionFlagsBits.ViewChannel],
                deny: [PermissionFlagsBits.SendMessages] // Muted until claimed
            });
        }

        return overwrites;
    }

    async sendWelcomeMessage(channel, interaction, description, client, supabase) {
        const embed = new EmbedBuilder()
            .setTitle(`${this.config.emoji} ${this.config.title}`)
            .setDescription(description)
            .setColor(0x5865F2)
            .setFooter({ text: 'Reclama el ticket para responder' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_close_ticket_ask').setLabel('Cerrar').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('btn_claim_ticket').setLabel('Reclamar').setStyle(ButtonStyle.Success).setEmoji('✋')
        );

        await channel.send({
            content: `${interaction.user}`,
            embeds: [embed],
            components: [row]
        });
    }

    async onTicketCreated(channel, interaction, ticketData, client, supabase) {
        // Optional: Ping specific users if configured
        if (this.config.pingUserId) {
            const userId = TICKET_CONFIG.USERS[this.config.pingUserId];
            if (userId) await channel.send(`||<@${userId}>||`);
        }
    }
}

module.exports = BaseTicketStrategy;
