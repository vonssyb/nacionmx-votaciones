const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../services/Logger');

const BANK_CONFIG = {
    BANKER_ROLE: '1450591546524307689', // Banqueros
    CATEGORY_ID: '1398888679216513044', // Categoría Banco
    LOG_CHANNEL: '1414065296704016465', // Canal de logs (igual que tickets)
    ADMIN_ROLES: ['1412882245735420006', '1412887195014557787'] // Junta Directiva, Co-Owner
};

/**
 * Handler for banking panel interactions
 */
async function handleBankingInteraction(interaction, client, supabase) {
    if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return false;

    const { customId } = interaction;
    // logger.debug('[Banking Handler] Interaction received', { customId }); // Verbose

    try {
        // Banking Select Menu
        if (customId === 'banco_servicios') {
            const selectedService = interaction.values[0];
            return await handleBankServiceSelection(selectedService, interaction, client, supabase);
        }

        // Banking Quick Buttons
        if (customId.startsWith('banco_btn_')) {
            const service = customId.replace('banco_btn_', '');
            return await handleBankButtonPress(service, interaction, client, supabase);
        }

        // Banking Modal Submissions
        if (customId.startsWith('modal_banco_')) {
            return await handleBankModalSubmit(customId, interaction, client, supabase);
        }

        return false;
    } catch (error) {
        logger.errorWithContext('Banking Handler Error', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Error al procesar la solicitud bancaria.', ephemeral: true });
            } else {
                await interaction.editReply('❌ Error al procesar la solicitud bancaria.');
            }
        } catch (e) {
            logger.errorWithContext('Banking Handler Failed to send error message', e);
        }
        return true; // Mark as handled even if error
    }
}

async function handleBankServiceSelection(service, interaction, client, supabase) {
    // logger.info('[Banking] Menu service selected', { service });
    switch (service) {
        case 'banco_debito':
            return showModalDebito(interaction);
        case 'banco_credito':
            return showModalCredito(interaction);
        case 'banco_prestamo':
            return showModalPrestamo(interaction);
        case 'banco_consulta':
            return showEstadoCuenta(interaction, supabase);
        case 'banco_cambio':
            return showModalCambio(interaction);
        case 'banco_empresa':
            return showModalEmpresa(interaction);
        case 'banco_ahorro':
            return showModalAhorro(interaction);
        case 'banco_ayuda':
            return showAyudaBanco(interaction);
        default:
            await interaction.reply({ content: '❌ Servicio no disponible.', ephemeral: true });
            return true;
    }
}

// --- MISSING MODAL FUNCTIONS IMPLEMENTATION ---

async function showModalDebito(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_debito').setTitle('💳 Solicitud Tarjeta Débito');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nombre_titular').setLabel('Nombre Completo').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ocupacion').setLabel('Ocupación Principal').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
    return true;
}

async function showModalCredito(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_credito').setTitle('💳 Solicitud Tarjeta Crédito');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ingresos_mensuales').setLabel('Ingresos Mensuales Estimados').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motivo_solicitud').setLabel('Motivo de Solicitud').setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    await interaction.showModal(modal);
    return true;
}

async function showModalPrestamo(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_prestamo').setTitle('💰 Solicitud de Préstamo');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('monto_solicitado').setLabel('Monto Solicitado').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('plazo_pago').setLabel('Plazo de Pago (Días/Semanas)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motivo_prestamo').setLabel('Destino del Crédito').setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    await interaction.showModal(modal);
    return true;
}

async function showModalCambio(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_cambio').setTitle('💱 Cambio de Divisas');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('monto_origen').setLabel('Monto a Cambiar (MXN/USD)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tipo_cambio_deseado').setLabel('¿Compra o Venta?').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
    return true;
}

async function showModalEmpresa(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_empresa').setTitle('🏢 Servicio Empresarial');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nombre_empresa').setLabel('Nombre de la Empresa').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tipo_servicio').setLabel('Servicio Requerido (Cuenta/Nómina)').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
    return true;
}

async function showModalAhorro(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_ahorro').setTitle('🐷 Cuenta de Ahorro');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('monto_inicial').setLabel('Monto de Apertura').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('meta_ahorro').setLabel('Meta de Ahorro (Opcional)').setStyle(TextInputStyle.Short).setRequired(false))
    );
    await interaction.showModal(modal);
    return true;
}

async function handleBankButtonPress(service, interaction, client, supabase) {
    // logger.info('[Banking] Button pressed', { service });
    switch (service) {
        case 'creditoexpress':
            return showModalPrestamo(interaction);
        case 'estadocuenta':
            return showEstadoCuenta(interaction, supabase);
        case 'mistarjetas':
            return showMisTarjetas(interaction, supabase);
        default:
            return false;
    }
}
// ... (rest of modals are fine, no logs)

