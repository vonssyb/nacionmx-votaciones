// Command registration for /limits
// Add to bot/register_commands.js or manual_register.js

new SlashCommandBuilder()
    .setName('limits')
    .setDescription('Gestionar límites de tarjetas por rol (Solo Admins)')
    .addSubcommand(subcommand =>
        subcommand
            .setName('view')
            .setDescription('Ver límites de un rol')
            .addRoleOption(option =>
                option
                    .setName('role')
                    .setDescription('Rol a consultar (default si no se especifica)')
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('set-role')
            .setDescription('Ajustar límite de un rol')
            .addRoleOption(option =>
                option
                    .setName('role')
                    .setDescription('Rol a modificar')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('tipo')
                    .setDescription('Tipo de límite')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Débito Base', value: 'debit_base_limit' },
                        { name: 'Débito Máximo', value: 'debit_max_limit' },
                        { name: 'Crédito Oro', value: 'credit_oro_limit' },
                        { name: 'Crédito Black', value: 'credit_black_limit' },
                        { name: 'Crédito Diamante', value: 'credit_diamante_limit' },
                        { name: 'Business', value: 'business_limit' },
                        { name: 'Transacción Máxima', value: 'max_transaction' },
                        { name: 'Límite Diario', value: 'daily_transaction_limit' }
                    )
            )
            .addIntegerOption(option =>
                option
                    .setName('valor')
                    .setDescription('Nuevo valor del límite')
                    .setRequired(true)
                    .setMinValue(0)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('set-user')
            .setDescription('Establecer override para usuario específico')
            .addUserOption(option =>
                option
                    .setName('usuario')
                    .setDescription('Usuario a modificar')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('tipo')
                    .setDescription('Tipo de límite')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Débito', value: 'debit_limit' },
                        { name: 'Crédito Oro', value: 'credit_oro_limit' },
                        { name: 'Crédito Black', value: 'credit_black_limit' },
                        { name: 'Business', value: 'business_limit' },
                        { name: 'Transacción Máxima', value: 'max_transaction' },
                        { name: 'Límite Diario', value: 'daily_limit' }
                    )
            )
            .addIntegerOption(option =>
                option
                    .setName('valor')
                    .setDescription('Nuevo valor del límite')
                    .setRequired(true)
                    .setMinValue(0)
            )
            .addStringOption(option =>
                option
                    .setName('razon')
                    .setDescription('Razón del override')
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('reset-user')
            .setDescription('Eliminar override de usuario')
            .addUserOption(option =>
                option
                    .setName('usuario')
                    .setDescription('Usuario a resetear')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('Listar todos los roles configurados')
    )
    .toJSON()
