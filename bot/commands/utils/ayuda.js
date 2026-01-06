const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('📘 Ver el centro de ayuda y lista de comandos'),

    async execute(interaction, client, supabase) {
        const initialEmbed = new EmbedBuilder()
            .setTitle('📘 Centro de Ayuda Nación MX')
            .setColor(0xD4AF37) // Gold
            .setDescription('**Selecciona una categoría en el menú de abajo para ver los comandos disponibles.**\n\nAquí encontrarás toda la información sobre el sistema financiero, legal, empresarial y de entretenimiento.\n\n🤖 **3 Bots Disponibles:**\n• **Economía** - Finanzas, empresas, casino\n• **Gobierno** - Legal, policial, ciudadanía\n• **Moderación** - Sanciones, staff, ERLC')
            .setFooter({ text: 'Usa el menú desplegable para navegar' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('Selecciona una categoría...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Banco & Economía').setDescription('Débito, Transferencias, Efectivo').setValue('economy').setEmoji('🏦'),
                new StringSelectMenuOptionBuilder().setLabel('Crédito & Deudas').setDescription('Tarjetas de Crédito, Buró, Pagos').setValue('credit').setEmoji('💳'),
                new StringSelectMenuOptionBuilder().setLabel('Empresas & Negocios').setDescription('Gestión Avanzada, Terminal POS, Empleados').setValue('business').setEmoji('🏢'),
                new StringSelectMenuOptionBuilder().setLabel('Inversiones & Bolsa').setDescription('Acciones, Crypto, Plazos Fijos').setValue('invest').setEmoji('📈'),
                new StringSelectMenuOptionBuilder().setLabel('Casino & Juegos').setDescription('Slots, Ruleta, Caballos, Juegos').setValue('casino').setEmoji('🎰'),
                new StringSelectMenuOptionBuilder().setLabel('Gobierno & Legal').setDescription('DNI, Visa, Vehículos, Multas').setValue('gov').setEmoji('🏛️'),
                new StringSelectMenuOptionBuilder().setLabel('Policía & Justicia').setDescription('Arrestos, Fianzas, Misiones Policiales').setValue('police').setEmoji('👮'),
                new StringSelectMenuOptionBuilder().setLabel('Moderación & Staff').setDescription('Sanciones, ERLC, Verificación').setValue('staff').setEmoji('🛡️'),
                new StringSelectMenuOptionBuilder().setLabel('Social & Reputación').setDescription('Reputación, Nivel, Logros').setValue('social').setEmoji('⭐'),
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const response = await interaction.editReply({ embeds: [initialEmbed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });

        collector.on('collect', async i => {
            if (i.customId !== 'help_category') return;
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '❌ Solo quien ejecutó el comando puede usar el menú.', flags: [64] });
            }

            const category = i.values[0];
            const newEmbed = new EmbedBuilder().setColor(0xD4AF37).setTimestamp();

            switch (category) {
                case 'economy':
                    newEmbed.setTitle('🏦 Banco & Economía')
                        .setDescription('**Comandos financieros básicos del Bot de Economía**')
                        .addFields(
                            { name: '`/perfil`', value: 'Ver tu saldo completo, DNI, licencias, empresas y patrimonio total.' },
                            { name: '`/debito`', value: 'Panel de cajero: depositar, retirar y ver tarjeta de débito.' },
                            { name: '`/transferir`', value: 'Transferir dinero a otro ciudadano (banco a banco).' },
                            { name: '`/depositar`', value: 'Enviar efectivo a terceros (OXXO/físico).' },
                            { name: '`/colectar`', value: 'Reclamar tus salarios acumulados y beneficios.' },
                            { name: '`/fichar`', value: 'Iniciar o terminar tu turno de trabajo oficial.' },
                            { name: '`/saldo`', value: 'Ver balance rápido de efectivo y banco.' }
                        );
                    break;
                case 'credit':
                    newEmbed.setTitle('💳 Crédito & Deudas')
                        .setDescription('**Sistema de tarjetas de crédito y buró**')
                        .addFields(
                            { name: '`/credito estado`', value: 'Ver tu deuda actual, límite disponible y próximo pago.' },
                            { name: '`/credito pagar`', value: 'Abonar dinero desde tu banco a la tarjeta de crédito.' },
                            { name: '`/credito info`', value: 'Detalles de tu tarjeta: límite, interés, tier.' },
                            { name: '`/credito buro`', value: 'Consultar tu score financiero (0-850) y nivel crediticio.' },
                            { name: '`/credito upgrade`', value: 'Mejorar tu tarjeta a un tier superior (hasta Platino Elite).' },
                            { name: '`/top-morosos`', value: 'Ranking de ciudadanos con mayor deuda pendiente.' },
                            { name: '**Tiers Disponibles:**', value: 'Básica → Oro → Diamante → **Zafiro** → **Platino Elite**' }
                        );
                    break;
                case 'business':
                    newEmbed.setTitle('🏢 Empresas & Negocios')
                        .setDescription('**Sistema empresarial completo con gestión avanzada**')
                        .addFields(
                            { name: '`/empresa crear`', value: 'Abrir un negocio propio ($250k de trámite inicial).' },
                            { name: '`/empresa menu`', value: 'Panel de control: ver saldo, nóminas y estadísticas.' },
                            { name: '`/empresa cobrar`', value: 'Terminal POS para cobrar a clientes físicos.' },
                            { name: '`/empresa contratar`', value: '**NUEVO** - Contratar empleados para tu empresa (máx 10).' },
                            { name: '`/empresa despedir`', value: '**NUEVO** - Despedir empleados de tu plantilla.' },
                            { name: '`/empresa empleados`', value: '**NUEVO** - Ver lista completa de empleados y salarios.' },
                            { name: '`/empresa salario`', value: '**NUEVO** - Ajustar salario de un empleado específico.' },
                            { name: '`/empresa reporte`', value: '**NUEVO** - Ver reporte financiero mensual completo.' },
                            { name: '`/nomina`', value: 'Gestionar grupos de pago masivos y sueldos.' }
                        );
                    break;
                case 'invest':
                    newEmbed.setTitle('📈 Inversiones & Bolsa')
                        .setDescription('**Mercado de valores y ahorro**')
                        .addFields(
                            { name: '`/bolsa ver`', value: 'Ver precios actuales de acciones en tiempo real.' },
                            { name: '`/bolsa comprar`', value: 'Comprar acciones de empresas disponibles.' },
                            { name: '`/bolsa vender`', value: 'Vender tus acciones al precio actual del mercado.' },
                            { name: '`/inversion crear`', value: 'Abrir plazo fijo con rendimiento garantizado.' },
                            { name: '`/stake`', value: 'Bloquear ahorros para ganar intereses pasivos mensuales.' },
                            { name: '`/divisa`', value: 'Cambio de moneda USD ↔ MXN con tipo de cambio real.' }
                        );
                    break;
                case 'casino':
                    newEmbed.setTitle('🎰 Casino & Diversión')
                        .setDescription('**Entretenimiento y juegos de azar**')
                        .addFields(
                            { name: '`/casino ruleta`', value: 'Apuesta en la ruleta: rojo/negro, números, docenas.' },
                            { name: '`/casino blackjack`', value: 'Juega al 21 contra la casa.' },
                            { name: '`/slots`', value: 'Máquina tragamonedas con jackpot progresivo.' },
                            { name: '`/crimen`', value: 'Actividades ilegales de alto riesgo por dinero rápido.' },
                            { name: '`/trabajar`', value: 'Realizar mini-trabajos legales para ganar efectivo.' },
                            { name: '`/robar`', value: 'Intentar sustraer dinero de otro ciudadano (riesgo de multa).' },
                            { name: '`/jugar`', value: 'Mini-juegos casuales con apuestas pequeñas.' }
                        );
                    break;
                case 'gov':
                    newEmbed.setTitle('🏛️ Gobierno & Ciudadanía')
                        .setDescription('**Comandos del Bot de Gobierno**')
                        .addFields(
                            { name: '`/dni solicitar`', value: 'Crear tu Documento Nacional de Identidad (DNI) oficial.' },
                            { name: '`/dni ver`', value: 'Consultar tu DNI actual con todos los datos.' },
                            { name: '`/visa solicitar`', value: 'Pedir permiso de residencia estadounidense.' },
                            { name: '`/visa procesar`', value: 'Staff: Aprobar/Rechazar solicitudes de visa pendientes.' },
                            { name: '`/american-id`', value: 'Generar ID americana (solo si tienes rol de americano).' },
                            { name: '`/registrar-coche`', value: 'Dar de alta un vehículo nuevo en el censo vehicular.' },
                            { name: '`/gestionar-coche`', value: 'Vender o transferir tus vehículos registrados.' },
                            { name: '`/multar`', value: '**Policía** - Imponer multas viales y administrativas.' }
                        );
                    break;
                case 'police':
                    newEmbed.setTitle('👮 Policía & Justicia')
                        .setDescription('**Sistema policial y penal (Bot de Moderación)**')
                        .addFields(
                            { name: '`/arrestar`', value: '**Policía** - Arrestar ciudadano con artículos del código penal. Auto-kick ERLC.' },
                            { name: '`/fianza calcular`', value: '**NUEVO** - Ver el costo de tu fianza si estás arrestado.' },
                            { name: '`/fianza pagar`', value: '**NUEVO** - Pagar fianza para salir antes del arresto (2x multa).' },
                            { name: '`/mision diaria`', value: '**NUEVO** - Ver tu misión policial del día (solo policías).' },
                            { name: '`/mision completar`', value: '**NUEVO** - Registrar progreso de tu misión activa.' },
                            { name: '`/mision reclamar`', value: '**NUEVO** - Cobrar recompensa al completar 100% de la misión.' },
                            { name: '`/reputacion ver`', value: '**NUEVO** - Ver tu reputación como policía (0-100).' },
                            { name: '`/reputacion top`', value: '**NUEVO** - Ranking de policías con mejor reputación.' },
                            { name: '`/reputacion historial`', value: '**NUEVO** - Ver tu historial completo de reputación.' }
                        );
                    break;
                case 'staff':
                    newEmbed.setTitle('🛡️ Moderación & Staff')
                        .setDescription('**Comandos de moderación y administración**')
                        .addFields(
                            { name: '`/sancion`', value: '**Junta/Admin/Staff** - Sistema profesional de sanciones con múltiples tipos.' },
                            { name: '**Tipos de Sanción:**', value: '• General (Warns, Kicks, Bans)\n• SA (Sanción Administrativa)\n• Notificación (Staff)' },
                            { name: '**Acciones ERLC:**', value: '• Kick ERLC\n• Ban Temporal ERLC (auto-unban)\n• Ban Permanente ERLC' },
                            { name: '**Acciones Discord:**', value: '• Kick Discord (solo Junta)\n• Ban Temporal Discord (auto-unban, solo Junta)\n• Ban Permanente Discord (solo Junta)\n• Timeout/Mute' },
                            { name: '**Blacklists:**', value: '**Solo Junta** - Moderación, Policía, Cartel, Política, Empresas, Total' },
                            { name: '`/ver_warns`', value: 'Ver historial de sanciones de un usuario (con paginación).' },
                            { name: '`/mis_warns`', value: 'Ver tus propias sanciones activas y expiradas.' },
                            { name: '`/apelacion`', value: 'Solicitar revisión de una sanción injusta.' },
                            { name: '`/setup-erlc`', value: '**Admin** - Configurar integración con servidor ERLC.' },
                            { name: '`/mod shift`', value: '**Policía** - Iniciar/Terminar turno en ERLC con tracking.' },
                            { name: '`/verificar`', value: 'Vincular cuenta de Discord con Roblox (obligatorio).' }
                        );
                    break;
                case 'social':
                    newEmbed.setTitle('⭐ Social & Progreso')
                        .setDescription('**Sistema de niveles, logros y reputación**')
                        .addFields(
                            { name: '`/nivel`', value: 'Ver tu nivel actual, EXP y próximo rango.' },
                            { name: '`/logros`', value: 'Ver tus retos completados y pendientes.' },
                            { name: '`/reputacion dar`', value: '**Junta** - Otorgar puntos de reputación a policías destacados.' },
                            { name: '`/top`', value: 'Rankings de dinero, nivel, empresas y más.' },
                            { name: '`/ping` / `/status`', value: 'Ver latencia del bot y estado de sistemas.' },
                            { name: '`/info`', value: 'Información general del servidor y estadísticas.' }
                        );
                    break;
            }

            await i.update({ embeds: [newEmbed], components: [row] });
        });

        collector.on('end', () => {
            // Optional: Disable menu on timeout
        });
    }
};
