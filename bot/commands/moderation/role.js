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
                    opt.setName('grupo')
                        .setDescription('Selecciona un grupo predefinido (Opcional)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Todos (All)', value: 'all' },
                            { name: 'Humanos', value: 'humans' },
                            { name: 'Bots', value: 'bots' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('usuarios')
                        .setDescription('Lista de usuarios por ID/Ping (Opcional si usas Grupo)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('roles')
                        .setDescription('Roles a gestionar: @Rol1 @Rol2 o IDs')
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
        try {
            const groupInput = interaction.options.getString('grupo');
            const usersInput = interaction.options.getString('usuarios');
            const rolesInput = interaction.options.getString('roles');
            const action = interaction.options.getString('action');

            if (!groupInput && !usersInput) {
                return interaction.reply({ content: '❌ Debes especificar al menos un **Grupo** o una lista de **Usuarios**.', ephemeral: true });
            }

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
            let descriptionParts = [];

            // 1. Fetch from Group
            if (groupInput) {
                const all = await interaction.guild.members.fetch();
                if (groupInput === 'all') {
                    // Map ALL members
                    all.forEach((m, k) => targetMembers.set(k, m));
                    descriptionParts.push("Todos");
                } else if (groupInput === 'humans') {
                    const humans = all.filter(m => !m.user.bot);
                    humans.forEach((m, k) => targetMembers.set(k, m));
                    descriptionParts.push("Humanos");
                } else if (groupInput === 'bots') {
                    const bots = all.filter(m => m.user.bot);
                    bots.forEach((m, k) => targetMembers.set(k, m));
                    descriptionParts.push("Bots");
                }
            }

            // 2. Fetch from Custom List
            if (usersInput) {
                const userIds = extractIds(usersInput);
                if (userIds.length > 0) {
                    try {
                        let fetched;
                        if (userIds.length < 50) {
                            fetched = await interaction.guild.members.fetch({ user: userIds });
                        } else {
                            const all = await interaction.guild.members.fetch();
                            fetched = all.filter(m => userIds.includes(m.id));
                        }

                        fetched.forEach((m, k) => targetMembers.set(k, m));
                        descriptionParts.push(`${fetched.size} usuarios manuales`);
                    } catch (e) {
                        console.error("Error fetching custom users:", e);
                    }
                }
            }

            if (targetMembers.size === 0) {
                return interaction.editReply('⚠️ No se encontraron miembros para procesar con los criterios dados.');
            }

            targetDescription = descriptionParts.join(' + ');

            const roleNames = resolvedRoles.map(r => r.name).join(', ');
            const actionText = action === 'add' ? 'Añadiendo' : 'Quitando';
            await interaction.editReply(`🔄 **Procesando...**\nAcción: **${actionText}**\nRoles: ${roleNames}\nObjetivo: ${targetDescription} (${targetMembers.size} miembros)\n⏳ Esto puede tardar...`);

            let successCount = 0;
            let failCount = 0;
            let processed = 0;

            // Process Loop
            for (const [id, member] of targetMembers) {
                processed++;
                try {
                    if (action === 'add') {
                        const rolesToAdd = resolvedRoles.filter(r => !member.roles.cache.has(r.id));
                        if (rolesToAdd.length > 0) {
                            await member.roles.add(rolesToAdd);
                            successCount++;
                            // Rate Limit Safety: 1s sleep per 5 heavy ops
                            if (successCount % 5 === 0) await new Promise(r => setTimeout(r, 1000));
                        }
                    } else {
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

                // Update periodically if needed (every 100 users)
                if (processed % 100 === 0) {
                    try {
                        // Just Log, don't edit message constantly to avoid rate limits
                        console.log(`Mass Role Progress: ${processed}/${targetMembers.size}`);
                    } catch (err) { /* ignore */ }
                }
            }

            await interaction.editReply(`✅ **Operación Finalizada**\nRoles: ${roleNames}\nObjetivo: ${targetDescription}\n✨ Cambios realizados: ${successCount} usuarios\n❌ Errores: ${failCount}`);

        } catch (fatalError) {
            console.error("CRITICAL ERROR IN ROLE MASS:", fatalError);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(`❌ **Error Crítico**: ${fatalError.message}`);
            } else {
                await interaction.reply({ content: `❌ **Error Crítico**: ${fatalError.message}`, ephemeral: true });
            }
        }
    }
};
