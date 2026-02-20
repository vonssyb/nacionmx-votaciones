const McQueenBaseStrategy = require('./McQueenBaseStrategy');

class McQueenApptStrategy extends McQueenBaseStrategy {
    constructor() {
        super('ticket_agendar_cita');
    }
}

module.exports = McQueenApptStrategy;
