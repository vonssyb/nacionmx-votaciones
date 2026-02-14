const fs = require('fs');
const path = require('path');

/**
 * Loads commands from the commands directory recursively
 * @param {Client} client - The Discord Client instance
 * @param {string} commandsPath - Path to the commands directory
 */
const loadCommands = async (client, commandsPath, allowedCategories = null) => {
    if (!client.commands) {
        client.commands = new Map();
    }
    const commandFolders = fs.readdirSync(commandsPath);

    let loadedCount = 0;

    for (const folder of commandFolders) {
        // Filter Logic
        if (allowedCategories && !allowedCategories.includes(folder)) {
            continue; // Skip this folder if not in allowed list
        }

        const folderPath = path.join(commandsPath, folder);

        // Skip if not a directory
        if (!fs.lstatSync(folderPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            try {
                const command = require(filePath);

                // Validate command structure
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    loadedCount++;
                    // console.log(`[CMD] Loaded /${command.data.name}`);
                } else {
                    console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            } catch (error) {
                console.error(`[ERROR] Failed to load command at ${filePath}:`, error);
            }
        }
    }

    console.log(`✅ Successfully loaded ${loadedCount} commands (Categories: ${allowedCategories ? allowedCategories.join(', ') : 'ALL'}).`);
    return loadedCount;
};

module.exports = { loadCommands };
