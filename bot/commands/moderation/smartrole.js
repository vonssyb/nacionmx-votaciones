const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('smartrole')
        .setDescription('Asignar rol condicionalmente a MÚLTIPLES usuarios (Solo si NO tienen rol de exclusión)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        // Required
        .addRoleOption(option =>
            option.setName('rol_asignar')
                .setDescription('El rol que quieres dar')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('rol_exclusion')
                .setDescription('Si tienen este rol, NO se les dará el nuevo')
                .setRequired(true)
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
            opt.setName('modo')
                .setDescription('Acción a realizar')
                .setRequired(true)
                .addChoices(
                    { name: 'Asignar Rol (Dar)', value: 'asignar' },
                    { name: 'Quitar Rol (Remover)', value: 'quitar' }
                )
        )
        // Optional
        .addStringOption(opt =>
            opt.setName('usuarios')
                .setDescription('Solo si elegiste "Lista Personalizada": IDs o Pings')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: '❌ No tienes permisos para gestionar roles.', ephemeral: true });
        }

        const roleToGive = interaction.options.getRole('rol_asignar');
        const roleToExclude = interaction.options.getRole('rol_exclusion');
        const groupInput = interaction.options.getString('grupo');
        const usersInput = interaction.options.getString('usuarios');
        const mode = interaction.options.getString('modo'); // 'asignar' or 'quitar'

        if (groupInput === 'manual' && !usersInput) {
            return interaction.reply({ content: '❌ Elegiste **Lista Personalizada** pero no escribiste nada en la opción `usuarios`.', ephemeral: true });
        }

        // Security Check
        const myHighestRole = interaction.guild.members.me.roles.highest.position;
        if (roleToGive.position >= myHighestRole) {
            return interaction.reply({ content: `❌ No puedo gestionar el rol **${roleToGive.name}** porque es superior al mío.`, ephemeral: true });
        }

        await interaction.deferReply();

        // 1. Determine Targets
        let targetMembers = new Map();
        let targetDescription = "";

        // Regex for IDs
        const extractIds = (str) => {
            if (!str) return [];
            return [...str.matchAll(/(\d{17,20})/g)].map(m => m[0]);
        };

        try {
            if (groupInput !== 'manual') {
                const all = await interaction.guild.members.fetch();
                if (groupInput === 'all') {
                    all.forEach((m, k) => targetMembers.set(k, m));
                    targetDescription = "Todos";
                } else if (groupInput === 'humans') {
                    const humans = all.filter(m => !m.user.bot);
                    humans.forEach((m, k) => targetMembers.set(k, m));
                    targetDescription = "Humanos";
                } else if (groupInput === 'bots') {
                    const bots = all.filter(m => m.user.bot);
                    bots.forEach((m, k) => targetMembers.set(k, m));
                    targetDescription = "Bots";
                }
            } else {
                // Manual
                const userIds = extractIds(usersInput);
                if (userIds.length > 0) {
                    if (userIds.length < 50) {
                        const fetched = await interaction.guild.members.fetch({ user: userIds });
                        fetched.forEach((m, k) => targetMembers.set(k, m));
                    } else {
                        const all = await interaction.guild.members.fetch();
                        all.filter(m => userIds.includes(m.id)).forEach((m, k) => targetMembers.set(k, m));
                    }
                    targetDescription = `${targetMembers.size} usuarios manuales`;
                }
            }
        } catch (e) {
            console.error(e);
            return interaction.editReply('❌ Error obteniendo usuarios.');
        }

        if (targetMembers.size === 0) {
            return interaction.editReply('⚠️ No se encontraron usuarios con los criterios especificados.');
        }

        const actionVerb = mode === 'asignar' ? 'Asignar' : 'Quitar';
        await interaction.editReply(`🔄 **Procesando SmartRole (${actionVerb})...**\nRol: ${roleToGive}\nExclusión (Protección): ${roleToExclude}\nObjetivo: ${targetDescription} (${targetMembers.size})\n⏳ Iniciando...`);

        let successCount = 0;
        let skippedExclusion = 0; // Protected
        let skippedNoAction = 0; // Already has (assign) or doesn't have (remove)
        let failCount = 0;
        let processed = 0;

        for (const [id, member] of targetMembers) {
            processed++;
            try {
                // 1. Check Exclusion (Protects user from ANY change)
                if (member.roles.cache.has(roleToExclude.id)) {
                    skippedExclusion++;
                    continue;
                }

                if (mode === 'asignar') {
                    // MODO ASIGNAR
                    if (member.roles.cache.has(roleToGive.id)) {
                        skippedNoAction++;
                        continue;
                    }
                    await member.roles.add(roleToGive);
                    successCount++;
                } else {
                    // MODO QUITAR
                    if (!member.roles.cache.has(roleToGive.id)) {
                        skippedNoAction++; // Doesn't have it, can't remove
                        continue;
                    }
                    await member.roles.remove(roleToGive);
                    successCount++;
                }

                // Rate Limit Protection
                if (successCount % 5 === 0) await new Promise(r => setTimeout(r, 1000));

            } catch (e) {
                console.error(`Smartrole error on ${member.user.tag}:`, e.message);
                failCount++;
            }

            if (processed % 100 === 0) console.log(`SmartRole Progress: ${processed}/${targetMembers.size}`);
        }

        await interaction.editReply(`✅ **SmartRole Finalizado (${actionVerb})**\n🎯 Exitosos: ${successCount}\n🛡️ Protegidos (Exclusión): ${skippedExclusion}\nℹ️ Sin cambios necesarios: ${skippedNoAction}\n❌ Errores: ${failCount}`);
    }
};
