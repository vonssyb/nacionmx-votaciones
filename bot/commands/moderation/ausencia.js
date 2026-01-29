const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const ROLE_AUSENTE = '1465141044768276631';
const LOG_CHANNEL = '1457457209268109516'; // Logs de Ausencias

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ausencia')
        .setDescription('📅 Registro Oficial de Inactividad de Staff')
        .addStringOption(option =>
            option.setName('tiempo')
                .setDescription('Duración (ej: 3d, 1w, 24h) o Meses (ej: 1m)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Explicar de forma breve y clara')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('rango')
                .setDescription('Rango actual del staff')
                .setRequired(true)
                .addChoices(
                    { name: 'Staff en entrenamiento', value: 'Staff en entrenamiento' },
                    { name: 'Staff', value: 'Staff' },
                    { name: 'Admin', value: 'Admin' },
                    { name: 'Junta Directiva', value: 'Junta Directiva' }
                ))
        .addStringOption(option =>
            option.setName('disponibilidad')
                .setDescription('Disponibilidad durante la inactividad')
                .setRequired(true)
                .addChoices(
                    { name: '🔴 Ninguna', value: 'Ninguna' },
                    { name: '🟡 Parcial (Responder urgentes)', value: 'Parcial' }
                ))
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Staff ausente (Opcional, por defecto tú)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('observaciones')
                .setDescription('Información adicional opcional')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('foto')
                .setDescription('Justificante opcional')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

        const targetUser = interaction.options.getMember('usuario') || interaction.member;
        const durationStr = interaction.options.getString('tiempo');
        const reason = interaction.options.getString('motivo');
        const rank = interaction.options.getString('rango');
        const availability = interaction.options.getString('disponibilidad');
        const notes = interaction.options.getString('observaciones') || 'Ninguna';
        const photo = interaction.options.getAttachment('foto');

        // 1. Parse Duration
        const durationMs = parseDuration(durationStr);
        if (!durationMs) {
            return interaction.editReply('❌ Formato de tiempo inválido. Usa: `3d` (dias), `1w` (semanas). Máximo 2 meses.');
        }

        // Limit check (approx 60 days)
        if (durationMs > (62 * 24 * 60 * 60 * 1000)) {
            return interaction.editReply('⚠️ La duración máxima es de 2 meses.');
        }

        const startDate = new Date();
        const endDate = new Date(Date.now() + durationMs);

        try {
            // 2. Assign Role if needed
            if (!targetUser.roles.cache.has(ROLE_AUSENTE)) {
                await targetUser.roles.add(ROLE_AUSENTE, `Ausencia: ${reason}`);
            }

            // 3. Create Formatted Embed
            const embed = new EmbedBuilder()
                .setTitle('📝 Formato de Inactividad')
                .setDescription('Registro oficial de ausencia temporal.')
                .setColor('#2C3E50')
                .addFields(
                    { name: '👤 Nombre en el servidor', value: targetUser.displayName, inline: true },
                    { name: '🛡️ Placa de Staff', value: targetUser.user.tag, inline: true }, // Tag or ID usually acts as plate
                    { name: '🔰 Rango de Staff', value: rank, inline: false },
                    { name: '📄 Motivo de la inactividad', value: reason, inline: false },
                    { name: '📅 Fecha de inicio', value: startDate.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), inline: true },
                    { name: '📅 Fecha de término estimada', value: endDate.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), inline: true },
                    { name: '⏱️ Duración', value: durationStr, inline: true },
                    { name: '📡 Disponibilidad', value: availability === 'Ninguna' ? '🔴 Ninguna' : '🟡 Parcial — Responder tickets asignados o urgente', inline: false }
                );

            if (notes && notes !== 'Ninguna') {
                embed.addFields({ name: '📝 Observaciones', value: notes });
            }

            // Disclaimer / Compromiso
            embed.addFields({
                name: '✅ Compromiso',
                value: 'Me comprometo a regresar en la fecha indicada o avisar cualquier cambio. En caso de incumplimiento, acepto las sanciones.'
            });

            embed.setFooter({ text: `Fecha: ${startDate.toLocaleDateString('es-MX')}` });

            if (photo) {
                embed.setImage(photo.url);
            }

            await interaction.editReply({
                content: `✅ Registro de ausencia creado exitosamente para ${targetUser}.`,
                embeds: [embed]
            });

            // 4. Send Log
            const logChannel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
            if (logChannel) {
                await logChannel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al procesar la ausencia. Verifica mis permisos.');
        }
    }
};

function parseDuration(str) {
    const regex = /^(\d+)([dwhm])$/; // d=dias, w=semanas, h=horas, m=meses
    const match = str.match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000,
        'm': 30 * 24 * 60 * 60 * 1000 // Aprox month
    };

    return value * multipliers[unit];
}
