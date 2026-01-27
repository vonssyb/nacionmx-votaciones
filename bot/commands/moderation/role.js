const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Gestión de roles avanzada')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('mass')
                .setDescription('Asignación masiva de múltiples roles')
                .addStringOption(opt =>
                    opt.setName('target')
                        .setDescription('A quién: "all", "humans", "bots" O lista de Pings/IDs')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('roles')
                        .setDescription('Roles a gestionar: Lista de Pings/IDs')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Acción a realizar')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Dar Roles (Add)', value: 'add' },
                            { name: 'Quitar Roles (Remove)', value: 'remove' }
                        )
                )
        ),
    async execute(interaction, client) {
        const targetInput = interaction.options.getString('target');
        const rolesInput = interaction.options.getString('roles');
        const action = interaction.options.getString('action');

        await interaction.deferReply();

        // Regex for IDs
        const extractIds = (str) => {
            if (!str) return [];
            return [...str.matchAll(/(\d{17,20})/g)].map(m => m[0]);
        };

        const roleIds = extractIds(rolesInput);
        if (roleIds.length === 0) {
            return interaction.editReply('❌ No detecté roles válidos. Usa @Menciones o IDs.');
        }

        // Validate Roles & Permissions
        const resolvedRoles = [];
        const myHighestRole = interaction.guild.members.me.roles.highest.position;

        for (const rId of roleIds) {
            const r = interaction.guild.roles.cache.get(rId);
            if (!r) continue;
            if (r.position >= myHighestRole) {
                return interaction.editReply(`❌ No puedo gestionar el rol **${r.name}** porque es igual o superior al mío.`);
            }
            resolvedRoles.push(r);
        }

        if (resolvedRoles.length === 0) {
            return interaction.editReply('❌ Ninguno de los roles especificados es válido o gestionable por mí.');
        }

        // Determine Target Members
        let targetMembers = new Map();
        let targetDescription = "";

        if (['all', 'everyone', 'todos'].includes(targetInput.toLowerCase())) {
            targetMembers = await interaction.guild.members.fetch();
            targetDescription = "Todos los miembros";
        } else if (['humans', 'humanos', 'personas'].includes(targetInput.toLowerCase())) {
            const all = await interaction.guild.members.fetch();
            targetMembers = all.filter(m => !m.user.bot);
            targetDescription = "Solo Humanos";
        } else if (['bots', 'robots'].includes(targetInput.toLowerCase())) {
            const all = await interaction.guild.members.fetch();
            targetMembers = all.filter(m => m.user.bot);
            targetDescription = "Solo Bots";
        } else {
            // Assume input is list of users
            const userIds = extractIds(targetInput);
            if (userIds.length === 0) return interaction.editReply('❌ Objetivo no reconocido. Usa "humans", "bots", "all" o una lista de usuarios.');

            targetDescription = `${userIds.length} usuarios especificados`;

            try {
                // Determine approach based on list size
                if (userIds.length < 50) {
                    // small batch
                    const fetched = await interaction.guild.members.fetch({ user: userIds });
                    targetMembers = fetched;
                } else {
                    // large batch, fetch all and filter
                    const all = await interaction.guild.members.fetch();
                    targetMembers = all.filter(m => userIds.includes(m.id));
                }
            } catch (e) {
                return interaction.editReply('❌ Error buscando usuarios especificados.');
            }
        }

        const roleNames = resolvedRoles.map(r => r.name).join(', ');
        const actionText = action === 'add' ? 'Añadiendo' : 'Quitando';
        await interaction.editReply(`🔄 **Procesando...**\nAcción: **${actionText}**\nRoles: ${roleNames}\nObjetivo: ${targetDescription} (${targetMembers.size} miembros encontrados)\n⏳ Esto puede tardar...`);

        let successCount = 0;
        let failCount = 0;
        let processed = 0;

        // Process Loop
        for (const [id, member] of targetMembers) {
            processed++;
            try {
                if (action === 'add') {
                    // Check which roles are missing
                    const rolesToAdd = resolvedRoles.filter(r => !member.roles.cache.has(r.id));
                    if (rolesToAdd.length > 0) {
                        await member.roles.add(rolesToAdd);
                        successCount++;
                        // Rate Limit Safety: 1s sleep per 5 heavy ops
                        if (successCount % 5 === 0) await new Promise(r => setTimeout(r, 1000));
                    }
                } else {
                    // 'remove'
                    // Check which roles they actually have
                    const rolesToRemove = resolvedRoles.filter(r => member.roles.cache.has(r.id));
                    if (rolesToRemove.length > 0) {
                        await member.roles.remove(rolesToRemove);
                        successCount++;
                        if (successCount % 5 === 0) await new Promise(r => setTimeout(r, 1000));
                    }
                }
            } catch (e) {
                console.error(`Mass Role Error on ${member.user.tag}:`, e.message);
                failCount++;
            }

            // Optional: Update progress status
        }

        await interaction.editReply(`✅ **Operación Finalizada**\nRoles: ${roleNames}\nObjetivo: ${targetDescription}\n✨ Cambios realizados: ${successCount} usuarios\n❌ Errores: ${failCount}`);
    }
};
