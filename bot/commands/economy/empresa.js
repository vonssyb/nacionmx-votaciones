const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PaginationHelper = require('../../utils/PaginationHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('empresa')
        .setDescription('🏢 Gestión Avanzada de Empresa')
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
                        .setRequired(true))),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({});

        const subcommand = interaction.options.getSubcommand();

        try {
            // Get user's company (Owner OR Employee)
            let company = null;
            let employeeRecord = null;

            // 1. Check Owner
            const { data: ownerComp } = await supabase
                .from('companies')
                .select('*')
                .eq('owner_id', interaction.user.id)
                .maybeSingle();

            if (ownerComp) {
                company = ownerComp;
            } else {
                // 2. Check Employee (Two-step fetch to avoid join issues)
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
                        employeeRecord = emp;
                        company = empComp;
                    }
                }
            }

            if (!company) {
                return interaction.editReply('❌ No tienes una empresa registrada ni eres empleado.');
            }

            if (subcommand === 'contratar') {
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
            } else if (subcommand === 'cobrar') {
                const cliente = interaction.options.getUser('cliente');
                const monto = interaction.options.getInteger('monto');
                const concepto = interaction.options.getString('concepto');

                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

                const embed = new EmbedBuilder()
                    .setTitle(`🧾 Factura: ${company.name}`)
                    .setDescription(`**${interaction.user.tag}** le ha enviado un cobro.`)
                    .addFields(
                        { name: '👤 Cliente', value: `<@${cliente.id}>`, inline: true },
                        { name: '💰 Monto', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: '📝 Concepto', value: concepto, inline: false }
                    )
                    .setColor('#F1C40F')
                    .setThumbnail(company.logo_url || null)
                    .setFooter({ text: 'Pagos seguros vía Nación MX Bank' })
                    .setTimestamp();

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
