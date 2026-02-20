const McQueenBaseStrategy = require('./McQueenBaseStrategy');

class McQueenSupportStrategy extends McQueenBaseStrategy {
    constructor() {
        super('ticket_soporte_tecnico');
    }
}

module.exports = McQueenSupportStrategy;
