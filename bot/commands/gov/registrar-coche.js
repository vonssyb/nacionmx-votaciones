const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar-coche')
        .setDescription('🚗 Registrar un vehículo nuevo a tu nombre')
        .addStringOption(option =>
            option.setName('matricula')
                .setDescription('Placa del vehículo (Ej: ABC-123)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('modelo')
                .setDescription('Marca y Modelo (Ej: Nissan Tsuru)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Color del vehículo')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de vehículo (Define el costo)')
                .setRequired(true)
                .addChoices(
                    { name: 'Particular ($1,000)', value: 'Particular' },
                    { name: 'SUV / Pickup ($1,500)', value: 'SUV' },
                    { name: 'Oficial / Emergencias ($2,000)', value: 'Oficial' },
                    { name: 'Pesado / Camión ($2,500)', value: 'Pesado' }
                )),

    async execute(interaction, client, supabase) {
        await interaction.deferReply();
        const member = interaction.member;

        // 1. DNI Check (Required for owning a car)
        const { data: dni } = await supabase
            .from('citizen_dni')
            .select('id')
            .eq('guild_id', interaction.guildId)
            .eq('user_id', interaction.user.id)
            .maybeSingle();

        if (!dni) {
            return interaction.editReply('❌ **Sin DNI:** Necesitas un DNI para registrar vehículos. Usa `/dni crear`.');
        }

        const matricula = interaction.options.getString('matricula').toUpperCase();
        const modelo = interaction.options.getString('modelo');
        const color = interaction.options.getString('color');
        const tipo = interaction.options.getString('tipo');

        // 2. Validate plate format (ABC-123)
        const plateRegex = /^[A-Z]{3}-[0-9]{3}$/;
        if (!plateRegex.test(matricula)) {
            return interaction.editReply('❌ **Formato de Placa Inválido**\n\nDebe ser 3 letras, guión, 3 números.\n**Ejemplo:** ABC-123');
        }

        // 3. Determine Cost
        const COSTS = {
            'Particular': 1000,
            'SUV': 1500,
            'Oficial': 2000,
            'Pesado': 2500
        };
        const cost = COSTS[tipo];

        // 3. Validation: Check duplicate plate
        const { data: existingCar } = await supabase
            .from('vehicles')
            .select('id')
            .eq('guild_id', interaction.guildId)
            .eq('plate', matricula)
            .maybeSingle();

        if (existingCar) {
            return interaction.editReply(`❌ **Placa Duplicada:** La matrícula \`${matricula}\` ya está registrada.`);
        }

        // 4. Charge Money
        const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
        if (process.env.UNBELIEVABOAT_TOKEN) {
            const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);
            try {
                // Check balance first? UB throws if insufficient funds usually.
                await ubService.removeMoney(interaction.guildId, interaction.user.id, cost, 0, `Registro Vehículo: ${matricula}`);
            } catch (error) {
                return interaction.editReply(`❌ **Fondos Insuficientes** o Error: No tienes $${cost.toLocaleString()} para este registro.`);
            }
        }

        // 5. Register in DB
        const { error } = await supabase.from('vehicles').insert({
            guild_id: interaction.guildId,
            user_id: interaction.user.id,
            plate: matricula,
            model: modelo,
            color: color,
            type: tipo
        });

        if (error) {
            console.error('Vehicle Error:', error);
            return interaction.editReply('❌ Error de base de datos al registrar vehículo.');
        }

        // 6. Success
        // 6. Success & Generate Card
        const ImageGenerator = require('../../utils/ImageGenerator');
        try {
            // We have 'dni' object from step 1 (Check DNI)
            // We have car info.
            const carData = {
                plate: matricula,
                model: modelo,
                color: color,
                type: tipo,
                created_at: new Date().toISOString()
            };

            const cardBuffer = await ImageGenerator.generateCarCard(carData, dni);
            const attachment = new EmbedBuilder().image // Wait, attachment is separate
            const { AttachmentBuilder } = require('discord.js');
            const file = new AttachmentBuilder(cardBuffer, { name: 'tarjeta.png' });

            const embed = new EmbedBuilder()
                .setTitle('🚗 Vehículo Registrado Correctamente')
                .setColor('#2ECC71')
                .setDescription(`Se ha emitido la tarjeta de circulación para el vehículo **${matricula}**.`)
                .setImage('attachment://tarjeta.png')
                .setFooter({ text: 'Nación MX | Secretaría de Finanzas' });

            await interaction.editReply({ embeds: [embed], files: [file] });

        } catch (imgError) {
            console.error('Error generating car card:', imgError);
            // Fallback to text embed if image fails
            const embed = new EmbedBuilder()
                .setTitle('🚗 Vehículo Registrado')
                .setColor('#2ECC71')
                .addFields(
                    { name: 'Propietario', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Vehículo', value: modelo, inline: true },
                    { name: 'Matrícula', value: `\`${matricula}\``, inline: true },
                    { name: 'Color', value: color, inline: true },
                    { name: 'Tipo', value: tipo, inline: true },
                    { name: 'Costo', value: `$${cost.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: 'Nación MX | Secretaría de Finanzas' });

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
