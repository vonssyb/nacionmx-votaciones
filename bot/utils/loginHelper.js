const logger = require('../services/Logger');

async function loginWithRetry(client, token, botName) {
    try {
        await client.login(token);
    } catch (error) {
        logger.error(`${botName} login failed`, {
            error: error.message,
            code: error.code,
            stack: error.stack
        });
        console.error(`❌ [${botName}] Login Error:`, error.message, `(Code: ${error.code})`);
        setTimeout(() => loginWithRetry(client, token, botName), 10000);
    }
}

module.exports = loginWithRetry;
