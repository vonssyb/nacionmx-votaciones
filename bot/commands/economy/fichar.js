const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const moment = require('moment-timezone');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fichar')
        .setDescription('Gestión de turnos de trabajo y vinculación')
        .addSubcommand(sub =>
            sub.setName('entrada')
                .setDescription('Iniciar tu turno de trabajo oficial'))
        .addSubcommand(sub =>
            sub.setName('salida')
                .setDescription('Finalizar tu turno de trabajo actual'))
        .addSubcommand(sub =>
            sub.setName('vincular')
                .setDescription('Vincular un ciudadano al censo (Staff Only)')
                .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a vincular').setRequired(true))
                .addStringOption(opt => opt.setName('nombre').setDescription('Nombre completo RP').setRequired(true))
                .addAttachmentOption(opt => opt.setName('dni').setDescription('Foto del DNI').setRequired(false))),

    async execute(interaction, client, supabase) {
        // We use deferReply as a separate step or let the monkey-patch handle it 
        // But since this is a new modular command, we should be explicit.
        await interaction.deferReply({ flags: [64] });

        const subCmd = interaction.options.getSubcommand();

        // 1. VINCULAR (Code copied and adapted from legacy for consistency)
        if (subCmd === 'vincular') {
            const STAFF_ROLE_ID = '1450591546524307689';
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply('⛔ No tienes permisos para vincular ciudadanos (Rol Staff Banco Requerido).');
            }

            const targetUser = interaction.options.getUser('usuario');
            const fullName = interaction.options.getString('nombre');
            const dniPhoto = interaction.options.getAttachment('dni');

            let { data: existingCitizen } = await supabase.from('citizens').select('*').eq('discord_id', targetUser.id).limit(1).maybeSingle();

            let finalDniUrl = dniPhoto ? dniPhoto.url : null;

            if (!finalDniUrl) {
                if (existingCitizen && existingCitizen.dni) {
                    finalDniUrl = existingCitizen.dni;
                } else {
                    const { data: vData } = await supabase.from('verification_codes').select('dni_url').eq('discord_id', targetUser.id).limit(1).maybeSingle();
                    if (vData && vData.dni_url) finalDniUrl = vData.dni_url;
                }

                if (!finalDniUrl) {
                    const { data: dniData } = await supabase.from('citizen_dni').select('foto_url').eq('user_id', targetUser.id).limit(1).maybeSingle();
                    if (dniData && dniData.foto_url) finalDniUrl = dniData.foto_url;
                }

                if (!finalDniUrl) {
                    return interaction.editReply(`❌ **DNI Requerido:** El usuario <@${targetUser.id}> no tiene un DNI registrado. Sube una foto.`);
                }
            }

            if (existingCitizen) {
                await supabase.from('citizens').update({ full_name: fullName, dni: finalDniUrl }).eq('id', existingCitizen.id);
                return interaction.editReply(`✅ Datos de <@${targetUser.id}> actualizados.`);
            } else {
                await supabase.from('citizens').insert([{ discord_id: targetUser.id, full_name: fullName, dni: finalDniUrl, credit_score: 100 }]);
                return interaction.editReply(`✅ <@${targetUser.id}> vinculado exitosamente.`);
            }
        }

        // 2. ENTRADA (Clock In)
        if (subCmd === 'entrada') {
            // Check if already active
            const { data: activeShift } = await supabase
                .from('job_shifts')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .eq('status', 'active')
                .maybeSingle();

            if (activeShift) {
                return interaction.editReply('❌ Ya tienes un turno activo. Usa `/fichar salida` primero.');
            }

            // Get user's RP name
            const { data: citizen } = await supabase
                .from('citizens')
                .select('full_name')
                .eq('discord_id', interaction.user.id)
                .maybeSingle();

            const name = citizen ? citizen.full_name : interaction.user.username;

            await supabase.from('job_shifts').insert({
                guild_id: interaction.guildId,
                user_id: interaction.user.id,
                full_name: name,
                status: 'active'
            });

            const embed = new EmbedBuilder()
                .setTitle('👷 Turno Iniciado')
                .setColor('#2ECC71')
                .setDescription(`Has iniciado tu turno como **${name}**.\n\n🕒 **Hora:** ${moment().tz('America/Mexico_City').format('HH:mm:ss')}`)
                .setFooter({ text: 'Nación MX | Registro de Jornada' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }

        // 3. SALIDA (Clock Out)
        if (subCmd === 'salida') {
            const { data: shift } = await supabase
                .from('job_shifts')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!shift) {
                return interaction.editReply('❌ No tienes un turno activo para finalizar.');
            }

            const clockOut = new Date();
            const durationMs = clockOut - new Date(shift.clock_in);
            const durationMins = Math.round(durationMs / 60000);

            await supabase.from('job_shifts').update({
                clock_out: clockOut.toISOString(),
                status: 'completed',
                duration_minutes: durationMins
            }).eq('id', shift.id);

            const embed = new EmbedBuilder()
                .setTitle('🛑 Turno Finalizado')
                .setColor('#E74C3C')
                .addFields(
                    { name: '👤 Trabajador', value: shift.full_name, inline: true },
                    { name: '⏱️ Duración', value: `${durationMins} minutos`, inline: true },
                    { name: '🕒 Salida', value: moment(clockOut).tz('America/Mexico_City').format('HH:mm:ss'), inline: true }
                )
                .setFooter({ text: 'Nación MX | Registro de Jornada' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
