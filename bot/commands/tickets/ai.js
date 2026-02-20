const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const AIService = require('../../services/AIService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Comandos de Inteligencia Artificial para Staff')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub =>
            sub.setName('consultar')
                .setDescription('Consulta la base de conocimiento de la IA')
                .addStringOption(option =>
                    option.setName('pregunta')
                        .setDescription('¿Qué quieres saber?')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('perfil')
                .setDescription('Genera un perfil psicológico/usuario basado en tickets')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuario a analizar')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('aprender')
                .setDescription('Enseña manualmente algo a la IA')
                .addStringOption(option =>
                    option.setName('dato')
                        .setDescription('Conocimiento a guardar')
                        .setRequired(true)
                )
        ),

    async execute(interaction, client, supabase) {
        await interaction.deferReply();
        const ai = new AIService(supabase);
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'consultar') {
            const question = interaction.options.getString('pregunta');

            const answer = await ai.consult(question);

            const embed = new EmbedBuilder()
                .setTitle('🤖 Respuesta de IA')
                .setDescription(answer)
                .setColor(0x5865F2)
                .setFooter({ text: `Pregunta: ${question}` });

            await interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'perfil') {
            const targetUser = interaction.options.getUser('usuario');
            const profile = await ai.profileUser(targetUser.id);

            const embed = new EmbedBuilder()
                .setTitle(`🧠 Perfil de Usuario: ${targetUser.username}`)
                .setDescription(profile)
                .setColor(0x9B59B6)
                .setThumbnail(targetUser.displayAvatarURL());

            await interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'aprender') {
            const fact = interaction.options.getString('dato');

            // Manual injection
            await ai.storeMemory(
                'GENERAL_KNOWLEDGE',
                fact,
                'MANUAL',
                interaction.user.id,
                ['manual', 'staff_knowledge'],
                1.0
            );

            await interaction.editReply(`✅ **Dato guardado en memoria:** "${fact}"`);
        }
    }
};
