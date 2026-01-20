/**
 * Jest Test Setup
 * Configures mocks and global test utilities
 */

// Mock Discord.js
jest.mock('discord.js', () => ({
    Client: jest.fn(),
    GatewayIntentBits: {},
    Partials: {},
    EmbedBuilder: jest.fn().mockImplementation(() => ({
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
    })),
    ActionRowBuilder: jest.fn().mockImplementation(() => ({
        addComponents: jest.fn().mockReturnThis(),
    })),
    ButtonBuilder: jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis(),
        setEmoji: jest.fn().mockReturnThis(),
    })),
    ButtonStyle: {
        Primary: 1,
        Secondary: 2,
        Success: 3,
        Danger: 4,
        Link: 5,
    },
}));

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lt: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
    })),
}));

// Mock environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.DISCORD_TOKEN_MOD = 'test-token-mod';
process.env.DISCORD_TOKEN_ECO = 'test-token-eco';
process.env.DISCORD_TOKEN_GOV = 'test-token-gov';
process.env.GUILD_ID = '1234567890';

// Test utilities
global.createMockInteraction = () => ({
    id: 'test-interaction-id',
    commandName: 'test',
    customId: null,
    user: {
        id: 'test-user-id',
        tag: 'TestUser#1234',
        username: 'TestUser',
    },
    guild: {
        id: 'test-guild-id',
    },
    guildId: 'test-guild-id',
    member: {
        id: 'test-user-id',
        roles: {
            cache: new Map(),
        },
        permissions: {
            has: jest.fn().mockReturnValue(true),
        },
    },
    channel: {
        id: 'test-channel-id',
    },
    channelId: 'test-channel-id',
    deferred: false,
    replied: false,
    reply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    deferReply: jest.fn().mockResolvedValue({}),
    followUp: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    deferUpdate: jest.fn().mockResolvedValue({}),
    options: {
        getString: jest.fn(),
        getInteger: jest.fn(),
        getNumber: jest.fn(),
        getUser: jest.fn(),
        getSubcommand: jest.fn(),
    },
    createdTimestamp: Date.now(),
    client: {
        users: {
            fetch: jest.fn().mockResolvedValue({
                id: 'test-user-id',
                tag: 'TestUser#1234',
            }),
        },
        channels: {
            fetch: jest.fn().mockResolvedValue({
                id: 'test-channel-id',
                send: jest.fn().mockResolvedValue({}),
            }),
        },
    },
});

global.createMockSupabase = () => {
    const mockFrom = jest.fn(() => mockQuery);

    const mockQuery = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    return {
        from: mockFrom,
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
};

// Suppress console logs during tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
