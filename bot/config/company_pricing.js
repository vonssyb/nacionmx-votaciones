// ===================================================================
// PRICING TABLE FOR COMPANY CREATION
// Auto-calculated by system
// ===================================================================

const COMPANY_PRICING = {
    // Fixed cost
    tramite: 250000, // $250k MXN fijo

    // Local costs by size
    local: {
        'pequeño': 850000,    // $850k
        'mediano': 1750000,   // $1.75M
        'grande': 3200000,    // $3.2M
        'gigante': 5000000    // $5M
    },

    // Vehicle costs by type
    vehiculos: {
        'ejecutiva_ligera': 420000,       // $420k
        'operativa_servicio': 550000,     // $550k
        'carga_pesada': 850000,           // $850k
        'ejecutiva_premium': 1200000,     // $1.2M
        'asistencia_industrial': 1500000  // $1.5M
    },

    // Vehicle display names
    vehiculoNames: {
        'ejecutiva_ligera': 'Unidad Ejecutiva Ligera',
        'operativa_servicio': 'Unidad Operativa de Servicio',
        'carga_pesada': 'Unidad de Carga Pesada',
        'ejecutiva_premium': 'Unidad Ejecutiva Premium',
        'asistencia_industrial': 'Unidad de Asistencia Industrial'
    }
};

/**
 * Calculate total company cost
 * @param {string} tipoLocal - Size of local (pequeño, mediano, grande, gigante)
 * @param {Array<string>} vehiculos - Array of vehicle types
 * @returns {Object} - Breakdown of costs
 */
function calculateCompanyCost(tipoLocal, vehiculos = []) {
    const costoTramite = COMPANY_PRICING.tramite;
    const costoLocal = COMPANY_PRICING.local[tipoLocal] || 0;

    let costoVehiculos = 0;
    const vehiculosDetalle = [];

    vehiculos.forEach(v => {
        if (v && COMPANY_PRICING.vehiculos[v]) {
            costoVehiculos += COMPANY_PRICING.vehiculos[v];
            vehiculosDetalle.push({
                tipo: COMPANY_PRICING.vehiculoNames[v],
                costo: COMPANY_PRICING.vehiculos[v]
            });
        }
    });

    const costoTotal = costoTramite + costoLocal + costoVehiculos;

    return {
        tramite: costoTramite,
        local: costoLocal,
        vehiculos: costoVehiculos,
        vehiculosDetalle,
        total: costoTotal
    };
}

// Export for use in empresa command handler
module.exports = { COMPANY_PRICING, calculateCompanyCost };
