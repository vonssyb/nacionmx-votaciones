const BaseTicketStrategy = require('./BaseTicketStrategy');
const { TextInputBuilder, TextInputStyle } = require('discord.js');

class BugTicketStrategy extends BaseTicketStrategy {
    constructor() {
        super('ticket_bug');
    }

    getModalFields() {
        return [
            new TextInputBuilder()
                .setCustomId('q_location')
                .setLabel("¿En qué parte ocurre el error?")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_desc')
                .setLabel("Describe el fallo y cómo reproducirlo:")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(900)
        ];
    }
}

module.exports = BugTicketStrategy;