// ...

async function showEstadoCuenta(interaction, supabase) {
    await interaction.deferReply({ ephemeral: true });

    // Use the /tarjetas info command logic
    try {
        const { data: mxnCards } = await supabase
            .from('credit_cards')
            .select('*')
            .eq('discord_user_id', interaction.user.id);

        const { data: usdCards } = await supabase
            .from('credit_cards_usd')
            .select('*')
            .eq('discord_user_id', interaction.user.id);

        const totalMxn = mxnCards?.length || 0;
        const totalUsd = usdCards?.length || 0;

        const embed = new EmbedBuilder()
            .setTitle('📊 Estado de Cuenta')
            .setDescription(`**${interaction.user.tag}**\n\nResumen de tus productos bancarios`)
            .addFields(
                { name: '💳 Tarjetas MXN', value: `${totalMxn}`, inline: true },
                { name: '💳 Tarjetas USD', value: `${totalUsd}`, inline: true }
            )
            .setColor(0x5865F2)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.errorWithContext('[Estado Cuenta] Error', error);
        await interaction.editReply('❌ Error al consultar tu estado de cuenta.');
    }

    return true;
}

// ... 

async function showMisTarjetas(interaction, supabase) {
    // Redirect to /tarjetas info
    await interaction.reply({
        content: '💡 **Tip:** Usa el comando `/tarjetas info` para ver todas tus tarjetas con detalles completos.',
        ephemeral: true
    });
    return true;
}

async function showAyudaBanco(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('❓ Ayuda - Servicios Bancarios')
        .setDescription(
            '**¿Cómo usar el Banco?**\n\n' +
            '1️⃣ Selecciona el servicio del menú\n' +
            '2️⃣ Completa el formulario\n' +
            '3️⃣ Un banquero te atenderá\n\n' +
            '**Servicios Disponibles:**\n' +
            '💳 **Tarjetas:** Débito y crédito MXN/USD\n' +
            '💰 **Préstamos:** Personales y empresariales\n' +
            '📊 **Consultas:** Estado de cuenta, movimientos\n' +
            '🔄 **Cambio:** Convertir MXN ⇄ USD\n\n' +
            '**Comandos Útiles:**\n' +
            '`/tarjetas info` - Ver tus tarjetas\n' +
            '`/credito` - Gestión de créditos\n' +
            '`/balanza` - Ver tu balance completo\n\n' +
            '💡 Para atención directa, abre un ticket bancario.'
        )
        .setColor(0x3498DB)
        .setFooter({ text: 'Banco Nacional de México' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
}

// MODAL SUBMIT HANDLER
async function handleBankModalSubmit(customId, interaction, client, supabase) {
    await interaction.deferReply({ ephemeral: true });

    const serviceType = customId.replace('modal_banco_', '');

    // Create banking ticket channel
    const ticketChannel = await createBankingTicket(interaction, serviceType, client, supabase);

    if (ticketChannel) {
        await interaction.editReply(`✅ Tu solicitud bancaria ha sido creada: ${ticketChannel}`);
        return true;
    } else {
        await interaction.editReply('❌ Error al crear tu solicitud bancaria.');
        return true;
    }
}

async function createBankingTicket(interaction, serviceType, client, supabase) {
    try {
        const cleanName = interaction.user.username.replace(/[^a-z0-9\-_]/g, '').toLowerCase().substring(0, 15);
        const channelName = `banco-${serviceType}-${cleanName}`;

        const permissionOverwrites = [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
            { id: BANK_CONFIG.BANKER_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
        ];

        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: BANK_CONFIG.CATEGORY_ID,
            topic: `ID: ${interaction.user.id} | Solicitud: ${serviceType}`,
            permissionOverwrites
        });

        // Build description from modal fields
        let description = `**Tipo:** Solicitud Bancaria - ${serviceType.toUpperCase()}\n**Usuario:** <@${interaction.user.id}>\n\n`;

        // Iterate through modal fields correctly
        const fields = interaction.fields.fields;
        for (const [key, field] of fields) {
            const label = field.customId.replace(/_/g, ' ').toUpperCase();
            description += `**${label}:** ${field.value}\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏦 Solicitud Bancaria: ${serviceType.toUpperCase()}`)
            .setDescription(description)
            .setColor(0x2ECC71)
            .setFooter({ text: 'Un banquero te atenderá pronto' })
            .setTimestamp();

        await ticketChannel.send({
            content: `<@${interaction.user.id}> <@&${BANK_CONFIG.BANKER_ROLE}>`,
            embeds: [embed]
        });

        return ticketChannel;
    } catch (error) {
        logger.errorWithContext('Banking Ticket Error', error);
        return null;
    }
}

