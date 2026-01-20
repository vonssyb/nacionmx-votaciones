#!/usr/bin/env node
/**
 * Comprehensive logger migration script
 * Migrates all console.log/error/warn to Logger service across handlers
 */

const fs = require('fs');
const path = require('path');

const handlersToMigrate = [
    'handlers/ticketMessageHandler.js',
    'handlers/ticketHandler.js',
    'handlers/legacyEconomyHandler.js',
    'handlers/legacyModerationHandler.js'
];

// Common replacement patterns
const replacements = [
    // Generic patterns
    [/console\.log\('✅ (.+?)'\);/g, "logger.info('$1');"],
    [/console\.log\('🔄 (.+?)'\);/g, "logger.info('$1');"],
    [/console\.log\('🔍 (.+?)'\);/g, "logger.info('$1');"],
    [/console\.warn\('⚠️ (.+?)'\);/g, "logger.warn('$1');"],
    [/console\.error\('❌ (.+?)', (.+?)\);/g, "logger.error('$1', { error: $2 });"],
    [/console\.error\('(.+?):', (.+?)\);/g, "logger.errorWithContext('$1', $2);"],
    [/console\.error\(\\"(.+?):\\", (.+?)\);/g, "logger.errorWithContext('$1', $2);"],
    [/console\.log\(\`✅ (.+?)\`\);/g, "logger.info(`$1`);"],
    [/console\.log\(\`🔄 (.+?)\`\);/g, "logger.info(`$1`);"],
    [/console\.log\(\`🔍 (.+?)\`\);/g, "logger.info(`$1`);"],
    [/console\.warn\(\`⚠️ (.+?)\`\);/g, "logger.warn(`$1`);"],
    [/console\.error\(\`❌ (.+?)\`, (.+?)\);/g, "logger.error(`$1`, { error: $2 });"],

    // Groq specific
    [/console\.error\('\[GROQ\] (.+?)'\);/g, "logger.error('$1', { module: 'GROQ' });"],
    [/console\.log\(\`Groq Error \(Key #\${(.+?)}\):`, (.+?)\);/g, "logger.error(`Groq error with key`, { keyIndex: $1, error: $2 });"],

    // File operations
    [/console\.warn\('⚠️ (.+?)\.md no encontrado(.+?)'\);/g, "logger.warn('$1.md not found$2');"],
    [/console\.error\('Error cargando (.+?):', (.+?)\);/g, "logger.errorWithContext('Error loading $1', $2);"],

    // Generic error patterns
    [/console\.error\('Error (.+?):', (.+?)\);/g, "logger.errorWithContext('Error $1', $2);"],
    [/console\.log\('(.+?)'\);/g, "logger.info('$1');"],
    [/console\.log\(\`(.+?)\`\);/g, "logger.info(`$1`);"],
    [/console\.warn\('(.+?)'\);/g, "logger.warn('$1');"],
    [/console\.error\('(.+?)'\);/g, "logger.error('$1');"]
];

// Check if logger is imported
function ensureLoggerImport(content, filePath) {
    const loggerImport = "const logger = require('../services/Logger');";
    const legacyLoggerImport = "const logger = require('./services/Logger');";

    // Determine correct import based on file location
    const isInHandlers = filePath.includes('handlers/');
    const correctImport = isInHandlers ? loggerImport : legacyLoggerImport;

    if (!content.includes("require('../services/Logger')") &&
        !content.includes("require('./services/Logger')")) {
        // Find where to insert (after other requires, before module.exports or first function)
        const lines = content.split('\n');
        let insertIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('require(')) {
                insertIndex = i + 1;
            }
            if (lines[i].includes('module.exports') || lines[i].includes('async function')) {
                break;
            }
        }

        lines.splice(insertIndex, 0, correctImport);
        return lines.join('\n');
    }

    return content;
}

let totalReplacements = 0;
const results = [];

for (const handlerPath of handlersToMigrate) {
    const fullPath = path.join(__dirname, '..', handlerPath);

    if (!fs.existsSync(fullPath)) {
        console.log(`⏭️  Skipping ${handlerPath} (not found)`);
        continue;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let fileReplacements = 0;

    // Ensure logger import
    content = ensureLoggerImport(content, handlerPath);

    // Apply replacements
    for (const [pattern, replacement] of replacements) {
        const before = content;
        content = content.replace(pattern, replacement);
        if (before !== content) {
            fileReplacements++;
        }
    }

    // Write back
    if (fileReplacements > 0) {
        fs.writeFileSync(fullPath, content, 'utf8');
        totalReplacements += fileReplacements;
        results.push({ file: handlerPath, replacements: fileReplacements });
        console.log(`✅ ${handlerPath}: ${fileReplacements} patterns replaced`);
    } else {
        console.log(`✓  ${handlerPath}: Already migrated`);
    }
}

console.log('\n📊 Migration Summary:');
console.log(`   Total files processed: ${results.length}`);
console.log(`   Total patterns replaced: ${totalReplacements}`);

if (results.length > 0) {
    console.log('\n📝 Updated files:');
    results.forEach(r => {
        console.log(`   - ${r.file} (${r.replacements} changes)`);
    });
}

console.log('\n✅ Logger migration complete!');
console.log('   Next: Review changes and test the bot');
