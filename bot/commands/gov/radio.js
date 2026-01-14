const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const vcConfig = require('../../config/erlcVoiceChannels');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('radio')
        .setDescription('📻 Gestión de radio y frecuencias')
        .addSubcommand(subcommand =>
            subcommand
                .setName('codigos')
                .setDescription('📋 Ver lista de códigos y frecuencias de radio')),

    async execute(interaction) {
        // await interaction.deferReply(); // Handled globally usually, but safe to check

        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'codigos') {
            const embed = new EmbedBuilder()
                .setTitle('📻 Frecuencias de Radio - Nación MX')
                .setColor(0x0099FF)
                .setDescription('Lista de códigos para unirse rápidamente a los canales de voz.\nUsa el comando `/frecuencia <codigo>` (si existe) o busca el canal manualmente.')
                .setFooter({ text: 'Sistema de Radio ERLC' })
                .setTimestamp();

            // Group by category
            const categories = {
                '👮 Policía': [],
                '👮‍♂️ Policía Federal': [],
                '🕵️ AIC': [],
                '🚑 Emergencias': [],
                '💀 Cartel': [],
                '👑 Administración': [],
                '🎭 Rol': []
            };

            const aliases = vcConfig.ALIASES;

            // Iterate and sort into categories based on prefix or known IDs
            for (const [alias, id] of Object.entries(aliases)) {
                const info = vcConfig.getChannelInfo(id);
                const name = info ? info.name : 'Desconocido';
                const entry = `**\`${alias}\`** → ${name}`;

                if (alias.startsWith('p') || alias === 'pg') categories['👮 Policía'].push(entry);
                else if (alias.startsWith('pf')) categories['👮‍♂️ Policía Federal'].push(entry);
                else if (alias.startsWith('aic')) categories['🕵️ AIC'].push(entry);
                else if (['mg', 'bg'].includes(alias)) categories['🚑 Emergencias'].push(entry);
                else if (alias.startsWith('c') || alias === 'cg') categories['💀 Cartel'].push(entry);
                else if (['jd', 'staff', 'espera', 's1', 's2', 's3'].includes(alias)) categories['👑 Administración'].push(entry);
                else categories['🎭 Rol'].push(entry);
            }

            // Add fields
            for (const [emoji, list] of Object.entries(categories)) {
                if (list.length > 0) {
                    embed.addFields({ name: emoji, value: list.join('\n'), inline: true });
                }
            }

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
