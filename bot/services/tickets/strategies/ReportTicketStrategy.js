const BaseTicketStrategy = require('./BaseTicketStrategy');
const { TextInputBuilder, TextInputStyle } = require('discord.js');

class ReportTicketStrategy extends BaseTicketStrategy {
    constructor() {
        super('ticket_reportes');
    }

    getModalFields() {
        return [
            new TextInputBuilder()
                .setCustomId('q_who')
                .setLabel("Usuario a reportar:")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_infraction')
                .setLabel("Tipo de infracción cometida:")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_context')
                .setLabel("Describe lo sucedido (contexto completo):")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(900),
            new TextInputBuilder()
                .setCustomId('q_proofs')
                .setLabel("¿Cuentas con pruebas claras?")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ];
    }
}

module.exports = ReportTicketStrategy;
