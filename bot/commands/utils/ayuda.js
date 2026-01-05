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

        const response = await interaction.reply({ embeds: [initialEmbed], components: [row] });

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
                            { name: '`/debito estado`', value: 'Ver tu saldo bancario y número de tarjeta.' },
                            { name: '`/debito depositar`', value: 'Depositar efectivo a tu cuenta (Inmediato).' },
                            { name: '`/debito retirar`', value: 'Retirar dinero del banco (Inmediato).' },
                            { name: '`/debito transferir`', value: 'Transferir a otro usuario (Banco a Banco, 5 min).' },
                            { name: '`/transferir`', value: 'Transferencia SPEI inmediata (Solo Banco).' },
                            { name: '`/depositar`', value: 'Depósito en efectivo a terceros (OXXO, 4 horas).' },
                            { name: '`/giro`', value: 'Envío de efectivo por paquetería (24 horas).' }
                        );
                    break;
                case 'credit':
                    newEmbed.setTitle('💳 Crédito & Deudas')
                        .addFields(
                            { name: '`/credito info`', value: 'Ver estado de cuenta, límite y corte.' },
                            { name: '`/credito pagar`', value: 'Pagar deuda de tarjeta.' },
                            { name: '`/credito buro`', value: 'Ver tu historial crediticio.' },
                            { name: '`/top-morosos`', value: 'Ver quién debe más en el servidor.' },
                            { name: '`/top-ricos`', value: 'Ver quién tiene mejor Score Crediticio.' }
                        );
                    break;
                case 'business':
                    newEmbed.setTitle('🏢 Empresas & Negocios')
                        .addFields(
                            { name: '`/empresa crear`', value: 'Registrar una nueva empresa ($50k).' },
                            { name: '`/empresa menu`', value: 'Panel de gestión (pagar nómina, ver saldo).' },
                            { name: '`/empresa cobrar`', value: 'Generar cobro para clientes (Terminal POS).' },
                            { name: '`/empresa credito`', value: 'Solicitar crédito empresarial.' }
                        );
                    break;
                case 'invest':
                    newEmbed.setTitle('📈 Inversiones & Bolsa')
                        .addFields(
                            { name: '`/bolsa precios`', value: 'Ver precios de acciones/crypto.' },
                            { name: '`/bolsa comprar`', value: 'Invertir en activos.' },
                            { name: '`/bolsa vender`', value: 'Vender activos.' },
                            { name: '`/bolsa portafolio`', value: 'Ver tus rendimientos.' },
                            { name: '`/inversion nueva`', value: 'Abrir plazo fijo (CDT).' }
                        );
                    break;
                case 'casino':
                    newEmbed.setTitle('🎰 Casino Nación MX')
                        .setDescription('¡Apuesta y gana! La casa (casi) nunca pierde.')
                        .addFields(
                            { name: '`/casino fichas comprar`', value: 'Comprar fichas (1 ficha = $1).' },
                            { name: '`/casino fichas retirar`', value: 'Cambiar fichas por dinero.' },
                            { name: '`/jugar slots`', value: 'Tragamonedas clásica.' },
                            { name: '`/jugar dados`', value: 'Adivina suma (Mayor/Menor).' },
                            { name: '`/jugar ruleta`', value: 'Ruleta (Rojo/Negro/Número).' },
                            { name: '`/jugar crash`', value: '¡Sal antes de que explote!' },
                            { name: '`/jugar caballos`', value: 'Carreras.' },
                            { name: '`/jugar gallos`', value: 'Pelea de gallos.' },
                            { name: '`/jugar rusa`', value: 'Ruleta Rusa (Peligroso).' }
                        );
                    break;
                case 'police':
                    newEmbed.setTitle('👮 Legal & Policial')
                        .addFields(
                            { name: '`/fichar`', value: 'Buscar antecedentes penales (Policía).' },
                            { name: '`/multa`', value: 'Imponer multa (Policía/Juez).' },
                            { name: '`/impuestos pagar`', value: 'Pagar impuestos pendientes.' },
                            { name: '`/licencia registrar`', value: 'Registrar licencia de conducir.' }
                        );
                    break;
                case 'utils':
                    newEmbed.setTitle('⚙️ Utilidades')
                        .addFields(
                            { name: '`/balanza`', value: 'Resumen financiero total (Net Worth).' },
                            { name: '`/notificaciones`', value: 'Activar/desactivar DMs del banco.' },
                            { name: '`/ping`', value: 'Ver latencia del bot.' },
                            { name: '`/rol`', value: 'Asignarse roles de trabajo.' }
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
