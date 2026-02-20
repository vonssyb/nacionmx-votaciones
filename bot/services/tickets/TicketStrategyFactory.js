const TICKET_CONFIG = require('../../config/TicketConfig');

// Strategies will be lazy-loaded or required here
// We'll require them as we implement them. For now, BaseStrategy placeholder or specific ones.
// To avoid circular dependency issues or large modification, we'll implement the factory logic 
// to look up files naturally.

class TicketStrategyFactory {
    static getStrategy(typeKey) {
        const config = TICKET_CONFIG.TYPES[typeKey];
        if (!config) throw new Error(`Unknown ticket type: ${typeKey}`);

        // Naming convention: snake_case key -> PascalCaseStrategy
        // e.g. ticket_general -> GeneralTicketStrategy or just use a map
        // For simplicity, let's map them explicitly or use a switch.

        let StrategyClass;

        try {
            // Attempt to load specific strategy
            // Mapping keys to filenames
            const strategyMap = {
                'ticket_general': 'GeneralTicketStrategy',
                'ticket_reportes': 'ReportTicketStrategy',
                'ticket_blacklist': 'BlacklistTicketStrategy',
                'ticket_trabajo': 'FactionTicketStrategy',
                'ticket_prestamo': 'LoanTicketStrategy',
                'ticket_ck': 'CKTicketStrategy',
                'ticket_vip': 'VIPTicketStrategy',
                'ticket_bug': 'BugTicketStrategy',
                // McQueen
                'ticket_compra_vehiculo': 'McQueenSalesStrategy',
                'ticket_soporte_tecnico': 'McQueenSupportStrategy',
                'ticket_agendar_cita': 'McQueenApptStrategy',
                'ticket_recursos_humanos': 'McQueenHRStrategy'
            };

            const fileName = strategyMap[typeKey];
            if (fileName) {
                StrategyClass = require(`./strategies/${fileName}`);
            } else {
                // Fallback to General for unknown types if safe? No, better error.
                throw new Error(`Strategy not mapped for ${typeKey}`);
            }

            return new StrategyClass(typeKey);

        } catch (e) {
            // If strategy file doesn't exist yet, we might want a fallback during dev
            // But better to fail fast.
            console.error(`Failed to load strategy for ${typeKey}:`, e);
            throw e;
        }
    }
}

module.exports = TicketStrategyFactory;
