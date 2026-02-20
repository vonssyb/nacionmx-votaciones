const BaseTicketStrategy = require('./BaseTicketStrategy');
const { TextInputBuilder, TextInputStyle } = require('discord.js');

class GeneralTicketStrategy extends BaseTicketStrategy {
    constructor() {
        super('ticket_general');
    }

    getModalFields() {
        return [
            new TextInputBuilder()
                .setCustomId('q_topic')
                .setLabel("Tema: (Duda / Queja / Sugerencia)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_situation')
                .setLabel("Explica tu situación clara y detallada:")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000)
        ];
    }
}

module.exports = GeneralTicketStrategy;
