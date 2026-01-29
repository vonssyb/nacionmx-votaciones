const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('📊 Ver el estado del sistema y salud del bot'),

    async execute(interaction, client, supabase) {
        await interaction.deferReply();

        try {
            // Helper functions (inline for now as they are simple)
            const formatDuration = (ms) => {
                const seconds = Math.floor((ms / 1000) % 60);
                const minutes = Math.floor((ms / (1000 * 60)) % 60);
                const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
                const days = Math.floor(ms / (1000 * 60 * 60 * 24));
                return `${days}d ${hours}h ${minutes}m ${seconds}s`;
            };

            const formatNumber = (num) => {
                return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            };

            // Bot uptime
            const uptime = formatDuration(process.uptime() * 1000);

            // Access services from client
            const billingService = client.services?.billing;

            // Cache stats (if available)
            let cacheStats = 'N/A';
            try {
                if (billingService?.ubService?.getCacheStats) {
                    const stats = billingService.ubService.getCacheStats();
                    cacheStats = `${stats.hits}/${stats.hits + stats.misses}`;
                }
            } catch (e) {
                // Ignore cache error
            }

            // Database connection test
            let dbStatus = '🟢 Online';
            try {
                const { count, error } = await supabase
                    .from('debit_cards')
                    .select('*', { count: 'exact', head: true });

                if (error) throw error;
                dbStatus = `🟢 Online (${count || 0} cards)`;
            } catch (e) {
                console.error(e);
                dbStatus = '🔴 Error/Slow';
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
                        value: `\`\`\`\nUptime: ${uptime}\nMemory: ${memUsed}MB / ${memTotal}MB\nServers: ${guildCount}\nUsers: ${formatNumber(userCount)}\n\`\`\``,
                        inline: true
                    },
                    {
                        name: '🗄️ Database',
                        value: `\`\`\`\nStatus: ${dbStatus}\nCache: ${cacheStats}\n\`\`\``,
                        inline: true
                    },
                    {
                        name: '⚡ Performance',
                        value: `\`\`\`\nPing: ${client.ws.ping}ms\nVersion: Node ${process.version}\n\`\`\``,
                        inline: false
                    },
                    {
                        name: '🔗 Links',
                        value: '[Dashboard](https://nacionmx-portal.onrender.com) • [Soporte](https://discord.gg/nacionmx)',
                        inline: false
                    }
                ],
                footer: {
                    text: 'NacionMX Banking System',
                    icon_url: interaction.guild?.iconURL()
                },
                timestamp: new Date()
            };

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /status:', error);
            await interaction.editReply('❌ Error al obtener el estado del sistema.');
        }
    }
};
