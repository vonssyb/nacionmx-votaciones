const BaseTicketStrategy = require('./BaseTicketStrategy');
const { TextInputBuilder, TextInputStyle } = require('discord.js');

class CKTicketStrategy extends BaseTicketStrategy {
    constructor() {
        super('ticket_ck');
    }

    getModalFields() {
        return [
            new TextInputBuilder()
                .setCustomId('q_char_name')
                .setLabel("Nombre de tu personaje:")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_target_name')
                .setLabel("Nombre del objetivo:")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_lore')
                .setLabel("Historia y justificación del rol (lore):")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(900),
            new TextInputBuilder()
                .setCustomId('q_proofs')
                .setLabel("Pruebas del rol (+16 horas):")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        ];
    }
}

module.exports = CKTicketStrategy;
