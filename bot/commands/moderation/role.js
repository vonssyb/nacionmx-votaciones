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
        await interaction.editReply(`🔄 **Procesando...** ${actionText} rol ${role.name} a ${targetMembers.size} usuarios (${targetType}). Esto puede tardar.`);

        let successCount = 0;
        let failCount = 0;

        // Process in chunks/delay to avoid heavy rate limits
        for (const [id, member] of targetMembers) {
            try {
                if (action === 'add' && !member.roles.cache.has(role.id)) {
                    await member.roles.add(role);
                    successCount++;
                } else if (action === 'remove' && member.roles.cache.has(role.id)) {
                    await member.roles.remove(role);
                    successCount++;
                }
                // Small sleep every 10 ops
                if (successCount % 10 === 0) await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                failCount++;
            }
        }

        await interaction.editReply(`✅ **Operación Completada**\nRol: ${role.name}\nAcción: ${action}\nObjetivo: ${targetType}\n✅ Éxitos: ${successCount}\n❌ Fallos/Omitidos: ${failCount}`);
    }
};
