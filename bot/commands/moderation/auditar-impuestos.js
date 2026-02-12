const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('auditar-impuestos')
        .setDescription('[POLICÍA] Auditar a un ciudadano para detectar evasión fiscal')
        .addUserOption(option =>
            option.setName('ciudadano')
                .setDescription('Ciudadano a auditar')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('ciudadano');
        const supabase = interaction.client.supabaseClient;
        const billingService = interaction.client.services.billing;

        // IDs importantes
        const EVASOR_FISCAL_ROLE_ID = '1449950636371214397';
        const POLICIA_ROLES = [
            '1398525349490118698',  // Policía
            '1398525353026240582',  // SWAT
            '1398525363063799940',  // Sheriff
        ];

        try {
            // 1. Verificar que quien ejecuta sea policía
            const hasPoliceRole = POLICIA_ROLES.some(roleId =>
                interaction.member.roles.cache.has(roleId)
            );

            if (!hasPoliceRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply('❌ Este comando es exclusivo para **Policía**.');
            }

            // 2. Obtener el miembro objetivo con sus roles
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const hasEvasorRole = targetMember.roles.cache.has(EVASOR_FISCAL_ROLE_ID);

            // 3. Si NO tiene el rol de evasor, no puede ser detectado
            if (!hasEvasorRole) {
                const embed = new EmbedBuilder()
                    .setTitle('📋 Auditoría del SAT')
                    .setColor('#00FF00')
                    .setDescription(`**${targetUser.tag}** fue auditado y está **AL CORRIENTE** con sus impuestos.`)
                    .addFields(
                        { name: '✅ Resultado', value: 'Sin irregularidades detectadas', inline: true },
                        { name: '👮 Auditor', value: interaction.user.tag, inline: true }
                    )
                    .setFooter({ text: 'Sistema de Auditoría Fiscal' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // 4. DETECCIÓN ALEATORIA
            // Si tiene rol evasor, hay una probabilidad de detectarlo
            // Obtenemos el historial de evasiones para calcular probabilidad

            const { data: history } = await supabase
                .from('tax_evasion_history')
                .select('evasion_type')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .order('created_at', { ascending: false })
                .limit(10);

            const recentEvasions = (history || []).filter(h => h.evasion_type === 'success').length;
            const recentCaught = (history || []).filter(h => h.evasion_type === 'caught').length;

            // Probabilidad base de detección: 35% para policía
            let detectionProbability = 0.35;
            detectionProbability += recentEvasions * 0.08; // +8% por cada evasión reciente
            detectionProbability = Math.min(detectionProbability, 0.75); // Máximo 75%

            const detectionRoll = Math.random();
            const wasDetected = detectionRoll < detectionProbability;

            // 5. SI NO LO DETECTAN
            if (!wasDetected) {
                const embed = new EmbedBuilder()
                    .setTitle('📋 Auditoría del SAT')
                    .setColor('#FFA500')
                    .setDescription(`**${targetUser.tag}** fue auditado pero **no se encontraron irregularidades** en esta ocasión.`)
                    .addFields(
                        { name: '🔍 Resultado', value: 'Sin pruebas suficientes', inline: true },
                        { name: '👮 Auditor', value: interaction.user.tag, inline: true },
                        { name: '⚠️ Nota', value: 'Los evasores más recurrentes son más fáciles de atrapar', inline: false }
                    )
                    .setFooter({ text: `Probabilidad de detección: ${Math.floor(detectionProbability * 100)}%` })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // 6. ¡LO DETECTARON! Aplicar multa

            // Obtener saldo del evasor
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
            const cash = balance.cash || 0;

            // Calcular impuesto base (sobre efectivo excedente de $1M)
            const TAX_THRESHOLD = 1000000;
            const BASE_TAX_RATE = 0.05;

            let baseTaxAmount = 0;
            if (cash > TAX_THRESHOLD) {
                baseTaxAmount = Math.floor((cash - TAX_THRESHOLD) * BASE_TAX_RATE);
            } else {
                // Si no tiene efectivo gravable, multa mínima
                baseTaxAmount = 50000; // $50,000 multa mínima
            }

            // Aplicar multiplicador de multa
            const fineMultiplier = recentCaught > 0 ? 3.0 : 2.5; // 300% reincidente, 250% primera vez
            const fineAmount = Math.floor(baseTaxAmount * fineMultiplier);

            // Cobrar multa
            await billingService.ubService.removeMoney(
                interaction.guildId,
                targetUser.id,
                fineAmount,
                `🚨 Multa SAT - Evasión Fiscal (Auditoría policial por ${interaction.user.tag})`,
                'cash'
            );

            // Remover rol de evasor
            try {
                await targetMember.roles.remove(EVASOR_FISCAL_ROLE_ID);
            } catch (roleErr) {
                console.error('[auditar-impuestos] Failed to remove evasor role:', roleErr);
            }

            // Registrar en historial
            await supabase.from('tax_evasion_history').insert({
                guild_id: interaction.guildId,
                user_id: targetUser.id,
                evasion_type: 'caught',
                tax_amount: baseTaxAmount,
                fine_amount: fineAmount,
                suspicion_level: Math.floor(detectionProbability * 100)
            });

            // 7. Embed de éxito
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🚨 ¡EVASIÓN FISCAL DETECTADA!')
                .setDescription(`La policía ha descubierto que **${targetUser.tag}** estaba evadiendo impuestos.`)
                .addFields(
                    { name: '💸 Impuesto Base', value: `$${baseTaxAmount.toLocaleString()}`, inline: true },
                    { name: '🚔 Multa Aplicada', value: `$${fineAmount.toLocaleString()}`, inline: true },
                    { name: '📊 Multiplicador', value: `${fineMultiplier * 100}%${recentCaught > 0 ? ' (REINCIDENTE)' : ''}`, inline: true },
                    { name: '👮 Auditor', value: interaction.user.tag, inline: true },
                    { name: '🎲 Probabilidad', value: `${Math.floor(detectionProbability * 100)}%`, inline: true },
                    { name: '⚖️ Estado', value: `Evasiones previas: ${recentEvasions}\\nCapturas previas: ${recentCaught}`, inline: true },
                    { name: '❌ Consecuencias', value: `• Rol **Evasión de Impuestos** removido\\n• Multa del **${fineMultiplier * 100}%** del impuesto base\\n• Registro permanente en historial fiscal`, inline: false }
                )
                .setFooter({ text: 'Sistema de Auditoría Fiscal SAT | Desarrollado en colaboración con Policía' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[auditar-impuestos] Error:', error);
            await interaction.editReply('❌ Error al realizar la auditoría. Contacta a un administrador.');
        }
    }
};
