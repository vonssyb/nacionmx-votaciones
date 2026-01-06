const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PaginationHelper = require('../../utils/PaginationHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reputacion')
        .setDescription('⭐ Sistema de Reputación Ciudadana')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Ver reputación de un usuario')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuario a consultar (opcional, por defecto tú)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('dar')
                .setDescription('Dar punto de reputación (+1 o -1)')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuario a calificar')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('puntos')
                        .setDescription('Puntos a dar')
                        .setRequired(true)
                        .addChoices(
                            { name: '+1 (Positivo)', value: 1 },
                            { name: '-1 (Negativo)', value: -1 }
                        ))
                .addStringOption(option =>
                    option.setName('razon')
                        .setDescription('Razón (opcional)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('top')
                .setDescription('Top 10 usuarios con mejor reputación'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('historial')
                .setDescription('Ver quién te ha votado')),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({});

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'ver') {
                const targetUser = interaction.options.getUser('usuario') || interaction.user;

                // Get reputation from view
                const { data: rep } = await supabase
                    .from('reputation_rankings')
                    .select('*')
                    .eq('target_discord_id', targetUser.id)
                    .maybeSingle();

                const totalRep = rep?.total_reputation || 0;
                const positiveVotes = rep?.positive_votes || 0;
                const negativeVotes = rep?.negative_votes || 0;
                const voteCount = rep?.vote_count || 0;

                const repColor = totalRep > 10 ? '#2ECC71' : totalRep < -5 ? '#E74C3C' : '#95A5A6';

                const embed = new EmbedBuilder()
                    .setTitle(`⭐ Reputación de ${targetUser.tag}`)
                    .setColor(repColor)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .addFields(
                        { name: '📊 Reputación Total', value: `**${totalRep}** puntos`, inline: false },
                        { name: '👍 Positivos', value: `${positiveVotes}`, inline: true },
                        { name: '👎 Negativos', value: `${negativeVotes}`, inline: true },
                        { name: '📝 Total Votos', value: `${voteCount}`, inline: true }
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'dar') {
                const targetUser = interaction.options.getUser('usuario');
                const points = interaction.options.getInteger('puntos');
                const reason = interaction.options.getString('razon') || 'Sin razón';

                // Validations
                if (targetUser.id === interaction.user.id) {
                    return interaction.editReply('❌ No puedes darte reputación a ti mismo.');
                }

                // Check user level (minimum 5)
                const { data: stats } = await supabase
                    .from('user_stats')
                    .select('level')
                    .eq('discord_id', interaction.user.id)
                    .maybeSingle();

                if (!stats || (stats.level || 0) < 5) {
                    return interaction.editReply('❌ Necesitas nivel 5 o superior para dar reputación.');
                }

                // Check if already voted
                const { data: existing } = await supabase
                    .from('reputation_points')
                    .select('*')
                    .eq('giver_discord_id', interaction.user.id)
                    .eq('target_discord_id', targetUser.id)
                    .maybeSingle();

                if (existing) {
                    // Update vote (allowed once every 7 days)
                    const daysSince = (new Date() - new Date(existing.updated_at)) / (1000 * 60 * 60 * 24);

                    if (daysSince < 7) {
                        return interaction.editReply(
                            `❌ Ya votaste por ${targetUser.tag}.\n` +
                            `Podrás cambiar tu voto en **${Math.ceil(7 - daysSince)} días**.`
                        );
                    }

                    await supabase
                        .from('reputation_points')
                        .update({
                            points: points,
                            reason: reason,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id);

                    return interaction.editReply(
                        `✅ Voto actualizado para ${targetUser.tag}: **${points > 0 ? '+' : ''}${points}**` +
                        `\n📝 Razón: ${reason}`
                    );
                }

                // Create new vote
                await supabase.from('reputation_points').insert({
                    giver_discord_id: interaction.user.id,
                    target_discord_id: targetUser.id,
                    points: points,
                    reason: reason
                });

                const emoji = points > 0 ? '👍' : '👎';
                return interaction.editReply(
                    `${emoji} Reputación dada a ${targetUser.tag}: **${points > 0 ? '+' : ''}${points}**\n` +
                    `📝 Razón: ${reason}`
                );

            } else if (subcommand === 'top') {
                const { data: rankings } = await supabase
                    .from('reputation_rankings')
                    .select('*')
                    .order('total_reputation', { ascending: false })
                    .limit(10);

                if (!rankings || rankings.length === 0) {
                    return interaction.editReply('📋 Aún no hay rankings de reputación.');
                }

                const rankingText = rankings.map((r, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                    return `${medal} <@${r.target_discord_id}> - **${r.total_reputation}** pts (${r.vote_count} votos)`;
                }).join('\n');

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Top 10 Reputación')
                    .setDescription(rankingText)
                    .setColor('#F1C40F')
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'historial') {
                const { data: votes } = await supabase
                    .from('reputation_points')
                    .select('*')
                    .eq('target_discord_id', interaction.user.id)
                    .order('created_at', { ascending: false });

                if (!votes || votes.length === 0) {
                    return interaction.editReply('📋 Aún no has recibido votos de reputación.');
                }

                const voteList = votes.map(v => {
                    const emoji = v.points > 0 ? '👍' : '👎';
                    const date = new Date(v.created_at).toLocaleDateString('es-MX');
                    return `${emoji} <@${v.giver_discord_id}> **${v.points > 0 ? '+' : ''}${v.points}** - ${v.reason}\n📅 ${date}`;
                }).join('\n\n');

                const embed = new EmbedBuilder()
                    .setTitle('📜 Historial de Votos')
                    .setDescription(voteList.substring(0, 4000))
                    .setColor('#3498DB')
                    .setFooter({ text: `Total: ${votes.length} votos` })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[reputacion] Error:', error);
            await interaction.editReply('❌ Error al procesar la acción.');
        }
    }
};
