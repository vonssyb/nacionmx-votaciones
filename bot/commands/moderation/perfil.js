const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('👤 Ver tu perfil económico y registros en Nación MX')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Ver el perfil de otro usuario (opcional)')
                .setRequired(false)),

    async execute(interaction, client, supabase) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const isOwnProfile = targetUser.id === interaction.user.id;

        try {
            // Fetch Economy Data from UnbelievaBoat API
            const UnbelievaBoatService = require('../services/UnbelievaBoatService');
            const ubToken = process.env.UNBELIEVABOAT_TOKEN;

            if (!ubToken) {
                console.error('[perfil] UNBELIEVABOAT_TOKEN not configured');
                return interaction.editReply('❌ Error de configuración del bot.');
            }

            const ubService = new UnbelievaBoatService(ubToken);

            let cash = 0, bank = 0;

            try {
                const balance = await ubService.getUserBalance(interaction.guildId, targetUser.id);
                cash = balance.cash || 0;
                bank = balance.bank || 0;
                console.log('[perfil] UnbelievaBoat balance:', { userId: targetUser.id, cash, bank });
            } catch (ubError) {
                console.error('[perfil] Error fetching UnbelievaBoat balance:', ubError.message);
                // Continue with 0 if API fails
            }

            const total = cash + bank;

            // Fetch Credit Card
            const { data: creditCards } = await supabase
                .from('credit_cards')
                .select('card_type, available_limit, used_limit, total_limit')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .eq('active', true);

            const creditCard = creditCards?.[0];

            // Fetch Licenses
            const member = await interaction.guild.members.fetch(targetUser.id);
            const licenses = [];

            const licenseRoles = {
                '1413543909761614005': '🚗 Licencia de Conducir',
                '1413543907110682784': '🔫 Licencia de Armas Cortas',
                '1413541379803578431': '🎯 Licencia de Armas Largas'
            };

            for (const [roleId, licenseName] of Object.entries(licenseRoles)) {
                if (member.roles.cache.has(roleId)) {
                    licenses.push(licenseName);
                }
            }

            // Fetch Sanctions (last 5)
            const { data: sanctions } = await supabase
                .from('sanctions')
                .select('sanction_type, reason, created_at')
                .eq('user_id', targetUser.id)
                .order('created_at', { ascending: false })
                .limit(5);

            // Fetch Active Store Passes
            const { data: passes } = await supabase
                .from('store_purchases')
                .select('item_name, expires_at, uses_remaining')
                .eq('user_id', targetUser.id)
                .eq('active', true)
                .gt('expires_at', new Date().toISOString());

            // Build Embed
            const embed = new EmbedBuilder()
                .setTitle(`${isOwnProfile ? '👤 Tu Perfil' : `👤 Perfil de ${targetUser.tag}`}`)
                .setColor('#00AAC0')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTimestamp();

            // Economy Section - Enhanced Display
            let economyText = `💵 **EFECTIVO:** $${cash.toLocaleString()}\n`;
            economyText += `🏦 **BANCO / DÉBITO:** $${bank.toLocaleString()}`;

            if (creditCard) {
                const available = creditCard.available_limit || 0;
                const used = creditCard.used_limit || 0;
                const creditTotal = total + available;

                economyText += `\n\n💳 **CRÉDITO**\n`;
                economyText += `Disponible: $${available.toLocaleString()}\n`;
                economyText += `Deuda: $${used.toLocaleString()}`;

                economyText += `\n\n📊 **PATRIMONIO TOTAL**\n`;
                economyText += `✅ $${creditTotal.toLocaleString()}`;
            } else {
                economyText += `\n\n📊 **PATRIMONIO TOTAL**\n`;
                economyText += `✅ $${total.toLocaleString()}`;
            }

            embed.addFields({ name: '💼 Economía', value: economyText, inline: false });

            // Licenses Section
            if (licenses.length > 0) {
                embed.addFields({
                    name: '🪪 Licencias Activas',
                    value: licenses.join('\n'),
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '🪪 Licencias Activas',
                    value: 'Sin licencias registradas',
                    inline: false
                });
            }

            // Active Passes Section
            if (passes && passes.length > 0) {
                const passText = passes.map(p => {
                    const expires = new Date(p.expires_at);
                    const remaining = p.uses_remaining
                        ? ` (${p.uses_remaining} usos)`
                        : ` (hasta ${expires.toLocaleDateString('es-MX')})`;
                    return `${p.item_name}${remaining}`;
                }).join('\n');

                embed.addFields({
                    name: '🎫 Pases Activos',
                    value: passText,
                    inline: false
                });
            }

            // Sanctions Section (only show own if viewing own profile, or if staff)
            const juntaDirectivaRoleId = '1412882245735420006';
            const isStaff = interaction.member.roles.cache.has(juntaDirectivaRoleId) ||
                interaction.member.permissions.has('Administrator');

            if ((isOwnProfile || isStaff) && sanctions && sanctions.length > 0) {
                const sanctionText = sanctions.map(s => {
                    const date = new Date(s.created_at).toLocaleDateString('es-MX');
                    return `⚠️ **${s.sanction_type}** (${date})\n   ${s.reason}`;
                }).join('\n\n');

                embed.addFields({
                    name: '📋 Historial de Sanciones (Últimas 5)',
                    value: sanctionText.substring(0, 1024), // Discord limit
                    inline: false
                });
            } else if ((isOwnProfile || isStaff) && (!sanctions || sanctions.length === 0)) {
                embed.addFields({
                    name: '📋 Historial de Sanciones',
                    value: '✅ Registro limpio',
                    inline: false
                });
            }

            embed.setFooter({
                text: isOwnProfile
                    ? 'Tu información personal en Nación MX'
                    : `Información solicitada por ${interaction.user.tag}`
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[perfil] Critical Error:', error);
            console.error('[perfil] Stack:', error.stack);
            await interaction.editReply('❌ Error al cargar el perfil. Intenta de nuevo más tarde.');
        }
    }
};
