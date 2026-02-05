const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { invalidateEconomyCache } = require('../../services/EconomyHelper');
const ROLES = require('../../config/roles.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economia')
        .setDescription('🏛️ Comandos de la Secretaría de Economía')
        .addSubcommand(sub =>
            sub.setName('impuestos')
                .setDescription('Ajustar la tasa de impuestos global (ISR)')
                .addIntegerOption(opt =>
                    opt.setName('porcentaje')
                        .setDescription('Nuevo porcentaje (1-50%)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(50)))
        .addSubcommand(sub =>
            sub.setName('salario')
                .setDescription('Ajustar el multiplicador de salarios globales')
                .addNumberOption(opt =>
                    opt.setName('multiplicador')
                        .setDescription('Multiplicador (0.5x a 3.0x)')
                        .setRequired(true)
                        .setMinValue(0.5)
                        .setMaxValue(3.0)))
        .addSubcommand(sub =>
            sub.setName('subsidio')
                .setDescription('Otorgar un subsidio gubernamental a un usuario')
                .addUserOption(opt => opt.setName('usuario').setDescription('Beneficiario').setRequired(true))
                .addIntegerOption(opt => opt.setName('monto').setDescription('Cantidad a otorgar').setRequired(true))
                .addStringOption(opt => opt.setName('razon').setDescription('Motivo del subsidio').setRequired(true))),

    async execute(interaction, client, supabase) {
        // 1. Role Check (Secretario de Economia or Admin)
        const economiaRole = ROLES.government.secretario_economia;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasRole = interaction.member.roles.cache.has(economiaRole);

        if (!hasRole && !isAdmin) {
            return interaction.reply({ content: '❌ No tienes permiso para usar este comando. (Secretaría de Economía)', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'impuestos') {
                const percent = interaction.options.getInteger('porcentaje');
                const rate = percent / 100.0;

                // Update DB
                const { error } = await supabase.from('server_settings').upsert({
                    guild_id: interaction.guildId,
                    key: 'global_tax_rate',
                    value: rate.toString(),
                    description: 'Tasa de impuestos ISR global'
                }, { onConflict: ['guild_id', 'key'] });

                if (error) throw error;

                invalidateEconomyCache(interaction.guildId, 'global_tax_rate');

                const embed = new EmbedBuilder()
                    .setTitle('📉 Ajuste Fiscal: Impuestos')
                    .setDescription(`La Secretaría de Economía ha ajustado el ISR global.`)
                    .addFields(
                        { name: 'Nueva Tasa', value: `**${percent}%**`, inline: true },
                        { name: 'Efectivo', value: 'Inmediato', inline: true }
                    )
                    .setColor('#00AA00')
                    .setFooter({ text: `Autorizado por: ${interaction.user.tag}` });

                return interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'salario') {
                const multiplier = interaction.options.getNumber('multiplicador');

                const { error } = await supabase.from('server_settings').upsert({
                    guild_id: interaction.guildId,
                    key: 'global_salary_multiplier',
                    value: multiplier.toString(),
                    description: 'Multiplicador de salarios global'
                }, { onConflict: ['guild_id', 'key'] });

                if (error) throw error;

                invalidateEconomyCache(interaction.guildId, 'global_salary_multiplier');

                const embed = new EmbedBuilder()
                    .setTitle('💵 Ajuste Económico: Salarios')
                    .setDescription(`La Secretaría de Economía ha ajustado los salarios base.`)
                    .addFields(
                        { name: 'Nuevo Multiplicador', value: `**x${multiplier}**`, inline: true },
                        { name: 'Efectivo', value: 'Inmediato', inline: true }
                    )
                    .setColor('#00AA00')
                    .setFooter({ text: `Autorizado por: ${interaction.user.tag}` });

                return interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'subsidio') {
                await interaction.deferReply();
                const target = interaction.options.getUser('usuario');
                const amount = interaction.options.getInteger('monto');
                const reason = interaction.options.getString('razon');

                if (amount <= 0) return interaction.editReply('❌ El monto debe ser positivo.');

                // Check Treasury Balance
                const currentBalance = await client.treasuryService.getBalance(interaction.guildId);
                if (currentBalance < amount) {
                    return interaction.editReply({
                        content: `❌ **Fondos Insuficientes en Tesorería**\nBalance actual: $${currentBalance.toLocaleString()}`
                    });
                }

                // Withdraw from Treasury (Add negative funds)
                await client.treasuryService.addFunds(
                    interaction.guildId,
                    -amount,
                    'Subsidio',
                    `Subsidio a ${target.tag}: ${reason}`
                );

                // Add to user balance
                await client.services.billing.ubService.addMoney(
                    interaction.guildId,
                    target.id,
                    amount,
                    `🏛️ Subsidio Gobierno: ${reason}`,
                    'bank'
                );

                const embed = new EmbedBuilder()
                    .setTitle('🤝 Subsidio Otorgado')
                    .setDescription(`Se ha otorgado un subsidio gubernamental.`)
                    .addFields(
                        { name: 'Beneficiario', value: `${target}`, inline: true },
                        { name: 'Monto', value: `$${amount.toLocaleString()}`, inline: true },
                        { name: 'Motivo', value: reason }
                    )
                    .setColor('#00FFFF');

                return interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[Economia] Error:', error);
            return interaction.reply({ content: '❌ Error ejecutando el comando.', ephemeral: true });
        }
    }
};
