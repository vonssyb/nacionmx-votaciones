const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('💰 Ver comandos de Economía y Negocios'),

    async execute(interaction, client, supabase) {
        const initialEmbed = new EmbedBuilder()
            .setTitle('💰 Economía Nación MX - Ayuda')
            .setColor(0xD4AF37) // Gold
            .setDescription('**Sistema Financiero y Empresarial**\nSelecciona una categoría para ver los comandos.')
            .setFooter({ text: 'Bot de Economía' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_eco_category')
            .setPlaceholder('Menú de Economía...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Banco & Efectivo').setDescription('Débito, Transferencias, Saldo').setValue('economy').setEmoji('🏦'),
                new StringSelectMenuOptionBuilder().setLabel('Crédito & Deudas').setDescription('Tarjetas, Buró, Pagos').setValue('credit').setEmoji('💳'),
                new StringSelectMenuOptionBuilder().setLabel('Empresas').setDescription('Gestión de Negocios, Empleados, POS').setValue('business').setEmoji('🏢'),
                new StringSelectMenuOptionBuilder().setLabel('Inversiones').setDescription('Bolsa de Valores, Plazos Fijos').setValue('invest').setEmoji('📈'),
                new StringSelectMenuOptionBuilder().setLabel('Casino & Juegos').setDescription('Ruleta, Slots, Crimen').setValue('casino').setEmoji('🎰'),
                new StringSelectMenuOptionBuilder().setLabel('Seguridad & Privacidad').setDescription('Bóveda, Privacidad, Protección').setValue('privacy').setEmoji('🔐'),
                new StringSelectMenuOptionBuilder().setLabel('Social & Progreso').setDescription('Nivel, Logros, Top').setValue('social').setEmoji('⭐'),
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const response = await interaction.editReply({ embeds: [initialEmbed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });

        collector.on('collect', async i => {
            if (i.customId !== 'help_eco_category') return;
            if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Menú ajeno.', flags: [64] });

            const category = i.values[0];
            const newEmbed = new EmbedBuilder().setColor(0xD4AF37).setTimestamp();

            switch (category) {
                case 'economy':
                    newEmbed.setTitle('🏦 Banco & Efectivo')
                        .addFields(
                            { name: '`/perfil`', value: 'Resumen financiero completo.' },
                            { name: '`/saldo`', value: 'Ver balance rápido.' },
                            { name: '`/debito`', value: 'Cajero: retirar/depositar/ver tarjeta.' },
                            { name: '`/transferir`', value: 'Enviar dinero (banco a banco).' },
                            { name: '`/depositar`', value: 'Enviar efectivo a otro usuario.' },
                            { name: '`/colectar`', value: 'Reclamar ingresos pendientes.' },
                            { name: '`/fichar`', value: 'Control de asistencia laboral.' }
                        );
                    break;
                case 'credit':
                    newEmbed.setTitle('💳 Crédito')
                        .addFields(
                            { name: '`/credito estado`', value: 'Ver deuda y límite.' },
                            { name: '`/credito pagar`', value: 'Abonar a la tarjeta.' },
                            { name: '`/credito info`', value: 'Detalles de tu tarjeta.' },
                            { name: '`/credito buro`', value: 'Score crediticio.' },
                            { name: '`/credito upgrade`', value: 'Mejorar nivel de tarjeta.' },
                            { name: '`/top-morosos`', value: 'Ranking de deudores.' }
                        );
                    break;
                case 'privacy':
                    newEmbed.setTitle('🔐 Seguridad & Privacidad')
                        .addFields(
                            { name: '`/privacidad info`', value: 'Ver nivel de protección actual.' },
                            { name: '`/privacidad comprar`', value: 'Adquirir protección de datos.' },
                            { name: '`/privacidad familia`', value: 'Gestionar acceso familiar.' },
                            { name: '`/boveda`', value: 'Almacenamiento seguro de dinero (anti-robo).' }
                        );
                    break;
                    newEmbed.setTitle('💳 Crédito')
                        .addFields(
                            { name: '`/credito estado`', value: 'Ver deuda y límite.' },
                            { name: '`/credito pagar`', value: 'Abonar a la tarjeta.' },
                            { name: '`/credito info`', value: 'Detalles de tu tarjeta.' },
                            { name: '`/credito buro`', value: 'Score crediticio.' },
                            { name: '`/credito upgrade`', value: 'Mejorar nivel de tarjeta.' },
                            { name: '`/top-morosos`', value: 'Ranking de deudores.' }
                        );
                    break;
                case 'business':
                    newEmbed.setTitle('🏢 Empresas')
                        .addFields(
                            { name: '`/empresa crear`', value: 'Fundar una empresa ($250k).' },
                            { name: '`/empresa menu`', value: 'Panel de gestión.' },
                            { name: '`/empresa cobrar`', value: 'Cobrar a clientes (POS).' },
                            { name: '`/empresa contratar/despedir`', value: 'Gestión de RRHH.' },
                            { name: '`/empresa empleados`', value: 'Lista de personal.' },
                            { name: '`/nomina`', value: 'Pagos masivos.' }
                        );
                    break;
                case 'invest':
                    newEmbed.setTitle('📈 Inversiones')
                        .addFields(
                            { name: '`/bolsa ver`', value: 'Precios del mercado.' },
                            { name: '`/bolsa comprar/vender`', value: 'Trading de acciones.' },
                            { name: '`/inversion crear`', value: 'Plazo fijo.' },
                            { name: '`/stake`', value: 'Cuentas de ahorro.' },
                            { name: '`/divisa`', value: 'Cambio de moneda.' }
                        );
                    break;
                case 'casino':
                    newEmbed.setTitle('🎰 Casino & Ilegal')
                        .addFields(
                            { name: '`/casino ruleta`', value: 'Jugar Ruleta.' },
                            { name: '`/casino blackjack`', value: 'Jugar 21.' },
                            { name: '`/slots`', value: 'Tragamonedas.' },
                            { name: '`/crimen`', value: 'Actividades delictivas.' },
                            { name: '`/trabajar`', value: 'Trabajos rápidos.' },
                            { name: '`/robar`', value: 'Robar a usuarios.' }
                        );
                    break;
                case 'social':
                    newEmbed.setTitle('⭐ Social')
                        .addFields(
                            { name: '`/nivel`', value: 'Ver progreso.' },
                            { name: '`/logros`', value: 'Medallas desbloqueadas.' },
                            { name: '`/top`', value: 'Rankings globales.' },
                            { name: '`/tienda`', value: 'Comprar items.' }
                        );
                    break;
            }
            await i.update({ embeds: [newEmbed], components: [row] });
        });
    }
};
