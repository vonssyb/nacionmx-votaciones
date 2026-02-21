const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const AIService = require('../../services/AIService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff_perfil')
        .setDescription('🕵️ [STAFF] Obtiene el Perfil Psicológico y de Riesgo de un usuario (IA Mente Maestra).')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a perfilar')
                .setRequired(true)
        )
        // Solo administradores/moderadores por defecto en Discord
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, client, supabase) {
        // Doble verificación: Solo roles de Staff de NacionMX
        const staffRoles = ['1412887167654690908', '1398526164253888640', '1412882245735420006'];
        const isStaff = interaction.member.roles.cache.some(r => staffRoles.includes(r.id)) || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

        if (!isStaff) {
            return interaction.reply({ content: '🚫 Solo el Staff puede investigar a los ciudadanos.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('usuario');

        await interaction.deferReply({ ephemeral: false }); // Ephemeral = true si quieres que solo lo vea el que llamó el comando

        try {
            const ai = new AIService(supabase);

            // Verificamos si la IA tiene el motor activo
            const groq = ai.getGroqClient();
            if (!groq) {
                return interaction.editReply('❌ **NMX-Córtex:** Mis sistemas lógicos están desconectados. Verifica las llaves de GROQ.');
            }

            // Llamar a la función principal de perfilación
            const profile = await ai.profileUser(targetUser.id, targetUser.username);

            const embed = new EmbedBuilder()
                .setTitle(`🕵️ Perfil Criminológico IA: ${targetUser.username}`)
                .setDescription(profile)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setColor(0x2B2D31)
                .setFooter({ text: 'CONFIDENCIAL - Uso exclusivo de Moderación NacionMX', iconURL: 'https://cdn-icons-png.flaticon.com/512/2065/2065181.png' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error generando perfil IA del usuario:', error);
            await interaction.editReply('❌ Ocurrió un error al contactar con la Mente Maestra para generar el perfil.');
        }
    },
};
