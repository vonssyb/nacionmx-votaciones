// /limits command handler - Add to bot/index.js
// Fase 3, Item #8: Dynamic Card Limits - Admin Command

/*
COMANDO: /limits
Gestión de límites de tarjetas por rol y usuario

Subcomandos:
- /limits view [role]: Ver límites de un rol
- /limits set-role [role] [tipo] [valor]: Ajustar límite de rol
- /limits set-user [usuario] [tipo] [valor]: Override para usuario
- /limits reset-user [usuario]: Remover override
- /limits list: Listar todos los roles

Permisos: Solo admins (ManageGuild o rol específico)
*/

else if (commandName === 'limits') {
    // Check permissions
    const hasPermission = interaction.member.permissions.has('ManageGuild') ||
        interaction.member.roles.cache.has('ADMIN_ROLE_ID'); // Configure this

    if (!hasPermission) {
        return interaction.reply({
            content: '❌ No tienes permisos para gestionar límites.',
            flags: [64]
        });
    }

    await interaction.deferReply({ flags: [64] });

    const subcommand = interaction.options.getSubcommand();
    const limitsService = new (require('./services/LimitsService'))(supabase);

    try {
        if (subcommand === 'view') {
            const roleOption = interaction.options.getRole('role');
            const roleId = roleOption ? roleOption.id : 'default';
            const roleName = roleOption ? roleOption.name : 'Default';

            const limits = await limitsService.getRoleLimits(roleId);

            if (!limits) {
                return interaction.editReply('❌ No se encontraron límites para este rol.');
            }

            const formatted = limitsService.formatLimits(limits);

            const embed = {
                title: `📊 Límites para @${roleName}`,
                color: 0xFFD700,
                fields: [
                    {
                        name: '💳 Débito',
                        value: `Base: ${formatted.debit.split(' - ')[0]}\nMáximo: ${formatted.debit.split(' - ')[1]}`,
                        inline: true
                    },
                    {
                        name: '💎 Crédito',
                        value: `Start: ${formatted.credit.start}\nOro: ${formatted.credit.oro}\nBlack: ${formatted.credit.black}\nDiamante: ${formatted.credit.diamante}`,
                        inline: true
                    },
                    {
                        name: '💼 Business',
                        value: formatted.business,
                        inline: true
                    },
                    {
                        name: '🔄 Transacciones',
                        value: `Máximo: ${formatted.transactions.max}\nDiario: ${formatted.transactions.daily}`,
                        inline: false
                    }
                ],
                footer: {
                    text: `Role ID: ${roleId}`
                }
            };

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'set-role') {
            const roleOption = interaction.options.getRole('role');
            const tipo = interaction.options.getString('tipo');
            const valor = interaction.options.getInteger('valor');

            const roleId = roleOption.id;
            const roleName = roleOption.name;

            // Build limits object
            const limits = {};
            limits[tipo] = valor;

            await limitsService.setRoleLimits(roleId, roleName, limits, interaction.user.id);

            await interaction.editReply({
                content: `✅ **Límite Actualizado**\n\nRol: @${roleName}\nTipo: \`${tipo}\`\nNuevo límite: $${valor.toLocaleString()}\n\nCambio aplicado por: ${interaction.user.tag}`,
                flags: [64]
            });

        } else if (subcommand === 'set-user') {
            const user = interaction.options.getUser('usuario');
            const tipo = interaction.options.getString('tipo');
            const valor = interaction.options.getInteger('valor');
            const razon = interaction.options.getString('razon') || 'Override manual';

            const limits = {};
            limits[tipo] = valor;

            await limitsService.setUserOverride(user.id, limits, razon, interaction.user.id);

            await interaction.editReply({
                content: `✅ **Override Establecido**\n\nUsuario: ${user.tag}\nTipo: \`${tipo}\`\nNuevo límite: $${valor.toLocaleString()}\nRazón: ${razon}\n\nAplicado por: ${interaction.user.tag}`,
                flags: [64]
            });

        } else if (subcommand === 'reset-user') {
            const user = interaction.options.getUser('usuario');

            await limitsService.removeUserOverride(user.id, interaction.user.id);

            await interaction.editReply({
                content: `✅ **Override Eliminado**\n\nUsuario: ${user.tag} ahora usa los límites de su rol.\n\nAplicado por: ${interaction.user.tag}`,
                flags: [64]
            });

        } else if (subcommand === 'list') {
            const roles = await limitsService.listRoles();

            if (roles.length === 0) {
                return interaction.editReply('❌ No hay roles configurados.');
            }

            const embed = {
                title: '📋 Roles Configurados',
                description: 'Roles con límites personalizados:',
                color: 0xFFD700,
                fields: roles.map(role => ({
                    name: role.role_name,
                    value: `ID: \`${role.role_id}\``,
                    inline: true
                })),
                footer: {
                    text: `Total: ${roles.length} roles`
                }
            };

            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error in /limits command:', error);
        await interaction.editReply('❌ Error al procesar el comando. Verifica los logs.');
    }
}

// To add this command:
// 1. Register it with Discord (add to manual_register.js or commands array)
// 2. Add this handler to handleExtraCommands function
// 3. Configure ADMIN_ROLE_ID
// 4. Test in Discord
