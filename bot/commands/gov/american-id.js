const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('american-id')
        .setDescription('🇺🇸 American Identification System')
        .addSubcommand(sub => sub
            .setName('create')
            .setDescription('Create your American ID')
            .addStringOption(opt => opt
                .setName('first_name')
                .setDescription('First Name')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('last_name')
                .setDescription('Last Name')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('age')
                .setDescription('Age (18-99)')
                .setRequired(true)
                .setMinValue(18)
                .setMaxValue(99))
            .addStringOption(opt => opt
                .setName('gender')
                .setDescription('Gender')
                .setRequired(true)
                .addChoices(
                    { name: 'Male', value: 'Male' },
                    { name: 'Female', value: 'Female' },
                    { name: 'Other', value: 'Other' }
                ))
            .addStringOption(opt => opt
                .setName('state')
                .setDescription('State of residence')
                .setRequired(false)
                .addChoices(
                    { name: 'California', value: 'California' },
                    { name: 'Texas', value: 'Texas' },
                    { name: 'New York', value: 'New York' },
                    { name: 'Florida', value: 'Florida' },
                    { name: 'Other', value: 'Other' }
                ))
            .addStringOption(opt => opt
                .setName('ssn_last4')
                .setDescription('Last 4 digits of SSN (optional, for RP)')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('View your American ID'))
        .addSubcommand(sub => sub
            .setName('edit')
            .setDescription('Edit your American ID (Staff only)')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('User to edit')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('delete')
            .setDescription('Delete an American ID (Admin only)')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('User to delete')
                .setRequired(true))),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ flags: [64] });

        const subCmd = interaction.options.getSubcommand();
        const AMERICAN_ROLE_ID = process.env.AMERICAN_ROLE_ID;

        // Check if user has American role (for most commands)
        if (subCmd === 'create' || subCmd === 'view') {
            const hasAmericanRole = interaction.member.roles.cache.has(AMERICAN_ROLE_ID);
            if (!hasAmericanRole) {
                return interaction.editReply({
                    content: '❌ **American Role Required**\\n\\nYou need the American role to use this command.\\n\\n**Are you Mexican?** Use `/dni crear` instead.\\n**Want to become American?** Request a US visa with `/visa solicitar`',
                    flags: [64]
                });
            }
        }

        if (subCmd === 'create') {
            // Check if already has ID
            const { data: existing } = await supabase
                .from('american_id')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .maybeSingle();

            if (existing) {
                return interaction.editReply({
                    content: '❌ **ID Already Exists**\\n\\nYou already have an American ID.\\nUse `/american-id view` to see it.',
                    flags: [64]
                });
            }

            const firstName = interaction.options.getString('first_name');
            const lastName = interaction.options.getString('last_name');
            const age = interaction.options.getInteger('age');
            const gender = interaction.options.getString('gender');
            const state = interaction.options.getString('state') || 'Other';
            const ssnLast4 = interaction.options.getString('ssn_last4');

            // Validate SSN if provided
            if (ssnLast4 && !/^\\d{4}$/.test(ssnLast4)) {
                return interaction.editReply({
                    content: '❌ **Invalid SSN**\\n\\nSSN must be exactly 4 digits.',
                    flags: [64]
                });
            }

            // Create American ID
            const { data: newId, error } = await supabase
                .from('american_id')
                .insert({
                    guild_id: interaction.guildId,
                    user_id: interaction.user.id,
                    first_name: firstName,
                    last_name: lastName,
                    age: age,
                    gender: gender,
                    state: state,
                    ssn_last4: ssnLast4,
                    created_by: interaction.user.id
                })
                .select()
                .single();

            if (error) {
                console.error('[american-id create] Error:', error);
                return interaction.editReply({
                    content: '❌ Error creating American ID. Contact an administrator.',
                    flags: [64]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🇺🇸 American ID Created')
                .setColor('#B22234') // US flag red
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '📛 Name', value: `${firstName} ${lastName}`, inline: true },
                    { name: '🎂 Age', value: `${age}`, inline: true },
                    { name: '⚧️ Gender', value: gender, inline: true },
                    { name: '📍 State', value: state, inline: true },
                    { name: '🔢 ID Number', value: `#${newId.id}`, inline: true },
                    { name: '🆔 Discord', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setFooter({ text: 'Use /american-id view to see your full ID' })
                .setTimestamp();

            if (ssnLast4) {
                embed.addFields({ name: '🔐 SSN (Last 4)', value: `***-**-${ssnLast4}`, inline: true });
            }

            await interaction.editReply({ embeds: [embed], flags: [64] });

        } else if (subCmd === 'view') {
            const { data: americanId, error } = await supabase
                .from('american_id')
                .select('*')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .maybeSingle();

            if (!americanId) {
                return interaction.editReply({
                    content: '❌ **No American ID Found**\\n\\nYou don\\'t have an American ID yet.\\nCreate one with `/american-id create`',
                    flags: [64]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🇺🇸 American Identification')
                .setColor('#3C3B6E') // US flag blue
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '📛 Full Name', value: `${americanId.first_name} ${americanId.last_name}`, inline: false },
                    { name: '🎂 Age', value: `${americanId.age} years`, inline: true },
                    { name: '⚧️ Gender', value: americanId.gender, inline: true },
                    { name: '📍 State', value: americanId.state || 'Not specified', inline: true },
                    { name: '🔢 ID Number', value: `#${americanId.id}`, inline: true },
                    { name: '📅 Issued', value: new Date(americanId.created_at).toLocaleDateString(), inline: true }
                )
                .setFooter({ text: 'United States of America' })
                .setTimestamp();

            if (americanId.ssn_last4) {
                embed.addFields({ name: '🔐 SSN', value: `***-**-${americanId.ssn_last4}`, inline: true });
            }

            await interaction.editReply({ embeds: [embed], flags: [64] });

        } else if (subCmd === 'edit' || subCmd === 'delete') {
            // Staff/Admin only
            const isStaff = interaction.member.permissions.has('ManageRoles');
            if (!isStaff) {
                return interaction.editReply({
                    content: '❌ **Permission Denied**\\n\\nOnly staff can use this command.',
                    flags: [64]
                });
            }

            return interaction.editReply({
                content: '⚠️ **Coming Soon**\\n\\nThis command is under development.',
                flags: [64]
            });
        }
    }
};
