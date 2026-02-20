const BaseTicketStrategy = require('./BaseTicketStrategy');
const { TextInputBuilder, TextInputStyle } = require('discord.js');

class VIPTicketStrategy extends BaseTicketStrategy {
    constructor() {
        super('ticket_vip');
    }

    getModalFields() {
        return [
            new TextInputBuilder()
                .setCustomId('q_vip_needs')
                .setLabel("¿En qué necesitas atención prioritaria?")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(800)
        ];
    }
}

module.exports = VIPTicketStrategy;
