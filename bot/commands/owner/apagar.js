const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apagar')
        .setDescription('🚨 PANEL DE APAGADO DE EMERGENCIA (Solo dueños)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        // No arguments needed. We show a panel.

        const embed = new EmbedBuilder()
            .setTitle('🚨 PROTOCOLO DE APAGADO DE EMERGENCIA')
            .setDescription('**ADVERTENCIA:** Esta acción detendrá todos los procesos del sistema inmediatamente.\n\nPara proceder, presiona el botón y confirma la contraseña de seguridad.')
            .setColor('#FF0000') // Red
            .setThumbnail('https://i.imgur.com/8bfOq9t.png') // Optional: Warning icon
            .setFooter({ text: 'Sistema de Seguridad NacionMX' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('emergency_shutdown_btn')
                    .setLabel('☢️ INICIAR APAGADO')
                    .setStyle(ButtonStyle.Danger)
            );

        // Send PUBLIC message (not ephemeral, as requested)
        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        // Create collector for the button
        const collector = response.createMessageComponentCollector({
            filter: i => i.customId === 'emergency_shutdown_btn',
            time: 60000 // 1 minute timeout
        });

        collector.on('collect', async i => {
            // Verify permissions again for the button clicker (just in case)
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return i.reply({ content: '❌ No tienes autorización para esto.', ephemeral: true });
            }

            // Show Modal
            const modal = new ModalBuilder()
                .setCustomId('shutdown_modal')
                .setTitle('Confirmación de Seguridad');

            const passwordInput = new TextInputBuilder()
                .setCustomId('shutdown_password')
                .setLabel("Contraseña de Seguridad")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ingresa la clave de autorización...')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(passwordInput);
            modal.addComponents(firstActionRow);

            await i.showModal(modal);

            // Wait for modal submission
            try {
                const submitted = await i.awaitModalSubmit({
                    time: 60000,
                    filter: m => m.customId === 'shutdown_modal' && m.user.id === i.user.id
                });

                const password = submitted.fields.getTextInputValue('shutdown_password');

                if (password === 'vonssybmono') {
                    console.log(`🚨 EMERGENCY SHUTDOWN TRIGGERED BY ${submitted.user.tag} (${submitted.user.id})`);

                    await submitted.reply({
                        content: '🚨 **CONTRASEÑA CORRECTA. APAGANDO SISTEMA...**',
                        ephemeral: false
                    });

                    // Disable button on original message
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            ButtonBuilder.from(row.components[0]).setDisabled(true).setLabel('SISTEMA APAGADO')
                        );

                    await interaction.editReply({ components: [disabledRow] });

                    // Shutdown
                    setTimeout(() => {
                        process.exit(0);
                    }, 2000);

                } else {
                    await submitted.reply({
                        content: '❌ **ACCESO DENEGADO.** Contraseña incorrecta.',
                        ephemeral: true
                    });
                }

            } catch (err) {
                // Modal timeout or error
                console.log('Shutdown modal expired or error:', err);
            }
        });
    },
};
