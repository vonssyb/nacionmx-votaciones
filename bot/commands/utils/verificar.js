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
        await interaction.deferReply({ ephemeral: false });

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
                .setTitle('🛡️ Verificación de Cuenta')
                .setColor(0x3498DB)
                .setDescription(`Para verificar que eres el dueño de **${realUsername}**, sigue estos pasos:\n\n1️⃣ Copia este código: \`${verifCode}\`\n2️⃣ Pégalo en tu **Bio/Descripción** de tu perfil de Roblox.\n3️⃣ Haz clic en el botón de abajo para confirmar.`)
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

                        const successEmbed = new EmbedBuilder()
                            .setTitle('✅ Verificación Exitosa')
                            .setColor(0x00FF00)
                            .setDescription(`¡Felicidades! Tu cuenta ha sido vinculada con **${realUsername}**.\nYa puedes remover el código de tu bio.`)
                            .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`);

                        await i.editReply({ embeds: [successEmbed], components: [] });

                        // Log
                        const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                        if (logChannel) {
                            const pingMsg = await logChannel.send(`<@${discordUserId}> se ha verificado como **${realUsername}**.`);
                            setTimeout(() => pingMsg.delete().catch(() => null), 5000);
                        }
                    } else {
                        await i.followUp({ content: `❌ **Código no encontrado.**\nAsegúrate de haber pegado \`${verifCode}\` en tu bio de Roblox y que sea visible públicamente.`, ephemeral: true });
                    }
                } catch (err) {
                    console.error('[VERIFICAR] Interaction Error:', err);
                    await i.followUp({ content: '❌ Error al consultar tu perfil de Roblox. Intenta de nuevo en unos segundos.', ephemeral: true });
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
