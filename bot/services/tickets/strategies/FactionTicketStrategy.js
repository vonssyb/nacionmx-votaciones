const BaseTicketStrategy = require('./BaseTicketStrategy');
const { TextInputBuilder, TextInputStyle } = require('discord.js');

class FactionTicketStrategy extends BaseTicketStrategy {
    constructor() {
        super('ticket_trabajo');
    }

    getModalFields() {
        return [
            new TextInputBuilder()
                .setCustomId('q_faction')
                .setLabel("¿A qué facción deseas postularte?:")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_roles')
                .setLabel("¿Ya tienes roles previos?")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ];
    }
}

module.exports = FactionTicketStrategy;
