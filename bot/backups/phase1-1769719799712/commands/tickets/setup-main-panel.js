const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-main-panel')
        .setDescription('Despliega el panel PRINCIPAL de tickets (Automático)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal donde enviar el panel (Opcional, por defecto usa el ID configurado)')
                .addChannelTypes(ChannelType.GuildText)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetChannelId = interaction.options.getChannel('canal')?.id || '1398889153919189042';
        const channel = interaction.guild.channels.cache.get(targetChannelId);

        if (!channel) return interaction.editReply('❌ No encontré el canal destino.');

        // --- 1. EMBED PRINCIPAL ---
        const embed = new EmbedBuilder()
            .setTitle('CENTRO DE SOPORTE NACIÓN MX')
            .setDescription(`
**¡Bienvenido al sistema de soporte!**

Selecciona la categoría adecuada para tu consulta en el menú desplegable de abajo.
El equipo de Staff te atenderá lo más pronto posible.

**Horarios de Atención:** 24/7 (Sujeto a disponibilidad)
**Reglas:**
• No hagas ping al staff innecesariamente.
• Sé respetuoso en todo momento.
• Describe tu problema detalladamente.

⬇️ **SELECCIONA UNA OPCIÓN ABAJO** ⬇️`)
            .setColor(0xFFFFFF)
            .setImage('https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzdhaTUzend4bXByMDk3bWhnemJidXBtZjdma2p6cGdnOXM3Yzc1ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/FywHpJCtWSb28/giphy.gif')
            .setFooter({ text: 'Nación MX • Sistema de Tickets', iconURL: interaction.guild.iconURL() });

        // --- 2. MENU DESPLEGABLE ---
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_main_menu')
            .setPlaceholder('Selecciona el tipo de ticket...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('SOPORTE GENERAL')
                    .setDescription('Dudas, problemas generales o ayuda básica.')
                    .setValue('ticket_general')
                    .setEmoji('🔧'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('REPORTES Y SANCIONES')
                    .setDescription('Reportar usuarios, anti-rol, etc.')
                    .setValue('ticket_reportes')
                    .setEmoji('🚨'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('BLACKLIST | APELACION')
                    .setDescription('Apelar sanciones o solicitar revisión.')
                    .setValue('ticket_blacklist')
                    .setEmoji('📜'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('FACCIONES Y TRABAJO')
                    .setDescription('Asuntos relacionados a facciones, empresas o empleos.')
                    .setValue('ticket_trabajo')
                    .setEmoji('💼'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('SOLICITUD FEC / CK')
                    .setDescription('Solicitudes de FEC o Character Kill.')
                    .setValue('ticket_ck')
                    .setEmoji('☠️')
            );

        const rowMenu = new ActionRowBuilder().addComponents(selectMenu);

        // --- 3. BOTONES EXTRA (VIP / FALLAS) ---
        const btnVip = new ButtonBuilder()
            .setCustomId('ticket_btn_vip')
            .setLabel('TICKET VIP')
            .setStyle(ButtonStyle.Primary) // Azul
            .setEmoji('💎');

        const btnBug = new ButtonBuilder()
            .setCustomId('ticket_btn_bug')
            .setLabel('FALLAS CON EL BOT')
            .setStyle(ButtonStyle.Danger) // Rojo
            .setEmoji('🤖');

        const rowButtons = new ActionRowBuilder().addComponents(btnVip, btnBug);

        // --- ENVIAR ---
        await channel.send({ embeds: [embed], components: [rowMenu, rowButtons] });

        await interaction.editReply(`✅ Panel principal enviado correctamente a ${channel}.`);
    }
};
