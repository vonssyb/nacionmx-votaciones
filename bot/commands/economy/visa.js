const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
        .setDescription('🇺🇸 US Visa System for Mexican Citizens')
        .addSubcommand(sub => sub
            .setName('solicitar')
            .setDescription('Request a US visa')
            .addStringOption(opt => opt
                .setName('tipo')
                .setDescription('Visa type')
                .setRequired(true)
                .addChoices(
                    { name: '🛂 Tourist (B-2) - 90 days', value: 'turista' },
                    { name: '💼 Work (H-1B) - 180 days', value: 'trabajo' },
                    { name: '📚 Student (F-1) - 365 days', value: 'estudiante' },
                    { name: '🏠 Resident (Green Card) - Permanent', value: 'residente' }
                ))
            .addStringOption(opt => opt
                .setName('razon')
                .setDescription('Reason for visa request')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('aprobar')
            .setDescription('Approve a visa request (USCIS only)')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('User to approve')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('rechazar')
            .setDescription('Reject a visa request (USCIS only)')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('User to reject')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('razon')
                .setDescription('Reason for rejection')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('ver')
            .setDescription('View your current visa'))
        .addSubcommand(sub => sub
            .setName('renovar')
            .setDescription('Renew your existing visa'))
        .addSubcommand(sub => sub
            .setName('revocar')
            .setDescription('Revoke a visa (USCIS/Admin only)')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('User whose visa to revoke')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('razon')
                .setDescription('Reason for revocation')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('solicitudes')
            .setDescription('View pending visa requests (USCIS only)'))
        .addSubcommand(sub => sub
            .setName('listar')
            .setDescription('List all active visas (USCIS only)')),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ flags: [64] });

        const subCmd = interaction.options.getSubcommand();
        const AMERICAN_ROLE_ID = process.env.AMERICAN_ROLE_ID || '1457950212923461632';
        const USCIS_ROLE_ID = process.env.USCIS_ROLE_ID || '1457949662181851415';

        // Check USCIS permissions for staff commands
        const isUSCIS = interaction.member.roles.cache.has(USCIS_ROLE_ID) || interaction.member.permissions.has('Administrator');

        if (['aprobar', 'rechazar', 'revocar', 'solicitudes', 'listar'].includes(subCmd) && !isUSCIS) {
            return interaction.editReply({
                content: '❌ **Access Denied**\\n\\nOnly USCIS staff can use this command.',
                flags: [64]
            });
        }

        // SOLICITAR - Request visa
        if (subCmd === 'solicitar') {
            // Check if user already has American role
            if (interaction.member.roles.cache.has(AMERICAN_ROLE_ID)) {
                return interaction.editReply({
                    content: '❌ **Already American**\\n\\nYou already have the American role.\\nUse `/visa ver` to check your visa status.',
                    flags: [64]
                });
            }

            // Check if user has DNI
            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .maybeSingle();

            if (!dni) {
                return interaction.editReply({
                    content: '❌ **DNI Required**\\n\\nYou need a Mexican DNI to request a US visa.\\nCreate one first with `/dni crear`',
                    flags: [64]
                });
            }

            // Check for pending request
            const { data: pendingRequest } = await supabase
                .from('visa_requests')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .eq('status', 'pending')
                .maybeSingle();

            if (pendingRequest) {
                return interaction.editReply({
                    content: '⏳ **Pending Request**\\n\\nYou already have a pending visa request.\\nPlease wait for USCIS to review it.',
                    flags: [64]
                });
            }

            const visaType = interaction.options.getString('tipo');
            const reason = interaction.options.getString('razon') || 'No reason provided';

            // Create request
            const { data: newRequest, error } = await supabase
                .from('visa_requests')
                .insert({
                    guild_id: interaction.guildId,
                    user_id: interaction.user.id,
                    user_tag: interaction.user.tag,
                    citizen_dni_id: dni.id,
                    visa_type: visaType,
                    reason: reason,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) {
                console.error('[visa solicitar] Error:', error);
                return interaction.editReply('❌ Error creating visa request.');
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Visa Request Submitted')
                .setColor('#00FF00')
                .setDescription('Your US visa request has been submitted to USCIS')
                .addFields(
                    { name: '📋 Type', value: visaType.charAt(0).toUpperCase() + visaType.slice(1), inline: true },
                    { name: '⏱️ Duration', value: VISA_DURATIONS[visaType] ? `${VISA_DURATIONS[visaType]} days` : 'Permanent', inline: true },
                    { name: '📝 Reason', value: reason, inline: false },
                    { name: '🔢 Request ID', value: `\`${newRequest.id}\``, inline: false }
                )
                .setFooter({ text: 'USCIS will review your request soon' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Notify USCIS channel (if configured)
            // TODO: Send notification to VISA_REQUEST_CHANNEL_ID

        }

        // APROBAR - Approve visa
        else if (subCmd === 'aprobar') {
            const targetUser = interaction.options.getUser('usuario');
            const targetMember = await interaction.guild.members.fetch(targetUser.id);

            // Check for pending request
            const { data: request } = await supabase
                .from('visa_requests')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', targetUser.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!request) {
                return interaction.editReply({
                    content: `❌ **No Pending Request**\\n\\n${targetUser.tag} doesn't have a pending visa request.`,
                    flags: [64]
                });
            }

            // Generate visa number
            const { data: visaNumberResult } = await supabase.rpc('generate_us_visa_number');
            const visaNumber = visaNumberResult;

            // Calculate expiration
            let expirationDate = null;
            if (VISA_DURATIONS[request.visa_type]) {
                expirationDate = new Date();
                expirationDate.setDate(expirationDate.getDate() + VISA_DURATIONS[request.visa_type]);
            }

            // Create visa
            const { data: newVisa, error: visaError } = await supabase
                .from('us_visas')
                .insert({
                    guild_id: interaction.guildId,
                    user_id: targetUser.id,
                    citizen_dni_id: request.citizen_dni_id,
                    visa_type: request.visa_type,
                    visa_number: visaNumber,
                    expiration_date: expirationDate,
                    status: 'active',
                    approved_by: interaction.user.id,
                    approved_by_tag: interaction.user.tag
                })
                .select()
                .single();

            if (visaError) {
                console.error('[visa aprobar] Error:', visaError);
                return interaction.editReply('❌ Error creating visa.');
            }

            // Update request status
            await supabase
                .from('visa_requests')
                .update({
                    status: 'approved',
                    reviewed_by: interaction.user.id,
                    reviewed_by_tag: interaction.user.tag,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', request.id);

            // Grant American role
            try {
                await targetMember.roles.add(AMERICAN_ROLE_ID);
            } catch (roleError) {
                console.error('[visa aprobar] Role error:', roleError);
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Visa Approved')
                .setColor('#00FF00')
                .setDescription(`US Visa granted to ${targetUser.tag}`)
                .addFields(
                    { name: '👤 Applicant', value: `<@${targetUser.id}>`, inline: true },
                    { name: '📋 Type', value: request.visa_type.charAt(0).toUpperCase() + request.visa_type.slice(1), inline: true },
                    { name: '🎫 Visa Number', value: `\`${visaNumber}\``, inline: false },
                    { name: '📅 Issued', value: new Date().toLocaleDateString(), inline: true },
                    { name: '⏰ Expires', value: expirationDate ? expirationDate.toLocaleDateString() : 'Never (Permanent)', inline: true },
                    { name: '👮 Approved By', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setFooter({ text: 'American role granted automatically' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // DM the user
            try {
                await targetUser.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🎉 Your US Visa Has Been Approved!')
                        .setColor('#00FF00')
                        .setDescription(`Congratulations! Your visa request has been approved by USCIS.`)
                        .addFields(
                            { name: '🎫 Visa Number', value: `\`${visaNumber}\``, inline: false },
                            { name: '📋 Type', value: request.visa_type.charAt(0).toUpperCase() + request.visa_type.slice(1), inline: true },
                            { name: '⏰ Valid Until', value: expirationDate ? expirationDate.toLocaleDateString() : 'Permanent', inline: true }
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
                    content: '❌ **No Active Visa**\\n\\nYou don\\'t have an active US visa.\\n\\nRequest one with `/visa solicitar`',
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

        // SOLICITUDES - List pending requests
        else if (subCmd === 'solicitudes') {
            const { data: requests } = await supabase
                .from('visa_requests')
                .select('*, citizen:citizen_dni(*)')
                .eq('guild_id', interaction.guildId)
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (!requests || requests.length === 0) {
                return interaction.editReply({
                    content: '📭 **No Pending Requests**\\n\\nThere are no pending visa requests.',
                    flags: [64]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Pending Visa Requests')
                .setColor('#FFA500')
                .setDescription(`Total: **${requests.length}** pending request(s)`)
                .setTimestamp();

            requests.slice(0, 10).forEach(req => {
                embed.addFields({
                    name: `${req.user_tag} - ${req.visa_type}`,
                    value: `Reason: ${req.reason}\\nRequested: ${new Date(req.created_at).toLocaleString()}\\nID: \`${req.user_id}\``,
                    inline: false
                });
            });

            await interaction.editReply({ embeds: [embed] });
        }

        // Other subcommands can be added similarly...
        else {
            await interaction.editReply({
                content: '⚠️ **Under Development**\\n\\nThis feature is coming soon.',
                flags: [64]
            });
        }
    }
};
