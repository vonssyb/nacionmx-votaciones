const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quitar-rol')
        .setDescription('➖ Quitar un rol de un usuario (Solo Staff)')
        .addUserOption(option => option.setName('usuario').setDescription('Usuario al que quitar rol').setRequired(true))
        .addRoleOption(option => option.setName('rol').setDescription('Rol a quitar').setRequired(true))
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

            // Check if user doesn't have the role
            if (!member.roles.cache.has(role.id)) {
                return interaction.editReply(`⚠️ ${targetUser.tag} no tiene el rol ${role.name}.`);
            }

            // Remove role
            await member.roles.remove(role);

            // Wait briefly to ensure Discord processes the change
            await new Promise(resolve => setTimeout(resolve, 500));

            const embed = new EmbedBuilder()
                .setTitle('✅ Rol Removido')
                .setColor('#FF0000')
                .addFields(
                    { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
                    { name: '🎭 Rol', value: `${role.name}`, inline: true },
                    { name: '👮 Por', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Razón', value: razon, inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });

            // --- ERLC SYNC (Automatic Rank Revoke) ---
            try {
                const ErlcScheduler = require('../../services/ErlcScheduler');
                const MOD_ROLES = ['1412887079612059660', '1412887167654690908']; // Staff, Training
                const ADMIN_ROLES = ['1412882245735420006', '1412882248411381872']; // Junta, Administración

                let commandToQueue = null;

                if (ADMIN_ROLES.includes(role.id)) {
                    commandToQueue = 'unadmin';
                } else if (MOD_ROLES.includes(role.id)) {
                    commandToQueue = 'unmod';
                }

                if (commandToQueue) {
                    const { data: citizen } = await interaction.client.supabase
                        .from('citizens')
                        .select('roblox_username')
                        .eq('discord_id', targetUser.id)
                        .maybeSingle();

                    if (citizen && citizen.roblox_username) {
                        const fullCmd = `:${commandToQueue} ${citizen.roblox_username}`;
                        await ErlcScheduler.queueAction(interaction.client.supabase, fullCmd, `Degradación Discord de ${role.name}`, { username: citizen.roblox_username });
                        console.log(`[quitar-rol] Queued ERLC Sync: ${fullCmd}`);

                        // Safety: If unadmin, also attempt unmod just in case they had both or ranks are weird
                        if (commandToQueue === 'unadmin') {
                            await ErlcScheduler.queueAction(interaction.client.supabase, `:unmod ${citizen.roblox_username}`, 'Degradación limpieza', { username: citizen.roblox_username });
                        }
                    }
                }
            } catch (syncErr) {
                console.error('[quitar-rol] ERLC Sync Error:', syncErr);
            }
            // ----------------------------------------

        } catch (error) {
            console.error('[quitar-rol] Error:', error);
            await interaction.editReply('❌ Error al quitar el rol. Verifica que el bot tenga permisos suficientes.');
        }
    }
};
