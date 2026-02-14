const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const ROLES = require('../../config/roles.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('justicia')
        .setDescription('⚖️ Comandos de la Secretaría de Justicia')
        .addSubcommand(sub =>
            sub.setName('indultar')
                .setDescription('Borrar antecedentes penales de un ciudadano')
                .addUserOption(opt => opt.setName('usuario').setDescription('Ciudadano a indultar').setRequired(true))
                .addStringOption(opt => opt.setName('motivo').setDescription('Razón legal del indulto').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('orden')
                .setDescription('Emitir una orden judicial')
                .addUserOption(opt => opt.setName('objetivo').setDescription('Objetivo de la orden').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('tipo')
                        .setDescription('Tipo de orden')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Aprehensión (Arrest)', value: 'APREHENSION' },
                            { name: 'Cateo (Search)', value: 'CATEO' }
                        ))
                .addStringOption(opt => opt.setName('razon').setDescription('Causa probable').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('ley')
                .setDescription('Publicar una nueva ley o decreto')
                .addStringOption(opt => opt.setName('titulo').setDescription('Título de la ley').setRequired(true))
                .addStringOption(opt => opt.setName('contenido').setDescription('Texto de la ley').setRequired(true))),

    async execute(interaction, client, supabase) {
        // 1. Role Check
        const justiciaRole = ROLES.government.secretario_justicia; // "1466249013891305544"
        const juezRole = ROLES.government.juez;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasRole = interaction.member.roles.cache.has(justiciaRole) || interaction.member.roles.cache.has(juezRole);

        if (!hasRole && !isAdmin) {
            return interaction.editReply({ content: '❌ No tienes permiso para usar este comando. (Secretaría de Justicia / Juez)' });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'indultar') {
                const target = interaction.options.getUser('usuario');
                const reason = interaction.options.getString('motivo');

                // Update criminal_records
                const { error } = await supabase
                    .from('criminal_records')
                    .upsert({
                        user_id: target.id,
                        guild_id: interaction.guildId,
                        stars: 0
                    }, { onConflict: ['user_id', 'guild_id'] });

                if (error) {
                    console.error('Indulto error:', error);
                    return interaction.editReply({ content: '❌ Error al actualizar antecedentes.' });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🕊️ Indulto Presidencial / Judicial')
                    .setDescription(`Se han borrado los antecedentes penales de ${target}.`)
                    .addFields({ name: 'Motivo', value: reason })
                    .setColor('#FFFFFF')
                    .setImage('https://media.discordapp.net/attachments/1398888916303487028/1398888916303487028/freedom.png?width=800') // Placeholder or nice image
                    .setFooter({ text: `Autorizado por: ${interaction.user.tag}` });

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'orden') {
                const target = interaction.options.getUser('objetivo');
                const type = interaction.options.getString('tipo');
                const reason = interaction.options.getString('razon');

                // Insert Warrant
                const { error } = await supabase.from('warrants').insert({
                    guild_id: interaction.guildId,
                    target_id: target.id,
                    issuer_id: interaction.user.id,
                    type: type,
                    reason: reason,
                    status: 'active'
                });

                if (error) throw error;

                const embed = new EmbedBuilder()
                    .setTitle(`⚖️ Orden Judicial: ${type}`)
                    .setDescription(`SE BUSCA A: **${target}**`)
                    .addFields(
                        { name: 'Causa', value: reason },
                        { name: 'Estado', value: '🚨 ACTIVA' }
                    )
                    .setColor('#AA0000')
                    .setThumbnail(target.displayAvatarURL())
                    .setFooter({ text: `Emitida por: ${interaction.user.tag}` });

                // Notify in public channel if possible (e.g. #policia or #warrants)
                // For now, reply here.
                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'ley') {
                const title = interaction.options.getString('titulo');
                const content = interaction.options.getString('contenido');

                const embed = new EmbedBuilder()
                    .setTitle(`📜 DECRETO OFICIAL: ${title}`)
                    .setDescription(content)
                    .setColor('#FFD700') // Gold
                    .setAuthor({ name: 'Secretaría de Justicia', iconURL: client.user.displayAvatarURL() })
                    .setFooter({ text: `Publicado por: ${interaction.user.tag} | Nación MX` })
                    .setTimestamp();

                await interaction.editReply({ content: '✅ Ley publicada.' });

                // Try to find a laws channel
                // We should look into roles.json/channels or find by name
                // Let's assume current channel if name contains "ley" or "anuncios", otherwise just warn.

                // Better: Just send it to the channel where command is run required? 
                // User usually runs this in the laws channel.
                return interaction.channel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[Justicia] Error:', error);
            return interaction.editReply({ content: '❌ Error ejecutando el comando.' });
        }
    }
};
