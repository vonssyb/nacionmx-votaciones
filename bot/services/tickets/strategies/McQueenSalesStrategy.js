const McQueenBaseStrategy = require('./McQueenBaseStrategy');

class McQueenSalesStrategy extends McQueenBaseStrategy {
    constructor() {
        super('ticket_compra_vehiculo');
    }
}

module.exports = McQueenSalesStrategy;
