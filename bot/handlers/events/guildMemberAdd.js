const { AttachmentBuilder } = require('discord.js');
const { CHANNELS, ROLES, GUILDS } = require('../../config/constants');
const logger = require('../../services/Logger');

// Roles to auto-assign when joining the server
const DEALERSHIP_CUSTOMER_ROLES = [
    '1466559667013681422', // Cliente Concesionario 1
    '1466559974435061881'  // Cliente Concesionario 2
];
const ImageGenerator = require('../../utils/ImageGenerator');

module.exports = async (client, member, supabase) => {
    const MAIN_GUILDS = [GUILDS.MAIN, GUILDS.STAFF, GUILDS.MCQUEEN];
    if (!MAIN_GUILDS.includes(member.guild.id)) return;

    try {
        let AUTO_ROLES = [];

        if (member.guild.id === GUILDS.MCQUEEN) {
            // For McQueen Server: Only specific roles
            AUTO_ROLES = DEALERSHIP_CUSTOMER_ROLES;
            logger.info(`[AutoRole] Processing join for McQueen server (${member.guild.id})`);
        } else {
            // For Main/Staff Servers: Existing comprehensive list
            // REMOVED DEALERSHIP_CUSTOMER_ROLES from here as they are specific to McQueen guild
            AUTO_ROLES = [
                '1458506735185825993', '1449948588166611078', '1413541382869618731',
                '1424534280725463071', '1412887179281305772', '1460051693092995174',
                '1412887170267480215', '1413545285975801918', '1412882235547189362',
                '1413645375918706820'
            ];
            logger.info(`[AutoRole] Processing join for Main/Staff server (${member.guild.id})`);
        }

        // Filter out roles that don't exist in this guild to prevent errors
        const validRoles = AUTO_ROLES.filter(roleId => {
            const exists = member.guild.roles.cache.has(roleId);
            if (!exists) {
                logger.warn(`[AutoRole] Role ${roleId} not found in guild ${member.guild.name} (${member.guild.id}) - Skipping`);
            }
            return exists;
        });

        if (validRoles.length > 0) {
            try {
                await member.roles.add(validRoles);
                logger.info(`[AutoRole] Assigned ${validRoles.length} roles to ${member.user.tag} (${member.user.id})`);
            } catch (roleError) {
                logger.error(`[AutoRole] Failed to assign roles to ${member.user.tag}: ${roleError.message}`);
            }
        } else {
            logger.info(`[AutoRole] No valid auto-roles to assign for ${member.user.tag} in ${member.guild.name}`);
        }

        let welcomeChannelId, message;

        if (member.guild.id === GUILDS.MAIN) {
            // ORIGINAL SERVER CONFIG
            welcomeChannelId = CHANNELS.WELCOME_ORIGINAL;
            const VERIFY_CHANNEL_ID = CHANNELS.VERIFY;
            const DNI_CHANNEL_ID = CHANNELS.DNI;
            message = `<@${member.user.id}> **bienvenido al servidor** para verificarse usa el comando \`/verificar\` en <#${VERIFY_CHANNEL_ID}> y también crea tu dni con el comando \`/dni crear\` en el canal de <#${DNI_CHANNEL_ID}> **¡Bienvenido!**`;
        } else if (member.guild.id === GUILDS.STAFF) {
            // NEW MAIN SERVER CONFIG
            welcomeChannelId = CHANNELS.WELCOME_NEW;
            message = `<@${member.user.id}> **¡Bienvenido al servidor!** Nos alegra tenerte aquí. **¡Disfruta tu estancia!**`;

            // AUTO-DISCOVERY FALLBACK
            try {
                // If channel is invalid, try finding one named 'bienvenida'
                const channelCheck = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
                if (!channelCheck) {
                    const channels = await member.guild.channels.fetch();
                    const found = channels.find(ch => ch.type === 0 && ch.name.toLowerCase().includes('bienvenida'));
                    if (found) welcomeChannelId = found.id;
                }
            } catch (e) { /* ignore */ }
        }

        const welcomeChannel = await client.channels.fetch(welcomeChannelId).catch(() => null);
        if (!welcomeChannel) return;

        // Generate Luxury Image
        const buffer = await ImageGenerator.generateWelcome(member);
        const attachment = new AttachmentBuilder(buffer, { name: `bienvenida_${member.user.id}.png` });

        await welcomeChannel.send({
            content: message,
            files: [attachment]
        });

    } catch (err) {
        logger.errorWithContext('Welcome system error', err, { module: 'MOD' });
    }
};
