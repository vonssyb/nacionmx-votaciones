const BaseTicketStrategy = require('./BaseTicketStrategy');
const TICKET_CONFIG = require('../../../config/TicketConfig');

class McQueenBaseStrategy extends BaseTicketStrategy {
    // Override interaction handler to skip modal
    async handleInteraction(interaction, client, supabase) {
        await this.createTicket(interaction, {}, client, supabase);
    }

    // McQueen doesn't use modals, so we don't need getModalFields
    getModalFields() { return []; }

    formatDescription(interaction, formData) {
        return `¡Hola ${interaction.user}! Gracias por contactar a McQueen Concesionario.\n\n` +
            `Un asesor estará contigo pronto para ayudarte con: **${this.config.title}**`;
    }
}

module.exports = McQueenBaseStrategy;
