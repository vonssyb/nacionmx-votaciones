const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banxico')
        .setDescription('Comandos del Banco de México')
        .addSubcommand(sub =>
            sub.setName('indicadores').setDescription('Ver indicadores económicos actuales'))
        .addSubcommand(sub =>
            sub.setName('acceso')
                .setDescription('Genera un código para entrar a la Banca en Línea')
        )
        .addSubcommand(sub =>
            sub.setName('tasa').setDescription('Ajustar Tasa de Interés (Gobernador)')
                .addNumberOption(opt => opt.setName('valor').setDescription('Nueva tasa %').setRequired(true))),

    async execute(interaction) {
        // Access service via client (Standard Portal Pattern)
        const banxicoService = interaction.client.services?.banxico;

        if (!banxicoService) {
            console.error('BanxicoService not found in client.services');
            return interaction.editReply({ content: '❌ Error interno: Servicio Banxico no disponible.' });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'indicadores') {
            try {
                const data = await banxicoService.getIndicators();

                const embed = new EmbedBuilder()
                    .setTitle('🏦 Indicadores Económicos - Banco de México')
                    .setColor('#ffd700')
                    .setTimestamp();

                data.forEach(ind => {
                    embed.addFields({
                        name: ind.name,
                        value: `**${ind.value} ${ind.unit}**`,
                        inline: true
                    });
                });

                return interaction.editReply({ embeds: [embed] });
            } catch (e) {
                return interaction.editReply({ content: '❌ Error obteniendo indicadores.' });
            }
        }

        if (subcommand === 'acceso') {
            // Generate 6-digit code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

            try {
                await banxicoService.createAuthCode(interaction.user.id, code, expiresAt);

                // Send DM
                try {
                    await interaction.user.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('🔐 Código de Acceso - Banco de México')
                                .setDescription(`Tu código de seguridad para la Banca en Línea es:\n\n# \`${code}\`\n\n⚠️ Este código expira en 5 minutos. No lo compartas con nadie.`)
                                .setColor('#b38728')
                                .setFooter({ text: 'Sistema de Seguridad Banxico' })
                        ]
                    });
                    return interaction.editReply({ content: '✅ Te he enviado el código de acceso por mensaje privado.' });
                } catch (err) {
                    return interaction.editReply({ content: `❌ No pude enviarte el DM. Por favor habilita tus mensajes privados.\nTu código es: ||${code}||` });
                }
            } catch (error) {
                console.error(error);
                return interaction.editReply({ content: '❌ Error al generar el código. Intenta de nuevo.' });
            }
        }

        if (subcommand === 'tasa') {
            // Check Admin permission (or specific role later)
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({ content: '❌ Solo el Gobernador del Banco de México puede ajustar tasas.' });
            }

            const newValue = interaction.options.getNumber('valor');
            try {
                await banxicoService.updateIndicator('interest_rate', newValue, interaction.user.id);
                return interaction.editReply({
                    content: `✅ **Tasa de Interés ajustada a ${newValue}%** por el Gobernador.`
                });
            } catch (e) {
                return interaction.editReply({ content: '❌ Error actualizando tasa.' });
            }
        }
    }
};
