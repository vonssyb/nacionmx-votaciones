const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Gestión de roles avanzada')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('mass')
                .setDescription('Gestión de roles masiva (All, Humans, Bots)')
                .addStringOption(opt =>
                    opt.setName('target')
                        .setDescription('A quién aplicar el cambio')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Todos (All)', value: 'all' },
                            { name: 'Humanos', value: 'humans' },
                            { name: 'Bots', value: 'bots' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Acción a realizar')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Dar Rol (Add)', value: 'add' },
                            { name: 'Quitar Rol (Remove)', value: 'remove' }
                        )
                )
                .addRoleOption(opt => opt.setName('role').setDescription('El rol a gestionar').setRequired(true))
        ),
    async execute(interaction, client) {
        const targetType = interaction.options.getString('target');
        const action = interaction.options.getString('action');
        const role = interaction.options.getRole('role');

        await interaction.deferReply();

        // Security check: Don't mess with dangerous roles
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.editReply('❌ No puedo gestionar un rol superior o igual al mío.');
        }

        const members = await interaction.guild.members.fetch();
        let targetMembers;

        if (targetType === 'all') {
            targetMembers = members;
        } else if (targetType === 'humans') {
            targetMembers = members.filter(m => !m.user.bot);
        } else if (targetType === 'bots') {
            targetMembers = members.filter(m => m.user.bot);
        }

        const actionText = action === 'add' ? 'Añadiendo' : 'Quitando';
        await interaction.editReply(`🔄 **Procesando...** ${actionText} rol ${role.name} a ${targetMembers.size} usuarios (${targetType}). Esto puede tardar varios minutos...`);

        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;
        let processed = 0;

        // Process in chunks/delay to avoid heavy rate limits
        for (const [id, member] of targetMembers) {
            processed++;
            try {
                if (action === 'add') {
                    if (!member.roles.cache.has(role.id)) {
                        await member.roles.add(role);
                        successCount++;
                        // Delay to prevent rate limits (1s every 5 reqs)
                        if (successCount % 5 === 0) await new Promise(r => setTimeout(r, 1000));
                    } else {
                        skippedCount++;
                    }
                } else if (action === 'remove') {
                    if (member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                        successCount++;
                        // Delay to prevent rate limits (1s every 5 reqs)
                        if (successCount % 5 === 0) await new Promise(r => setTimeout(r, 1000));
                    } else {
                        skippedCount++;
                    }
                }
            } catch (e) {
                console.error(`Error processing ${member.user.tag}:`, e.message);
                failCount++;
            }

            // Log progress every 100 users
            if (processed % 100 === 0) {
                console.log(`Mass Role Progress: ${processed}/${targetMembers.size}`);
            }
        }

        await interaction.editReply(`✅ **Operación Completada**\nRol: ${role.name}\nAcción: ${action}\nObjetivo: ${targetType}\n✅ Éxitos (Cambios realizados): ${successCount}\n⏭️ Omitidos (Ya tenían el estado): ${skippedCount}\n❌ Fallos: ${failCount}`);
    }
};
