const BaseTicketStrategy = require('./BaseTicketStrategy');
const { TextInputBuilder, TextInputStyle } = require('discord.js');

class BlacklistTicketStrategy extends BaseTicketStrategy {
    constructor() {
        super('ticket_blacklist');
    }

    getModalFields() {
        return [
            new TextInputBuilder()
                .setCustomId('q_staff')
                .setLabel("Staff sancionador:")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_reason')
                .setLabel("Motivo (Ban/Warn):")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_defense')
                .setLabel("Justificación de apelación:")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(900)
        ];
    }
}

module.exports = BlacklistTicketStrategy;
