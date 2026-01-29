const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PaginationHelper = require('../../utils/PaginationHelper');
const JobValidator = require('../../services/JobValidator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('empresa')
        .setDescription('🏢 Gestión Avanzada de Empresa')
        .addSubcommand(subcommand =>
            subcommand
                .setName('crear')
                .setDescription('Crear una nueva empresa')
                .addStringOption(option => option.setName('nombre').setDescription('Nombre de la empresa').setRequired(true))
                .addUserOption(option => option.setName('dueño').setDescription('Dueño de la empresa').setRequired(true))
                .addStringOption(option => option.setName('descripcion').setDescription('Descripción de la empresa').setRequired(true))
                .addStringOption(option => option.setName('menu_url').setDescription('Enlace al menú/catálogo de servicios').setRequired(true))
                .addStringOption(option => option.setName('discord_server').setDescription('Enlace al servidor de Discord').setRequired(true))
                .addStringOption(option =>
                    option.setName('tipo_local')
                        .setDescription('Tamaño del local (Costo varía)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Pequeño ($850k)', value: 'pequeño' },
                            { name: 'Mediano ($1.75M)', value: 'mediano' },
                            { name: 'Grande ($3.2M)', value: 'grande' },
                            { name: 'Gigante ($5M)', value: 'gigante' }
                        ))
                .addAttachmentOption(option => option.setName('logo').setDescription('Logo de la empresa').setRequired(false))
                .addStringOption(option => option.setName('ubicacion').setDescription('Ubicación (Calles)').setRequired(false))
                .addAttachmentOption(option => option.setName('foto_local').setDescription('Foto del local').setRequired(false))
                .addUserOption(option => option.setName('co_dueño').setDescription('Co-Dueño inicial (opcional)').setRequired(false))
                .addBooleanOption(option => option.setName('es_privada').setDescription('Empresa privada (no listada en directorio)').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('contratar')
                .setDescription('Contratar un empleado para tu empresa')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuario a contratar')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('salario')
                        .setDescription('Salario mensual (en $)')
                        .setRequired(true)
                        .setMinValue(1000))
                .addStringOption(option =>
                    option.setName('rol')
                        .setDescription('Cargo del empleado')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('despedir')
                .setDescription('Despedir un empleado')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Empleado a despedir')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('empleados')
                .setDescription('Ver lista de empleados'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('salario')
                .setDescription('Ajustar salario de un empleado')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Empleado')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('nuevo_salario')
                        .setDescription('Nuevo salario mensual')
                        .setRequired(true)
                        .setMinValue(1000)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reporte')
                .setDescription('Ver dashboard completo de tu empresa'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cobrar')
                .setDescription('Realizar un cobro a un cliente')
                .addUserOption(option =>
                    option.setName('cliente')
                        .setDescription('Cliente a cobrar')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('monto')
                        .setDescription('Monto a cobrar')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('concepto')
                        .setDescription('Motivo del cobro (ej: Venta de comida)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('retirar')
                .setDescription('Retirar fondos de la empresa a tu cuenta personal')
                .addIntegerOption(option =>
                    option.setName('monto')
                        .setDescription('Monto a retirar')
                        .setRequired(true)
                        .setMinValue(1))
                .addStringOption(option =>
                    option.setName('concepto')
                        .setDescription('Motivo del retiro (opcional)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('depositar')
                .setDescription('Depositar fondos personales a la empresa')
                .addIntegerOption(option =>
                    option.setName('monto')
                        .setDescription('Monto a depositar')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remover_dueño')
                .setDescription('Remover un socio/dueño de la empresa')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Socio a remover')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('transferir')
                .setDescription('Transferir la propiedad completa de la empresa')
                .addUserOption(option =>
                    option.setName('nuevo_dueño')
                        .setDescription('Nuevo dueño de la empresa')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Ver directorio de empresas públicas'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('actualizar')
                .setDescription('Actualizar información de tu empresa')
                .addStringOption(option =>
                    option.setName('descripcion')
                        .setDescription('Nueva descripción')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('menu_url')
                        .setDescription('Nuevo enlace al menú')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('discord_server')
                        .setDescription('Nuevo enlace al servidor Discord')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('ubicacion')
                        .setDescription('Nueva ubicación')
                        .setRequired(false))
                .addAttachmentOption(option =>
                    option.setName('logo')
                        .setDescription('Nuevo logo')
                        .setRequired(false))
                .addAttachmentOption(option =>
                    option.setName('foto_local')
                        .setDescription('Nueva foto del local')
                        .setRequired(false))),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        // Note: deferReply is handled automatically by index_economia.js monkey-patch
        const subcommand = interaction.options.getSubcommand();

        try {
            // === PHASE 2.3: CENTRALIZED HANDLERS ===
            if (subcommand === 'crear') {
                if (client.services && client.services.companyManagement) {
                    return await client.services.companyManagement.handleCreateCommand(interaction);
                } else {
                    return interaction.editReply('❌ Servicio de gestión de empresas no disponible (Fase 2.3 Handler Missing).');
                }
            }

            // Handle VER subcommand (public directory)
            if (subcommand === 'ver') {
                const { data: companies } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('is_private', false)
                    .order('name');

                if (!companies || companies.length === 0) {
                    return interaction.editReply('📋 No hay empresas públicas registradas actualmente.');
                }

                // Use pagination
                await PaginationHelper.paginate(interaction, companies, {
                    itemsPerPage: 5,
                    formatPage: (pageCompanies, pageNum, totalPages) => {
                        const companyList = pageCompanies.map((c, idx) => {
                            const num = (pageNum * 5) + idx + 1;
                            let info = `**${num}. ${c.name}**\n`;
                            if (c.description) info += `📝 ${c.description}\n`;
                            if (c.menu_url) info += `📋 [Ver Menú](${c.menu_url})\n`;
                            if (c.discord_server) info += `💬 [Servidor Discord](${c.discord_server})\n`;
                            if (c.location) info += `📍 ${c.location}\n`;
                            info += `💰 Balance: $${(c.balance || 0).toLocaleString()}`;
                            return info;
                        }).join('\n\n');

                        const embed = new EmbedBuilder()
                            .setTitle('🏢 Directorio de Empresas')
                            .setDescription(companyList)
                            .setColor('#3498DB')
                            .setFooter({ text: `Página ${pageNum + 1}/${totalPages} • Total: ${companies.length} empresas` });

                        return embed;
                    }
                });
                return;
            }

            // Handle ACTUALIZAR subcommand
            if (subcommand === 'actualizar') {
                // Get user's companies (must be owner)
                const { data: ownedCompanies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [interaction.user.id]);

                if (!ownedCompanies || ownedCompanies.length === 0) {
                    return interaction.editReply('❌ No tienes ninguna empresa registrada. Solo los dueños pueden actualizar información.');
                }

                let selectedCompany = null;

                if (ownedCompanies.length > 1) {
                    // Multiple companies - show selector
                    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`empresa_select_update_${interaction.user.id}`)
                        .setPlaceholder('Selecciona la empresa a actualizar')
                        .addOptions(ownedCompanies.map(comp => ({
                            label: comp.name,
                            description: `Balance: $${(comp.balance || 0).toLocaleString()}`,
                            value: comp.id
                        })));

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    await interaction.editReply({
                        content: '🏢 **Selecciona la empresa que deseas actualizar:**',
                        components: [row]
                    });

                    // Wait for selection
                    const filter = i => i.customId.startsWith('empresa_select_update_') && i.user.id === interaction.user.id;
                    const collected = await interaction.channel.awaitMessageComponent({
                        filter,
                        time: 60000
                    }).catch(() => null);

                    if (!collected) {
                        return interaction.editReply({
                            content: '⏱️ Tiempo agotado para seleccionar empresa.',
                            components: []
                        });
                    }

                    await collected.deferUpdate();

                    // Get selected company
                    const selectedId = collected.values[0];
                    selectedCompany = ownedCompanies.find(c => c.id === selectedId);

                    // Clear menu
                    await interaction.editReply({ components: [] });
                } else {
                    selectedCompany = ownedCompanies[0];
                }

                // Get update fields
                const updates = {};
                const descripcion = interaction.options.getString('descripcion');
                const menuUrl = interaction.options.getString('menu_url');
                const discordServer = interaction.options.getString('discord_server');
                const ubicacion = interaction.options.getString('ubicacion');
                const logo = interaction.options.getAttachment('logo');
                const fotoLocal = interaction.options.getAttachment('foto_local');

                if (descripcion) updates.description = descripcion;
                if (menuUrl) {
                    // Validate URL
                    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
                    if (!urlRegex.test(menuUrl)) {
                        return interaction.editReply('❌ El enlace del menú no es válido.');
                    }
                    updates.menu_url = menuUrl;
                }
                if (discordServer) {
                    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
                    if (!urlRegex.test(discordServer)) {
                        return interaction.editReply('❌ El enlace del servidor Discord no es válido.');
                    }
                    updates.discord_server = discordServer;
                }
                if (ubicacion) updates.location = ubicacion;
                if (logo) updates.logo_url = logo.url;
                if (fotoLocal) updates.local_photo_url = fotoLocal.url;

                if (Object.keys(updates).length === 0) {
                    return interaction.editReply('❌ No proporcionaste ningún campo para actualizar.');
                }

                // Update company
                const { error } = await supabase
                    .from('companies')
                    .update(updates)
                    .eq('id', selectedCompany.id);

                if (error) {
                    console.error('[empresa/actualizar] Error:', error);
                    return interaction.editReply('❌ Error al actualizar la empresa.');
                }

                const embed = new EmbedBuilder()
                    .setTitle('✅ Empresa Actualizada')
                    .setColor('#2ECC71')
                    .setDescription(`Se ha actualizado la información de **${selectedCompany.name}**`)
                    .addFields(
                        Object.entries(updates).map(([key, value]) => ({
                            name: key === 'description' ? '📝 Descripción' :
                                key === 'menu_url' ? '📋 Menú' :
                                    key === 'discord_server' ? '💬 Discord' :
                                        key === 'location' ? '📍 Ubicación' :
                                            key === 'logo_url' ? '🖼️ Logo' :
                                                key === 'local_photo_url' ? '📸 Foto Local' : key,
                            value: typeof value === 'string' && value.startsWith('http') ? `[Ver enlace](${value})` : value.toString(),
                            inline: false
                        }))
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // ========================================
            // HELPER: Get User's Selected Company
            // ========================================
            const getSelectedCompany = async (requireOwner = false) => {
                // 1. Check if user owns companies
                const { data: ownedCompanies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [interaction.user.id]);

                if (ownedCompanies && ownedCompanies.length > 0) {
                    if (ownedCompanies.length === 1) {
                        return { company: ownedCompanies[0], isOwner: true };
                    }

                    // Multiple companies - show selector
                    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`empresa_select_${interaction.user.id}_${subcommand}`)
                        .setPlaceholder('Selecciona la empresa')
                        .addOptions(ownedCompanies.map(comp => ({
                            label: comp.name,
                            description: `Balance: $${(comp.balance || 0).toLocaleString()}`,
                            value: comp.id
                        })));

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    await interaction.editReply({
                        content: '🏢 **Tienes múltiples empresas**\\nSelecciona con cuál deseas operar:',
                        components: [row]
                    });

                    // Wait for selection
                    const filter = i => i.customId.startsWith('empresa_select_') && i.user.id === interaction.user.id;
                    const collected = await interaction.channel.awaitMessageComponent({
                        filter,
                        time: 60000
                    }).catch(() => null);

                    if (!collected) {
                        await interaction.editReply({
                            content: '⏱️ Tiempo agotado para seleccionar empresa.',
                            components: []
                        });
                        return null;
                    }

                    await collected.deferUpdate();

                    // Get selected company
                    const selectedId = collected.values[0];
                    const company = ownedCompanies.find(c => c.id === selectedId);

                    // Clear menu
                    await interaction.editReply({ components: [] });

                    return { company, isOwner: true };
                }

                // Not an owner - check if employee (only if not required to be owner)
                if (!requireOwner) {
                    const { data: emp } = await supabase
                        .from('company_employees')
                        .select('*')
                        .eq('discord_id', interaction.user.id)
                        .is('fired_at', null)
                        .maybeSingle();

                    if (emp) {
                        const { data: empComp } = await supabase
                            .from('companies')
                            .select('*')
                            .eq('id', emp.company_id)
                            .maybeSingle();

                        if (empComp) {
                            return { company: empComp, isOwner: false, employeeRecord: emp };
                        }
                    }
                }

                return null;
            };

            // Get user's company (Owner OR Employee)
            let company = null;
            let employeeRecord = null;
            
            // Use helper to get selected company
            const result = await getSelectedCompany();
            
            if (!result) {
                return interaction.editReply('❌ No tienes una empresa registrada ni eres empleado.');
            }

            company = result.company;
            const isOwner = result.isOwner;
            employeeRecord = result.employeeRecord || null;

            if (subcommand === 'contratar') {
                // Only owners can hire
                if (!isOwner) {
                    return interaction.editReply('❌ Solo el dueño puede contratar empleados.');
                }

                const targetUser = interaction.options.getUser('usuario');
                const salary = interaction.options.getInteger('salario');
                const role = interaction.options.getString('rol') || 'Empleado';

                // Check if already employed
                const { data: existingEmp } = await supabase
                    .from('company_employees')
                    .select('*')
                    .eq('company_id', company.id)
                    .eq('discord_id', targetUser.id)
                    .is('fired_at', null)
                    .maybeSingle();

                if (existingEmp) {
                    return interaction.editReply(`❌ ${targetUser.tag} ya trabaja en tu empresa.`);
                }

                // Get citizen name
                const { data: citizen } = await supabase
                    .from('citizens')
                    .select('full_name')
                    .eq('discord_id', targetUser.id)
                    .maybeSingle();

                // === JOB LIMIT CHECK ===
                const targetMember = await interaction.guild.members.fetch(targetUser.id);
                const limitCheck = await JobValidator.validateNewJob(targetMember, 'SECONDARY', supabase);

                if (!limitCheck.allowed) {
                    return interaction.editReply(limitCheck.reason);
                }
                // ========================

                // Hire - WITH ERROR VALIDATION
                console.log(`[empresa/contratar] Attempting to hire user ${targetUser.id} for company ${company.id}`);
                const { data: newEmp, error: insertError } = await supabase.from('company_employees').insert({
                    company_id: company.id,
                    discord_id: targetUser.id,           // Modular
                    discord_user_id: targetUser.id,      // Legacy compatibility
                    citizen_name: citizen?.full_name || targetUser.tag,
                    role: role,
                    salary: salary,
                    status: 'active',                    // Legacy compatibility
                    hired_at: new Date().toISOString()
                }).select();

                if (insertError) {
                    console.error('[empresa/contratar] Insert failed:', insertError);
                    return interaction.editReply(`❌ Error al contratar: ${insertError.message}\n\n**Posibles causas:**\n- Permisos de base de datos (RLS)\n- La empresa no existe\n- Error de conexión`);
                }

                if (!newEmp || newEmp.length === 0) {
                    console.error('[empresa/contratar] Insert succeeded but returned no data');
                    return interaction.editReply('❌ Error: La contratación no se pudo confirmar. Verifica permisos de la base de datos.');
                }

                console.log(`[empresa/contratar] ✅ Successfully hired user ${targetUser.id}`);

                const embed = new EmbedBuilder()
                    .setTitle('✅ Empleado Contratado')
                    .setColor('#2ECC71')
                    .addFields(
                        { name: '👤 Empleado', value: `<@${targetUser.id}>`, inline: true },
                        { name: '💼 Cargo', value: role, inline: true },
                        { name: '💰 Salario Mensual', value: `$${salary.toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: `Empresa: ${company.name}` })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'despedir') {
                // Only owners can fire employees
                if (!isOwner) {
                    return interaction.editReply('❌ Solo el dueño puede despedir empleados.');
                }

                const targetUser = interaction.options.getUser('usuario');

                const { data: emp } = await supabase
                    .from('company_employees')
                    .select('*')
                    .eq('company_id', company.id)
                    .eq('discord_id', targetUser.id)
                    .is('fired_at', null)
                    .maybeSingle();

                if (!emp) {
                    return interaction.editReply('❌ Este usuario no trabaja en tu empresa.');
                }

                await supabase
                    .from('company_employees')
                    .update({ fired_at: new Date().toISOString() })
                    .eq('id', emp.id);

                return interaction.editReply(`✅ ${targetUser.tag} ha sido despedido de ${company.name}.`);

            } else if (subcommand === 'empleados') {
                const { data: employees } = await supabase
                    .from('company_employees')
                    .select('*')
                    .eq('company_id', company.id)
                    .is('fired_at', null)
                    .order('hired_at', { ascending: false });

                if (!employees || employees.length === 0) {
                    return interaction.editReply('📋 No tienes empleados actualmente.');
                }

                // Use pagination
                await PaginationHelper.paginate(interaction, employees, {
                    itemsPerPage: 10,
                    formatPage: (pageEmployees, pageNum, totalPages) => {
                        const employeeList = pageEmployees.map((e, idx) => {
                            const num = (pageNum * 10) + idx + 1;
                            return `**${num}.** <@${e.discord_id}> - ${e.role}\n💰 Salario: $${e.salary.toLocaleString()}/mes`;
                        }).join('\n\n');

                        return new EmbedBuilder()
                            .setTitle(`👥 Empleados de ${company.name}`)
                            .setDescription(employeeList)
                            .setColor('#3498DB')
                            .setFooter({ text: `Página ${pageNum + 1}/${totalPages} • Total: ${employees.length} empleados` });
                    }
                });

            } else if (subcommand === 'salario') {
                // Only owners can adjust salaries
                if (!isOwner) {
                    return interaction.editReply('❌ Solo el dueño puede ajustar salarios.');
                }

                const targetUser = interaction.options.getUser('usuario');
                const newSalary = interaction.options.getInteger('nuevo_salario');

                const { data: emp } = await supabase
                    .from('company_employees')
                    .select('*')
                    .eq('company_id', company.id)
                    .eq('discord_id', targetUser.id)
                    .is('fired_at', null)
                    .maybeSingle();

                if (!emp) {
                    return interaction.editReply('❌ Este usuario no trabaja en tu empresa.');
                }

                await supabase
                    .from('company_employees')
                    .update({ salary: newSalary })
                    .eq('id', emp.id);

                return interaction.editReply(
                    `✅ Salario de ${targetUser.tag} actualizado:\n` +
                    `~~$${emp.salary.toLocaleString()}~~ → **$${newSalary.toLocaleString()}**/mes`
                );

            } else if (subcommand === 'reporte') {
                // Get employees count
                const { data: employees, count: empCount } = await supabase
                    .from('company_employees')
                    .select('*', { count: 'exact' })
                    .eq('company_id', company.id)
                    .is('fired_at', null);

                // Get total payroll
                const totalPayroll = employees?.reduce((sum, e) => sum + (e.salary || 0), 0) || 0;

                // Get recent transactions
                const { data: transactions } = await supabase
                    .from('company_transactions')
                    .select('*')
                    .eq('company_id', company.id)
                    .order('created_at', { ascending: false })
                    .limit(30);

                const income = transactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0;
                const expenses = transactions?.filter(t => t.type === 'expense' || t.type === 'payroll').reduce((sum, t) => sum + t.amount, 0) || 0;
                const netProfit = income - expenses;

                const embed = new EmbedBuilder()
                    .setTitle(`📊 Reporte de Empresa: ${company.name}`)
                    .setColor('#3498DB')
                    .setThumbnail(company.logo_url || null)
                    .addFields(
                        { name: '💼 Empleados Activos', value: `${empCount || 0}`, inline: true },
                        { name: '💰 Nómina Mensual', value: `$${totalPayroll.toLocaleString()}`, inline: true },
                        { name: '🏦 Balance', value: `$${(company.balance || 0).toLocaleString()}`, inline: true },
                        { name: '\u200b', value: '\u200b' }, // Spacer
                        { name: '📈 Ingresos (30d)', value: `$${income.toLocaleString()}`, inline: true },
                        { name: '📉 Gastos (30d)', value: `$${expenses.toLocaleString()}`, inline: true },
                        { name: '💎 Ganancia Neta', value: `$${netProfit.toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: `Industria: ${company.industry_type || 'General'}` })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'retirar') {
                // Only owners can withdraw
                if (!isOwner) {
                    return interaction.editReply('❌ Solo el dueño puede retirar fondos de la empresa.');
                }

                const monto = interaction.options.getInteger('monto');
                const concepto = interaction.options.getString('concepto') || 'Retiro de fondos';

                // Verify sufficient funds
                const currentBalance = company.balance || 0;
                if (currentBalance < monto) {
                    return interaction.editReply(`❌ Fondos insuficientes.\\n\\nBalance: $${currentBalance.toLocaleString()}\\nIntentando retirar: $${monto.toLocaleString()}`);
                }

                // Deduct from company
                await supabase.from('companies')
                    .update({ balance: currentBalance - monto })
                    .eq('id', company.id);

                // Add to owner's personal account
                const UnbelievaBoatService = client.billingService?.ubService;
                if (UnbelievaBoatService) {
                    await UnbelievaBoatService.addMoney(interaction.guildId, interaction.user.id, monto, `Retiro de ${company.name}`, 'bank');
                }

                // Log transaction
                await supabase.from('company_transactions').insert({
                    company_id: company.id,
                    type: 'expense',
                    amount: monto,
                    description: `Retiro a cuenta personal: ${concepto}`,
                    related_user_id: interaction.user.id
                });

                const embed = new EmbedBuilder()
                    .setTitle('💰 Retiro Exitoso')
                    .setColor('#2ECC71')
                    .addFields(
                        { name: '🏢 Empresa', value: company.name, inline: true },
                        { name: '💵 Monto Retirado', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: '🏦 Nuevo Balance', value: `$${(currentBalance - monto).toLocaleString()}`, inline: true },
                        { name: '📝 Concepto', value: concepto, inline: false }
                    )
                    .setFooter({ text: 'Los fondos han sido transferidos a tu cuenta bancaria' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'depositar') {
                const monto = interaction.options.getInteger('monto');

                // Check user balance (cash + bank)
                const UnbelievaBoatService = client.services?.billing?.ubService || client.billingService?.ubService || (client.services && client.services.billing && client.services.billing.ubService);

                if (!UnbelievaBoatService) {
                    return interaction.editReply('❌ Error: Servicio de facturación no disponible.');
                }

                const userBalance = await UnbelievaBoatService.getUserBalance(interaction.guildId, interaction.user.id);

                if (userBalance.bank < monto) {
                    return interaction.editReply(`❌ **Fondos insuficientes en Banco**\nRequieres: $${monto.toLocaleString()}\nTienes en Banco: $${userBalance.bank.toLocaleString()}`);
                }

                // Remove from user bank
                await UnbelievaBoatService.removeMoney(interaction.guildId, interaction.user.id, monto, `Depósito a empresa ${company.name}`, 'bank');

                // Add to company balance
                await supabase.from('companies')
                    .update({ balance: (company.balance || 0) + monto })
                    .eq('id', company.id);

                // Log transaction
                await supabase.from('company_transactions').insert({
                    company_id: company.id,
                    type: 'income',
                    amount: monto,
                    description: `Inyección de capital por ${interaction.user.tag}`,
                    related_user_id: interaction.user.id
                });

                const embed = new EmbedBuilder()
                    .setTitle('💰 Depósito Exitoso')
                    .setColor('#2ECC71')
                    .addFields(
                        { name: '🏢 A Empresa', value: company.name, inline: true },
                        { name: '💵 Monto Depositado', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: '🏦 Nuevo Balance Empresa', value: `$${((company.balance || 0) + monto).toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: 'Los fondos han sido transferidos desde tu cuenta personal' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'remover_dueño') {
                // Only owners can remove other owners
                if (!isOwner) {
                    return interaction.editReply('❌ Solo un dueño puede remover socios.');
                }

                const targetUser = interaction.options.getUser('usuario');

                // Check if target is an owner
                if (!company.owner_ids || !company.owner_ids.includes(targetUser.id)) {
                    return interaction.editReply(`❌ <@${targetUser.id}> no es dueño de **${company.name}**.`);
                }

                // Prevent removing yourself if you're the only owner
                if (company.owner_ids.length === 1) {
                    return interaction.editReply('❌ No puedes remover el último dueño. Usa `/empresa transferir` para cambiar de dueño.');
                }

                // Remove from owner_ids array
                const newOwners = company.owner_ids.filter(id => id !== targetUser.id);
                await supabase.from('companies')
                    .update({ owner_ids: newOwners })
                    .eq('id', company.id);

                const embed = new EmbedBuilder()
                    .setTitle('🚪 Socio Removido')
                    .setColor('#E74C3C')
                    .addFields(
                        { name: '🏢 Empresa', value: company.name, inline: true },
                        { name: '👤 Socio Removido', value: `<@${targetUser.id}>`, inline: true },
                        { name: '👥 Dueños Restantes', value: `${newOwners.length}`, inline: true }
                    )
                    .setFooter({ text: 'El usuario ya no tiene permisos de dueño en esta empresa' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'transferir') {
                // Only current owners can transfer
                if (!isOwner) {
                    return interaction.editReply('❌ Solo un dueño puede transferir la empresa.');
                }

                const newOwner = interaction.options.getUser('nuevo_dueño');

                // Transfer complete ownership (replace all owners with just the new one)
                await supabase.from('companies')
                    .update({ owner_ids: [newOwner.id] })
                    .eq('id', company.id);

                const embed = new EmbedBuilder()
                    .setTitle('🔄 Empresa Transferida')
                    .setColor('#3498DB')
                    .addFields(
                        { name: '🏢 Empresa', value: company.name, inline: false },
                        { name: '👤 Antiguo Dueño', value: `<@${interaction.user.id}>`, inline: true },
                        { name: '👤 Nuevo Dueño', value: `<@${newOwner.id}>`, inline: true }
                    )
                    .setDescription('⚠️ **Transferencia Completa:** El nuevo dueño tiene control total de la empresa.')
                    .setFooter({ text: 'Ya no tienes permisos en esta empresa' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'cobrar') {
                const cliente = interaction.options.getUser('cliente');
                const monto = interaction.options.getInteger('monto');
                const concepto = interaction.options.getString('concepto');

                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

                const embed = new EmbedBuilder()
                    .setTitle(`🧾 Factura: ${company.name}`)
                    .setDescription(`**${interaction.user.tag}** le ha enviado un cobro.`)
                    .addFields(
                        { name: '👤 Cliente', value: `<@${cliente.id}>`, inline: true },
                        { name: '💰 Monto', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: '📝 Concepto', value: concepto, inline: false },
                        { name: '⏳ Estado', value: 'Pendiente de pago', inline: false }
                    )
                    .setColor('#F1C40F')
                    .setThumbnail(company.logo_url || null)
                    .setFooter({ text: 'Pagos seguros vía Nación MX Bank' })
                    .setTimestamp();

                // Button ID: btn_pay_company_{companyId}_{amount}_{timestamp} (timestamp to unique)
                // Note: keeping ID short is good. {companyId}_{amount}
                const customId = `btn_pay_company_${company.id}_${monto}`;

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(customId)
                            .setLabel(`Pagar $${monto.toLocaleString()}`)
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('💳'),
                        new ButtonBuilder()
                            .setCustomId('btn_cancel') // Generic cancel? Or specific?
                            .setLabel('Rechazar')
                            .setStyle(ButtonStyle.Danger)
                    );

                // Reply so everyone sees (or ephemeral? No, client must see to click. But button only works for client?)
                // Usually we want public proof of charge.
                await interaction.editReply({
                    content: `<@${cliente.id}>`, // Ping client
                    embeds: [embed],
                    components: [row]
                });
            }

        } catch (error) {
            console.error('[empresa] Error:', error);
            await interaction.editReply('❌ Error al procesar la acción.');
        }
    }
};
