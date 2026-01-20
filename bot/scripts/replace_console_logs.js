#!/usr/bin/env node
/**
 * Replace console.log with logger in index_unified.js
 * This script replaces remaining console statements with proper logger calls
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'index_unified.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replacements map
const replacements = [
    // Error handlers
    [/console\.error\('\[APP\] 💥 Error assigning roles:', err\);/g, "logger.errorWithContext('Error assigning roles to approved applicant', err);"],
    [/console\.error\('\[TICKET\] Error in handler:', err\);/g, "logger.errorWithContext('Ticket handler error', err);"],
    [/console\.error\('\[MOD\] Legacy Handler Error:', e\);/g, "logger.errorWithContext('Legacy moderation handler error', e, { module: 'MOD' });"],
    [/console\.error\('\[LOG\] Error logging command:', logErr\);/g, "logger.errorWithContext('Error logging command usage', logErr);"],
    [/console\.error\('\[MOD\] Command Error:', e\);/g, "logger.errorWithContext('MOD command execution error', e);"],
    [/console\.error\('Eco Billing Error:', e\)/g, "logger.errorWithContext('Economy billing service error', e)"],
    [/console\.error\('\[ECO\] Command Error:', e\);/g, "logger.errorWithContext('ECO command execution error', e);"],
    [/console\.error\('\[ECO\] Legacy Error:', e\);/g, "logger.errorWithContext('Legacy economy handler error', e);"],
    [/console\.error\('\[GOV\] Visa Payment Error:', error\);/g, "logger.errorWithContext('Visa payment error', error, { module: 'GOV' });"],
    [/console\.error\('\[GOV\] Command Error:', e\);/g, "logger.errorWithContext('GOV command execution error', e);"],

    // Economy bot registrations
    [/console\.log\(`🔄 \[ECO\] Auto-registering commands for \${TARGET_GUILDS\.length} guilds \(Background\)\.\.\.\`\);/g, "logger.info(`Auto-registering ECO commands for ${TARGET_GUILDS.length} guilds`);"],
    [/console\.log\(`✅ \[ECO\] Registered \${allCommands\.length} commands to Guild ID: \${guildId}`\);/g, "logger.info(`Registered ${allCommands.length} ECO commands to guild`, { guildId });"],
    [/console\.error\(\`❌ \[ECO\] Failed to register commands for Guild ID \${guildId}:`, guildError\);/g, "logger.errorWithContext(`Failed to register ECO commands for guild`, guildError, { guildId });"],
    [/console\.error\('❌ \[ECO\] Critical Auto-registration failure:', regError\);/g, "logger.errorWithContext('Critical ECO auto-registration failure', regError);"],

    // Government bot registrations
    [/console\.log\(`🔄 Auto-registering Gov commands for \${TARGET_GUILDS\.length} guilds \(Background\)\.\.\.\`\);/g, "logger.info(`Auto-registering GOV commands for ${TARGET_GUILDS.length} guilds`);"],
    [/console\.log\(`✅ Registered \${allCommands\.length} Gov commands to Guild ID: \${guildId}`\);/g, "logger.info(`Registered ${allCommands.length} GOV commands to guild`, { guildId });"],
    [/console\.error\(\`❌ Failed to register commands for Guild ID \${guildId}:`, guildError\);/g, "logger.errorWithContext(`Failed to register GOV commands for guild`, guildError, { guildId });"],
    [/console\.error\('❌ Critical Gov Auto-registration failure:', regError\);/g, "logger.errorWithContext('Critical GOV auto-registration failure', regError);"],

    // ERLC logs
    [/console\.log\(\`\[ERLC\] Emergency \${emergencyId} joined by \${interaction\.user\.tag}\`\);/g, "logger.info(`Emergency joined`, { emergencyId, user: interaction.user.tag });"],
    [/console\.error\('\[ERLC\] Emergency respond error:', error\);/g, "logger.errorWithContext('Emergency respond error', error);"],
    [/console\.log\(\`\[ERLC\] Payment request \${requestId} accepted`\);/g, "logger.info(`Payment request accepted`, { requestId });"],
    [/console\.error\('\[ERLC\] Payment accept error:', error\);/g, "logger.errorWithContext('Payment accept error', error);"],
    [/console\.log\(\`\[ERLC\] Payment request \${requestId} rejected`\);/g, "logger.info(`Payment request rejected`, { requestId });"],
    [/console\.error\('\[ERLC\] Payment reject error:', error\);/g, "logger.errorWithContext('Payment reject error', error);"],

    // Login retries
    [/console\.error\(\`❌ \[\${botName}\] Login Failed:`, error\.message\);/g, "logger.error(`${botName} login failed`, { error: error.message });"],
    [/console\.log\(`⏳ \[Startup\] Another instance is active\. Waiting for lock\.\.\. \(Max 45s\)`\);/g, "logger.info('Another bot instance is active, waiting for lock (max 45s)');"],
    [/console\.log\(`✅ \[Startup\] Lock acquired\. Starting bots in 2s\.\.\.\`\);/g, "logger.info('Lock acquired, starting bots in 2s');"],
    [/console\.error\(`❌ \[Startup\] Lock Timeout\. Starting anyway \(Manual cleanup may be needed\)`\);/g, "logger.warn('Lock timeout, starting anyway (manual cleanup may be needed)');"],
    [/console\.log\(`⏸️ Graceful Shutdown: Releasing lock\.\.\.\`\);/g, "logger.info('Graceful shutdown: Releasing lock');"],
    [/console\.log\(`✅ Lock released\. Exiting\.\.\.\`\);/g, "logger.info('Lock released, exiting');"],
    [/console\.error\(`⚠️ Error releasing lock:`, e\.message\);/g, "logger.error('Error releasing lock', { error: e.message });"]
];

// Apply all replacements
let changeCount = 0;
replacements.forEach(([pattern, replacement]) => {
    const before = content;
    content = content.replace(pattern, replacement);
    if (before !== content) changeCount++;
});

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log(`✅ Replaced ${changeCount} console statements with logger calls`);
console.log(`📝 File updated: ${filePath}`);
