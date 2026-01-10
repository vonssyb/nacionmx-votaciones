const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('agregar-rol')
        .setDescription('➕ Agregar un rol a un usuario (Solo Staff)')
        .addUserOption(option => option.setName('usuario').setDescription('Usuario al que agregar rol').setRequired(true))
        .addRoleOption(option => option.setName('rol').setDescription('Rol a agregar').setRequired(true))
        .addStringOption(option => option.setName('razon').setDescription('Razón del cambio').setRequired(false)),

    async execute(interaction) {
        // Deferral handled globally by index_moderacion.js
        // // await interaction.deferReply();

        // Staff role check
        const ALLOWED_ROLES = [
            '1412882248411381872', // Administración
            '1412887079612059660', // Staff
            '1412887167654690908'  // Training
        ];

        const isStaff = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id)) ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isStaff) {
            return interaction.editReply('❌ Solo el staff puede gestionar roles.');
        }

        const targetUser = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('rol');
        const razon = interaction.options.getString('razon') || 'No especificada';

        try {
            const member = await interaction.guild.members.fetch(targetUser.id);

            // Check if user already has the role
            if (member.roles.cache.has(role.id)) {
                return interaction.editReply(`⚠️ ${targetUser.tag} ya tiene el rol ${role.name}.`);
            }

            // --- CK ROLE COOLDOWN CHECK ---
            const { data: cooldown } = await interaction.client.supabase
                .from('role_cooldowns')
                .select('*')
                .eq('user_id', targetUser.id)
                .eq('role_id', role.id)
                .gt('expires_at', new Date().toISOString())
                .maybeSingle();

            if (cooldown) {
                const expiresDate = new Date(cooldown.expires_at).toLocaleDateString('es-MX');
                return interaction.editReply(`⛔ **Rol Bloqueado por CK**\nEste usuario tiene restringido el rol **${role.name}** debido a un CK reciente.\n\n📅 Desbloqueo: **${expiresDate}**`);
            }

            // Add role
            await member.roles.add(role);

            // Wait briefly to ensure Discord processes the change
            await new Promise(resolve => setTimeout(resolve, 500));

            const embed = new EmbedBuilder()
                .setTitle('✅ Rol Agregado')
                .setColor('#00FF00')
                .addFields(
                    { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
                    { name: '🎭 Rol', value: `${role.name}`, inline: true },
                    { name: '👮 Por', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Razón', value: razon, inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });

            // --- ERLC SYNC (Automatic Rank Grant) ---
            try {
                const ErlcScheduler = require('../../services/ErlcScheduler');
                const MOD_ROLES = ['1412887079612059660', '1412887167654690908']; // Staff, Training
                const ADMIN_ROLES = ['1412882245735420006', '1412882248411381872']; // Junta, Administración

                let commandToQueue = null;

                if (ADMIN_ROLES.includes(role.id)) {
                    commandToQueue = 'admin';
                } else if (MOD_ROLES.includes(role.id)) {
                    commandToQueue = 'mod';
                }

                if (commandToQueue) {
                    const { data: citizen } = await interaction.client.supabase
                        .from('citizens')
                        .select('roblox_username')
                        .eq('discord_id', targetUser.id)
                        .maybeSingle();

                    if (citizen && citizen.roblox_username) {
                        const fullCmd = `:${commandToQueue} ${citizen.roblox_username}`;
                        await ErlcScheduler.queueAction(interaction.client.supabase, fullCmd, `Promoción Discord a ${role.name}`, { username: citizen.roblox_username });
                        console.log(`[agregar-rol] Queued ERLC Sync: ${fullCmd}`);
                    }
                }
            } catch (syncErr) {
                console.error('[agregar-rol] ERLC Sync Error:', syncErr);
            }
            // ----------------------------------------

        } catch (error) {
            console.error('[agregar-rol] Error:', error);
            await interaction.editReply('❌ Error al agregar el rol. Verifica que el bot tenga permisos suficientes.');
        }
    }
};
