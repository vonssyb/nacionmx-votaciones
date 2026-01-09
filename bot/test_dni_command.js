const DNICommand = require('./commands/gov/dni.js');
const ImageGenerator = require('./utils/ImageGenerator');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

// Mock Interaction
const mockInteraction = {
    options: {
        getSubcommand: () => 'ver',
        getUser: () => ({ id: '123456789', tag: 'TestUser', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' }),
        getMember: () => ({ id: '123456789' }),
        getString: () => 'TestString',
        getInteger: () => 20
    },
    user: { id: '123456789', tag: 'TestUser' },
    guild: {
        id: 'guild1',
        roles: { cache: { get: () => ({ id: 'roleid' }) } }
    },
    guildId: 'guild1', // Added guildId
    member: {
        id: '123456789',
        roles: { cache: { has: () => true } }, // Mock admin or bypass
        permissions: { has: () => true }
    },
    replied: true,
    deferred: true,
    editReply: async (payload) => {
        console.log('Interaction.editReply called with:', JSON.stringify(payload, null, 2));
        if (payload.files) {
            console.log('Files attached:', payload.files.length);
        }
    }
};

// Mock Supabase
const mockSupabase = {
    from: (table) => {
        const queryBuilder = {
            select: () => queryBuilder,
            eq: (col, val) => queryBuilder, // Chainable
            single: async () => ({
                data: {
                    id: '12345678-1234-1234-1234-123456789012',
                    user_id: '123456789',
                    nombre: 'Juan',
                    apellido: 'Perez',
                    edad: 30,
                    genero: 'Masculino',
                    fecha_nacimiento: '1995-05-15',
                    user_tag: 'juan.perez',
                    foto_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
                },
                error: null
            }),
            maybeSingle: async () => ({
                data: {
                    id: '12345678-1234-1234-1234-123456789012',
                    user_id: '123456789',
                    nombre: 'Juan',
                    apellido: 'Perez',
                    edad: 30,
                    genero: 'Masculino',
                    fecha_nacimiento: '1995-05-15',
                    user_tag: 'juan.perez',
                    foto_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
                },
                error: null
            })
        };
        return queryBuilder;
    }
};

async function main() {
    console.log('Testing DNI Command...');
    try {
        await DNICommand.execute(mockInteraction, {}, mockSupabase);
        console.log('Command executed successfully.');
    } catch (e) {
        console.error('Command failed:', e);
    }
}

main();
