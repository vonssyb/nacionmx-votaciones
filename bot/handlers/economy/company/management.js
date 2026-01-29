/**
 * @module handlers/economy/company/management
 * @description Gestión de empresas (Crear, Transferir, Renombrar)
 * 
 * Flujo Crear Empresa:
 * 1. Slash `/empresa crear` -> Valida input y calcula costo.
 * 2. Guarda datos temporales en StateManager (PendingAction).
 * 3. Muestra botones de pago (`company_create_pay_METHOD_STATEID`).
 * 4. Al pagar, recupera datos del StateManager y crea la empresa en DB.
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');
const crypto = require('crypto');

class CompanyManagementHandler {
    constructor(client, supabase, paymentProcessor, billingService, stateManager) {
        this.client = client;
        this.supabase = supabase;
        this.paymentProcessor = paymentProcessor;
        this.billingService = billingService;
        this.stateManager = stateManager;
    }

    async handleInteraction(interaction) {
        try {
            const { customId } = interaction;

            // Handle Creation Payment Buttons
            // Format: company_create_pay_METHOD_STATEID
            if (interaction.isButton() && customId.startsWith('company_create_pay_')) {
                return await this.handleCreationPayment(interaction);
            }

            return false;
        } catch (error) {
            await ErrorHandler.handle(error, interaction);
            return true;
        }
    }

    /**
     * Maneja el comando Slash /empresa crear
     */
    async handleCreateCommand(interaction) {
        // defer is skipped if already deferred. Assuming safeDefer is used.
        const nombre = interaction.options.getString('nombre');
        const dueño = interaction.options.getUser('dueño');
        const descripcion = interaction.options.getString('descripcion');
        const menuUrl = interaction.options.getString('menu_url');
        const discordServer = interaction.options.getString('discord_server');
        const tipoLocal = interaction.options.getString('tipo_local');
        const logo = interaction.options.getAttachment('logo');
        const fotoLocal = interaction.options.getAttachment('foto_local');
        const ubicacion = interaction.options.getString('ubicacion');
        const coDueño = interaction.options.getUser('co_dueño');
        const esPrivada = interaction.options.getBoolean('es_privada') || false;

        // Validate URLs
        const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        if (!urlRegex.test(menuUrl)) {
            await interaction.followUp({ content: '❌ El enlace del menú no es válido. Debe ser una URL válida.', ephemeral: true });
            return;
        }
        if (!urlRegex.test(discordServer)) {
            await interaction.followUp({ content: '❌ El enlace del servidor Discord no es válido. Debe ser una URL válida.', ephemeral: true });
            return;
        }

        // 1. Validate Uniqueness
        const { data: existing } = await this.supabase
            .from('companies')
            .select('id')
            .eq('name', nombre)
            .maybeSingle();

        if (existing) {
            await interaction.followUp({ content: '❌ Ya existe una empresa con ese nombre.', ephemeral: true });
            return;
        }

        // 2. Calculate Costs
        const TRAMITE_FEE = 250000;
        const LOCAL_COSTS = {
            'pequeño': 850000,
            'mediano': 1750000,
            'grande': 3200000,
            'gigante': 5000000
        };
        let baseCost = TRAMITE_FEE;
        if (tipoLocal && LOCAL_COSTS[tipoLocal]) {
            baseCost += LOCAL_COSTS[tipoLocal];
        }

        // 3. Apply Discounts (Legacy Logic)
        const ownerMember = await interaction.guild.members.fetch(dueño.id);
        const hasVip = ownerMember.roles.cache.some(r => r.name === 'VIP' || r.name === 'Booster' || r.name === 'Premium' || r.id === '1412887172503175270'); // Simplified check with ID
        // Full role check logic could be injected or imported. For now: 
        const discount = hasVip ? 0.30 : 0;
        const totalCost = baseCost * (1 - discount);

        // 4. Save State
        const stateId = crypto.randomBytes(8).toString('hex');
        const companyData = {
            name: nombre,
            description: descripcion,
            menu_url: menuUrl,
            owner_id: dueño.id,
            owner_ids: coDueño ? [dueño.id, coDueño.id] : [dueño.id], // Array for ownership
            co_owner_id: coDueño?.id || null, // Keeping legacy column just in case
            created_at: new Date().toISOString(),
            logo_url: logo?.url || null,
            local_type: tipoLocal || 'pequeño',
            local_photo_url: fotoLocal?.url || null,
            location: ubicacion,
            is_private: esPrivada,
            industry_type: 'General',
            discord_server: discordServer,
            vehicle_count: 0,
            balance: 0,
            totalCost
        };

        const stored = await this.stateManager.setPendingAction(stateId, {
            type: 'company_create',
            data: companyData,
            userId: interaction.user.id
        }, 600); // 10 mins

        if (!stored) {
            await interaction.followUp({ content: '❌ Error guardando estado de creación.' });
            return;
        }

        // 5. Show Summary & Buttons
        const embed = new EmbedBuilder()
            .setTitle(`🏢 Confirmar Creación: ${nombre}`)
            .setColor('#3498DB')
            .setDescription(`${descripcion}\n\n**Costo Total:** $${totalCost.toLocaleString()}\n(Trámite: $${TRAMITE_FEE.toLocaleString()} + Local: $${(LOCAL_COSTS[tipoLocal] || 0).toLocaleString()} - Desc: ${(discount * 100)}%)`)
            .addFields(
                { name: 'Dueño', value: `<@${dueño.id}>`, inline: true },
                { name: 'Tipo Local', value: tipoLocal || 'Ninguno', inline: true },
                { name: 'Co-Dueño', value: coDueño ? `<@${coDueño.id}>` : 'N/A', inline: true },
                { name: '📋 Menú', value: menuUrl, inline: false },
                { name: '💬 Discord', value: discordServer, inline: false }
            )
            .setFooter({ text: 'Selecciona método de pago para confirmar' });

        if (logo) embed.setThumbnail(logo.url);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`company_create_pay_cash_${stateId}`).setLabel('💵 Efectivo').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`company_create_pay_debit_${stateId}`).setLabel('💳 Débito').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`company_create_pay_credit_${stateId}`).setLabel('💳 Crédito').setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
    }

    /**
     * Procesa el pago y crea la empresa
     */
    async handleCreationPayment(interaction) {
        const parts = interaction.customId.split('_');
        // company_create_pay_METHOD_STATEID
        const method = parts[3];
        const stateId = parts[4];

        await interaction.deferReply({ ephemeral: false }); // Public confirmation

        // 1. Retrieve State
        const action = await this.stateManager.getPendingAction(stateId);
        if (!action || !action.data) {
            await interaction.editReply({ content: '❌ La sesión de creación ha expirado. Vuelve a ejecutar el comando.', components: [] });
            return true;
        }

        const companyData = action.data;
        const totalCost = companyData.totalCost;
        const ownerId = companyData.owner_id;

        // 2. Process Payment (Charge Owner)
        // If the interaction user is NOT the owner, we prevent charging someone else?
        // Legacy: "i.user.id === interaction.user.id" (Executor pays).
        // Usually executor IS owner, or admin creating for check. 
        // We charge the executor (interaction.user).

        const paymentResult = await this.paymentProcessor.processPayment(
            method,
            interaction.user.id,
            interaction.guildId,
            totalCost,
            `Creación Empresa: ${companyData.name}`
        );

        if (!paymentResult.success) {
            await interaction.editReply({ content: `❌ **Pago Fallido**\n${paymentResult.error}`, components: [] });
            return true;
        }

        // 3. Create Company in DB
        // Clean up data not in table schema
        const insertData = { ...companyData };
        delete insertData.totalCost; // Remove temp field

        const { data: newCompany, error } = await this.supabase
            .from('companies')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            logger.errorWithContext('Failed to create company DB record', error, companyData);
            // TODO: Refund logic here ideally
            await interaction.editReply(`❌ **Error Fatal**\nSe cobró el dinero pero falló la creación en base de datos.\nID Transacción: ${paymentResult.transactionId}\nContacta a soporte.`);
            return true;
        }

        // 4. Assign Role (Legacy)
        try {
            const member = await interaction.guild.members.fetch(ownerId);
            const roles = ['Empresario', 'CEO', 'Dueño'];
            // Try finding any of these
            for (const rName of roles) {
                const role = interaction.guild.roles.cache.find(r => r.name === rName);
                if (role && !member.roles.cache.has(role.id)) {
                    await member.roles.add(role);
                    break;
                }
            }
        } catch (err) {
            logger.warn('Role assignment failed', err);
        }

        // 5. Cleanup & Success
        await this.stateManager.deletePendingAction(stateId);

        const successEmbed = new EmbedBuilder()
            .setTitle(`✅ EmpresaCreada: ${newCompany.name}`)
            .setColor('#2ECC71')
            .setDescription(`Se ha registrado correctamente con ID: \`${newCompany.id}\``)
            .setFooter({ text: '¡Felicidades por tu nuevo emprendimiento!' })
            .setTimestamp();

        if (companyData.logo_url) successEmbed.setThumbnail(companyData.logo_url);
        if (companyData.local_photo_url) successEmbed.setImage(companyData.local_photo_url);

        await interaction.editReply({ embeds: [successEmbed], components: [] });
        return true;
    }
}

module.exports = CompanyManagementHandler;
