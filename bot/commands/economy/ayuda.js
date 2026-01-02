const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('📘 Ver comandos de economía y negocios'),

    async execute(interaction, client, supabase) {
        const initialEmbed = new EmbedBuilder()
            .setTitle('💰 Centro de Ayuda - Nación MX Economy')
            .setColor(0x00FF00) // Green for economy
            .setDescription('**Selecciona una categoría en el menú para ver los comandos disponibles.**\n\nAquí encontrarás información sobre dinero, negocios, inversiones y entretenimiento.')
            .setFooter({ text: 'Usa el menú desplegable para navegar' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('Selecciona una categoría...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Banco & Economía').setDescription('Saldo, Depósitos, Transferencias').setValue('economy').setEmoji('🏦'),
                new StringSelectMenuOptionBuilder().setLabel('Crédito & Tarjetas').setDescription('Solicitar crédito, pagar deudas').setValue('credit').setEmoji('💳'),
                new StringSelectMenuOptionBuilder().setLabel('Empresas & Negocios').setDescription('Crear empresa, nómina, POS').setValue('business').setEmoji('🏢'),
                new StringSelectMenuOptionBuilder().setLabel('Inversiones & Bolsa').setDescription('Comprar acciones, ver portafolio').setValue('invest').setEmoji('📈'),
                new StringSelectMenuOptionBuilder().setLabel('Casino & Juegos').setDescription('Slots, ruleta, apuestas').setValue('casino').setEmoji('🎰'),
                new StringSelectMenuOptionBuilder().setLabel('Gamificación').setDescription('Logros, misiones, niveles').setValue('gamification').setEmoji('🎮'),
                new StringSelectMenuOptionBuilder().setLabel('Utilidades').setDescription('Ping, status, notificaciones').setValue('utils').setEmoji('⚙️'),
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const response = await interaction.reply({ embeds: [initialEmbed], components: [row], ephemeral: false });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });

        collector.on('collect', async i => {
            if (i.customId !== 'help_category') return;
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '❌ Solo quien ejecutó el comando puede usar el menú.', ephemeral: true });
            }

            const category = i.values[0];
            const newEmbed = new EmbedBuilder().setColor(0x00FF00).setTimestamp();

            switch (category) {
                case 'economy':
                    newEmbed.setTitle('🏦 Banco & Economía')
                        .setDescription('Comandos para manejar tu dinero y realizar transacciones.')
                        .addFields(
                            { name: '/saldo', value: 'Ver tu dinero en efectivo y banco', inline: false },
                            { name: '/depositar <cantidad> <usuario>', value: 'Depositar efectivo a cuenta de otro usuario (4hrs)', inline: false },
                            { name: '/giro <cantidad> <usuario>', value: 'Enviar dinero por paquetería (24hrs)', inline: false },
                            { name: '/trabajar', value: 'Trabajar para ganar dinero basado en tu rol', inline: false },
                            { name: '/robar', value: 'Intentar robar a alguien (riesgoso)', inline: false },
                            { name: '/balanza', value: 'Ver tu patrimonio total (dinero + inversiones + empresas)', inline: false },
                            { name: '/movimientos', value: 'Ver historial de transacciones', inline: false },
                            { name: '/notificaciones', value: 'Configurar alertas del sistema económico', inline: false }
                        );
                    break;
                case 'credit':
                    newEmbed.setTitle('💳 Crédito & Tarjetas')
                        .setDescription('Solicita crédito, maneja tus tarjetas y paga tus deudas.')
                        .addFields(
                            { name: '/registrar-tarjeta', value: 'Solicitar una tarjeta de débito o crédito', inline: false },
                            { name: '/tarjeta', value: 'Ver información de tu tarjeta actual', inline: false },
                            { name: '/credito pagar <cantidad>', value: 'Pagar deuda de tarjeta de crédito', inline: false },
                            { name: '/credito info', value: 'Ver estado de cuenta y límite de crédito', inline: false },
                            { name: '/top-morosos', value: 'Ver usuarios con más deudas', inline: false },
                            { name: '/top-ricos', value: 'Ver usuarios con mejor score crediticio', inline: false }
                        );
                    break;
                case 'business':
                    newEmbed.setTitle('🏢 Empresas & Negocios')
                        .setDescription('Crea y administra tu empresa, contrata empleados y genera ingresos.')
                        .addFields(
                            { name: '/empresa crear <nombre>', value: 'Crear una empresa nueva ($50,000)', inline: false },
                            { name: '/empresa menu', value: 'Panel de gestión de tu empresa', inline: false },
                            { name: '/empresa cobrar <cantidad> <usuario>', value: 'Generar cobro con terminal POS', inline: false },
                            { name: '/nomina', value: 'Pagar nómina a empleados de tu empresa', inline: false },
                            { name: '/business', value: 'Ver estadísticas de todas las empresas', inline: false }
                        );
                    break;
                case 'invest':
                    newEmbed.setTitle('📈 Inversiones & Bolsa')
                        .setDescription('Invierte en acciones, criptomonedas y plazos fijos.')
                        .addFields(
                            { name: '/bolsa precios', value: 'Ver precios actuales de acciones y crypto', inline: false },
                            { name: '/bolsa comprar <símbolo> <cantidad>', value: 'Comprar acciones o crypto', inline: false },
                            { name: '/bolsa vender <símbolo> <cantidad>', value: 'Vender tus inversiones', inline: false },
                            { name: '/bolsa portafolio', value: 'Ver tu cartera de inversiones y rendimiento', inline: false },
                            { name: '/inversion nueva <monto> <plazo>', value: 'Crear plazo fijo (CDT) con intereses', inline: false },
                            { name: '/impuestos pagar', value: 'Pagar impuestos pendientes', inline: false }
                        );
                    break;
                case 'casino':
                    newEmbed.setTitle('🎰 Casino & Juegos')
                        .setDescription('¡Apuesta y gana! Diversos juegos de azar disponibles.')
                        .addFields(
                            { name: '/casino fichas comprar <cantidad>', value: 'Comprar fichas para jugar (1 ficha = $1)', inline: false },
                            { name: '/casino fichas retirar', value: 'Cambiar tus fichas por dinero', inline: false },
                            { name: '/slots <apuesta>', value: 'Jugar en las tragamonedas', inline: false },
                            { name: '/stake <apuesta>', value: 'Apostar en juego de multiplicador', inline: false },
                            { name: '/jugar <juego> <apuesta>', value: 'Juegos: dados, ruleta, caballos, gallos, crash', inline: false },
                            { name: '/crimen', value: 'Cometer un crimen (alto riesgo, alta recompensa)', inline: false }
                        );
                    break;
                case 'gamification':
                    newEmbed.setTitle('🎮 Gamificación')
                        .setDescription('Completa misiones, desbloquea logros y sube de nivel.')
                        .addFields(
                            { name: '/nivel', value: 'Ver tu nivel actual y experiencia', inline: false },
                            { name: '/logros', value: 'Ver todos los logros disponibles y tu progreso', inline: false },
                            { name: '/misiones', value: 'Ver misiones activas y reclamar recompensas', inline: false }
                        );
                    break;
                case 'utils':
                    newEmbed.setTitle('⚙️ Utilidades')
                        .setDescription('Comandos generales y de configuración.')
                        .addFields(
                            { name: '/ping', value: 'Ver latencia del bot', inline: false },
                            { name: '/status', value: 'Ver estado del sistema económico', inline: false },
                            { name: '/info', value: 'Información del servidor y economía', inline: false },
                            { name: '/ayuda', value: 'Mostrar este menú de ayuda', inline: false },
                            { name: '/privacidad', value: 'Configurar privacidad de tu información económica', inline: false },
                            { name: '/fondos', value: 'Ver fondos disponibles en el sistema', inline: false }
                        );
                    break;
            }

            await i.update({ embeds: [newEmbed], components: [row] });
        });

        collector.on('end', () => {
            // Optional cleanup
        });
    }
};
