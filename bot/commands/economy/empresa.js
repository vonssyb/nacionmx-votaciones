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
                .setDescription('Ver dashboard completo de tu empresa')),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({});

        const subcommand = interaction.options.getSubcommand();

        try {
            // Get user's company
            const { data: company, error: compError } = await supabase
                .from('companies')
                .select('*')
                .eq('owner_id', interaction.user.id)
                .maybeSingle();

            if (!company) {
                return interaction.editReply('❌ No tienes una empresa registrada. Usa `/empresa crear` primero (legacy handler).');
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

                // Hire
                await supabase.from('company_employees').insert({
                    company_id: company.id,
                    discord_id: targetUser.id,
                    citizen_name: citizen?.full_name || targetUser.tag,
                    role: role,
                    salary: salary
                });

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
            }

        } catch (error) {
            console.error('[empresa] Error:', error);
            await interaction.editReply('❌ Error al procesar la acción.');
        }
    }
};
