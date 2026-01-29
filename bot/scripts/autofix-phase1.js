/**
 * Phase 1 Auto-Fix Script
 * Automatically applies Phase 1 improvements to all command files:
 * 1. Add/uncomment/standardize deferReply
 * 2. Replace .single() with .maybeSingle()
 * 3. Add basic error handling where missing
 * 
 * Run with --dry-run to preview changes without applying them
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const BACKUP_DIR = path.join(__dirname, '..', 'backups', `phase1-${Date.now()}`);

let stats = {
    filesProcessed: 0,
    deferReplyAdded: 0,
    deferReplyUncommented: 0,
    deferReplyStandardized: 0,
    singleReplaced: 0,
    errorHandlingAdded: 0,
    filesBackedUp: 0
};

function backupFile(filePath) {
    if (DRY_RUN) return;

    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
    const backupPath = path.join(BACKUP_DIR, relativePath);
    const backupDir = path.dirname(backupPath);

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    fs.copyFileSync(filePath, backupPath);
    stats.filesBackedUp++;
}

function fixDeferReply(content, filePath) {
    let modified = false;
    let newContent = content;

    // Pattern 1: Uncomment existing deferReply
    if (/\/\/\s*await interaction\.deferReply/.test(content)) {
        newContent = newContent.replace(
            /\/\/\s*(await interaction\.deferReply\(\{?\s*(?:ephemeral:\s*true\s*)?\}?\);?)/g,
            '$1'
        );
        stats.deferReplyUncommented++;
        modified = true;
        console.log(`  ✓ Uncommented deferReply in ${path.basename(filePath)}`);
    }

    // Pattern 2: Standardize conditional deferReply
    if (/if\s*\([^)]*!interaction\.deferred[^)]*\)\s*await interaction\.deferReply/.test(content)) {
        // Keep the conditional but make it consistent
        newContent = newContent.replace(
            /if\s*\([^)]*!interaction\.deferred[^)]*\)\s*await interaction\.deferReply\([^)]*\);?/g,
            'if (!interaction.deferred && !interaction.replied) await interaction.deferReply();'
        );
        stats.deferReplyStandardized++;
        modified = true;
        console.log(`  ✓ Standardized conditional deferReply in ${path.basename(filePath)}`);
    }

    // Pattern 3: Add deferReply if missing
    const hasAnyDefer = /await interaction\.deferReply/.test(newContent);
    const executeMatch = newContent.match(/(async execute\(interaction[^)]*\)\s*{)/);

    if (!hasAnyDefer && executeMatch) {
        const insertPosition = newContent.indexOf(executeMatch[0]) + executeMatch[0].length;
        const insertion = `\n        if (!interaction.deferred && !interaction.replied) {\n            await interaction.deferReply();\n        }\n`;

        newContent = newContent.slice(0, insertPosition) + insertion + newContent.slice(insertPosition);
        stats.deferReplyAdded++;
        modified = true;
        console.log(`  ✓ Added deferReply to ${path.basename(filePath)}`);
    }

    return { content: newContent, modified };
}

function fixSingleToMaybeSingle(content, filePath) {
    let modified = false;
    let newContent = content;

    // Count occurrences before
    const singleMatches = (content.match(/\.single\(\)/g) || []).length;

    if (singleMatches > 0) {
        // Replace .single() with .maybeSingle()
        newContent = newContent.replace(/\.single\(\)/g, '.maybeSingle()');
        stats.singleReplaced += singleMatches;
        modified = true;
        console.log(`  ✓ Replaced ${singleMatches} .single() → .maybeSingle() in ${path.basename(filePath)}`);
    }

    return { content: newContent, modified };
}

function addBasicErrorHandling(content, filePath) {
    let modified = false;
    let newContent = content;

    // Check if already has try-catch around main execution
    if (!/try\s*{/.test(content)) {
        // Find the execute function body
        const executeMatch = content.match(/async execute\(interaction[^)]*\)\s*{([\s\S]*?)}\s*};?\s*$/m);

        if (executeMatch) {
            const functionBody = executeMatch[1];

            // Wrap the body in try-catch if it's not already wrapped
            const wrappedBody = `
        try {${functionBody}
        } catch (error) {
            console.error(\`[\${interaction.commandName}] Error:\`, {
                message: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId
            });
            
            const errorMessage = '❌ Ha ocurrido un error al procesar el comando. El equipo técnico ha sido notificado.';
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMessage, embeds: [], components: [] }).catch(() => {});
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
            }
        }
    `;

            newContent = content.replace(
                /async execute\(interaction[^)]*\)\s*{([\s\S]*?)}\s*};?\s*$/m,
                `async execute(interaction, client, supabase) {${wrappedBody}    }`
            );

            stats.errorHandlingAdded++;
            modified = true;
            console.log(`  ✓ Added error handling to ${path.basename(filePath)}`);
        }
    }

    return { content: newContent, modified };
}

function processFile(filePath) {
    console.log(`\n📄 Processing: ${path.relative(path.join(__dirname, '..'), filePath)}`);

    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // Backup original
    if (!DRY_RUN) {
        backupFile(filePath);
    }

    // Apply fixes in order
    let result;

    // 1. Fix deferReply
    result = fixDeferReply(content, filePath);
    content = result.content;
    modified = modified || result.modified;

    // 2. Fix .single() → .maybeSingle()
    result = fixSingleToMaybeSingle(content, filePath);
    content = result.content;
    modified = modified || result.modified;

    // 3. Add basic error handling (DISABLED for now - too aggressive)
    // result = addBasicErrorHandling(content, filePath);
    // content = result.content;
    // modified = modified || result.modified;

    // Write back if modified
    if (modified) {
        if (!DRY_RUN) {
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`  💾 Saved changes`);
        } else {
            console.log(`  👁️  DRY RUN - Changes not saved`);
        }
        stats.filesProcessed++;
    } else {
        console.log(`  ℹ️  No changes needed`);
    }
}

function scanAndFix(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            scanAndFix(filePath);
        } else if (file.endsWith('.js') && !file.includes('test')) {
            processFile(filePath);
        }
    }
}

// MAIN EXECUTION
console.log('🔧 PHASE 1 AUTO-FIX SCRIPT');
console.log('═══════════════════════════════════════════════════════\n');

if (DRY_RUN) {
    console.log('👁️  DRY RUN MODE - No files will be modified\n');
} else {
    console.log('⚠️  LIVE MODE - Files will be modified (backups in /backups)\n');
}

const commandsDir = path.join(__dirname, '..', 'commands');

if (!fs.existsSync(commandsDir)) {
    console.error('❌ Commands directory not found:', commandsDir);
    process.exit(1);
}

scanAndFix(commandsDir);

// Print summary
console.log('\n═══════════════════════════════════════════════════════');
console.log('📊 SUMMARY');
console.log('═══════════════════════════════════════════════════════');
console.log(`Files processed: ${stats.filesProcessed}`);
console.log(`Files backed up: ${stats.filesBackedUp}`);
console.log(`\ndeferReply:`);
console.log(`  - Added: ${stats.deferReplyAdded}`);
console.log(`  - Uncommented: ${stats.deferReplyUncommented}`);
console.log(`  - Standardized: ${stats.deferReplyStandardized}`);
console.log(`\nQuery fixes:`);
console.log(`  - .single() → .maybeSingle(): ${stats.singleReplaced}`);
console.log(`\nError handling:`);
console.log(`  - Added try-catch: ${stats.errorHandlingAdded}`);

if (!DRY_RUN && stats.filesBackedUp > 0) {
    console.log(`\n📁 Backups saved to: ${BACKUP_DIR}`);
    console.log(`   Restore with: cp -R ${BACKUP_DIR}/* ./`);
}

console.log('\n✅ Auto-fix complete!\n');

if (DRY_RUN) {
    console.log('💡 Run without --dry-run to apply changes');
}
