const path = require('path');

// Change working directory to 'bot' so that relative paths (fs, requires) work as expected
const botDir = path.join(__dirname, 'bot');
try {
    process.chdir(botDir);
    console.log(`✅ Changed working directory to: ${botDir}`);
} catch (err) {
    console.error(`❌ Failed to change directory to ${botDir}:`, err);
    process.exit(1);
}

// Start the bot
require('./bot/index.js');
