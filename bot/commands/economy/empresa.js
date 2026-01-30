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
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('eliminar')
                .setDescription('⚠️ Eliminar permanentemente tu empresa'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('📊 Ver panel de control y estadísticas de tu empresa'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reporte')
                .setDescription('📈 Generar reporte financiero de la empresa')
                .addStringOption(option =>
                    option.setName('periodo')
                        .setDescription('Periodo del reporte')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Mensual (últimos 30 días)', value: 'monthly' },
                            { name: 'Anual (últimos 365 días)', value: 'yearly' },
                            { name: 'Todo el tiempo', value: 'all' }
                        ))),

    async execute(interaction, client, supabase) {
        // Handle autocomplete requests
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true);

            try {
                let choices = [];

                // For company name autocomplete - user's own companies
                if (focusedOption.name === 'empresa_nombre') {
                    const { data: companies } = await supabase
                        .from('companies')
                        .select('id, name, balance')
                        .contains('owner_ids', [interaction.user.id])
                        .order('name');

                    if (companies) {
                        choices = companies
                            .filter(c => c.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                            .slice(0, 25) // Discord limit
                            .map(c => ({
                                name: `${c.name} ($${(c.balance || 0).toLocaleString()})`,
                                value: c.id
                            }));
                    }
                }

                return await interaction.respond(choices);
            } catch (error) {
                console.error('[empresa autocomplete] Error:', error);
                return await interaction.respond([]);
            }
        }

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


            } else if (subcommand === 'retirar') {
                // Rate limit check (15 seconds)
                const rateLimitCheck = client.services.rateLimit.checkCooldown(
                    interaction.user.id,
                    'empresa_retirar',
                    15000
                );

                if (!rateLimitCheck.allowed) {
                    return interaction.editReply(
                        `⏳ Debes esperar **${rateLimitCheck.remaining}s** antes de retirar fondos nuevamente.`
                    );
                }

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
                // Rate limit check (10 seconds)
                const rateLimitCheck = client.services.rateLimit.checkCooldown(
                    interaction.user.id,
                    'empresa_depositar',
                    10000
                );

                if (!rateLimitCheck.allowed) {
                    return interaction.editReply(
                        `⏳ Debes esperar **${rateLimitCheck.remaining}s** antes de depositar nuevamente.`
                    );
                }

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
                // Rate limit check (30 seconds)
                const rateLimitCheck = client.services.rateLimit.checkCooldown(
                    interaction.user.id,
                    'empresa_transferir',
                    30000
                );

                if (!rateLimitCheck.allowed) {
                    return interaction.editReply(
                        `⏳ Debes esperar **${rateLimitCheck.remaining}s** antes de transferir otra empresa.`
                    );
                }

                // Only current owners can transfer
                if (!isOwner) {
                    return interaction.editReply('❌ Solo un dueño puede transferir la empresa.');
                }

                const newOwner = interaction.options.getUser('nuevo_dueño');
                const previousOwnerId = interaction.user.id;

                // Transfer complete ownership (replace all owners with just the new one)
                await supabase.from('companies')
                    .update({ owner_ids: [newOwner.id] })
                    .eq('id', company.id);

                // Manage roles
                const CompanyService = require('../../services/CompanyService');
                await CompanyService.removeBusinessmanRole(interaction.guild, previousOwnerId, supabase);
                await CompanyService.assignBusinessmanRole(interaction.guild, newOwner.id);

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
                // Rate limit check (10 seconds)
                const rateLimitCheck = client.services.rateLimit.checkCooldown(
                    interaction.user.id,
                    'empresa_cobrar',
                    10000
                );

                if (!rateLimitCheck.allowed) {
                    return interaction.editReply(
                        `⏳ Debes esperar **${rateLimitCheck.remaining}s** antes de cobrar nuevamente.`
                    );
                }

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

            } else if (subcommand === 'eliminar') {
                const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
                const CompanyService = require('../../services/CompanyService');

                // Get user's companies (must be owner)
                const { data: ownedCompanies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [interaction.user.id]);

                if (!ownedCompanies || ownedCompanies.length === 0) {
                    return interaction.editReply('❌ No tienes ninguna empresa registrada.');
                }

                let selectedCompany = null;

                if (ownedCompanies.length > 1) {
                    // Multiple companies - show selector
                    const { StringSelectMenuBuilder } = require('discord.js');

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`empresa_select_delete_${interaction.user.id}`)
                        .setPlaceholder('Selecciona la empresa a eliminar')
                        .addOptions(ownedCompanies.map(comp => ({
                            label: comp.name,
                            description: `Balance: $${(comp.balance || 0).toLocaleString()}`,
                            value: comp.id
                        })));

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    await interaction.editReply({
                        content: '⚠️ **Selecciona la empresa que deseas eliminar:**',
                        components: [row]
                    });

                    // Wait for selection
                    const filter = i => i.customId.startsWith('empresa_select_delete_') && i.user.id === interaction.user.id;
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
                    const selectedId = collected.values[0];
                    selectedCompany = ownedCompanies.find(c => c.id === selectedId);
                } else {
                    selectedCompany = ownedCompanies[0];
                }

                // Get employees count
                const { data: employees } = await supabase
                    .from('company_employees')
                    .select('user_id')
                    .eq('company_id', selectedCompany.id);

                const employeeCount = employees?.length || 0;

                // Show confirmation
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Confirmar Eliminación de Empresa')
                    .setColor('#E74C3C')
                    .setDescription(`Estás a punto de **eliminar permanentemente** la siguiente empresa:`)
                    .addFields(
                        { name: '🏢 Empresa', value: selectedCompany.name, inline: true },
                        { name: '💰 Balance', value: `$${(selectedCompany.balance || 0).toLocaleString()}`, inline: true },
                        { name: '👥 Empleados', value: `${employeeCount}`, inline: true }
                    )
                    .setFooter({ text: '⚠️ Esta acción NO se puede deshacer' })
                    .setTimestamp();

                if (selectedCompany.balance > 0) {
                    confirmEmbed.addFields({
                        name: '💵 Transferencia',
                        value: `El balance de $${selectedCompany.balance.toLocaleString()} será transferido a tu cuenta.`,
                        inline: false
                    });
                }

                const confirmButton = new ButtonBuilder()
                    .setCustomId(`confirm_delete_${selectedCompany.id}_${Date.now()}`)
                    .setLabel('Sí, eliminar empresa')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️');

                const cancelButton = new ButtonBuilder()
                    .setCustomId('cancel_delete')
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Secondary);

                const buttonRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                await interaction.editReply({
                    embeds: [confirmEmbed],
                    components: [buttonRow]
                });

                // Wait for confirmation
                const btnFilter = i => i.user.id === interaction.user.id;
                const btnCollected = await interaction.channel.awaitMessageComponent({
                    filter: btnFilter,
                    time: 30000
                }).catch(() => null);

                if (!btnCollected) {
                    return interaction.editReply({
                        content: '⏱️ Confirmación expirada. Empresa no eliminada.',
                        embeds: [],
                        components: []
                    });
                }

                await btnCollected.deferUpdate();

                if (btnCollected.customId === 'cancel_delete') {
                    return interaction.editReply({
                        content: '✅ Eliminación cancelada.',
                        embeds: [],
                        components: []
                    });
                }

                // Proceed with deletion
                try {
                    // 1. Transfer balance to owner
                    if (selectedCompany.balance > 0) {
                        const { data: ownerProfile } = await supabase
                            .from('profiles')
                            .select('balance')
                            .eq('user_id', interaction.user.id)
                            .single();

                        const newBalance = (ownerProfile?.balance || 0) + selectedCompany.balance;

                        await supabase
                            .from('profiles')
                            .update({ balance: newBalance })
                            .eq('user_id', interaction.user.id);

                        // Log transaction
                        await supabase.from('money_history').insert({
                            user_id: interaction.user.id,
                            amount: selectedCompany.balance,
                            previous_balance: ownerProfile?.balance || 0,
                            new_balance: newBalance,
                            type: 'company_dissolution',
                            description: `Liquidación de empresa: ${selectedCompany.name}`
                        });
                    }

                    // 2. Delete employees
                    if (employeeCount > 0) {
                        await supabase
                            .from('company_employees')
                            .delete()
                            .eq('company_id', selectedCompany.id);
                    }

                    // 3. Delete company
                    await supabase
                        .from('companies')
                        .delete()
                        .eq('id', selectedCompany.id);

                    // 4. Remove businessman role if no more companies
                    await CompanyService.removeBusinessmanRole(interaction.guild, interaction.user.id, supabase);

                    // Success message
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Empresa Eliminada')
                        .setColor('#2ECC71')
                        .setDescription(`La empresa **${selectedCompany.name}** ha sido eliminada exitosamente.`)
                        .setTimestamp();

                    if (selectedCompany.balance > 0) {
                        successEmbed.addFields({
                            name: '💰 Fondos Transferidos',
                            value: `$${selectedCompany.balance.toLocaleString()} han sido agregados a tu cuenta.`,
                            inline: false
                        });
                    }

                    await interaction.editReply({
                        embeds: [successEmbed],
                        components: []
                    });

                } catch (deleteError) {
                    console.error('[empresa eliminar] Error:', deleteError);
                    return interaction.editReply({
                        content: '❌ Error al eliminar la empresa. Intenta de nuevo.',
                        embeds: [],
                        components: []
                    });
                }

            } else if (subcommand === 'dashboard') {
                const CompanyService = require('../../services/CompanyService');

                // Get user's companies
                const { data: ownedCompanies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [interaction.user.id]);

                if (!ownedCompanies || ownedCompanies.length === 0) {
                    return interaction.editReply('❌ No tienes ninguna empresa registrada.');
                }

                let selectedCompany = ownedCompanies[0];

                // If multiple companies, show selector
                if (ownedCompanies.length > 1) {
                    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`empresa_select_dashboard_${interaction.user.id}`)
                        .setPlaceholder('Selecciona la empresa para ver su dashboard')
                        .addOptions(ownedCompanies.map(comp => ({
                            label: comp.name,
                            description: `Balance: $${(comp.balance || 0).toLocaleString()}`,
                            value: comp.id
                        })));

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    await interaction.editReply({
                        content: '🏢 **Selecciona la empresa:**',
                        components: [row]
                    });

                    const filter = i => i.customId.startsWith('empresa_select_dashboard_') && i.user.id === interaction.user.id;
                    const collected = await interaction.channel.awaitMessageComponent({
                        filter,
                        time: 60000
                    }).catch(() => null);

                    if (!collected) {
                        return interaction.editReply({
                            content: '⏱️ Tiempo agotado.',
                            components: []
                        });
                    }

                    await collected.deferUpdate();
                    const selectedId = collected.values[0];
                    selectedCompany = ownedCompanies.find(c => c.id === selectedId);
                }

                // Get company stats
                const stats = await CompanyService.getCompanyStats(supabase, selectedCompany.id);

                if (!stats) {
                    return interaction.editReply('❌ Error al obtener estadísticas de la empresa.');
                }

                // Build dashboard embed
                const dashboardEmbed = new EmbedBuilder()
                    .setTitle(`📊 Dashboard: ${stats.company.name}`)
                    .setColor('#3498DB')
                    .setThumbnail(stats.company.logo_url || null)
                    .setTimestamp();

                // Balance and vehicles
                dashboardEmbed.addFields(
                    { name: '💰 Balance', value: `$${(stats.company.balance || 0).toLocaleString()}`, inline: true },
                    { name: '🚗 Vehículos', value: `${stats.company.vehicle_count || 0}`, inline: true },
                    { name: '👥 Empleados', value: `${stats.employeeCount}`, inline: true }
                );

                // Payroll
                if (stats.totalPayroll > 0) {
                    dashboardEmbed.addFields({
                        name: '💵 Nómina Mensual Total',
                        value: `$${stats.totalPayroll.toLocaleString()}`,
                        inline: false
                    });
                }

                // Employees list
                if (stats.employees.length > 0) {
                    const employeeList = stats.employees
                        .slice(0, 5) // Show max 5
                        .map(emp => `• <@${emp.user_id}> - ${emp.role || 'Empleado'} ($${(emp.salary || 0).toLocaleString()}/mes)`)
                        .join('\n');

                    dashboardEmbed.addFields({
                        name: '👔 Empleados Activos',
                        value: employeeList + (stats.employees.length > 5 ? `\n...y ${stats.employees.length - 5} más` : ''),
                        inline: false
                    });
                }

                // Recent transactions
                if (stats.transactions.length > 0) {
                    const txList = stats.transactions
                        .slice(0, 3) // Show max 3
                        .map(tx => {
                            const amount = tx.amount || 0;
                            const type = tx.type || 'unknown';
                            const sign = amount >= 0 ? '+' : '';
                            return `• ${sign}$${amount.toLocaleString()} - ${type}`;
                        })
                        .join('\n');

                    dashboardEmbed.addFields({
                        name: '📊 Últimas Transacciones',
                        value: txList || 'Sin transacciones recientes',
                        inline: false
                    });
                }

                // Quick action buttons
                const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Contratar')
                        .setCustomId(`quickaction_hire_${selectedCompany.id}`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('👨‍💼'),
                    new ButtonBuilder()
                        .setLabel('Ver Menú')
                        .setURL(selectedCompany.menu_url || '#')
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('📋')
                        .setDisabled(!selectedCompany.menu_url)
                );

                if (selectedCompany.discord_server) {
                    buttons.addComponents(
                        new ButtonBuilder()
                            .setLabel('Discord')
                            .setURL(selectedCompany.discord_server)
                            .setStyle(ButtonStyle.Link)
                            .setEmoji('💬')
                    );
                }

                await interaction.editReply({
                    embeds: [dashboardEmbed],
                    components: [buttons]
                });

            } else if (subcommand === 'reporte') {
                const CompanyService = require('../../services/CompanyService');
                const periodo = interaction.options.getString('periodo');

                // Get user's companies
                const { data: ownedCompanies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [interaction.user.id]);

                if (!ownedCompanies || ownedCompanies.length === 0) {
                    return interaction.editReply('❌ No tienes ninguna empresa registrada.');
                }

                let selectedCompany = ownedCompanies[0];

                // If multiple companies, show selector
                if (ownedCompanies.length > 1) {
                    const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`empresa_select_report_${interaction.user.id}`)
                        .setPlaceholder('Selecciona la empresa para generar reporte')
                        .addOptions(ownedCompanies.map(comp => ({
                            label: comp.name,
                            description: `Balance: $${(comp.balance || 0).toLocaleString()}`,
                            value: comp.id
                        })));

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    await interaction.editReply({
                        content: '🏢 **Selecciona la empresa:**',
                        components: [row]
                    });

                    const filter = i => i.customId.startsWith('empresa_select_report_') && i.user.id === interaction.user.id;
                    const collected = await interaction.channel.awaitMessageComponent({
                        filter,
                        time: 60000
                    }).catch(() => null);

                    if (!collected) {
                        return interaction.editReply({
                            content: '⏱️ Tiempo agotado.',
                            components: []
                        });
                    }

                    await collected.deferUpdate();
                    const selectedId = collected.values[0];
                    selectedCompany = ownedCompanies.find(c => c.id === selectedId);
                }

                // Generate report
                const report = await CompanyService.generateFinancialReport(supabase, selectedCompany.id, periodo);

                if (!report) {
                    return interaction.editReply('❌ Error al generar el reporte financiero.');
                }

                // Create report embed
                const reportEmbed = new EmbedBuilder()
                    .setTitle(`📈 Reporte Financiero: ${report.company.name}`)
                    .setDescription(`**Periodo:** ${report.periodLabel}`)
                    .setColor(report.netIncome >= 0 ? '#2ECC71' : '#E74C3C')
                    .setThumbnail(report.company.logo_url || null)
                    .setTimestamp();

                // Financial summary
                reportEmbed.addFields(
                    { name: '💰 Ingresos Totales', value: `$${report.income.toLocaleString()}`, inline: true },
                    { name: '💸 Gastos Totales', value: `$${report.expenses.toLocaleString()}`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true } // Blank for alignment
                );

                // Net income with visual indicator
                const netSymbol = report.netIncome >= 0 ? '📈' : '📉';
                const netColor = report.netIncome >= 0 ? '🟢' : '🔴';
                reportEmbed.addFields({
                    name: `${netSymbol} Balance Neto`,
                    value: `${netColor} **$${report.netIncome.toLocaleString()}**`,
                    inline: false
                });

                // Additional metrics
                reportEmbed.addFields(
                    { name: '💵 Nómina Mensual', value: `$${report.monthlyPayroll.toLocaleString()}`, inline: true },
                    { name: '📊 Transacciones', value: `${report.transactionCount}`, inline: true },
                    { name: '💰 Balance Actual', value: `$${(report.company.balance || 0).toLocaleString()}`, inline: true }
                );

                // Transaction breakdown
                if (report.transactionCount > 0) {
                    reportEmbed.addFields({
                        name: '📝 Desglose de Transacciones',
                        value: `✅ Ingresos: ${report.incomeTransactions}\n❌ Gastos: ${report.expenseTransactions}`,
                        inline: false
                    });
                }

                // Simple ASCII chart (income vs expenses)
                const maxValue = Math.max(report.income, report.expenses, 1);
                const incomeBar = '█'.repeat(Math.ceil((report.income / maxValue) * 20));
                const expenseBar = '█'.repeat(Math.ceil((report.expenses / maxValue) * 20));

                reportEmbed.addFields({
                    name: '📊 Comparación Visual',
                    value: `💰 Ingresos:  ${incomeBar}\n💸 Gastos:    ${expenseBar}`,
                    inline: false
                });

                // Footer with warning if netIncome is negative
                if (report.netIncome < 0) {
                    reportEmbed.setFooter({
                        text: '⚠️ Balance neto negativo - Considera reducir gastos o aumentar ingresos'
                    });
                } else {
                    reportEmbed.setFooter({
                        text: `✅ Rendimiento positivo en el periodo seleccionado`
                    });
                }

                await interaction.editReply({
                    embeds: [reportEmbed],
                    components: []
                });
            }

        } catch (error) {
            console.error('[empresa] Error:', error);
            await interaction.editReply('❌ Error al procesar la acción.');
        }
    }
};
