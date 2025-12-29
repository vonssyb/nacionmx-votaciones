const axios = require('axios');
const logger = require('../utils/logger');

class KeepAliveService {
    constructor() {
        this.interval = null;
        // Ping every 14 minutes (Render sleeps after 15)
        this.PING_INTERVAL = 14 * 60 * 1000;
    }

    start() {
        const url = process.env.RENDER_EXTERNAL_URL;

        if (!url) {
            logger.warn('Skipping Keep-Alive: RENDER_EXTERNAL_URL not set.');
            return;
        }

        logger.info(`Starting Keep-Alive Service for: ${url}`);

        // Initial Ping
        this.ping(url);

        // Schedule
        this.interval = setInterval(() => {
            this.ping(url);
        }, this.PING_INTERVAL);
    }

    async ping(url) {
        try {
            const start = Date.now();
            await axios.get(url);
            const duration = Date.now() - start;
            // logger.debug(`Keep-Alive Ping successful (${duration}ms)`);
        } catch (error) {
            logger.error(`Keep-Alive Ping Failed: ${error.message}`);
        }
    }
}

module.exports = new KeepAliveService();
