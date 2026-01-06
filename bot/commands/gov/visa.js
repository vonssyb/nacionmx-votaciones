const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Visa costs (automatically charged)
const VISA_COSTS = {
    turista: 10000,
    trabajo: 25000,
    estudiante: 50000,
    residente: 150000
};

// Visa durations (in days)
const VISA_DURATIONS = {
    turista: 90,
    trabajo: 180,
    estudiante: 365,
    residente: null // Permanent
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('visa')
        .setDescription('🇺🇸 US Visa System (USCIS Only)')
        .addSubcommand(sub => sub
            .setName('solicitar')
            .setDescription('Solicitar una Visa de EE.UU. (Requiere DNI Mexicano)')
            .addStringOption(opt => opt
                .setName('tipo')
                .setDescription('Tipo de visa')
                .setRequired(true)
                .addChoices(
                    { name: '🛂 Turista (B-2)', value: 'turista' },
                    { name: '💼 Trabajo (H-1B)', value: 'trabajo' },
                    { name: '📚 Estudiante (F-1)', value: 'estudiante' },
                    { name: '🏠 Residente (Green Card)', value: 'residente' }
                ))
            .addStringOption(opt => opt
                .setName('motivo')
                .setDescription('¿Por qué solicitas esta visa? (Mín. 10 caracteres)')
                .setRequired(true)
                .setMinLength(10)))
        .addSubcommand(sub => sub
            .setName('ver')
            .setDescription('Ver tu visa actual o estado de solicitud'))
        .addSubcommand(sub => sub
            .setName('aprobar')
            .setDescription('Aprobar una solicitud de visa - USCIS Only')
            .addStringOption(opt => opt
                .setName('id')
                .setDescription('ID de la solicitud')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('notas')
                .setDescription('Notas de aprobación')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('rechazar')
            .setDescription('Rechazar una solicitud de visa - USCIS Only')
            .addStringOption(opt => opt
                .setName('id')
                .setDescription('ID de la solicitud')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('motivo')
                .setDescription('Motivo del rechazo')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('otorgar')
            .setDescription('Otorgar visa directamente (Saltar solicitud) - USCIS Only')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Usuario a otorgar')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('tipo')
                .setDescription('Tipo de visa')
                .setRequired(true)
                .addChoices(
                    { name: '🛂 Turista (B-2) - $10,000', value: 'turista' },
                    { name: '💼 Trabajo (H-1B) - $25,000', value: 'trabajo' },
                    { name: '📚 Estudiante (F-1) - $50,000', value: 'estudiante' },
                    { name: '🏠 Residente (Green Card) - $150,000', value: 'residente' }
                )))
        .addSubcommand(sub => sub
            .setName('revocar')
            .setDescription('Revocar una visa - USCIS/Admin only')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Usuario a revocar')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('razon')
                .setDescription('Motivo de revocación')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('solicitudes')
            .setDescription('Ver solicitudes de visa pendientes - USCIS only')),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ flags: [64] });

        const subCmd = interaction.options.getSubcommand();
        const AMERICAN_ROLE_ID = process.env.AMERICAN_ROLE_ID || '1457950212923461632';
        const USCIS_ROLE_ID = process.env.USCIS_ROLE_ID || '1457949662181851415';
        const BillingService = require('../../services/BillingService');

        // Check USCIS permissions for staff commands
        const isUSCIS = interaction.member.roles.cache.has(USCIS_ROLE_ID) || interaction.member.permissions.has('Administrator');

        if (['aprobar', 'rechazar', 'otorgar', 'revocar', 'solicitudes'].includes(subCmd) && !isUSCIS) {
            return interaction.editReply({
                content: `❌ **Acceso Denegado**\n\nSolo el personal de USCIS puede usar este comando.`,
                flags: [64]
            });
        }

        // SOLICITAR - Create a visa request
        if (subCmd === 'solicitar') {
            const visaType = interaction.options.getString('tipo');
            const reason = interaction.options.getString('motivo');

            // 1. Check if user already has an active visa
            const { data: activeVisa } = await supabase
                .from('us_visas')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .eq('status', 'active')
                .maybeSingle();

            if (activeVisa) {
                return interaction.editReply({
                    content: '❌ **Ya tienes una Visa Activa**\n\nNo puedes solicitar otra mientras tengas una vigente. Usa `/visa ver` para detalles.',
                    flags: [64]
                });
            }

            // 2. Check if user already has a pending request
            const { data: pendingReq } = await supabase
                .from('visa_requests')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .eq('status', 'pending')
                .maybeSingle();

            if (pendingReq) {
                return interaction.editReply({
                    content: '❌ **Solicitud en Trámite**\n\nYa tienes una solicitud de visa pendiente. Por favor espera a que USCIS la revise.',
                    flags: [64]
                });
            }

            // 3. Check for DNI
            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .maybeSingle();

            if (!dni) {
                return interaction.editReply({
                    content: '❌ **DNI Requerido**\n\nDebes tener un DNI Mexicano para solicitar una visa de EE.UU. Usa `/dni crear`.',
                    flags: [64]
                });
            }

            // 4. Create request
            const { error: insertError } = await supabase
                .from('visa_requests')
                .insert({
                    guild_id: interaction.guildId,
                    user_id: interaction.user.id,
                    user_tag: interaction.user.tag,
                    citizen_dni_id: dni.id,
                    visa_type: visaType,
                    reason: reason
                });

            if (insertError) {
                console.error('[visa solicitar] Error:', insertError);
                return interaction.editReply('❌ Error al procesar tu solicitud. Intenta de nuevo.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🛂 Solicitud de Visa Enviada')
                .setColor('#002868')
                .setDescription(`Tu solicitud para una visa de **${visaType.toUpperCase()}** ha sido enviada a USCIS.`)
                .addFields(
                    { name: 'Motivo', value: reason },
                    { name: 'Estado', value: '⏳ Pendiente de revisión' }
                )
                .setFooter({ text: 'Nación MX | USCIS Office' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Notify staff (Optional: Use special channel if configured)
            const USCIS_LOGS_CHANNEL = '1457583225085100283'; // Police/Gov logs
            try {
                const logs = await client.channels.fetch(USCIS_LOGS_CHANNEL);
                if (logs) {
                    await logs.send({
                        content: `🔔 **NUEVA SOLICITUD DE VISA**\nUsuario: <@${interaction.user.id}> (${interaction.user.tag})\nTipo: \`${visaType}\`\nUsa \`/visa solicitudes\` para gestionar.`
                    });
                }
            } catch (e) { }
        }

        // SOLICITUDES - List pending requests for staff
        else if (subCmd === 'solicitudes') {
            const { data: requests, error } = await supabase
                .from('pending_visa_requests')
                .select('*');

            if (error) {
                return interaction.editReply('❌ Error al obtener solicitudes.');
            }

            if (!requests || requests.length === 0) {
                return interaction.editReply('✅ No hay solicitudes de visa pendientes.');
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Solicitudes de Visa Pendientes')
                .setColor('#002868')
                .setDescription('Lista de usuarios esperando aprobación de USCIS.');

            requests.slice(0, 10).forEach(req => {
                embed.addFields({
                    name: `${req.nombre} ${req.apellido} (@${req.user_tag})`,
                    value: `**Tipo:** ${req.visa_type.toUpperCase()}\n**Motivo:** ${req.reason}\n**ID:** \`${req.id.substring(0, 8)}\``,
                    inline: false
                });
            });

            embed.setFooter({ text: 'Usa /visa aprobar [id] o /visa rechazar [id]' });

            await interaction.editReply({ embeds: [embed] });
        }

        // APROBAR - Approve a pending request
        else if (subCmd === 'aprobar') {
            const requestIdPrefix = interaction.options.getString('id');
            const notes = interaction.options.getString('notas') || 'Aprobada por USCIS';

            // Find request by ID prefix
            const { data: request } = await supabase
                .from('visa_requests')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('status', 'pending')
                .ilike('id', `${requestIdPrefix}%`)
                .maybeSingle();

            if (!request) {
                return interaction.editReply(`❌ No se encontró una solicitud pendiente con ID que empiece por \`${requestIdPrefix}\`.`);
            }

            const targetUser = await client.users.fetch(request.user_id);
            const targetMember = await interaction.guild.members.fetch(request.user_id);
            const visaType = request.visa_type;
            const cost = VISA_COSTS[visaType];

            // 1. Process Payment
            try {
                const BillingService = require('../../services/BillingService');
                await BillingService.charge(interaction.guildId, request.user_id, cost, `Visa Approval: ${visaType}`);
            } catch (err) {
                return interaction.editReply(`❌ **Error de Pago:** El usuario no tiene $${cost.toLocaleString()} suficientes.`);
            }

            // 2. Generate Visa Number
            const { data: visaNum } = await supabase.rpc('generate_us_visa_number');

            // 3. Calculate Expiration
            const duration = VISA_DURATIONS[visaType];
            const expirationDate = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString() : null;

            // 4. Create Visa
            await supabase.from('us_visas').insert({
                guild_id: interaction.guildId,
                user_id: request.user_id,
                citizen_dni_id: request.citizen_dni_id,
                visa_type: visaType,
                visa_number: visaNum || `USA-${Math.floor(Math.random() * 9000) + 1000}-${new Date().getFullYear()}`,
                expiration_date: expirationDate,
                approved_by: interaction.user.id,
                approved_by_tag: interaction.user.tag,
                notes: notes
            });

            // 5. Update Request
            await supabase.from('visa_requests').update({
                status: 'approved',
                reviewed_by: interaction.user.id,
                reviewed_by_tag: interaction.user.tag,
                reviewed_at: new Date().toISOString(),
                review_notes: notes
            }).eq('id', request.id);

            // 6. Give American Role
            try {
                await targetMember.roles.add(AMERICAN_ROLE_ID);
            } catch (e) { }

            const embed = new EmbedBuilder()
                .setTitle('✅ Visa Aprobada')
                .setColor('#2ECC71')
                .addFields(
                    { name: '👤 Usuario', value: `<@${request.user_id}>`, inline: true },
                    { name: '🛂 Tipo', value: visaType.toUpperCase(), inline: true },
                    { name: '🎫 Número', value: `\`${visaNum || 'GEN-01'}\``, inline: true },
                    { name: '💰 Costo Cobrado', value: `$${cost.toLocaleString()}`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // DM User
            try {
                await targetUser.send(`🇺🇸 **¡Tu Visa ha sido aprobada!**\nYa tienes el rol Americano. Usa \`/visa ver\` para detalles.`);
            } catch (e) { }
        }

        // RECHAZAR - Reject a pending request
        else if (subCmd === 'rechazar') {
            const requestIdPrefix = interaction.options.getString('id');
            const reason = interaction.options.getString('motivo');

            const { data: request } = await supabase
                .from('visa_requests')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('status', 'pending')
                .ilike('id', `${requestIdPrefix}%`)
                .maybeSingle();

            if (!request) {
                return interaction.editReply(`❌ No se encontró solicitud con ID \`${requestIdPrefix}\`.`);
            }

            await supabase.from('visa_requests').update({
                status: 'rejected',
                reviewed_by: interaction.user.id,
                reviewed_by_tag: interaction.user.tag,
                reviewed_at: new Date().toISOString(),
                review_notes: reason
            }).eq('id', request.id);

            await interaction.editReply(`✅ Solicitud de <@${request.user_id}> rechazada por: ${reason}`);

            // DM User
            try {
                const targetUser = await client.users.fetch(request.user_id);
                await targetUser.send(`❌ **Tu solicitud de Visa ha sido rechazada**\nMotivo: ${reason}`);
            } catch (e) { }
        }

        // OTORGAR - Grant visa (with automatic payment)
        else if (subCmd === 'otorgar') {
            const targetUser = interaction.options.getUser('usuario');
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const visaType = interaction.options.getString('tipo');
            const cost = VISA_COSTS[visaType];

            // Check if user already has American role
            if (targetMember.roles.cache.has(AMERICAN_ROLE_ID)) {
                return interaction.editReply({
                    content: `❌ **Already American**

${targetUser.tag} already has the American role.
Use \`/visa ver\` to check their visa status.`,
                    flags: [64]
                });
            }

            // Check if user has DNI
            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .maybeSingle();

            if (!dni) {
                return interaction.editReply({
                    content: `❌ **DNI Required**

${targetUser.tag} needs a Mexican DNI first.
They must create one with \`/dni crear\``,
                    flags: [64]
                });
            }

            // Check user balance
            const balance = await BillingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
            const availableFunds = (balance.bank || 0) + (balance.cash || 0);

            if (availableFunds < cost) {
                return interaction.editReply({
                    content: `❌ **Insufficient Funds**

${targetUser.tag} doesn't have enough money for this visa.

**Required:** $${cost.toLocaleString()}
**Available:** $${availableFunds.toLocaleString()} (Bank + Cash)

They need $${(cost - availableFunds).toLocaleString()} more.`,
                    flags: [64]
                });
            }

            // Charge from bank first, then cash if needed
            const bankAmount = Math.min(cost, balance.bank || 0);
            const cashAmount = cost - bankAmount;

            try {
                if (bankAmount > 0) {
                    await BillingService.ubService.removeMoney(
                        interaction.guildId,
                        targetUser.id,
                        bankAmount,
                        `Visa USA ${visaType}`,
                        'bank'
                    );
                }
                if (cashAmount > 0) {
                    await BillingService.ubService.removeMoney(
                        interaction.guildId,
                        targetUser.id,
                        cashAmount,
                        `Visa USA ${visaType}`,
                        'cash'
                    );
                }
            } catch (paymentError) {
                console.error('[visa otorgar] Payment error:', paymentError);
                return interaction.editReply('❌ Error processing payment. Contact an administrator.');
            }

            // Generate visa number
            const { data: visaNumberResult } = await supabase.rpc('generate_us_visa_number');
            const visaNumber = visaNumberResult;

            // Calculate expiration
            let expirationDate = null;
            if (VISA_DURATIONS[visaType]) {
                expirationDate = new Date();
                expirationDate.setDate(expirationDate.getDate() + VISA_DURATIONS[visaType]);
            }

            // Create visa
            const { data: newVisa, error: visaError } = await supabase
                .from('us_visas')
                .insert({
                    guild_id: interaction.guildId,
                    user_id: targetUser.id,
                    citizen_dni_id: dni.id,
                    visa_type: visaType,
                    visa_number: visaNumber,
                    expiration_date: expirationDate,
                    status: 'active',
                    approved_by: interaction.user.id,
                    approved_by_tag: interaction.user.tag
                })
                .select()
                .single();

            if (visaError) {
                console.error('[visa otorgar] Error:', visaError);
                // Refund if visa creation failed
                if (bankAmount > 0) {
                    await BillingService.ubService.addMoney(interaction.guildId, targetUser.id, bankAmount, 'Visa refund', 'bank');
                }
                if (cashAmount > 0) {
                    await BillingService.ubService.addMoney(interaction.guildId, targetUser.id, cashAmount, 'Visa refund', 'cash');
                }
                return interaction.editReply('❌ Error creating visa. Payment refunded.');
            }

            // Grant American role
            try {
                await targetMember.roles.add(AMERICAN_ROLE_ID);
            } catch (roleError) {
                console.error('[visa otorgar] Role error:', roleError);
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ US Visa Granted')
                .setColor('#00FF00')
                .setDescription(`US Visa granted to ${targetUser.tag}`)
                .addFields(
                    { name: '👤 Recipient', value: `<@${targetUser.id}>`, inline: true },
                    { name: '📋 Type', value: visaType.charAt(0).toUpperCase() + visaType.slice(1), inline: true },
                    { name: '💰 Cost', value: `$${cost.toLocaleString()}`, inline: true },
                    { name: '🎫 Visa Number', value: `\`${visaNumber}\``, inline: false },
                    { name: '📅 Issued', value: new Date().toLocaleDateString(), inline: true },
                    { name: '⏰ Expires', value: expirationDate ? expirationDate.toLocaleDateString() : 'Never (Permanent)', inline: true },
                    { name: '👮 Issued By', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setFooter({ text: 'American role granted • Payment processed' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // DM the user
            try {
                await targetUser.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🎉 Your US Visa Has Been Granted!')
                        .setColor('#00FF00')
                        .setDescription(`Congratulations! Your US visa has been approved and processed by USCIS.`)
                        .addFields(
                            { name: '🎫 Visa Number', value: `\`${visaNumber}\``, inline: false },
                            { name: '📋 Type', value: visaType.charAt(0).toUpperCase() + visaType.slice(1), inline: true },
                            { name: '💰 Paid', value: `$${cost.toLocaleString()}`, inline: true },
                            { name: '⏰ Valid Until', value: expirationDate ? expirationDate.toLocaleDateString() : 'Permanent', inline: false }
                        )
                        .setFooter({ text: 'Welcome to the United States!' })
                        .setTimestamp()
                    ]
                });
            } catch (dmError) {
                // User has DMs disabled
            }
        }

        // VER - View visa
        else if (subCmd === 'ver') {
            const { data: visa } = await supabase
                .from('us_visas')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!visa) {
                return interaction.editReply({
                    content: `❌ **No Active Visa**

You don't have an active US visa.

Contact USCIS to request one via ticket.`,
                    flags: [64]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🇺🇸 United States Visa')
                .setColor('#3C3B6E')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 Holder', value: `${interaction.user.tag}`, inline: false },
                    { name: '🎫 Visa Number', value: `\`${visa.visa_number}\``, inline: false },
                    { name: '📋 Type', value: visa.visa_type.charAt(0).toUpperCase() + visa.visa_type.slice(1), inline: true },
                    { name: '📅 Issued', value: new Date(visa.issued_date).toLocaleDateString(), inline: true },
                    { name: '⏰ Expires', value: visa.expiration_date ? new Date(visa.expiration_date).toLocaleDateString() : 'Never (Permanent)', inline: true },
                    { name: '✅ Status', value: 'Active', inline: true }
                )
                .setFooter({ text: 'United States of America - USCIS' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }

        // LISTAR - List visas
        else if (subCmd === 'listar') {
            const { data: visas } = await supabase
                .from('active_us_visas')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .order('issued_date', { ascending: false })
                .limit(20);

            if (!visas || visas.length === 0) {
                return interaction.editReply({
                    content: `📭 **No Active Visas**

There are no active US visas.`,
                    flags: [64]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Active US Visas')
                .setColor('#3C3B6E')
                .setDescription(`Total: **${visas.length}** active visa(s)`)
                .setTimestamp();

            visas.slice(0, 10).forEach(visa => {
                const expires = visa.expiration_date ? new Date(visa.expiration_date).toLocaleDateString() : 'Permanent';
                embed.addFields({
                    name: `${visa.nombre} ${visa.apellido} - ${visa.visa_type}`,
                    value: `Visa: \`${visa.visa_number}\`
Expires: ${expires}
User: <@${visa.user_id}>`,
                    inline: false
                });
            });

            await interaction.editReply({ embeds: [embed] });
        }

        // REVOCAR - Revoke visa
        else if (subCmd === 'revocar') {
            const targetUser = interaction.options.getUser('usuario');
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const reason = interaction.options.getString('razon');

            const { data: visa } = await supabase
                .from('us_visas')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!visa) {
                return interaction.editReply({
                    content: `❌ **No Active Visa**

${targetUser.tag} doesn't have an active visa to revoke.`,
                    flags: [64]
                });
            }

            // Revoke visa
            await supabase
                .from('us_visas')
                .update({
                    status: 'revoked',
                    revoked_by: interaction.user.id,
                    revoked_reason: reason,
                    revoked_at: new Date().toISOString()
                })
                .eq('id', visa.id);

            // Remove American role
            try {
                await targetMember.roles.remove(AMERICAN_ROLE_ID);
            } catch (roleError) {
                console.error('[visa revocar] Role error:', roleError);
            }

            const embed = new EmbedBuilder()
                .setTitle('⛔ Visa Revoked')
                .setColor('#FF0000')
                .addFields(
                    { name: '👤 User', value: `<@${targetUser.id}>`, inline: true },
                    { name: '🎫 Visa Number', value: `\`${visa.visa_number}\``, inline: true },
                    { name: '📝 Reason', value: reason, inline: false },
                    { name: '👮 Revoked By', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // DM the user
            try {
                await targetUser.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⛔ Your US Visa Has Been Revoked')
                        .setColor('#FF0000')
                        .setDescription(`Your US visa (${visa.visa_number}) has been revoked by USCIS.`)
                        .addFields(
                            { name: '📝 Reason', value: reason, inline: false }
                        )
                        .setFooter({ text: 'Contact USCIS for more information' })
                        .setTimestamp()
                    ]
                });
            } catch (dmError) {
                // User has DMs disabled
            }
        }

        else {
            await interaction.editReply({
                content: '⚠️ **Unknown Command**',
                flags: [64]
            });
        }
    }
};
