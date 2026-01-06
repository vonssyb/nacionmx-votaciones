const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apelacion')
        .setDescription('Responde a tu sanción más reciente pidiendo una revisión')
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Explica por qué crees que tu sanción debe ser revisada (Mín. 20 caracteres)')
                .setRequired(true)
                .setMinLength(20))
        .addAttachmentOption(option =>
            option.setName('evidencia')
                .setDescription('Pruebas que respalden tu apelación (Imagen/Video)')
                .setRequired(false)),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ flags: [64] });

        // 1. Fetch most recent active sanction for the user
        const { data: sanction, error } = await supabase
            .from('sanctions')
            .select('*')
            .eq('discord_user_id', interaction.user.id)
            .eq('guild_id', interaction.guildId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !sanction) {
            return interaction.editReply('❌ No tienes sanciones activas que se puedan apelar.');
        }

        const appealReason = interaction.options.getString('motivo');
        const evidence = interaction.options.getAttachment('evidencia');

        // 2. Create appeal record in DB
        // Check if there's already an open appeal for this sanction
        const { data: existingAppeal } = await supabase
            .from('appeals')
            .select('id')
            .eq('sanction_id', sanction.id)
            .eq('status', 'pending')
            .maybeSingle();

        if (existingAppeal) {
            return interaction.editReply('❌ Ya tienes una apelación pendiente para esta sanción. Por favor espera noticias.');
        }

        const { data: appeal, error: appealError } = await supabase
            .from('appeals')
            .insert({
                guild_id: interaction.guildId,
                user_id: interaction.user.id,
                user_tag: interaction.user.tag,
                sanction_id: sanction.id,
                reason: appealReason,
                evidence_url: evidence ? evidence.url : null,
                status: 'pending'
            })
            .select()
            .single();

        if (appealError) {
            console.error('[apelacion] Error:', appealError);
            return interaction.editReply('❌ Error al procesar tu apelación. Contacta a un administrador.');
        }

        // 3. Send to Appeal Channel
        const APPEAL_CHANNEL_ID = '1398891368398585886';
        try {
            const channel = await client.channels.fetch(APPEAL_CHANNEL_ID);
            if (channel) {
                const appealEmbed = new EmbedBuilder()
                    .setTitle('⚖️ NUEVA APELACIÓN DE SANCIÓN')
                    .setColor('#F1C40F')
                    .addFields(
                        { name: '👤 Usuario', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                        { name: '📜 Sanción Original', value: `Tipo: ${sanction.type}\nMotivo: ${sanction.reason}`, inline: true },
                        { name: '📝 Motivo Apelación', value: appealReason, inline: false },
                        { name: '🆔 Appeal ID', value: `\`${appeal.id.substring(0, 8)}\``, inline: true }
                    )
                    .setFooter({ text: 'Usa los botones de abajo para gestionar' })
                    .setTimestamp();

                if (evidence) appealEmbed.setImage(evidence.url);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`appeal_approve_${appeal.id}`)
                        .setLabel('Aceptar Apelación')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`appeal_reject_${appeal.id}`)
                        .setLabel('Rechazar Apelación')
                        .setStyle(ButtonStyle.Danger)
                );

                await channel.send({ embeds: [appealEmbed], components: [row] });
            }
        } catch (e) {
            console.error('[apelacion] Log error:', e);
        }

        await interaction.editReply('✅ **Apelación enviada.** El equipo de Apelaciones revisará tu caso pronto.');
    }
};
