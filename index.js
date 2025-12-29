import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs';

// Force immediate flush of logs
const log = (msg) => process.stdout.write(msg + '\n');
const err = (msg, e) => {
    process.stderr.write(msg + '\n');
    if (e) process.stderr.write((e.stack || e) + '\n');
};

log('🚀 [ROOT] Bootstrapping Nacion MX Bot from root index.js...');

// Global handlers
process.on('uncaughtException', (e) => {
    err('❌ [ROOT] Uncaught Exception:', e);
    process.exit(1);
});
process.on('unhandledRejection', (r) => {
    err('❌ [ROOT] Unhandled Rejection:', r);
    process.exit(1);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

log(`📂 [ROOT] Current root directory: ${__dirname}`);

const botDir = path.join(__dirname, 'bot');
log(`👉 [ROOT] Target bot directory: ${botDir}`);

if (!fs.existsSync(botDir)) {
    err(`❌ [ROOT] Bot directory does not exist: ${botDir}`);
    process.exit(1);
}

try {
    process.chdir(botDir);
    log(`✅ [ROOT] Directory changed successfully to: ${process.cwd()}`);
} catch (error) {
    err(`❌ [ROOT] Failed to change directory:`, error);
    process.exit(1);
}

// Start the bot
const botFile = './index.js'; // Relative to CWD (botDir) because we changed dir? No wait.
// require resolves relative to THIS file (__filename).
// So we must use absolute path or relative to root.
// ./bot/index.js is relative to root.

const botPath = path.join(botDir, 'index.js');
log(`🤖 [ROOT] Resolving bot entry point: ${botPath}`);

if (!fs.existsSync(botPath)) {
    err(`❌ [ROOT] Bot entry file missing: ${botPath}`);
    process.exit(1);
}

try {
    log('⚡ [ROOT] Requiring bot...');
    require(botPath);
    log('✅ [ROOT] Bot required successfully. Setup should continue in bot/index.js');
} catch (error) {
    err('❌ [ROOT] Error checking/starting bot:', error);
    process.exit(1);
}
