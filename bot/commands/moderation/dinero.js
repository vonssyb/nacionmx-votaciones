const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const AuditService = require('../../services/AuditService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dinero')
        .setDescription('💰 Gestión de dinero en efectivo (Solo Junta Directiva)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('añadir')
                .setDescription('Añadir efectivo a un usuario')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario al que añadir dinero').setRequired(true))
                .addIntegerOption(option => option.setName('cantidad').setDescription('Cantidad de efectivo a añadir').setRequired(true).setMinValue(1))
                .addStringOption(option => option.setName('razon').setDescription('Razón administrativa').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('quitar')
                .setDescription('Quitar efectivo a un usuario')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario al que quitar dinero').setRequired(true))
                .addIntegerOption(option => option.setName('cantidad').setDescription('Cantidad de efectivo a quitar').setRequired(true).setMinValue(1))
                .addStringOption(option => option.setName('razon').setDescription('Razón administrativa').setRequired(true))),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: false });

        const juntaDirectivaRoleId = '1412882245735420006';

        // Permission Check
        if (!interaction.member.roles.cache.has(juntaDirectivaRoleId) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply('❌ Solo la Junta Directiva puede gestionar dinero administrativo.');
        }

        const subCmd = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('usuario');
        const cantidad = interaction.options.getInteger('cantidad');
        const razon = interaction.options.getString('razon');

        // Get current balance
        const { data: balance, error: balanceError } = await supabase
            .from('user_balances')
            .select('cash')
            .eq('guild_id', interaction.guildId)
            .eq('user_id', targetUser.id)
            .single();

        if (balanceError && balanceError.code !== 'PGRST116') {
            console.error('Error fetching balance:', balanceError);
            return interaction.editReply('❌ Error al consultar el balance del usuario.');
        }

        const currentCash = balance?.cash || 0;

        if (subCmd === 'quitar' && currentCash < cantidad) {
            return interaction.editReply(`❌ ${targetUser.tag} solo tiene $${currentCash.toLocaleString()} en efectivo. No se puede quitar $${cantidad.toLocaleString()}.`);
        }

        // Calculate new balance
        const newCash = subCmd === 'añadir' ? currentCash + cantidad : currentCash - cantidad;

        // Update balance
        const { error: updateError } = await supabase
            .from('user_balances')
            .upsert({
                guild_id: interaction.guildId,
                user_id: targetUser.id,
                cash: newCash
            }, { onConflict: 'guild_id,user_id' });

        if (updateError) {
            console.error('Error updating balance:', updateError);
            return interaction.editReply('❌ Error al actualizar el balance.');
        }

        // Log to enhanced audit system
        const auditService = new AuditService(supabase, client);
        await auditService.logTransaction({
            guildId: interaction.guildId,
            userId: targetUser.id,
            transactionType: subCmd === 'añadir' ? 'admin_add' : 'admin_remove',
            amount: subCmd === 'añadir' ? cantidad : -cantidad,
            currencyType: 'cash',
            reason: razon,
            metadata: {
                previous_balance: currentCash,
                new_balance: newCash,
                admin_action: true
            },
            createdBy: interaction.user.id,
            createdByTag: interaction.user.tag,
            commandName: 'dinero',
            interactionId: interaction.id,
            canRollback: true
        });

        // Log to audit
        const auditEmbed = new EmbedBuilder()
            .setTitle(`💰 ${subCmd === 'añadir' ? 'Dinero Añadido' : 'Dinero Quitado'}`)
            .setColor(subCmd === 'añadir' ? '#00FF00' : '#FFA500')
            .addFields(
                { name: '👤 Usuario Afectado', value: `<@${targetUser.id}>`, inline: true },
                { name: '💵 Cantidad', value: `$${cantidad.toLocaleString()}`, inline: true },
                { name: '💼 Balance Anterior', value: `$${currentCash.toLocaleString()}`, inline: true },
                { name: '💼 Balance Nuevo', value: `$${newCash.toLocaleString()}`, inline: true },
                { name: '👮 Autorizado por', value: `<@${interaction.user.id}>`, inline: false },
                { name: '📝 Razón', value: razon, inline: false }
            )
            .setTimestamp();

        // Log to audit channel
        const AUDIT_CHANNEL_ID = process.env.AUDIT_LOGS_CHANNEL_ID || '1450610756663115879';
        try {
            const logChannel = await client.channels.fetch(AUDIT_CHANNEL_ID);
            if (logChannel) await logChannel.send({ embeds: [auditEmbed] });
        } catch (e) {
            console.log('Error logging to audit channel:', e.message);
        }

        // Success response
        const successEmbed = new EmbedBuilder()
            .setTitle(`✅ Operación Completada`)
            .setColor('#00FF00')
            .setDescription(`Se ${subCmd === 'añadir' ? 'añadió' : 'quitó'} **$${cantidad.toLocaleString()}** ${subCmd === 'añadir' ? 'a' : 'de'} ${targetUser.tag}`)
            .addFields(
                { name: '💼 Balance Nuevo', value: `$${newCash.toLocaleString()}`, inline: true },
                { name: '📝 Razón', value: razon, inline: false }
            )
            .setFooter({ text: `Operación administrativa por ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

        // Notify user via DM
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle(`💰 Ajuste Administrativo`)
                .setColor(subCmd === 'añadir' ? '#00FF00' : '#FFA500')
                .setDescription(`Se ${subCmd === 'añadir' ? 'añadió' : 'quitó'} **$${cantidad.toLocaleString()}** ${subCmd === 'añadir' ? 'a' : 'de'} tu balance de efectivo.`)
                .addFields(
                    { name: '💼 Nuevo Balance', value: `$${newCash.toLocaleString()}`, inline: true },
                    { name: '📝 Razón', value: razon, inline: false }
                )
                .setTimestamp();

            await targetUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            console.log('Could not DM user:', dmError.message);
        }
    }
};
