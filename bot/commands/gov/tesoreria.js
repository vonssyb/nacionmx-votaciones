const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/Logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tesoreria')
        .setDescription('🏛️ Gestión de Fondos del Gobierno (Solo Gobernador/Staff)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription('Ver el balance actual de la tesorería'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('retirar')
                .setDescription('Retirar fondos de la tesorería')
                .addIntegerOption(option =>
                    option.setName('monto')
                        .setDescription('Monto a retirar')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('motivo')
                        .setDescription('Justificación del retiro')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('depositar')
                .setDescription('Depositar fondos a la tesorería')
                .addIntegerOption(option =>
                    option.setName('monto')
                        .setDescription('Monto a depositar')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('origen')
                        .setDescription('Origen de los fondos')
                        .setRequired(true))),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        // Permission Check
        // Roles allowed: 
        // 1. Staff Alto Rango (1412882245735420006 - Junta Directiva, 1412887195014557787 - Co-Owner)
        // 2. Gobernador (Need to check role ID, assuming Administrator perms for now or specific ID)
        // Using Administrator permission as fallback + explicit roles

        const ALLOWED_ROLES = [
            '1412882245735420006', // Junta Directiva
            '1412887195014557787', // Co-Owner
            '1450242487422812251', // Staff
            // Add Governor role if known
        ];

        const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));

        if (!hasPermission) {
            return interaction.editReply('❌ No tienes permiso para gestionar la tesorería del gobierno.');
        }

        const subcommand = interaction.options.getSubcommand();
        const treasuryService = client.treasuryService;

        if (!treasuryService) {
            return interaction.editReply('❌ Error: Servicio de tesorería no inicializado.');
        }

        try {
            if (subcommand === 'balance') {
                const balance = await treasuryService.getBalance(interaction.guildId);

                const embed = new EmbedBuilder()
                    .setTitle('🏛️ Balance de Tesorería Nacional')
                    .setColor('#F1C40F')
                    .setDescription(`Fondos gubernamentales actuales:\n# $${balance.toLocaleString()}`)
                    .setFooter({ text: 'Nación MX Gobierno' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'retirar') {
                const monto = interaction.options.getInteger('monto');
                const motivo = interaction.options.getString('motivo');
                const currentBalance = await treasuryService.getBalance(interaction.guildId);

                if (currentBalance < monto) {
                    return interaction.editReply(`❌ Fondos insuficientes. Balance actual: $${currentBalance.toLocaleString()}`);
                }

                // Add to user via UB
                const UnbelievaBoatService = client.services?.billing?.ubService || client.billingService?.ubService || (client.services && client.services.billing && client.services.billing.ubService);

                if (!UnbelievaBoatService) {
                    return interaction.editReply('❌ Error: No se pudo conectar con el banco para la transferencia.');
                }

                // 1. Withdraw from Treasury (Add negative funds)
                // This will throw if funds are insufficient or other error
                const newBalance = await treasuryService.addFunds(
                    interaction.guildId,
                    -monto,
                    'Retiro Gubernamental',
                    `Retiro por ${interaction.user.tag}: ${motivo}`
                );

                // 2. Add to user
                await UnbelievaBoatService.addMoney(interaction.guildId, interaction.user.id, monto, `Retiro Tesorería: ${motivo}`, 'bank');

                const embed = new EmbedBuilder()
                    .setTitle('💸 Retiro de Fondos Exitoso')
                    .setColor('#E74C3C')
                    .addFields(
                        { name: 'Monto Retirado', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: 'Nuevo Balance', value: `$${newBalance.toLocaleString()}`, inline: true },
                        { name: 'Beneficiario', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Motivo', value: motivo, inline: false }
                    );

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'depositar') {
                const monto = interaction.options.getInteger('monto');
                const origen = interaction.options.getString('origen');

                console.log(`[Tesoreria Debug] Depositar - Monto: ${monto}, Origen: ${origen}, User: ${interaction.user.tag}`);

                if (monto === null || monto === undefined) {
                    return interaction.editReply('❌ Error interno: Monto inválido.');
                }

                // Check user balance first
                const UnbelievaBoatService = client.services?.billing?.ubService || client.billingService?.ubService || (client.services && client.services.billing && client.services.billing.ubService);

                if (!UnbelievaBoatService) {
                    console.error('[Tesoreria Debug] UB Service not found');
                    return interaction.editReply('❌ Error: Servicio bancario no disponible.');
                }

                const userBalance = await UnbelievaBoatService.getUserBalance(interaction.guildId, interaction.user.id);
                console.log(`[Tesoreria Debug] User Balance:`, userBalance);

                if (!userBalance || typeof userBalance.bank === 'undefined') {
                    console.error('[Tesoreria Debug] Invalid user balance response', userBalance);
                    return interaction.editReply('❌ Error al obtener tu balance bancario.');
                }

                if (userBalance.bank < monto) {
                    return interaction.editReply(`❌ No tienes suficientes fondos en banco para depositar $${monto.toLocaleString()}.`);
                }

                // 1. Remove from user
                await UnbelievaBoatService.removeMoney(interaction.guildId, interaction.user.id, monto, `Depósito a Tesorería: ${origen}`, 'bank');

                // 2. Add to Treasury
                console.log('[Tesoreria Debug] Calling addFunds...');
                let newBalance = await treasuryService.addFunds(
                    interaction.guildId,
                    monto,
                    'Depósito Manual',
                    `Depósito por ${interaction.user.tag}: ${origen}`
                );

                console.log(`[Tesoreria Debug] addFunds returned: ${newBalance}`);

                if (newBalance === undefined || newBalance === null) {
                    console.error('[Tesoreria Debug] addFunds returned null/undefined!');
                    // Fetch directly as fallback to prevent crash
                    newBalance = await treasuryService.getBalance(interaction.guildId);
                    console.log(`[Tesoreria Debug] Fetched fallback balance: ${newBalance}`);
                }

                const embed = new EmbedBuilder()
                    .setTitle('💰 Depósito a Tesorería Exitoso')
                    .setColor('#2ECC71')
                    .addFields(
                        { name: 'Monto Depositado', value: `$${monto ? monto.toLocaleString() : '0'}`, inline: true },
                        { name: 'Nuevo Balance', value: `$${newBalance !== undefined && newBalance !== null ? newBalance.toLocaleString() : 'Error'}`, inline: true },
                        { name: 'Origen', value: origen || 'Desconocido', inline: false }
                    );

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[Tesoreria Debug] FATAL ERROR:', error);
            logger.errorWithContext('Error in tesoreria command:', error);
            await interaction.editReply(`❌ Ocurrió un error al procesar la solicitud (v2): ${error.message}`).catch(e => console.error(e));
        }
    }
};
