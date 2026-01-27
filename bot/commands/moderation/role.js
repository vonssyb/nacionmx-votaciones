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
                .addStringOption(opt =>
                    opt.setName('grupo')
                        .setDescription('Selecciona el grupo objetivo')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Todos (All)', value: 'all' },
                            { name: 'Humanos', value: 'humans' },
                            { name: 'Bots', value: 'bots' },
                            { name: 'Lista Personalizada (Manual)', value: 'manual' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('usuarios')
                        .setDescription('Solo si elegiste "Lista Personalizada": IDs o Pings')
                        .setRequired(false)
                )
        ),
    async execute(interaction, client) {
        try {
            const groupInput = interaction.options.getString('grupo');
            const usersInput = interaction.options.getString('usuarios');
            const rolesInput = interaction.options.getString('roles');
            const action = interaction.options.getString('action');

            if (groupInput === 'manual' && !usersInput) {
                return interaction.reply({ content: '❌ Elegiste **Lista Personalizada** pero no escribiste nada en la opción `usuarios`.', ephemeral: true });
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

            // Ensure all roles are cached
            await interaction.guild.roles.fetch();

            // Validate Roles & Permissions
            const resolvedRoles = [];
            const skippedRoles = [];
            const myHighestRole = interaction.guild.members.me.roles.highest.position;

            for (const rId of roleIds) {
                const r = interaction.guild.roles.cache.get(rId);
                if (!r) {
                    skippedRoles.push({ id: rId, reason: 'No encontrado' });
                    continue;
                }
                if (r.position >= myHighestRole) {
                    skippedRoles.push({ name: r.name, reason: 'Jerarquía superior a mi' });
                    continue;
                }
                resolvedRoles.push(r);
            }

            if (resolvedRoles.length === 0) {
                const errors = skippedRoles.map(s => s.name ? `${s.name} (${s.reason})` : `${s.id} (${s.reason})`).join(', ');
                return interaction.editReply(`❌ No se pudo procesar ningún rol válido.\nRazones: ${errors}`);
            }

            let warningMsg = "";
            if (skippedRoles.length > 0) {
                warningMsg = "\n⚠️ **Omitidos**: " + skippedRoles.map(s => s.name || s.id).join(', ');
            }

            // Determine Target Members
            let targetMembers = new Map();
            let targetDescription = "";
            let descriptionParts = [];

            if (groupInput !== 'manual') {
                const all = await interaction.guild.members.fetch();
                if (groupInput === 'all') {
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
            } else {
                if (usersInput) {
                    const userIds = extractIds(usersInput);
                    if (userIds.length > 0) {
                        try {
                            // Fetch Strategy
                            if (userIds.length < 50) {
                                const fetched = await interaction.guild.members.fetch({ user: userIds });
                                fetched.forEach((m, k) => targetMembers.set(k, m));
                            } else {
                                const all = await interaction.guild.members.fetch();
                                all.filter(m => userIds.includes(m.id)).forEach((m, k) => targetMembers.set(k, m));
                            }
                            descriptionParts.push(`${targetMembers.size} usuarios manuales`);
                        } catch (e) {
                            console.error("Error fetching custom users:", e);
                        }
                    }
                }
            }

            if (targetMembers.size === 0) {
                return interaction.editReply('⚠️ No se encontraron miembros para procesar con los criterios dados.');
            }

            targetDescription = descriptionParts.join(' + ');

            const roleNames = resolvedRoles.map(r => r.name).join(', ');
            const actionText = action === 'add' ? 'Añadiendo' : 'Quitando';

            await interaction.editReply(`🔄 **Procesando... (Modo Turbo)**\nAcción: **${actionText}**\nRoles: ${roleNames}${warningMsg}\nObjetivo: ${targetDescription} (${targetMembers.size} miembros)\n⏳ Iniciando...`);

            // Optimization: Process in chunks
            const membersArray = Array.from(targetMembers.values());
            const CHUNK_SIZE = 10; // Process 10 users in parallel
            const DELAY_MS = 200; // Small delay between chunks to be nice to API

            let successCount = 0;
            let failCount = 0;
            let processed = 0;

            const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
            const batches = chunk(membersArray, CHUNK_SIZE);

            for (const batch of batches) {
                const promises = batch.map(async (member) => {
                    try {
                        if (action === 'add') {
                            const rolesToAdd = resolvedRoles.filter(r => !member.roles.cache.has(r.id));
                            if (rolesToAdd.length > 0) {
                                await member.roles.add(rolesToAdd);
                                successCount++;
                            }
                        } else {
                            const rolesToRemove = resolvedRoles.filter(r => member.roles.cache.has(r.id));
                            if (rolesToRemove.length > 0) {
                                await member.roles.remove(rolesToRemove);
                                successCount++;
                            }
                        }
                    } catch (e) {
                        console.error(`Mass Role Error on ${member.user.tag}:`, e.message);
                        failCount++;
                    }
                });

                await Promise.all(promises);
                processed += batch.length;

                // Update status every 5 batches (50 users)
                if (processed % 50 === 0 || processed === membersArray.length) {
                    await interaction.editReply(`🔄 **Procesando...** (${processed}/${membersArray.length})\nÉxitos: ${successCount} | Fallos: ${failCount}`);
                }

                await new Promise(r => setTimeout(r, DELAY_MS));
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
