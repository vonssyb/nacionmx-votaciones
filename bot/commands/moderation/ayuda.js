const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('🛡️ Ver comandos de Moderación y Policía'),

    async execute(interaction, client, supabase) {
        const initialEmbed = new EmbedBuilder()
            .setTitle('🛡️ Moderación Nación MX - Ayuda')
            .setColor(0x0000FF) // Blue
            .setDescription('**Sistema de Justicia y Staff**\nSelecciona una categoría.')
            .setFooter({ text: 'Bot de Moderación' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_mod_category')
            .setPlaceholder('Menú de Moderación...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Sanciones').setDescription('Warns, Bans, Blacklists').setValue('sanctions').setEmoji('🔨'),
                new StringSelectMenuOptionBuilder().setLabel('Policía & Justicia').setDescription('Arrestos, Misiones, ERLC').setValue('police').setEmoji('👮'),
                new StringSelectMenuOptionBuilder().setLabel('Administración').setDescription('Setup, Staff').setValue('admin').setEmoji('⚙️'),
                new StringSelectMenuOptionBuilder().setLabel('Ciudadano').setDescription('Historial, Apelaciones').setValue('user').setEmoji('👤'),
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const response = await interaction.editReply({ embeds: [initialEmbed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 });

        collector.on('collect', async i => {
            if (i.customId !== 'help_mod_category') return;
            if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Menú ajeno.', flags: [64] });

            const category = i.values[0];
            const newEmbed = new EmbedBuilder().setColor(0x0000FF).setTimestamp();

            switch (category) {
                case 'sanctions':
                    newEmbed.setTitle('🔨 Sistema de Sanciones')
                        .addFields(
                            { name: '`/sancion`', value: 'Panel principal de sanciones (Warn, Kick, Ban, SA, Blacklist).' },
                            { name: '`/ver_warns`', value: 'Buscar historial de usuario.' },
                            { name: 'Blacklists', value: 'Solo Junta Directiva: Cartel, Policial, Política, Empresas, Total.' },
                            { name: 'ERLC', value: 'Soporte para Kicks/Bans directos al servidor ERLC.' }
                        );
                    break;
                case 'police':
                    newEmbed.setTitle('👮 Policía & ERLC')
                        .addFields(
                            { name: '`/arrestar`', value: 'Procesar detenido (Auto-Kick ERLC).' },
                            { name: '`/fianza calcular/pagar`', value: 'Sistema de fianzas.' },
                            { name: '`/mod shift`', value: 'Control de turno (S2/S3).' },
                            { name: '`/mision`', value: 'Misiones diarias policiales.' },
                            { name: '`/reputacion`', value: 'Karma policial.' }
                        );
                    break;
                case 'admin':
                    newEmbed.setTitle('⚙️ Administración')
                        .addFields(
                            { name: '`/rango`', value: 'Gestión de Staff (Promover/Degradar).' },
                            { name: '`/sesion`', value: 'Votaciones para abrir servidor.' },
                            { name: '`/server`', value: 'Bloqueo/Desbloqueo manual del servidor (.lock).' },
                            { name: '`/setup-erlc`', value: 'Vincular servidor ERLC.' },
                            { name: '`/verificar`', value: 'Forzar verificación Roblox.' }
                        );
                    break;
                case 'user':
                    newEmbed.setTitle('👤 Ciudadano')
                        .addFields(
                            { name: '`/mis_warns`', value: 'Ver tu historial penal.' },
                            { name: '`/apelacion`', value: 'Impugnar una sanción.' },
                            { name: '`/fianza`', value: 'Consultar costo de libertad.' }
                        );
                    break;
            }
            await i.update({ embeds: [newEmbed], components: [row] });
        });
    }
};
