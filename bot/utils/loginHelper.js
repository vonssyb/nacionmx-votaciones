const logger = require('../services/Logger');

async function loginWithRetry(client, token, botName) {
    try {
        await client.login(token);
    } catch (error) {
        logger.error(`${botName} login failed`, { error: error.message });
        setTimeout(() => loginWithRetry(client, token, botName), 10000);
    }
}

module.exports = loginWithRetry;
