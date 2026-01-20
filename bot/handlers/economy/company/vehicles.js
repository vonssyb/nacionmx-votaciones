/**
 * @module handlers/economy/company/vehicles
 * @description Maneja la compra y registro de vehículos para empresas
 * 
 * Este módulo gestiona:
 * 1. Botón 'company_addvehicle_ID' -> Muestra menú de selección
 * 2. Select 'vehicle_select_ID' -> Muestra opciones de pago
 * 3. Botón 'vehicle_pay_METHOD_TYPE_ID_COST' -> Procesa compra
 */

const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

const VEHICLE_COSTS = {
    'moto': 50000,
    'sedan': 150000,
    'camioneta': 250000,
    'camion': 500000,
    'deportivo': 750000,
    'lujo': 1000000,
    'helicoptero': 5000000,
    'avion': 10000000
};

const VEHICLE_NAMES = {
    'moto': '🏍️ Motocicleta',
    'sedan': '🚗 Sedán Corporativo',
    'camioneta': '🚙 Camioneta/SUV',
    'camion': '🚛 Camión de Carga',
    'deportivo': '🏎️ Deportivo',
    'lujo': '💎 Vehículo de Lujo',
    'helicoptero': '🚁 Helicóptero',
    'avion': '✈️ Avión Privado'
};

class CompanyVehicleHandler {
    constructor(client, supabase, paymentProcessor) {
        this.client = client;
        this.supabase = supabase;
        this.paymentProcessor = paymentProcessor;
    }

    /**
     * Router principal de interacciones de vehículos
     */
    async handleInteraction(interaction) {
        try {
            const { customId } = interaction;

            if (interaction.isButton()) {
                if (customId.startsWith('company_addvehicle_')) {
                    return await this.handleStartSelection(interaction);
                }
                if (customId.startsWith('vehicle_pay_')) {
                    return await this.handlePayment(interaction);
                }
            }

            if (interaction.isStringSelectMenu() && customId.startsWith('vehicle_select_')) {
                return await this.handleTypeSelection(interaction);
            }

            return false;
        } catch (error) {
            await ErrorHandler.handle(error, interaction);
            return true;
        }
    }

