const McQueenBaseStrategy = require('./McQueenBaseStrategy');

class McQueenHRStrategy extends McQueenBaseStrategy {
    constructor() {
        super('ticket_recursos_humanos');
    }
}

module.exports = McQueenHRStrategy;
