const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verificar')
        .setDescription('Vincular tu cuenta con Nacion MX Portal')
        .addStringOption(option =>
            option.setName('usuario')
                .setDescription('Tu nombre de usuario de Roblox')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        console.log('[VERIFICAR] Executing command...');
        // await interaction.deferReply({});

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

            // 2. Check if this Roblox ID is already linked
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('discord_id')
                .eq('roblox_id', robloxId)
                .maybeSingle();

            if (existingUser && existingUser.discord_id !== discordUserId) {
                return interaction.editReply({
                    content: `⚠️ **Error de Vinculación**\n\nEl usuario de Roblox **${realUsername}** ya está vinculado a otra cuenta de Discord.\n\nSi crees que esto es un error, abre un ticket en <#${TICKET_CHANNEL_ID}>.`
                });
            }

            // 3. Generate Unique Code
            const verifCode = `NMX-${Math.floor(1000 + Math.random() * 9000)}`;

            const instructionEmbed = new EmbedBuilder()
                .setTitle('🛡️ Nacion MX Portal')
                .setColor(0x3498DB)
                .setDescription(`Para vincular tu cuenta, sigue estos pasos:\n\n1️⃣ Copia este código: \`${verifCode}\`\n2️⃣ Pégalo en la **Bio** de tu perfil de Roblox (**${realUsername}**).\n3️⃣ Haz clic en el botón de abajo para confirmar.`)
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`)
                .setFooter({ text: 'Tienes 10 minutos para completar esto.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_verif_${robloxId}_${verifCode}`)
                    .setLabel('✅ Confirmar Bio')
                    .setStyle(ButtonStyle.Primary)
            );

            const msg = await interaction.editReply({ embeds: [instructionEmbed], components: [row] });

            // 4. Collector for the button
            const filter = i => i.user.id === discordUserId && i.customId.startsWith('confirm_verif_');
            const collector = msg.createMessageComponentCollector({ filter, time: 600000 }); // 10 min

            collector.on('collect', async i => {
                await i.deferUpdate();

                try {
                    // Fetch full profile info to check description
                    const userProfileRes = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`);
                    const description = userProfileRes.data.description || '';

                    if (description.includes(verifCode)) {
                        // SUCCESS!
                        collector.stop('success');

                        // Update DB
                        await supabase.from('profiles').update({ roblox_id: robloxId }).eq('discord_id', discordUserId);
                        await supabase.from('citizens').update({ roblox_id: robloxId, roblox_username: realUsername }).eq('discord_id', discordUserId);

                        // Roles
                        const member = await guild.members.fetch(discordUserId);
                        if (member.roles.cache.has(ROLE_NO_VERIFICADO)) await member.roles.remove(ROLE_NO_VERIFICADO);
                        if (!member.roles.cache.has(ROLE_VERIFICADO)) await member.roles.add(ROLE_VERIFICADO);

                        // --- NEW: SET NICKNAME ---
                        let nickChange = '';
                        try {
                            await member.setNickname(realUsername);
                            nickChange = `\n👤 Tu apodo ha sido cambiado a **${realUsername}**.`;
                        } catch (nickErr) {
                            console.log(`[VERIFICAR] Could not set nickname for ${discordUserId}:`, nickErr.message);
                            nickChange = `\n⚠️ No pude cambiar tu apodo (permisos insuficientes).`;
                        }

                        const successEmbed = new EmbedBuilder()
                            .setTitle('✅ Vinculación Exitosa')
                            .setColor(0x00FF00)
                            .setDescription(`¡Felicidades! <@${discordUserId}> se ha registrado correctamente en el **Portal Nacion MX** con la cuenta **${realUsername}**.\n${nickChange}`)
                            .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`);

                        // Send public message in channel
                        await interaction.channel.send({ embeds: [successEmbed] });

                        // Update ephemeral interaction to clear buttons
                        await i.editReply({ content: '✅ ¡Verificación finalizada con éxito!', embeds: [], components: [] });

                        // Log
                        const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                        if (logChannel) {
                            await logChannel.send(`<@${discordUserId}> se ha verificado como **${realUsername}**.`);
                        }
                    } else {
                        await i.followUp({ content: `❌ **Código no encontrado.**\nAsegúrate de haber pegado \`${verifCode}\` en tu bio de Roblox y que sea visible públicamente.`, flags: [64] });
                    }
                } catch (err) {
                    console.error('[VERIFICAR] Interaction Error:', err);
                    await i.followUp({ content: '❌ Error al consultar tu perfil de Roblox. Intenta de nuevo en unos segundos.', flags: [64] });
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.editReply({ content: '⏰ Tiempo agotado. Usa `/verificar` de nuevo si deseas continuar.', embeds: [], components: [] }).catch(() => { });
                }
            });

        } catch (error) {
            console.error('[VERIFICAR] Error:', error);
            await interaction.editReply('❌ **Error Crítico:** Hubo un problema al contactar con Roblox o la base de datos.');
        }
    }
};
