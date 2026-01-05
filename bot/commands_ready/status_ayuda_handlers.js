// Quick Wins Commands - /status and /ayuda handlers
// Add this code to bot/index.js after other command handlers

// ===================================================================
// COMANDO: /status
// Quick Win #22 - Bot Health & System Stats
// ===================================================================
/*
else if (commandName === 'status') {
    await interaction.deferReply();

    try {
        const { formatNumber, formatDuration } = require('./utils/formatters');

        // Bot uptime
        const uptime = formatDuration(process.uptime() * 1000);

        // Cache stats (if available)
        let cacheStats = 'N/A';
        try {
            const stats = billingService.ubService.getCacheStats();
            cacheStats = `${stats.hits}/${stats.hits + stats.misses} (${stats.hitRate})`;
        } catch (e) {}

        // Database connection test
        let dbStatus = '🟢 Online';
        try {
            const { count } = await supabase
                .from('debit_cards')
                .select('*', { count: 'exact', head: true });
            dbStatus = `🟢 Online (${count || 0} cards)`;
        } catch (e) {
            dbStatus = '🔴 Error';
        }

        // Memory usage
        const memUsage = process.memoryUsage();
        const memUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
        const memTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);

        // Discord stats
        const guildCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

        const embed = {
            color: 0xFFD700,
            title: '📊 Estado del Bot - NacionMX',
            fields: [
                {
                    name: '🤖 Bot Status',
                    value: `\`\`\`
Uptime: ${uptime}
Memory: ${memUsed}MB / ${memTotal}MB
Servers: ${guildCount}
Users: ${formatNumber(userCount)}
\`\`\``,
                    inline: true
                },
                {
                    name: '🗄️ Database',
                    value: `\`\`\`
Status: ${dbStatus}
Cache: ${cacheStats}
\`\`\``,
                    inline: true
                },
                {
                    name: '⚡ Performance',
                    value: `\`\`\`
Ping: ${client.ws.ping}ms
Version: Node ${process.version}
\`\`\``,
                    inline: false
                },
                {
                    name: '🔗 Links',
                    value: '[Dashboard](https://tu-dashboard.vercel.app) • [Soporte](https://discord.gg/nacionmx)',
                    inline: false
                }
            ],
            footer: {
                text: 'NacionMX Banking System',
                icon_url: interaction.guild.iconURL()
            },
            timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in /status:', error);
        await interaction.editReply('❌ Error al obtener el estado del sistema.');
    }
}
*/

// ===================================================================
// COMANDO: /ayuda
// Quick Win #24 - Interactive Help System
// ===================================================================
/*
else if (commandName === 'ayuda') {
    const categoria = interaction.options.getString('categoria');

    const helpData = {
        cards: {
            title: '💳 Comandos de Tarjetas',
            description: 'Gestiona tus tarjetas de débito y crédito',
            commands: [
                { name: '/registrar-tarjeta', desc: 'Abrir una nueva cuenta bancaria' },
                { name: '/debito info', desc: 'Ver información de tu tarjeta de débito' },
                { name: '/debito depositar', desc: 'Depositar dinero en tu cuenta' },
                { name: '/debito transferir', desc: 'Transferir dinero a otro usuario' },
                { name: '/credito solicitar', desc: 'Solicitar una tarjeta de crédito' },
                { name: '/credito info', desc: 'Ver tu tarjeta de crédito' },
                { name: '/credito pagar', desc: 'Pagar tu deuda de crédito' },
            ]
        },
        transactions: {
            title: '💰 Comandos de Transacciones',
            description: 'Realiza operaciones financieras',
            commands: [
                { name: '/transferir', desc: 'Enviar dinero a otro usuario' },
                { name: '/depositar', desc: 'Depositar en tu cuenta' },
                { name: '/retirar', desc: 'Retirar efectivo' },
                { name: '/historial', desc: 'Ver tu historial de transacciones' },
            ]
        },
        companies: {
            title: '🏢 Comandos de Empresas',
            description: 'Gestiona tu empresa y nómina',
            commands: [
                { name: '/empresa crear', desc: 'Crear una nueva empresa' },
                { name: '/empresa info', desc: 'Ver información de tu empresa' },
                { name: '/nomina crear', desc: 'Crear grupo de nómina' },
                { name: '/nomina pagar', desc: 'Pagar nómina a empleados' },
                { name: '/empresa cobrar', desc: 'Cobrar pagos pendientes' },
            ]
        },
        casino: {
            title: '🎰 Comandos de Casino',
            description: 'Juegos y apuestas',
            commands: [
                { name: '/slots', desc: 'Jugar a las tragamonedas' },
                { name: '/blackjack', desc: 'Jugar blackjack contra la casa' },
                { name: '/ruleta', desc: 'Apostar en la ruleta' },
                { name: '/crash', desc: 'Juego de multiplicador crash' },
            ]
        },
        info: {
            title: '📊 Comandos de Información',
            description: 'Consulta información del sistema',
            commands: [
                { name: '/balanza', desc: 'Ver tu balance total' },
                { name: '/status', desc: 'Estado del bot y sistema' },
                { name: '/bolsa', desc: 'Ver inversiones disponibles' },
            ]
        }
    };

    // Si no hay categoría, mostrar menú principal
    if (!categoria) {
        const embed = {
            color: 0xFFD700,
            title: '📚 Sistema de Ayuda - NacionMX',
            description: 'Selecciona una categoría para ver los comandos disponibles.\n\nUsa `/ayuda categoria:[nombre]` para ver comandos específicos.',
            fields: Object.entries(helpData).map(([key, data]) => ({
                name: data.title,
                value: data.description,
                inline: true
            })),
            footer: {
                text: 'Para ayuda detallada: /ayuda categoria:[nombre]'
            }
        };

        return interaction.reply({ embeds: [embed], flags: [64] });
    }

    // Mostrar comandos de categoría específica
    const categoryData = helpData[categoria];
    if (!categoryData) {
        return interaction.reply({
            content: '❌ Categoría no encontrada.',
            flags: [64]
        });
    }

    const embed = {
        color: 0xFFD700,
        title: categoryData.title,
        description: categoryData.description + '\n\n**Comandos disponibles:**',
        fields: categoryData.commands.map(cmd => ({
            name: cmd.name,
            value: cmd.desc,
            inline: false
        })),
        footer: {
            text: 'Usa /ayuda para ver todas las categorías'
        }
    };

    await interaction.reply({ embeds: [embed], flags: [64] });
}
*/

// To add these commands:
// 1. Uncomment the code above
// 2. Place it in the appropriate location in handleExtraCommands function
// 3. Run: node bot/register_commands.js (locally)
// 4. Test the commands in Discord
