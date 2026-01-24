const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../services/Logger');
const { CHANNELS, GUILDS } = require('../config/constants');

class SuggestionHandler {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
    }

    /**
     * Handles new messages in the suggestions channel
     * @param {Message} message 
     */
    async handleNewSuggestion(message) {
        if (message.author.bot) return;

        try {
            // 1. Delete original message
            await message.delete().catch(() => { });

            // 2. Create Embed
            const embed = new EmbedBuilder()
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setTitle('💡 Nueva Sugerencia')
                .setDescription(message.content)
                .setColor('#FFFF00') // Yellow for pending
                .addFields(
                    { name: 'Estado', value: '⏳ Pendiente', inline: true },
                    { name: 'Votos', value: '👍 0 | 👎 0', inline: true }
                )
                .setFooter({ text: 'Usa los botones para votar' })
                .setTimestamp();

            // 3. Create Buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('suggestion_vote_up')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('suggestion_vote_down')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger)
            );

            // 4. Send Embed
            const suggestionMsg = await message.channel.send({ embeds: [embed], components: [row] });

            // 5. Save to Database
            const { data, error } = await this.supabase.from('suggestions').insert({
                message_id: suggestionMsg.id,
                channel_id: message.channel.id,
                user_id: message.author.id,
                content: message.content,
                status: 'pending',
                upvotes: [],
                downvotes: []
            }).select().single();

            if (error) {
                logger.errorWithContext('Failed to save suggestion to DB', error);
                await suggestionMsg.edit({ content: '❌ Error guardando sugerencia en base de datos. Contacta a un admin.' });
                return;
            }

            // Update footer with ID
            embed.setFooter({ text: `ID: ${data.id} | Usa los botones para votar` });
            await suggestionMsg.edit({ embeds: [embed] });

        } catch (err) {
            logger.errorWithContext('Error handling new suggestion', err);
        }
    }

    /**
     * Handles button interactions for suggestions
     * @param {Interaction} interaction 
     */
    async handleButton(interaction) {
        if (!interaction.customId.startsWith('suggestion_vote_')) return;

        const isUpvote = interaction.customId === 'suggestion_vote_up';
        const userId = interaction.user.id;

        try {
            await interaction.deferUpdate();

            // 1. Get Suggestion Data
            const { data: suggestion, error } = await this.supabase
                .from('suggestions')
                .select('*')
                .eq('message_id', interaction.message.id)
                .single();

            if (!suggestion || error) {
                return interaction.followUp({ content: '❌ No se encontró esta sugerencia en la base de datos.', ephemeral: true });
            }

            let upvotes = suggestion.upvotes || [];
            let downvotes = suggestion.downvotes || [];

            // 2. Voting Logic
            if (isUpvote) {
                if (upvotes.includes(userId)) {
                    // Remove vote
                    upvotes = upvotes.filter(id => id !== userId);
                } else {
                    // Add vote, remove downvote if exists
                    if (!upvotes.includes(userId)) upvotes.push(userId);
                    downvotes = downvotes.filter(id => id !== userId);
                }
            } else {
                if (downvotes.includes(userId)) {
                    // Remove vote
                    downvotes = downvotes.filter(id => id !== userId);
                } else {
                    // Add vote, remove upvote if exists
                    if (!downvotes.includes(userId)) downvotes.push(userId);
                    upvotes = upvotes.filter(id => id !== userId);
                }
            }

            // 3. Update DB
            await this.supabase.from('suggestions').update({
                upvotes: upvotes,
                downvotes: downvotes
            }).eq('id', suggestion.id);

            // 4. Update Embed
            const oldEmbed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed);

            // Re-calculate fields
            newEmbed.spliceFields(1, 1, {
                name: 'Votos',
                value: `👍 ${upvotes.length} | 👎 ${downvotes.length}`,
                inline: true
            });

            await interaction.message.edit({ embeds: [newEmbed] });

        } catch (err) {
            logger.errorWithContext('Error handling suggestion vote', err);
        }
    }
}

module.exports = SuggestionHandler;
