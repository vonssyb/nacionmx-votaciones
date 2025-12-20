// FIX: Unknown Interaction Error
// The problem is deferReply() happening too late (>3 seconds)
// Solution: Add immediate deferReply at the START of handleExtraCommands

// FIND THIS in bot/index.js around line 4670:
async function handleExtraCommands(interaction) {
    // EXISTING CODE...

    // REPLACE IT WITH:
    async function handleExtraCommands(interaction) {
        // ⚡ CRITICAL FIX: Defer IMMEDIATELY to prevent "Unknown interaction"
        // This must happen within 3 seconds of receiving the interaction
        await interaction.deferReply().catch(err => {
            console.error('Failed to defer reply:', err);
            // If defer fails, the interaction is already invalid
            return;
        });

        // Now continue with rest of function...
        const commandName = interaction.commandName;

        // ... rest of existing code
    }

// ALTERNATIVELY: Add try-catch wrapper around the entire function
//
// Change from:
//   else if (commandName === 'bolsa') {
//       await interaction.deferReply();
//       // ... rest
//   }
//
// To:
//   else if (commandName === 'bolsa') {
//       // Defer is already done at function start
//       // ... rest of code (remove duplicate deferReply)
//   }

// CRITICAL: Remove duplicate deferReply() calls in individual commands
// since we're now deferring at the function start
