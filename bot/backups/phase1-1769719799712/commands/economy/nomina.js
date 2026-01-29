const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nomina')
        .setDescription('💼 Sistema de Nóminas para Empresas')
        .addSubcommand(sub => sub
            .setName('crear')
            .setDescription('Crear un nuevo grupo de nómina')
            .addStringOption(opt => opt.setName('nombre').setDescription('Nombre del grupo (ej: Ejecutivos)').setRequired(true))
            .addStringOption(opt => opt.setName('empresa_id').setDescription('ID de la empresa (Opcional si solo tienes una)').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('agregar')
            .setDescription('Agregar empleado a un grupo de nómina')
            .addStringOption(opt => opt.setName('grupo').setDescription('Nombre del grupo').setRequired(true))
            .addUserOption(opt => opt.setName('empleado').setDescription('Usuario a agregar').setRequired(true))
            .addIntegerOption(opt => opt.setName('salario').setDescription('Salario a pagar').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('pagar')
            .setDescription('Pagar un grupo de nómina')
            .addStringOption(opt => opt.setName('grupo').setDescription('Nombre del grupo a pagar').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('ver')
            .setDescription('Ver detalles de un grupo')
            .addStringOption(opt => opt.setName('grupo').setDescription('Nombre del grupo').setRequired(true))),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'crear') {
                const name = interaction.options.getString('nombre');

                // Find company owned by user
                const { data: companies } = await supabase.from('companies').select('*').contains('owner_ids', [interaction.user.id]);

                if (!companies || companies.length === 0) return interaction.editReply('❌ No eres dueño de ninguna empresa.');

                let companyId = companies[0].id; // Default to first
                if (companies.length > 1) {
                    // Logic for selector if needed, for simplicity use first or specified
                    const specified = interaction.options.getString('empresa_id');
                    if (specified) companyId = specified;
                    // Validate ownership
                    const target = companies.find(c => c.id === companyId);
                    if (!target) return interaction.editReply('❌ No eres dueño de esa empresa o ID inválido.');
                }

                const { data: group, error } = await supabase.from('payroll_groups').insert({
                    name: name,
                    company_id: companyId,
                    owner_discord_id: interaction.user.id,
                    created_at: new Date().toISOString()
                }).select().single();

                if (error) throw error;
                await interaction.editReply(`✅ Grupo de nómina **${name}** creado para la empresa ID: ${companyId}`);

            } else if (subcommand === 'agregar') {
                const groupName = interaction.options.getString('grupo');
                const user = interaction.options.getUser('empleado');
                const salary = interaction.options.getInteger('salario');

                const { data: group } = await supabase.from('payroll_groups').select('*').eq('name', groupName).eq('owner_discord_id', interaction.user.id).single();
                if (!group) return interaction.editReply('❌ Grupo no encontrado.');

                await supabase.from('payroll_items').insert({
                    group_id: group.id,
                    discord_user_id: user.id,
                    salary: salary
                });

                await interaction.editReply(`✅ ${user.tag} agregado a nómina **${groupName}** con salario $${salary.toLocaleString()}`);

            } else if (subcommand === 'pagar') {
                const groupName = interaction.options.getString('grupo');
                const { data: group } = await supabase.from('payroll_groups').select('*, companies(*)').eq('name', groupName).eq('owner_discord_id', interaction.user.id).single();

                if (!group) return interaction.editReply('❌ Grupo no encontrado.');

                const { data: items } = await supabase.from('payroll_items').select('*').eq('group_id', group.id);
                if (!items || items.length === 0) return interaction.editReply('❌ El grupo está vacío.');

                const total = items.reduce((sum, item) => sum + item.salary, 0);

                // Check company balance
                if (group.companies.balance < total) return interaction.editReply(`❌ La empresa no tiene fondos suficientes. Requiere: $${total.toLocaleString()}`);

                // Deduct from company
                await supabase.from('companies').update({ balance: group.companies.balance - total }).eq('id', group.companies.id);

                // Pay employees
                const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
                const ub = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);

                let paidList = '';
                for (const item of items) {
                    await ub.addMoney(interaction.guildId, item.discord_user_id, item.salary, `Nómina: ${group.companies.name}`, 'bank');
                    paidList += `<@${item.discord_user_id}>: $${item.salary.toLocaleString()}\n`;
                }

                // Log
                await supabase.from('company_transactions').insert({
                    company_id: group.companies.id,
                    type: 'payroll',
                    amount: total,
                    description: `Pago de Nómina: ${groupName}`,
                    created_by: interaction.user.id
                });

                const embed = new EmbedBuilder()
                    .setTitle('💸 Nómina Pagada Exitosamente')
                    .setDescription(`**Empresa:** ${group.companies.name}\n**Total:** $${total.toLocaleString()}\n\n**Empleados Pagados:**\n${paidList}`)
                    .setColor(0x2ECC71);

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'ver') {
                const groupName = interaction.options.getString('grupo');
                const { data: group } = await supabase.from('payroll_groups').select('*').eq('name', groupName).eq('owner_discord_id', interaction.user.id).single();
                if (!group) return interaction.editReply('❌ Grupo no encontrado.');

                const { data: items } = await supabase.from('payroll_items').select('*').eq('group_id', group.id);

                const list = items.map(i => `<@${i.discord_user_id}>: $${i.salary.toLocaleString()}`).join('\n') || 'Sin empleados';

                const embed = new EmbedBuilder()
                    .setTitle(`📋 Nómina: ${groupName}`)
                    .setDescription(list)
                    .setColor(0x3498DB);

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (e) {
            console.error(e);
            await interaction.editReply('❌ Error procesando comando. Asegúrate de que las tablas `payroll_groups` existen.');
        }
    }
};
