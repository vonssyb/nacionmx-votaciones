const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vincular-roblox')
        .setDescription('🔗 Vincula tu cuenta de Roblox para usar comandos ERLC')
        .addStringOption(option =>
            option.setName('usuario')
                .setDescription('Tu nombre de usuario exacto en Roblox')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        const robloxUser = interaction.options.getString('usuario');
        const discordId = interaction.user.id;

        try {
            // 1. Verificar si ya existe vinculación
            const { data: existing } = await supabase
                .from('roblox_discord_links')
                .select('*')
                .or(`discord_user_id.eq.${discordId},roblox_username.eq.${robloxUser}`)
                .maybeSingle();

            if (existing) {
                if (existing.discord_user_id === discordId) {
                    return interaction.editReply(`❌ Ya tienes vinculada la cuenta: **${existing.roblox_username}**`);
                }
                if (existing.roblox_username.toLowerCase() === robloxUser.toLowerCase()) {
                    return interaction.editReply(`❌ El usuario **${robloxUser}** ya está vinculado a otra cuenta de Discord.`);
                }
            }

            // 2. Crear vinculación
            const { error } = await supabase
                .from('roblox_discord_links')
                .insert({
                    roblox_username: robloxUser,
                    discord_user_id: discordId
                });

            if (error) throw error;

            const embed = new EmbedBuilder()
                .setTitle('✅ Vinculación Exitosa')
                .setDescription(`Ahora tu cuenta de Discord está conectada con **${robloxUser}**`)
                .addFields(
                    { name: 'Funciones Habilitadas', value: '• `:log talk [msg]` en ERLC enviará mensajes al canal de voz donde estés conectado.' }
                )
                .setColor(0x00FF00);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hubo un error al guardar la vinculación.');
        }
    }
};
