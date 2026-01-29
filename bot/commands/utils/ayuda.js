const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('📚 Centro de Ayuda Nación MX (Unificado)'),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        // Initial Menu: Select Department
        const mainEmbed = new EmbedBuilder()
            .setTitle('📚 Centro de Ayuda Nación MX')
            .setColor(0x0099FF)
            .setDescription('**Bienvenido al sistema de ayuda.**\nSelecciona el departamento para ver los comandos disponibles.')
            .setImage('https://i.imgur.com/7Ph6XjE.png') // Optional placeholder
            .setFooter({ text: 'Nación MX | Sistema Unificado' });

        const mainMenu = new StringSelectMenuBuilder()
            .setCustomId('help_main_menu')
            .setPlaceholder('Selecciona un departamento...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Moderación & Justicia').setDescription('Sanciones, Policía, Warns').setValue('dept_mod').setEmoji('🛡️'),
                new StringSelectMenuOptionBuilder().setLabel('Economía & Negocios').setDescription('Banco, Empresas, Trabajo').setValue('dept_eco').setEmoji('💰'),
                new StringSelectMenuOptionBuilder().setLabel('Gobierno & Trámites').setDescription('DNI, Licencias, Multas').setValue('dept_gov').setEmoji('🏛️')
            );

        const row = new ActionRowBuilder().addComponents(mainMenu);

        const response = await interaction.editReply({ embeds: [mainEmbed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Menú ajeno.', ephemeral: true });

            await i.deferUpdate(); // Acknowledge click

            const selection = i.values[0];

            // 1. MODERATION DEPARTMENT
            if (selection === 'dept_mod') {
                const modEmbed = new EmbedBuilder()
                    .setTitle('🛡️ Moderación - Ayuda')
                    .setColor(0x0000FF)
                    .setDescription('**Sistema de Justicia y Staff**\nSelecciona una categoría específica.')
                    .setFooter({ text: 'Volver al menú principal con el comando /ayuda' });

                const modMenu = new StringSelectMenuBuilder()
                    .setCustomId('help_mod_category')
                    .setPlaceholder('Categoría de Moderación...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('Sanciones').setDescription('Warns, Bans, Blacklists').setValue('mod_sanctions').setEmoji('🔨'),
                        new StringSelectMenuOptionBuilder().setLabel('Policía & Justicia').setDescription('Arrestos, Misiones, ERLC').setValue('mod_police').setEmoji('👮'),
                        new StringSelectMenuOptionBuilder().setLabel('Administración').setDescription('Setup, Staff').setValue('mod_admin').setEmoji('⚙️'),
                        new StringSelectMenuOptionBuilder().setLabel('Ciudadano').setDescription('Historial, Apelaciones').setValue('mod_user').setEmoji('👤'),
                        new StringSelectMenuOptionBuilder().setLabel('↩️ Volver al Inicio').setValue('back_main').setEmoji('🏠')
                    );

                await i.editReply({ embeds: [modEmbed], components: [new ActionRowBuilder().addComponents(modMenu)] });
            }

            // 2. ECONOMY DEPARTMENT
            else if (selection === 'dept_eco') {
                const ecoEmbed = new EmbedBuilder()
                    .setTitle('💰 Economía - Ayuda')
                    .setColor(0xD4AF37)
                    .setDescription('**Sistema Financiero y Empresarial**\nSelecciona una categoría específica.')
                    .setFooter({ text: 'Volver al menú principal con el comando /ayuda' });

                const ecoMenu = new StringSelectMenuBuilder()
                    .setCustomId('help_eco_category')
                    .setPlaceholder('Categoría de Economía...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('Banco & Efectivo').setDescription('Débito, Transferencias').setValue('eco_bank').setEmoji('🏦'),
                        new StringSelectMenuOptionBuilder().setLabel('Crédito & Deudas').setDescription('Tarjetas, Buró').setValue('eco_credit').setEmoji('💳'),
                        new StringSelectMenuOptionBuilder().setLabel('Empresas').setDescription('Gestión de Negocios').setValue('eco_business').setEmoji('🏢'),
                        new StringSelectMenuOptionBuilder().setLabel('Inversiones & Casino').setDescription('Bolsa, Juegos').setValue('eco_invest').setEmoji('📈'),
                        new StringSelectMenuOptionBuilder().setLabel('Social & Seguridad').setDescription('Nivel, Bóveda').setValue('eco_social').setEmoji('⭐'),
                        new StringSelectMenuOptionBuilder().setLabel('↩️ Volver al Inicio').setValue('back_main').setEmoji('🏠')
                    );

                await i.editReply({ embeds: [ecoEmbed], components: [new ActionRowBuilder().addComponents(ecoMenu)] });
            }

            // 3. GOVERNMENT DEPARTMENT
            else if (selection === 'dept_gov') {
                const govEmbed = new EmbedBuilder()
                    .setTitle('🏛️ Gobierno - Ayuda')
                    .setColor(0xFFFFFF)
                    .setDescription('**Servicios Ciudadanos**\nSelecciona una categoría específica.')
                    .setFooter({ text: 'Volver al menú principal con el comando /ayuda' });

                const govMenu = new StringSelectMenuBuilder()
                    .setCustomId('help_gov_category')
                    .setPlaceholder('Categoría de Gobierno...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('Documentos').setDescription('DNI, Visa').setValue('gov_docs').setEmoji('🪪'),
                        new StringSelectMenuOptionBuilder().setLabel('Vehículos').setDescription('Placas, Traspasos').setValue('gov_cars').setEmoji('🚗'),
                        new StringSelectMenuOptionBuilder().setLabel('Policía').setDescription('Multas (Gestión)').setValue('gov_police').setEmoji('👮'),
                        new StringSelectMenuOptionBuilder().setLabel('Utilidades').setDescription('Info, Ping').setValue('gov_utils').setEmoji('ℹ️'),
                        new StringSelectMenuOptionBuilder().setLabel('↩️ Volver al Inicio').setValue('back_main').setEmoji('🏠')
                    );

                await i.editReply({ embeds: [govEmbed], components: [new ActionRowBuilder().addComponents(govMenu)] });

            }

            // BACK BUTTON
            else if (selection === 'back_main') {
                await i.editReply({ embeds: [mainEmbed], components: [row] });
            }

            // SUB-HANDLERS (Nested Logic)
            else {
                // MODERATION SUB-MENUS
                if (selection.startsWith('mod_')) {
                    const embed = new EmbedBuilder().setColor(0x0000FF).setTimestamp();
                    switch (selection) {
                        case 'mod_sanctions':
                            embed.setTitle('🔨 Sistema de Sanciones')
                                .addFields(
                                    { name: '`/sancion`', value: 'Panel de sanciones (Warn, Kick, Ban, SA).' },
                                    { name: '`/ver_warns`', value: 'Historial de usuario.' },
                                    { name: '`/eliminar_sancion`', value: 'Anular sanción (Encargados).' }
                                ); break;
                        case 'mod_police':
                            embed.setTitle('👮 Policía & ERLC')
                                .addFields(
                                    { name: '`/arrestar`', value: 'Procesar detenido (Auto-Kick).' },
                                    { name: '`/fianza`', value: 'Calcular/Pagar fianza.' },
                                    { name: '`/mod shift`', value: 'Control de turno.' },
                                    { name: '`/mision`', value: 'Misiones diarias.' }
                                ); break;
                        case 'mod_admin':
                            embed.setTitle('⚙️ Administración')
                                .addFields(
                                    { name: '`/rango`', value: 'Gestión de Staff.' },
                                    { name: '`/sesion`', value: 'Control de sesión.' },
                                    { name: '`/server_lock`', value: 'Bloqueo de servidor.' },
                                    { name: '`/verificar`', value: 'Forzar verificación.' }
                                ); break;
                        case 'mod_user':
                            embed.setTitle('👤 Ciudadano')
                                .addFields(
                                    { name: '`/mis_warns`', value: 'Tu historial penal.' },
                                    { name: '`/apelacion`', value: 'Impugnar sanción.' }
                                ); break;
                    }
                    await i.editReply({ embeds: [embed] }); // Keep menu, update embed
                }

                // ECONOMY SUB-MENUS
                else if (selection.startsWith('eco_')) {
                    const embed = new EmbedBuilder().setColor(0xD4AF37).setTimestamp();
                    switch (selection) {
                        case 'eco_bank':
                            embed.setTitle('🏦 Banco & Efectivo')
                                .addFields(
                                    { name: '`/perfil`', value: 'Resumen financiero.' },
                                    { name: '`/debito`', value: 'Cajero automático.' },
                                    { name: '`/transferir`', value: 'Enviar dinero.' },
                                    { name: '`/colectar`', value: 'Cobrar salario.' },
                                    { name: '`/fichar`', value: 'Entrada/Salida laboral.' }
                                ); break;
                        case 'eco_credit':
                            embed.setTitle('💳 Crédito & Deuda')
                                .addFields(
                                    { name: '`/credito info`', value: 'Estado de cuenta.' },
                                    { name: '`/credito pagar`', value: 'Abonar deuda.' },
                                    { name: '`/credito buro`', value: 'Score crediticio.' }
                                ); break;
                        case 'eco_business':
                            embed.setTitle('🏢 Empresas')
                                .addFields(
                                    { name: '`/empresa reporte`', value: 'Dashboard empresarial.' },
                                    { name: '`/empresa cobrar`', value: 'Cobrar a clientes.' },
                                    { name: '`/empresa empleados`', value: 'Gestión RRHH.' }
                                ); break;
                        case 'eco_invest':
                            embed.setTitle('📈 Inversiones & Casino')
                                .addFields(
                                    { name: '`/bolsa`', value: 'Mercado de valores.' },
                                    { name: '`/divisa`', value: 'Cambio de moneda.' },
                                    { name: '`/casino`', value: 'Juegos de azar.' },
                                    { name: '`/crimen`', value: 'Actividades ilegales.' }
                                ); break;
                        case 'eco_social':
                            embed.setTitle('⭐ Social & Seguridad')
                                .addFields(
                                    { name: '`/nivel`', value: 'Nivel y XP.' },
                                    { name: '`/logros`', value: 'Medallas.' },
                                    { name: '`/boveda`', value: 'Caja fuerte personal.' }
                                ); break;
                    }
                    await i.editReply({ embeds: [embed] });
                }

                // GOV SUB-MENUS
                else if (selection.startsWith('gov_')) {
                    const embed = new EmbedBuilder().setColor(0xFFFFFF).setTimestamp();
                    switch (selection) {
                        case 'gov_docs':
                            embed.setTitle('🪪 Documentos')
                                .addFields(
                                    { name: '`/dni`', value: 'Gestión de identidad.' },
                                    { name: '`/visa`', value: 'Visado americano.' },
                                    { name: '`/american-id`', value: 'Residencia USA.' }
                                ); break;
                        case 'gov_cars':
                            embed.setTitle('🚗 Vehículos')
                                .addFields(
                                    { name: '`/registrar-coche`', value: 'Emplacadado.' },
                                    { name: '`/gestionar-coche`', value: 'Traspasos.' }
                                ); break;
                        case 'gov_police':
                            embed.setTitle('👮 Policía')
                                .addFields(
                                    { name: '`/multar`', value: 'Boletas de infracción.' }
                                ); break;
                        case 'gov_utils':
                            embed.setTitle('ℹ️ Utilidades')
                                .addFields(
                                    { name: '`/ping`', value: 'Latencia.' }
                                ); break;
                    }
                    await i.editReply({ embeds: [embed] });
                }
            }
        });
    }
};
