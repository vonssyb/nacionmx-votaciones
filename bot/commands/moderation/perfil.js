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
                // Add explicit timeout for external API
                const balancePromise = ubService.getUserBalance(interaction.guildId, targetUser.id);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('UB Timeout')), 3000));

                const balance = await Promise.race([balancePromise, timeoutPromise]);
                cash = balance.cash || 0;
                bank = balance.bank || 0;
                console.log('[perfil] UnbelievaBoat balance:', { userId: targetUser.id, cash, bank });
            } catch (ubError) {
                console.error('[perfil] Error fetching UnbelievaBoat balance:', ubError.message);
                // Continue with 0 if API fails
                await interaction.followUp({ content: '⚠️ Alerta: No se pudo verificar el saldo en tiempo real (UnbelievaBoat lento).', ephemeral: true });
            }

            const total = cash + bank;

            // Fetch Credit Card
            // Fetch DNI
            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('name, date_of_birth')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .maybeSingle();

            // Fetch Vehicle Count
            const { count: vehicleCount } = await supabase
                .from('vehicles')
                .select('*', { count: 'exact', head: true })
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id);

            // Check Arrest Status
            const ARRESTED_ROLE_ID = '1413540729623679056';
            const isArrestedRole = member.roles.cache.has(ARRESTED_ROLE_ID);

            // 2nd Check: Active DB Entry (optional but safer)
            const { data: activeArrest } = await supabase
                .from('arrests')
                .select('release_time, reason')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .gt('release_time', new Date().toISOString())
                .maybeSingle();

            // Build Embed
            const embed = new EmbedBuilder()
                .setTitle(`${isOwnProfile ? '👤 Tu Perfil Ciudadano' : `👤 Perfil de ${targetUser.username}`}`)
                .setColor(isArrestedRole ? '#FF0000' : '#00AAC0') // Red if arrested
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTimestamp();

            // 1. Identity Section
            const birthDate = dni?.date_of_birth
                ? new Date(dni.date_of_birth).toLocaleDateString('es-MX')
                : 'No registrado';

            const arrestStatus = isArrestedRole
                ? `🚨 **ARRESTADO** (Hasta: ${activeArrest ? new Date(activeArrest.release_time).toLocaleString('es-MX') : 'Indefinido'})`
                : '✅ Libre';

            embed.addFields({
                name: '🆔 Identidad',
                value: `**Nombre:** ${dni?.name || 'Ciudadano sin DNI'}\n**Nacimiento:** ${birthDate}\n**Estado Legal:** ${arrestStatus}`,
                inline: false
            });

            // 2. Assets Section
            embed.addFields({
                name: '🚗 Patrominio',
                value: `**Vehículos Registrados:** ${vehicleCount || 0}`,
                inline: true
            });

            // Economy Section - Enhanced Display
            let economyText = `💵 **EFECTIVO:** $${cash.toLocaleString()}\n`;
            economyText += `🏦 **BANCO / DÉBITO:** $${bank.toLocaleString()}`;

            if (creditCard) {
                const available = creditCard.available_limit || 0;
                const used = creditCard.used_limit || 0;
                const creditTotal = total + available;

                economyText += `\n💳 **CRÉDITO:** Disponible $${available.toLocaleString()}`;

                embed.addFields({ name: '💼 Finanzas', value: economyText, inline: false });
            } else {
                embed.addFields({ name: '💼 Finanzas', value: economyText, inline: false });
            }

            // Licenses Section
            if (licenses.length > 0) {
                embed.addFields({
                    name: '🪪 Licencias',
                    value: licenses.join('\n'),
                    inline: true
                });
            }

            // Active Passes Section
            if (passes && passes.length > 0) {
                const passText = passes.map(p => {
                    const expires = new Date(p.expires_at);
                    const remaining = p.uses_remaining
                        ? ` (${p.uses_remaining} usos)`
                        : ` (Vence: ${expires.toLocaleDateString('es-MX')})`;
                    return `• ${p.item_name}${remaining}`;
                }).join('\n');

                embed.addFields({
                    name: '🎫 Pases',
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
