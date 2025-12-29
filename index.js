import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

console.log('🚀 Bootstrapping Nacion MX Bot from root...');
console.log(`📂 Current root directory: ${__dirname}`);

const botDir = path.join(__dirname, 'bot');
console.log(`👉 Changing working directory to: ${botDir}`);

try {
    process.chdir(botDir);
    console.log(`✅ Directory changed successfully.`);
} catch (err) {
    console.error(`❌ Failed to change directory:`, err);
    process.exit(1);
}

// Start the bot
try {
    console.log('🤖 Requiring bot/index.js...');
    require('./bot/index.js');
} catch (err) {
    console.error('❌ Error starting bot:', err);
    process.exit(1);
}
