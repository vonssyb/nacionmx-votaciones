const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apagar')
        .setDescription('🚨 APAGADO DE EMERGENCIA (Solo dueños)')
        .addStringOption(option =>
            option.setName('contraseña')
                .setDescription('Contraseña de seguridad requerida')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        // Defer reply to ensure we can respond even if process exits quickly (though we should await reply first)
        await interaction.deferReply({ ephemeral: true });

        const password = interaction.options.getString('contraseña');

        if (password !== 'vonssybmono') {
            return interaction.editReply('❌ Contraseña incorrecta. Este intento ha sido registrado.');
        }

        console.log(`🚨 EMERGENCY SHUTDOWN TRIGGERED BY ${interaction.user.tag} (${interaction.user.id})`);

        await interaction.editReply('🚨 **APAGANDO SISTEMA DE INMEDIATO...**');

        // Give a small delay to ensure the reply is sent
        setTimeout(() => {
            console.log('🛑 Process exiting via /apagar command.');
            process.exit(0);
        }, 1000);
    },
};
