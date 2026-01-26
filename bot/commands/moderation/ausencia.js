const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const ROLE_AUSENTE = '1465141044768276631';
const LOG_CHANNEL = '1457457209268109516'; // General Logs or specific Staff Logs

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ausencia')
        .setDescription('📅 Marcar a un staff como ausente temporalmente')
        .addUserOption(option => option.setName('usuario').setDescription('Staff que estará ausente').setRequired(true))
        .addStringOption(option => option.setName('tiempo').setDescription('Duración (ej: 3d, 1w, 24h)').setRequired(true))
        .addStringOption(option => option.setName('razon').setDescription('Motivo de la ausencia').setRequired(true))
        .addAttachmentOption(option => option.setName('foto').setDescription('Justificante o imagen opcional').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred) await interaction.deferReply();

        const targetUser = interaction.options.getMember('usuario');
        const durationStr = interaction.options.getString('tiempo');
        const reason = interaction.options.getString('razon');
        const photo = interaction.options.getAttachment('foto');

        if (!targetUser) return interaction.editReply('❌ Usuario no encontrado en el servidor.');

        // 1. Parse Duration
        const durationMs = parseDuration(durationStr);
        if (!durationMs) {
            return interaction.editReply('❌ Formato de tiempo inválido. Usa: `1d` (dias), `1w` (semanas), `1h` (horas). Ej: `3d`');
        }

        const endDate = new Date(Date.now() + durationMs);

        try {
            // 2. Assign Role
            if (!targetUser.roles.cache.has(ROLE_AUSENTE)) {
                await targetUser.roles.add(ROLE_AUSENTE, `Ausencia: ${reason}`);
            }

            // 3. Log to DB for Auto-Removal (Future Scheduler)
            // Storing in a generic 'user_metadata' or 'staff_absences' if available. 
            // For now, we will assume we rely on manual check or future scheduler implementation.
            // Let's try to insert into 'staff_absences' if it existed, but to be safe and useful immediately:
            // We just ensure the role is set and logged.

            // NOTE: To make it auto-remove, we would need a persistent task scheduler.
            // I will create a simple JSON record if DB fails, or just Log it clearly.

            // 4. Create Embed
            const embed = new EmbedBuilder()
                .setTitle('📅 Registro de Ausencia Staff')
                .setColor('#F1C40F') // Yellow
                .addFields(
                    { name: '👤 Staff', value: `<@${targetUser.id}>`, inline: true },
                    { name: '⏱️ Duración', value: durationStr, inline: true },
                    { name: '📅 Regreso Estimado', value: `<t:${Math.floor(endDate.getTime() / 1000)}:f> (<t:${Math.floor(endDate.getTime() / 1000)}:R>)`, inline: false },
                    { name: '📝 Razón', value: reason }
                )
                .setFooter({ text: `Registrado por: ${interaction.user.tag}` })
                .setTimestamp();

            if (photo) {
                embed.setImage(photo.url);
            }

            await interaction.editReply({ content: `✅ **Ausencia Registrada** para <@${targetUser.id}>.`, embeds: [embed] });

            // 5. Send Log
            const logChannel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
            if (logChannel) {
                await logChannel.send({ embeds: [embed] });
            }

            // 6. DB Storage (Try optimized)
            /*
            const { error } = await supabase.from('scheduled_tasks').insert({
                type: 'remove_role',
                payload: { guild_id: interaction.guildId, user_id: targetUser.id, role_id: ROLE_AUSENTE },
                execute_at: endDate.toISOString()
            });
            if (error) console.error('Error scheduling role removal', error);
            */

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al procesar la ausencia. Verifica mis permisos de rol.');
        }
    }
};

function parseDuration(str) {
    const regex = /^(\d+)([dwhm])$/;
    const match = str.match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000
    };

    return value * multipliers[unit];
}