    /**
     * Paso 1: Mostrar menú de selección de vehículos
     */
    async handleStartSelection(interaction) {
        const companyId = interaction.customId.split('_')[2];
        await interaction.deferReply({ ephemeral: true });

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`vehicle_select_${companyId}`)
            .setPlaceholder('Selecciona el tipo de vehículo')
            .addOptions(
                Object.entries(VEHICLE_NAMES).map(([key, name]) => ({
                    label: name,
                    value: key,
                    description: `Costo: $${VEHICLE_COSTS[key].toLocaleString()}`
                }))
            );

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.editReply({
            content: '🚘 **Adquisición de Flota**\nSelecciona el tipo de vehículo que deseas registrar para la empresa:',
            components: [row]
        });
        return true;
    }

    /**
     * Paso 2: Mostrar opciones de pago para el vehículo seleccionado
     */
    async handleTypeSelection(interaction) {
        const companyId = interaction.customId.split('_')[2];
        const vehicleType = interaction.values[0];
        const cost = VEHICLE_COSTS[vehicleType];
        const name = VEHICLE_NAMES[vehicleType];

        await interaction.deferUpdate();

        // Obtener métodos de pago disponibles (User wallet/bank)
        // Usamos PaymentProcessor para generar botones, pero aquí necesitamos botones custom 
        // con formato `vehicle_pay_...` para que este handler los capture.
        // Helper manual:

        const row = new ActionRowBuilder().addComponents(
            // Simplificación: Botones directos con el formato requerido
            // En un sistema ideal, PaymentProcessor podría generar estos botones con un prefix custom.
            // Aquí los construimos manualmente para seguir el patrón del módulo.
            { type: 2, label: '💵 Efectivo', style: 1, custom_id: `vehicle_pay_cash_${vehicleType}_${companyId}_${cost}` },
            { type: 2, label: '🏦 Banco', style: 1, custom_id: `vehicle_pay_bank_${vehicleType}_${companyId}_${cost}` }
            // Podríamos agregar tarjeta de crédito si fuese necesario
        );

        const embed = new EmbedBuilder()
            .setTitle(`🛒 Confirmar Compra: ${name}`)
            .setColor('#0099ff')
            .addFields(
                { name: 'Vehículo', value: name, inline: true },
                { name: 'Costo', value: `$${cost.toLocaleString()}`, inline: true },
                { name: 'Empresa ID', value: companyId.substring(0, 8) + '...', inline: true }
            )
            .setFooter({ text: 'El pago se descontará de tu cuenta personal' });

        await interaction.editReply({
            content: null,
            embeds: [embed],
            components: [row]
        });
        return true;
    }

    /**
     * Paso 3: Procesar pago y registrar vehículo
     */
    async handlePayment(interaction) {
        const parts = interaction.customId.split('_');
        // vehicle_pay_METHOD_TYPE_ID_COST
        // 0: vehicle, 1: pay, 2: method, 3: type, 4: companyId, 5: cost

        if (parts.length < 6) {
            logger.warn('Invalid vehicle pay button', { customId: interaction.customId });
            return false;
        }

        const method = parts[2];
        const type = parts[3];
        const companyId = parts[4];
        const cost = parseFloat(parts[5]);
        const vehicleName = VEHICLE_NAMES[type] || type;

        await interaction.deferUpdate();

        // 1. Process Payment
        const paymentResult = await this.paymentProcessor.processPayment(
            method,
            interaction.user.id,
            interaction.guildId,
            cost,
            `Compra Vehículo Empresa: ${vehicleName}`
        );

        if (!paymentResult.success) {
            await interaction.followUp({
                content: `❌ **Error en el pago**\n${paymentResult.error}`,
                ephemeral: true
            });
            return true;
        }

        // 2. Update Company Vehicle Count
        // Primero obtenemos el count actual para incrementarlo de forma segura (concurrency aside)
        // O usamos un RPC/store procedure si existiera. Aquí hacemos read-modify-write simple.

        const { data: company, error: fetchError } = await this.supabase
            .from('companies')
            .select('vehicle_count, name')
            .eq('id', companyId)
            .single();

        if (fetchError || !company) {
            logger.errorWithContext('Failed to fetch company for vehicle add', fetchError, { companyId });
            await interaction.followUp({
                content: `⚠️ Pago exitoso, pero error al localizar la empresa. Contacta a soporte.\nRef: ${paymentResult.transactionId}`,
                ephemeral: true
            });
            return true;
        }

        const newCount = (company.vehicle_count || 0) + 1;

        const { error: updateError } = await this.supabase
            .from('companies')
            .update({ vehicle_count: newCount })
            .eq('id', companyId);

        if (updateError) {
            logger.errorWithContext('Failed to update vehicle count', updateError, { companyId });
            await interaction.followUp({
                content: `⚠️ Pago exitoso, pero error al actualizar contador de vehículos.\nRef: ${paymentResult.transactionId}`,
                ephemeral: true
            });
            return true;
        }

        // 3. Success Feedback
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Vehículo Registrado')
            .setColor('#00FF00')
            .setDescription(`Se ha añadido **${vehicleName}** a la flota de **${company.name}**.`)
            .addFields(
                { name: '💰 Costo', value: `$${cost.toLocaleString()}`, inline: true },
                { name: '🚗 Total Vehículos', value: `${newCount}`, inline: true },
                { name: '💳 Método', value: paymentResult.methodName, inline: true }
            );

        // Opción para agregar otro
        const addMoreRow = new ActionRowBuilder().addComponents(
            {
                type: 2,
                label: '➕ Agregar Otro Vehículo',
                style: 1,
                custom_id: `company_addvehicle_${companyId}` // Loop back to start
            }
        );

        await interaction.editReply({
            content: null,
            embeds: [successEmbed],
            components: [addMoreRow]
        });

        return true;
    }
}

module.exports = CompanyVehicleHandler;
