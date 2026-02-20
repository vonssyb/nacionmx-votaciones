const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const CharacterService = require('../services/CharacterService');
const DNIService = require('../services/DNIService');
const PermissionService = require('../services/PermissionService');

// Initialize Services
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const characterService = new CharacterService(null, supabase); // client passed if needed

module.exports = {
    data: new SlashCommandBuilder()
        .setName('personaje')
        .setDescription('Gestión de personajes (Exclusivo Ultrapass)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Ver información del personaje activo'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cambiar')
                .setDescription('Cambiar de personaje activo')
                .addIntegerOption(option =>
                    option.setName('slot')
                        .setDescription('Slot del personaje (1 o 2)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Personaje 1 (Principal)', value: 1 },
                            { name: 'Personaje 2 (Secundario - Ultrapass)', value: 2 }
                        ))),

    async execute(interaction) {
        if (!interaction.guild) return;

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand === 'info') {
            const activeChar = await characterService.getActiveCharacter(userId);
            const dni = await DNIService.getDNI(supabase, userId, activeChar);

            const embed = new EmbedBuilder()
                .setTitle(`👤 Información de Personaje Activo`)
                .setColor(activeChar === 1 ? '#00FF00' : '#FFD700')
                .addFields(
                    { name: 'Slot Activo', value: `Personaje #${activeChar}`, inline: true },
                    { name: 'Estado DNI', value: dni ? '✅ Registrado' : '❌ No registrado', inline: true },
                    { name: 'Identidad', value: dni ? dni.nombre : 'Desconocido', inline: false }
                );

            if (dni) {
                embed.addFields(
                    { name: 'CURP', value: dni.curp, inline: true },
                    { name: 'Nacionalidad', value: dni.nacionalidad || 'Mexicana', inline: true }
                );
            }

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'cambiar') {
            const slot = interaction.options.getInteger('slot');

            // Permission Check for Slot 2
            if (slot === 2) {
                // Check for Ultrapass Role
                // HARDCODED ROLE ID FROM EconomyHelper.js: '1414033620636532849'
                const ULTRAPASS_ROLE_ID = '1414033620636532849';
                const hasRole = interaction.member.roles.cache.has(ULTRAPASS_ROLE_ID);

                if (!hasRole) {
                    return interaction.reply({
                        content: '🚫 **Acceso Denegado**: El Slot 2 es exclusivo para miembros **Ultrapass**.',
                        ephemeral: true
                    });
                }
            }

            const success = await characterService.setActiveCharacter(userId, slot);

            if (success) {
                const embed = new EmbedBuilder()
                    .setTitle('🔄 Cambio de Personaje')
                    .setDescription(`Has cambiado exitosamente al **Personaje #${slot}**.`)
                    .setColor('#00FF00')
                    .setFooter({ text: 'Todos los comandos (DNI, Banco, etc.) ahora usarán este personaje.' });

                return interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                return interaction.reply({ content: '❌ Error al cambiar de personaje.', ephemeral: true });
            }
        }
    },
};
