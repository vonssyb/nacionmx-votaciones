const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verificar')
        .setDescription('Vincular tu cuenta de Discord con Roblox')
        .addStringOption(option =>
            option.setName('usuario')
                .setDescription('Tu nombre de usuario de Roblox')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        const robloxUsername = interaction.options.getString('usuario');
        const discordUserId = interaction.user.id;
        const guild = interaction.guild;

        const ROLE_VERIFICADO = '1412899401000685588';
        const ROLE_NO_VERIFICADO = '1413645375918706820';
        const LOG_CHANNEL_ID = '1398888447447404705';
        const TICKET_CHANNEL_ID = '1398889153919189042';

        try {
            // 1. Fetch Roblox ID from username
            const robloxRes = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [robloxUsername],
                excludeBannedUsers: false
            });

            if (!robloxRes.data.data || robloxRes.data.data.length === 0) {
                return interaction.editReply(`❌ **Usuario no encontrado:** El usuario \`${robloxUsername}\` no existe en Roblox.`);
            }

            const robloxData = robloxRes.data.data[0];
            const robloxId = robloxData.id.toString();
            const realUsername = robloxData.name;

            // 2. Check if this Roblox ID is already linked to ANOTHER Discord user
            // We check both citizens and profiles for robustness
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('discord_id')
                .eq('roblox_id', robloxId)
                .maybeSingle();

            if (existingUser && existingUser.discord_id !== discordUserId) {
                return interaction.editReply({
                    content: `⚠️ **Error de Vinculación**\n\nEl usuario de Roblox **${realUsername}** ya está vinculado a otra cuenta de Discord.\n\nSi crees que esto es un error o quieres recuperar tu cuenta, abre un ticket en <#${TICKET_CHANNEL_ID}>.`
                });
            }

            // 3. Update Database (Profiles is the best place for this)
            await supabase.from('profiles').update({
                roblox_id: robloxId
            }).eq('discord_id', discordUserId);

            // Also try to update citizens if they exist
            await supabase.from('citizens').update({
                roblox_id: robloxId,
                roblox_username: realUsername
            }).eq('discord_id', discordUserId);

            // 4. Update Discord Roles
            const member = await guild.members.fetch(discordUserId);

            if (member.roles.cache.has(ROLE_NO_VERIFICADO)) {
                await member.roles.remove(ROLE_NO_VERIFICADO).catch(e => console.error('Error removing unverified role:', e));
            }
            if (!member.roles.cache.has(ROLE_VERIFICADO)) {
                await member.roles.add(ROLE_VERIFICADO).catch(e => console.error('Error adding verified role:', e));
            }

            // 5. Success Message (Ephemeral)
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Verificación Exitosa')
                .setColor(0x00FF00)
                .setDescription(`Tu cuenta de Discord ha sido vinculada con **${realUsername}** (${robloxId}).`)
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`)
                .setFooter({ text: 'Nación MX | Sistema de Verificación' });

            await interaction.editReply({ embeds: [successEmbed] });

            // 6. Log Ping and Delete
            const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const pingMsg = await logChannel.send(`<@${discordUserId}> se ha verificado exitosamente como **${realUsername}**.`);
                // Delete after 5 seconds to notify but not clutter
                setTimeout(() => pingMsg.delete().catch(() => null), 5000);
            }

        } catch (error) {
            console.error('[VERIFICAR] Error:', error);
            await interaction.editReply('❌ **Error Crítico:** Hubo un problema al contactar con Roblox o la base de datos.');
        }
    }
};
