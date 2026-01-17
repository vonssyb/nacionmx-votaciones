require('dotenv').config({ path: 'bot/.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No API KEY found in bot/.env");
        return;
    }
    console.log("Using Key:", key.substring(0, 10) + "...");

    // Using fetch because SDK listModels might be obscure or require specific client
    // But let's try to just use a known valid model based on docs: "gemini-1.5-flash"
    // If that failed, let's try to fetch the list via REST which is standard.

    try {
        const fetch = (await import('node-fetch')).default; // Dynamic import for node-fetch if needed, or use built-in fetch in Node 18+
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.error) {
            console.error("API Error:", data.error);
        } else {
            console.log("--- AVAILABLE MODELS ---");
            if (data.models) {
                data.models.forEach(m => {
                    if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                        console.log(`- ${m.name}`);
                    }
                });
            } else {
                console.log("No models returned. Raw:", data);
            }
        }

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

listModels();
