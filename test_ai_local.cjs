require('dotenv').config();
const { generateAIResponse } = require('./bot/handlers/ticketMessageHandler');

async function test() {
    console.log('--- TEST START ---');
    console.log('API KEY:', process.env.GEMINI_API_KEY ? 'Found' : 'Missing');

    const query = "Recibí un ban de 8 faltas, qué significa?";
    console.log(`Query: ${query}`);

    try {
        const response = await generateAIResponse(query);
        console.log('--- RESPONSE ---');
        console.log(response);
    } catch (e) {
        console.error('--- ERROR ---', e);
    }
}

test();
