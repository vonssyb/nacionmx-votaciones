const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('📖 Menú de ayuda y lista de comandos'),

    async execute(interaction) {
        // Embed inicial
        const initialEmbed = new EmbedBuilder()
            .setTitle('📖 Centro de Ayuda NacionMX')
            .setDescription('Selecciona una categoría en el menú de abajo para ver los comandos disponibles.')
            .setColor('#3498DB')
            .addFields(
                { name: '🎰 Casino', value: 'Juegos de azar, fichas y apuestas PvP.', inline: true },
                { name: '🏢 Empresa', value: 'Gestión de negocios, empleados y finanzas.', inline: true },
                { name: '💰 Economía', value: 'Trabajos, crímenes, banco y balance.', inline: true },
                { name: '🛠️ Utilidad', value: 'Herramientas y configuraciones.', inline: true }
            )
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({ text: 'NacionMX Bot System' });

        // Select Menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_select')
            .setPlaceholder('Selecciona una categoría...')
            .addOptions(
                {
                    label: 'Casino & Juegos',
                    description: 'Ruleta, Tragamonedas, Blackjack, PvP',
                    value: 'help_casino',
                    emoji: '🎰'
                },
                {
                    label: 'Empresas',
                    description: 'Gestión empresarial completa',
                    value: 'help_empresa',
                    emoji: '🏢'
                },
                {
                    label: 'Economía Global',
                    description: 'Trabajos, Banco, Perfil',
                    value: 'help_economy',
                    emoji: '💰'
                },
                {
                    label: 'Utilidad & Otros',
                    description: 'Reportes, Configuración, Info',
                    value: 'help_utils',
                    emoji: '🛠️'
                }
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const message = await interaction.reply({ embeds: [initialEmbed], components: [row], fetchReply: true });

        // Collector
        const filter = i => i.user.id === interaction.user.id;
        const collector = message.createMessageComponentCollector({ componentType: ComponentType.StringSelect, filter, time: 60000 });

        collector.on('collect', async i => {
            const selection = i.values[0];
            let embed;

            if (selection === 'help_casino') {
                embed = new EmbedBuilder()
                    .setTitle('🎰 Comandos de Casino')
                    .setColor('#E67E22')
                    .addFields(
                        { name: '/fichas comprar', value: 'Compra fichas con botones interactivos.', inline: false },
                        { name: '/fichas vender', value: 'Cambia tus fichas por dinero (Efectivo/Banco).', inline: false },
                        { name: '/ruleta <apuesta> <color/número>', value: 'Apuesta en la ruleta clásica. (Rojo/Negro/Verde o 0-36)', inline: false },
                        { name: '/tragamonedas <apuesta>', value: 'Juega en la máquina de slots.', inline: false },
                        { name: '/blackjack <apuesta>', value: 'Juega al 21 contra la casa.', inline: false },
                        { name: '/pvp dados <usuario> <monto>', value: 'Reto de dados contra otro jugador.', inline: false },
                        { name: '/pvp rps <usuario> <monto>', value: 'Piedra, Papel o Tijeras PvP.', inline: false },
                        { name: '/pvp coinflip <usuario> <monto>', value: 'Cara o Cruz PvP.', inline: false }
                    );
            } else if (selection === 'help_empresa') {
                embed = new EmbedBuilder()
                    .setTitle('🏢 Comandos de Empresa')
                    .setColor('#9B59B6')
                    .addFields(
                        { name: '/empresa crear', value: 'Inicia tu propia empresa.', inline: false },
                        { name: '/empresa dashboard', value: 'Panel principal de tu negocio.', inline: false },
                        { name: '/empresa contratar <usuario>', value: 'Contrata a un empleado.', inline: false },
                        { name: '/empresa trabajar', value: 'Realiza tareas laborales (Empleado).', inline: false },
                        { name: '/empresa finanzas', value: 'Ver estado financiero y nómina.', inline: false }
                    );
            } else if (selection === 'help_economy') {
                embed = new EmbedBuilder()
                    .setTitle('💰 Comandos de Economía')
                    .setColor('#2ECC71')
                    .addFields(
                        { name: '/balance', value: 'Ver tu dinero en banco y efectivo.', inline: false },
                        { name: '/trabajar', value: 'Trabajo genérico para ganar dinero rápido.', inline: false },
                        { name: '/crimen', value: 'Alto riesgo, alta recompensa (o cárcel).', inline: false },
                        { name: '/deposito', value: 'Deposita dinero en el banco.', inline: false },
                        { name: '/retirar', value: 'Retira dinero del banco.', inline: false },
                        { name: '/perfil', value: 'Ver tu nivel, XP y reputación.', inline: false }
                    );
            } else if (selection === 'help_utils') {
                embed = new EmbedBuilder()
                    .setTitle('🛠️ Utilidad & Otros')
                    .setColor('#95A5A6')
                    .addFields(
                        { name: '/ayuda', value: 'Muestra este menú.', inline: false },
                        { name: '/ping', value: 'Ver latencia del bot.', inline: false },
                        { name: '/reporte', value: 'Reportar un bug o jugador.', inline: false }
                    );
            }

            if (embed) {
                await i.update({ embeds: [embed], components: [row] });
            }
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => { });
        });
    }
};
