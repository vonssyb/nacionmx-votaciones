/**
 * Phase 1 Analysis Script
 * Analyzes all bot commands for:
 * 1. deferReply patterns
 * 2. .single() vs .maybeSingle() usage  
 * 3. Error handling completeness
 * 4. Input validation presence
 */

const fs = require('fs');
const path = require('path');

const COMMAND_DIRS = [
    'commands/economy',
    'commands/moderation',
    'commands/gov',
    'commands/tickets',
    'commands/utils',
    'commands/admin',
    'commands/owner'
];

const BOT_ROOT = path.join(__dirname, '..');

const results = {
    total: 0,
    deferReply: {
        missing: [],
        commented: [],
        conditional: [],
        correct: []
    },
    queries: {
        usingSingle: [],
        usingMaybeSingle: [],
        noQueries: []
    },
    errorHandling: {
        noTryCatch: [],
        basicTryCatch: [],
        advancedTryCatch: []
    },
    validation: {
        noValidation: [],
        basicValidation: [],
        completeValidation: []
    }
};

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(BOT_ROOT, filePath);

    results.total++;

    // 1. ANALYZE DEFERREP LY
    const hasDeferReply = /await interaction\.deferReply/.test(content);
    const hasCommentedDefer = /\/\/.*await interaction\.deferReply/.test(content);
    const hasConditionalDefer = /if.*!interaction\.deferred.*await interaction\.deferReply/.test(content);

    if (hasCommentedDefer) {
        results.deferReply.commented.push(relPath);
    } else if (!hasDeferReply) {
        results.deferReply.missing.push(relPath);
    } else if (hasConditionalDefer) {
        results.deferReply.conditional.push(relPath);
    } else {
        results.deferReply.correct.push(relPath);
    }

    // 2. ANALYZE .single() vs .maybeSingle()
    const hasSingle = /\.single\(\)/.test(content);
    const hasMaybeSingle = /\.maybeSingle\(\)/.test(content);

    if (hasSingle) {
        // Count occurrences
        const singleMatches = content.match(/\.single\(\)/g) || [];
        results.queries.usingSingle.push({ file: relPath, count: singleMatches.length });
    }

    if (hasMaybeSingle) {
        const maybeSingleMatches = content.match(/\.maybeSingle\(\)/g) || [];
        results.queries.usingMaybeSingle.push({ file: relPath, count: maybeSingleMatches.length });
    }

    if (!hasSingle && !hasMaybeSingle) {
        results.queries.noQueries.push(relPath);
    }

    // 3. ANALYZE ERROR HANDLING
    const hasTryCatch = /try\s*{/.test(content);
    const hasDetailedLogging = /console\.(error|warn)\(\[.*\]/.test(content);
    const hasErrorMetadata = /{ message:.*stack:.*userId/.test(content);

    if (!hasTryCatch) {
        results.errorHandling.noTryCatch.push(relPath);
    } else if (hasDetailedLogging || hasErrorMetadata) {
        results.errorHandling.advancedTryCatch.push(relPath);
    } else {
        results.errorHandling.basicTryCatch.push(relPath);
    }

    // 4. ANALYZE INPUT VALIDATION
    const hasAmountValidation = /\.setMinValue\(/.test(content);
    const hasNameValidation = /(trim|length|regex|pattern)/.test(content);
    const hasCustomValidation = /(validate|validation|check).*function/i.test(content);

    if (!hasAmountValidation && !hasNameValidation && !hasCustomValidation) {
        results.validation.noValidation.push(relPath);
    } else if (hasCustomValidation) {
        results.validation.completeValidation.push(relPath);
    } else {
        results.validation.basicValidation.push(relPath);
    }
}

function scanDirectory(dir) {
    const fullPath = path.join(BOT_ROOT, dir);

    if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  Directory not found: ${dir}`);
        return;
    }

    const files = fs.readdirSync(fullPath);

    for (const file of files) {
        const filePath = path.join(fullPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Recursively scan subdirectories
            const relativeSub = path.join(dir, file);
            scanDirectory(relativeSub);
        } else if (file.endsWith('.js')) {
            analyzeFile(filePath);
        }
    }
}

// MAIN EXECUTION
console.log('🔍 Analyzing Bot Commands for Phase 1 Improvements...\n');

COMMAND_DIRS.forEach(dir => scanDirectory(dir));

// PRINT RESULTS
console.log(`📊 ANALYSIS COMPLETE - Analyzed ${results.total} command files\n`);

console.log('═══════════════════════════════════════════════════════');
console.log('1️⃣  DEFERREP LY STATUS');
console.log('═══════════════════════════════════════════════════════');
console.log(`✅ Correct: ${results.deferReply.correct.length}`);
console.log(`⚠️  Conditional: ${results.deferReply.conditional.length}`);
console.log(`❌ Missing: ${results.deferReply.missing.length}`);
console.log(`💬 Commented Out: ${results.deferReply.commented.length}`);

if (results.deferReply.missing.length > 0) {
    console.log('\n📁 Files missing deferReply:');
    results.deferReply.missing.forEach(f => console.log(`   - ${f}`));
}

if (results.deferReply.commented.length > 0) {
    console.log('\n📁 Files with commented deferReply:');
    results.deferReply.commented.forEach(f => console.log(`   - ${f}`));
}

if (results.deferReply.conditional.length > 0) {
    console.log('\n📁 Files with conditional deferReply (needs standardization):');
    results.deferReply.conditional.forEach(f => console.log(`   - ${f}`));
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('2️⃣  QUERY PATTERNS (.single vs .maybeSingle)');
console.log('═══════════════════════════════════════════════════════');
console.log(`✅ Using .maybeSingle(): ${results.queries.usingMaybeSingle.length}`);
console.log(`⚠️  Using .single(): ${results.queries.usingSingle.length}`);
console.log(`ℹ️  No Supabase queries: ${results.queries.noQueries.length}`);

if (results.queries.usingSingle.length > 0) {
    console.log('\n📁 Files using .single() (MUST CHANGE):');
    results.queries.usingSingle.forEach(item => console.log(`   - ${item.file} (${item.count} occurrences)`));
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('3️⃣  ERROR HANDLING QUALITY');
console.log('═══════════════════════════════════════════════════════');
console.log(`✅ Advanced (with logging): ${results.errorHandling.advancedTryCatch.length}`);
console.log(`⚠️  Basic try-catch: ${results.errorHandling.basicTryCatch.length}`);
console.log(`❌ No try-catch: ${results.errorHandling.noTryCatch.length}`);

if (results.errorHandling.noTryCatch.length > 0) {
    console.log('\n📁 Files without try-catch:');
    results.errorHandling.noTryCatch.forEach(f => console.log(`   - ${f}`));
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('4️⃣  INPUT VALIDATION');
console.log('═══════════════════════════════════════════════════════');
console.log(`✅ Complete validation: ${results.validation.completeValidation.length}`);
console.log(`⚠️  Basic validation: ${results.validation.basicValidation.length}`);
console.log(`❌ No validation: ${results.validation.noValidation.length}`);

console.log('\n═══════════════════════════════════════════════════════');
console.log('📋 PRIORITY ACTION ITEMS');
console.log('═══════════════════════════════════════════════════════');

const priorities = [];

if (results.deferReply.missing.length > 0) {
    priorities.push(`🔴 Add deferReply to ${results.deferReply.missing.length} files`);
}

if (results.deferReply.commented.length > 0) {
    priorities.push(`🟡 Uncomment and standardize deferReply in ${results.deferReply.commented.length} files`);
}

if (results.queries.usingSingle.length > 0) {
    const totalSingleOccurrences = results.queries.usingSingle.reduce((sum, item) => sum + item.count, 0);
    priorities.push(`🔴 Replace ${totalSingleOccurrences} .single() calls in ${results.queries.usingSingle.length} files`);
}

if (results.errorHandling.noTryCatch.length > 0) {
    priorities.push(`🟡 Add try-catch to ${results.errorHandling.noTryCatch.length} files`);
}

if (priorities.length === 0) {
    console.log('✅ No critical issues found!');
} else {
    priorities.forEach((item, i) => console.log(`${i + 1}. ${item}`));
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('💾 Saving detailed results to analysis-results.json...');
console.log('═══════════════════════════════════════════════════════\n');

fs.writeFileSync(
    path.join(BOT_ROOT, 'analysis-results.json'),
    JSON.stringify(results, null, 2)
);

console.log('✅ Analysis complete! Check analysis-results.json for full details.\n');
