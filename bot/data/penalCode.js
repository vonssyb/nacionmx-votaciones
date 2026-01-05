// Penal Code Data & Helper Functions
// Based on "CÓDIGO PENAL DEL ESTADO DE NACION MX"

// Time Conversion Constants (IRL Minutes)
const TIME_SCALE = {
    YEAR: 300,  // 5 hours IRL = 1 year RP
    MONTH: 90,  // 1.5 hours IRL = 1 month RP
    DAY: 30     // 30 mins IRL = 1 day RP
};

const ARTICLES = {
    // TÍTULO II: DELITOS CONTRA LA VIDA
    '10': { name: 'Homicidio Doloso', minYears: 15, maxYears: 25, points: 25, bailable: false },
    '11': { name: 'Homicidio Culposo', minYears: 5, maxYears: 10, points: 15, bailable: true },
    '12': { name: 'Lesiones', minYears: 1, maxYears: 3, points: 5, bailable: true }, // Leves default
    '12.1': { name: 'Lesiones Graves', minYears: 3, maxYears: 8, points: 10, bailable: true },
    '13': { name: 'Tortura o Trato Cruel', minYears: 5, maxYears: 15, points: 15, bailable: true },

    // CAPÍTULO II – DELITOS CONTRA LA LIBERTAD PERSONAL
    '20': { name: 'Secuestro', minYears: 15, maxYears: 40, points: 30, bailable: false },
    '21': { name: 'Retención Ilegal', minYears: 3, maxYears: 7, points: 10, bailable: true },
    '22': { name: 'Amenazas', minYears: 1, maxYears: 4, points: 5, bailable: true },

    // CAPÍTULO III – DELITOS CONTRA LA PROPIEDAD
    '30': { name: 'Robo con Violencia', minYears: 5, maxYears: 15, points: 15, bailable: true },
    '31': { name: 'Hurto (<$5k)', minYears: 1, maxYears: 1, points: 3, bailable: true, fine: 1000 },
    '31.1': { name: 'Hurto (>$5k)', minYears: 5, maxYears: 10, points: 10, bailable: true },
    '32': { name: 'Fraude / Estafa', minYears: 2, maxYears: 10, points: 10, bailable: true },
    '33': { name: 'Daño en Propiedad Ajena', minYears: 1, maxYears: 3, points: 5, bailable: true },

    // CAPÍTULO IV – DELITOS CONTRA LA AUTORIDAD
    '40': { name: 'Abuso de Autoridad', minYears: 2, maxYears: 6, points: 7, bailable: true },
    '41': { name: 'Desobediencia a la Autoridad', minYears: 1, maxYears: 3, points: 3, bailable: true },
    '42': { name: 'Evasión de Custodia', minYears: 2, maxYears: 5, points: 5, bailable: true },
    '43': { name: 'Soborno a Autoridad', minYears: 4, maxYears: 10, points: 10, bailable: true },

    // CAPÍTULO V – DELITOS INFORMÁTICOS
    '50': { name: 'Acceso No Autorizado', minYears: 2, maxYears: 6, points: 7, bailable: true },
    '51': { name: 'Suplantación de Identidad', minYears: 3, maxYears: 7, points: 10, bailable: true },
    '52': { name: 'Ciberdelincuencia Organizada', minYears: 8, maxYears: 15, points: 15, bailable: true },

    // CAPÍTULO VI – DELITOS DE TRÁNSITO
    '60': { name: 'Conducción Temeraria', minYears: 1, maxYears: 3, points: 5, fine: 2000 },
    '61': { name: 'DUI (Alcohol/Drogas)', minYears: 1, maxYears: 5, points: 7, fine: 5000 },
    '62': { name: 'Huir de la Policía', minYears: 3, maxYears: 7, points: 8, fine: 5000 }, // + decomiso
    '63': { name: 'Carrera Ilegal', minYears: 5, maxYears: 5, points: 6, fine: 5000 }, // + licencia
    '64': { name: 'Conducción sin Licencia', minYears: 0, maxYears: 0, points: 2, fine: 1500 },

    // CAPÍTULO VII – DELITOS CONTRA LA SALUD
    '70': { name: 'Contaminación Intencional', minYears: 3, maxYears: 8, points: 7, bailable: true },
    '71': { name: 'Maltrato Animal', maxMonths: 36, points: 4, bailable: true }, // handle months?

    // CAPÍTULO VIII – DELITOS CONTRA EL ESTADO
    '80': { name: 'Atentado Contra el Gobierno', minYears: 15, maxYears: 30, points: 30, bailable: false },
    '81': { name: 'Traición al Estado', minYears: 25, maxYears: 40, points: 35, bailable: false },
    '82': { name: 'Sabotaje Institucional', minYears: 10, maxYears: 20, points: 20, bailable: true },
    '83': { name: 'Difamación Grave Autoridades', minYears: 1, maxYears: 5, points: 5, bailable: true },

    // ARMAS
    '111': { name: 'Portación Ilegal de Armas', minYears: 1, maxYears: 5, points: 8, fine: 5000 },
    '112': { name: 'Uso de Armas Prohibidas', minYears: 5, maxYears: 15, points: 15, bailable: false },
    '113': { name: 'Comercio Ilegal de Armas', minYears: 5, maxYears: 10, points: 15, fine: 15000 }
};

module.exports = {
    ARTICLES,
    calculateSentence: (articleIds) => {
        let totalMinMinutes = 0;
        let totalMaxMinutes = 0;
        let totalFine = 0;
        let totalPoints = 0;
        let noBail = false;
        let reasons = [];

        const ids = articleIds.split(',').map(s => s.trim());

        for (const id of ids) {
            const art = ARTICLES[id];
            if (art) {
                reasons.push(`${art.name} (Art. ${id})`);

                // Calculate time
                if (art.minYears) totalMinMinutes += art.minYears * TIME_SCALE.YEAR;
                if (art.maxYears) totalMaxMinutes += art.maxYears * TIME_SCALE.YEAR;

                // Add fines
                if (art.fine) totalFine += art.fine;

                // Add points
                if (art.points) totalPoints += art.points;

                // Bail check
                if (art.bailable === false) noBail = true;
            }
        }

        return {
            minTime: totalMinMinutes,
            maxTime: totalMaxMinutes,
            suggestedTime: totalMinMinutes, // Default to minimum
            totalFine,
            totalPoints,
            noBail,
            reason: reasons.join(', ')
        };
    }
};
