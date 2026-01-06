const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('📘 Ver el centro de ayuda y lista de comandos'),

    async execute(interaction, client, supabase) {
        const initialEmbed = new EmbedBuilder()
            .setTitle('📘 Centro de Ayuda Nación MX')
            .setColor(0xD4AF37) // Gold
            .setDescription('**Selecciona una categoría en el menú de abajo para ver los comandos disponibles.**\n\nAquí encontrarás toda la información sobre el sistema financiero, legal y de entretenimiento.')
            // .setImage('https://i.imgur.com/K3pW4kC.png') 
            .setFooter({ text: 'Usa el menú desplegable para navegar' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('Selecciona una categoría...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Banco & Economía').setDescription('Débito, Transferencias, Efectivo').setValue('economy').setEmoji('🏦'),
                new StringSelectMenuOptionBuilder().setLabel('Crédito & Deudas').setDescription('Tarjetas de Crédito, Buró, Pagos').setValue('credit').setEmoji('💳'),
                new StringSelectMenuOptionBuilder().setLabel('Empresas & Negocios').setDescription('Gestión de Empresas, Terminal POS').setValue('business').setEmoji('🏢'),
                new StringSelectMenuOptionBuilder().setLabel('Inversiones & Bolsa').setDescription('Acciones, Crypto, Plazos Fijos').setValue('invest').setEmoji('📈'),
                new StringSelectMenuOptionBuilder().setLabel('Casino & Juegos').setDescription('Slots, Ruleta, Caballos, Juegos').setValue('casino').setEmoji('🎰'),
                new StringSelectMenuOptionBuilder().setLabel('Legal & Policial').setDescription('Multas, Antecedentes, Fichajes').setValue('police').setEmoji('👮'),
                new StringSelectMenuOptionBuilder().setLabel('Utilidades').setDescription('Ping, Balance, Notificaciones').setValue('utils').setEmoji('⚙️'),
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Use editReply because main bot handlers auto-defer
        const response = await interaction.editReply({ embeds: [initialEmbed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 }); // 5 mins

        collector.on('collect', async i => {
            if (i.customId !== 'help_category') return;

            // Important: Acknowledge the interaction to prevent "This interaction failed"
            // We use update (not reply) because we are modifying the message
            // But we do it at the END after building the new embed? 
            // Better to defer update or just update directly.

            // Checking if user matches
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '❌ Solo quien ejecutó el comando puede usar el menú.', flags: [64] });
            }

            const category = i.values[0];
            const newEmbed = new EmbedBuilder().setColor(0xD4AF37).setTimestamp();

            switch (category) {
                case 'economy':
                    newEmbed.setTitle('🏦 Banco & Economía')
                        .addFields(
                            { name: '`/perfil`', value: 'Ver tu saldo, DNI, licencias y patrimonio total.' },
                            { name: '`/debito`', value: 'Panel de cajero: depositar, retirar y ver tarjeta.' },
                            { name: '`/transferir`', value: 'Transferir dinero a otro ciudadano del banco.' },
                            { name: '`/depositar`', value: 'Enviar efectivo a terceros (OXXO).' },
                            { name: '`/colectar`', value: 'Reclamar tus salarios y beneficios acumulados.' },
                            { name: '`/fichar`', value: 'Iniciar o terminar tu turno de trabajo oficial.' }
                        );
                    break;
                case 'credit':
                    newEmbed.setTitle('💳 Crédito & Deudas')
                        .addFields(
                            { name: '`/credito estado`', value: 'Ver tu deuda actual y límite disponible.' },
                            { name: '`/credito pagar`', value: 'Abonar dinero a tu tarjeta de crédito.' },
                            { name: '`/credito buro`', value: 'Consultar tu score financiero y nivel.' },
                            { name: '`/top-morosos`', value: 'Ranking de ciudadanos con mayor deuda.' },
                            { name: '`/tarjeta info`', value: 'Catálogo de tarjetas y beneficios disponibles.' }
                        );
                    break;
                case 'business':
                    newEmbed.setTitle('🏢 Empresas & Negocios')
                        .addFields(
                            { name: '`/empresa crear`', value: 'Abrir un negocio propio ($250k trámite).' },
                            { name: '`/empresa menu`', value: 'Panel de control: nóminas, saldo y gestión.' },
                            { name: '`/empresa cobrar`', value: 'Terminal de cobro para clientes (POS).' },
                            { name: '`/nomina`', value: 'Gestionar grupos de pago y sueldos.' },
                            { name: '`/gestionar-coche`', value: 'Vender o transferir tus vehículos.' }
                        );
                    break;
                case 'invest':
                    newEmbed.setTitle('📈 Inversiones & Bolsa')
                        .addFields(
                            { name: '`/bolsa ver`', value: 'Ver precios actuales de acciones.' },
                            { name: '`/bolsa comprar/vender`', value: 'Operar en el mercado de valores.' },
                            { name: '`/inversion`', value: 'Plazos fijos con rendimiento garantizado.' },
                            { name: '`/stake`', value: 'Bloquear ahorros para ganar intereses pasivos.' },
                            { name: '`/divisa`', value: 'Cambio de moneda (USD/MXN).' }
                        );
                    break;
                case 'casino':
                    newEmbed.setTitle('🎰 Casino & Diversión')
                        .addFields(
                            { name: '`/casino ruleta/blackjack`', value: 'Juegos de mesa clásicos.' },
                            { name: '`/slots`', value: 'Máquina tragamonedas con jackpot.' },
                            { name: '`/crimen`', value: 'Actividades de alto riesgo por dinero.' },
                            { name: '`/trabajar`', value: 'Realizar mini-trabajos legales rápidos.' },
                            { name: '`/robar`', value: 'Intentar sustraer dinero de otro ciudadano.' }
                        );
                    break;
                case 'police':
                    newEmbed.setTitle('👮 Legal & Ciudadanía')
                        .addFields(
                            { name: '`/dni`', value: 'Ver o crear tu Documento de Identidad.' },
                            { name: '`/visa solicitar`', value: 'Pedir permiso de residencia en EE.UU.' },
                            { name: '`/american-id`', value: 'Identificación si ya tienes el rol americano.' },
                            { name: '`/multar`', value: 'Sancionas viales y legales (Solo Policía).' },
                            { name: '`/arrestar`', value: 'Proceso de detención oficial (Solo Policía).' },
                            { name: '`/registrar-coche`', value: 'Dar de alta un vehículo en el censo.' }
                        );
                    break;
                case 'utils':
                    newEmbed.setTitle('⚙️ Progreso & Social')
                        .addFields(
                            { name: '`/nivel` / `/logros`', value: 'Ver tu rango y retos completados.' },
                            { name: '`/misiones`', value: 'Tareas diarias con recompensas.' },
                            { name: '`/verificar`', value: 'Vincular cuenta con Roblox.' },
                            { name: '`/apelacion`', value: 'Solicitar revisión de una sanción activa.' },
                            { name: '`/status` / `/ping`', value: 'Estado del sistema.' }
                        );
                    break;
            }

            await i.update({ embeds: [newEmbed], components: [row] });
        });

        collector.on('end', () => {
            // Optional: Disable on timeout or remove components
            // interaction.editReply({ components: [] }).catch(console.error);
        });
    }
};
