const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');

const BANK_CONFIG = {
    BANKER_ROLE: '1450591546524307689', // Banqueros
    CATEGORY_ID: '1398888679216513044', // Categoría Banco
    ADMIN_ROLES: ['1412882245735420006', '1412887195014557787'] // Junta Directiva, Co-Owner
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-banco')
        .setDescription('🏦 Configurar panel del banco')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.channel;

            const panelEmbed = new EmbedBuilder()
                .setTitle('🏦 BANCO NACIONAL DE MÉXICO')
                .setDescription(
                    '**Bienvenido al Banco Nacional de México**\n\n' +
                    'Selecciona el servicio que necesitas del menú desplegable o usa los botones rápidos.\n\n' +
                    '**Servicios Disponibles:**\n' +
                    '💳 **Tarjetas** - Crédito y débito\n' +
                    '💰 **Créditos** - Préstamos personales\n' +
                    '🏢 **Empresarial** - Servicios para negocios\n' +
                    '💵 **Cuenta de Ahorro** - Apertura de cuentas\n' +
                    '📊 **Consultas** - Estado de cuenta, movimientos\n' +
                    '🔄 **Cambio de Divisa** - MXN ⇄ USD\n\n' +
                    '⏰ **Horario:** 24/7 (Servicio Automático)\n' +
                    '👨‍💼 Un banquero te atenderá personalmente'
                )
                .setColor(0x2ECC71)
                .setFooter({ text: 'Nación MX Banking System' })
                .setTimestamp()
                .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/bank-logo.png');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('banco_servicios')
                .setPlaceholder('🏦 Selecciona un servicio bancario')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('💳 Solicitar Tarjeta de Débito')
                        .setDescription('Tarjeta de débito MXN o USD')
                        .setValue('banco_debito')
                        .setEmoji('💳'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('💎 Solicitar Tarjeta de Crédito')
                        .setDescription('Tarjeta de crédito con línea de crédito')
                        .setValue('banco_credito')
                        .setEmoji('💎'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('💰 Solicitar Préstamo')
                        .setDescription('Créditos personales y empresariales')
                        .setValue('banco_prestamo')
                        .setEmoji('💰'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('📊 Consultar Estado de Cuenta')
                        .setDescription('Ver saldos y movimientos')
                        .setValue('banco_consulta')
                        .setEmoji('📊'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('🔄 Cambio de Divisa')
                        .setDescription('Convertir MXN ⇄ USD')
                        .setValue('banco_cambio')
                        .setEmoji('🔄'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('🏢 Servicios Empresariales')
                        .setDescription('Tarjetas corporativas, financiamiento')
                        .setValue('banco_empresa')
                        .setEmoji('🏢'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('💵 Abrir Cuenta de Ahorro')
                        .setDescription('Cuenta con intereses mensuales')
                        .setValue('banco_ahorro')
                        .setEmoji('💵'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('❓ Ayuda General')
                        .setDescription('Información sobre servicios')
                        .setValue('banco_ayuda')
                        .setEmoji('❓')
                );

            const row1 = new ActionRowBuilder().addComponents(selectMenu);

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('banco_btn_creditoexpress')
                    .setLabel('⚡ Crédito Express')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('⚡'),
                new ButtonBuilder()
                    .setCustomId('banco_btn_estadocuenta')
                    .setLabel('📊 Estado de Cuenta')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📊'),
                new ButtonBuilder()
                    .setCustomId('banco_btn_mistarjetas')
                    .setLabel('💳 Mis Tarjetas')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💳')
            );

            await channel.send({
                embeds: [panelEmbed],
                components: [row1, row2]
            });

            await interaction.editReply('✅ Panel bancario instalado exitosamente!');

        } catch (error) {
            console.error('[Setup Banco] Error:', error);
            await interaction.editReply('❌ Error al instalar el panel bancario.');
        }
    }
};
