const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('owner_debug')
        .setDescription('🛠️ Diagnóstico profundo del sistema (Solo Owner)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, supabase) {
        // 1. Critical Security Check: ONLY OWNER
        const OWNER_ID = '826637667718266880';
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({
                content: '⛔ **ACCESO DENEGADO**\nEstado: `ALERT_UNAUTHORIZED_ACCESS_ATTEMPT`\nIncident reported.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const botMember = await interaction.guild.members.fetchMe();
        const botHighest = botMember.roles.highest;
        const issues = [];
        const warnings = [];
        const info = [];

        // --- CONFIGURED ROLES TO MONITOR ---
        const CRITICAL_ROLES = [
            { name: 'Tercer al Mando', id: '1458597791906533477', singleton: true },
            { name: 'Junta Directiva', id: '1412882245735420006', singleton: false }, // Usually few
            { name: 'Administración', id: '1412882248411381872', singleton: false },
            { name: 'Moderador', id: '1412887079612059660', singleton: false },
            { name: 'Staff en Entrenamiento', id: '1457558479287091417', singleton: false },
            { name: 'Rank Lock', id: '1457897953376207021', singleton: false }
        ];

        // 2. Hierarchy Diagnostics
        info.push(`🤖 **Bot Rol:** ${botHighest.name} (Posición: ${botHighest.position})`);

        for (const roleDef of CRITICAL_ROLES) {
            const role = interaction.guild.roles.cache.get(roleDef.id);
            if (!role) {
                issues.push(`❌ **Falta Rol:** ${roleDef.name} (ID: ${roleDef.id}) no existe en el servidor.`);
                continue;
            }

            // A. Position Check
            if (role.position >= botHighest.position) {
                issues.push(`🛑 **BLOQUEO JERARQUÍA:** El rol **${role.name}** está ENCIMA (o igual) al bot.\n   👉 **Solución:** Arrastra el rol del bot por encima de ${role.name} en Ajustes > Roles.`);
            } else {
                info.push(`✅ Control sobre **${role.name}**: OK`);
            }

            // B. Singleton Check (Only 1 allowed?)
            if (roleDef.singleton) {
                if (role.members.size > 1) {
                    const names = role.members.map(m => m.user.tag).join(', ');
                    issues.push(`⚠️ **VIOLACIÓN LÍMITE:** El rol único **${roleDef.name}** tiene ${role.members.size} usuarios: ${names}.\n   👉 **Solución:** Degrada a los sobrantes.`);
                } else if (role.members.size === 1) {
                    info.push(`👤 **${roleDef.name}:** Ocupado por ${role.members.first().user.tag} (Correcto)`);
                } else {
                    info.push(`⚪ **${roleDef.name}:** Vacante`);
                }
            }
        }

        // 3. Database Conection Check (Indirect)
        try {
            const { error } = await supabase.from('users').select('count').limit(1).maybeSingle();
            if (error) throw error;
            info.push('💾 **Base de Datos:** Conectada y respondiendo.');
        } catch (dbErr) {
            issues.push(`🔥 **ERROR CRÍTICO DB:** No hay conexión con Supabase. (${dbErr.message})`);
        }

        // 4. ERLC API TOKEN Check
        if (!process.env.ERLC_API_KEY) {
            warnings.push('⚠️ **ERLC API:** No configures API Key. Comandos in-game fallarán.');
        } else {
            info.push('🚓 **ERLC API:** Key configurada.');
        }

        // 5. Construct Report
        const embed = new EmbedBuilder()
            .setTitle('🛠️ REPORTE DE DIAGNÓSTICO (OWNER)')
            .setColor(issues.length > 0 ? '#FF0000' : (warnings.length > 0 ? '#FFA500' : '#00FF00'))
            .setTimestamp();

        if (issues.length > 0) {
            embed.addFields({ name: '🚨 PROBLEMAS CRÍTICOS (ACCIÓN REQUERIDA)', value: issues.join('\n\n') });
        } else {
            embed.addFields({ name: '✨ Estado Crítico', value: '✅ Todo en orden. El sistema de rangos debería funcionar perfectamente.' });
        }

        if (warnings.length > 0) {
            embed.addFields({ name: '⚠️ Advertencias', value: warnings.join('\n') });
        }

        embed.addFields({ name: 'ℹ️ Información del Sistema', value: info.join('\n') });
        embed.setFooter({ text: `Solicitado por ${interaction.user.tag}` });

        await interaction.editReply({ embeds: [embed] });
    }
};
