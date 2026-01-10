const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const moment = require('moment-timezone');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arrestar')
        .setDescription('🚨 Arrestar un ciudadano por violación del código penal')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a arrestar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('arts')
                .setDescription('Artículos penales (ej: "10" o "10,30,40")')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('foto')
                .setDescription('Evidencia fotográfica del arresto')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        // DEFER IMMEDIATELY to prevent timeout
        // await interaction.deferReply({});

        const ARREST_CHANNEL_ID = '1398888960519835688';
        const ARREST_LOGS_CHANNEL_ID = '1457583225085100283';
        const ARRESTED_ROLE_ID = '1413540729623679056';

        // Excluded roles (cannot arrest)
        const EXCLUDED_ROLES = [
            '1412887183089471568', // Presidente
            '1412891374700724234', // Candidato
            '1412891683535982632', // Abogado
            '1413541371503185961'  // Juez
        ];

        // Salary roles (can arrest)
        const SALARY_ROLES = [
            '1412898905842122872', // Ejército
            '1412898908706963507', // Marina
            '1457135315323195432', // SSPC
            '1412898911185797310', // Guardia Nacional
            '1412898916021829903', // AIC
            '1455037616054341704', // Policía Estatal
            '1416867605976715363', // Policía Federal
            '1413540726100332574', // Paramédico
            '1412899382436827369', // Bombero
            '1412899385519640707', // DOT
            '1413540732760883311', // Reportero
            '1413540735487053924', // Basurero
            '1450242487422812251'  // Staff
        ];

        try {
            // 1. Validate channel
            if (interaction.channelId !== ARREST_CHANNEL_ID) {
                return interaction.editReply({
                    content: `❌ **Canal Incorrecto**\n\nEste comando solo puede usarse en <#${ARREST_CHANNEL_ID}>.`,
                    flags: [64]
                });
            }

            // 2. Validate permissions
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasExcludedRole = member.roles.cache.some(role => EXCLUDED_ROLES.includes(role.id));
            const hasSalaryRole = member.roles.cache.some(role => SALARY_ROLES.includes(role.id));

            if (hasExcludedRole) {
                return interaction.editReply({
                    content: '❌ **Permiso Denegado**\n\nTu rol no puede realizar arrestos.',
                    flags: [64]
                });
            }

            if (!hasSalaryRole && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({
                    content: '❌ **Sin Autorización**\n\nNecesitas ser parte de las fuerzas del orden para arrestar.',
                    flags: [64]
                });
            }

            // 3. Get options
            const targetUser = interaction.options.getUser('usuario');
            const articlesInput = interaction.options.getString('arts');
            // 'tiempo' removed
            const evidencia = interaction.options.getAttachment('foto');
            const razon = interaction.options.getString('razon'); // Is this used? Check line 94 original. Yes but line 94 declared it.

            // 4. Validate target
            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({
                    content: '❌ No puedes arrestarte a ti mismo.',
                    flags: [64]
                });
            }

            const targetMember = await interaction.guild.members.fetch(targetUser.id);

            // 5. Parse and Validate Articles
            const { calculateSentence, ARTICLES } = require('../../data/penalCode');

            // Sanitize input: remove extra spaces, letters, etc.
            const sanitizedInput = articlesInput
                .replace(/[^0-9,.\s]/g, '') // Only allow numbers, commas, dots, spaces
                .replace(/\s+/g, '') // Remove all spaces
                .replace(/,+/g, ',') // Remove multiple commas
                .replace(/^,|,$/g, ''); // Remove leading/trailing commas

            // Validate articles exist
            const articleIds = sanitizedInput.split(',').filter(id => id.trim().length > 0);
            const validArticles = [];
            const invalidArticles = [];

            for (const id of articleIds) {
                const trimmedId = id.trim();
                if (ARTICLES[trimmedId]) {
                    validArticles.push(trimmedId);
                } else {
                    invalidArticles.push(trimmedId);
                }
            }

            // If no valid articles, reject
            if (validArticles.length === 0) {
                return interaction.editReply({
                    content: `❌ **Error: Artículos Inválidos**\n\n` +
                        `No se reconoció ningún artículo válido en: \`${articlesInput}\`\n\n` +
                        `**Formato correcto:** \`10\` o \`10,30,60\`\n` +
                        `**Ejemplos:** \`10\`, \`30,60\`, \`111\``,
                    flags: [64]
                });
            }

            // Warning if some articles are invalid
            if (invalidArticles.length > 0) {
                await interaction.editReply({
                    content: `⚠️ **Advertencia:** Los siguientes artículos no existen y serán ignorados:\n` +
                        `❌ ${invalidArticles.join(', ')}\n\n` +
                        `✅ Procesando solo: **${validArticles.join(', ')}**\n\n` +
                        `Continuando en 3 segundos...`
                });
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Calculate sentence with valid articles only
            const sentence = calculateSentence(validArticles.join(','));

            let fineAmount = sentence.totalFine || 0; // Base fines from articles

            // Use calculated time (Default to minimum sentence)
            let finalTime = sentence.suggestedTime;

            // Fallback if no time calculated
            if (finalTime === 0) {
                finalTime = 30; // 30 mins default (1 day RP)
                sentence.reason = `Artículos: ${validArticles.join(', ')}`;
            }

            // Cap time strictly to avoid overflows/bad UX?
            // User requested "Code Penal" times which are huge (15 years = 4500 mins)
            // We will respect the calculation. 

            // Add standard processing fine ($500 per valid article)
            const processingFee = validArticles.length * 500;
            fineAmount += processingFee;

            // Apply Premium/UltraPass/Booster 50% Discount on Fine (Bail)
            const PREMIUM_ROLE_ID = '1412887172503175270';
            const BOOSTER_ROLE_ID = '1423520675158691972';
            const ULTRAPASS_ROLE_ID = '1414033620636532849';

            const hasPremium = targetMember.roles.cache.has(PREMIUM_ROLE_ID) ||
                targetMember.roles.cache.has(BOOSTER_ROLE_ID) ||
                targetMember.roles.cache.has(ULTRAPASS_ROLE_ID);

            const originalFine = fineAmount;
            if (hasPremium) {
                fineAmount = Math.floor(fineAmount * 0.5);
            }

            const articleText = sentence.reason || articlesInput;

            // 7. Add arrested role
            try {
                await targetMember.roles.add(ARRESTED_ROLE_ID);
            } catch (error) {
                console.error('[arrestar] Error adding role:', error);
            }

            // 7.5. Kick from ERLC if online
            try {
                // Get citizen/roblox ID
                const { data: citizen } = await supabase
                    .from('citizens')
                    .select('roblox_id, roblox_username')
                    .eq('discord_id', targetUser.id)
                    .maybeSingle();

                console.log('[arrestar] Citizen lookup:', citizen);

                if (citizen && (citizen.roblox_username || citizen.roblox_id)) {
                    // Initialize ERLC service - Use hardcoded key from index_moderacion.js
                    const ErlcService = require('../../services/ErlcService');
                    const erlcKey = process.env.ERLC_API_KEY || 'ARuRfmzZGTqbqUCjMERA-dzEeGLbRfisfjKtiCOXLHATXDedYZsQQEethQMZp';

                    if (erlcKey) {
                        const erlcService = new ErlcService(erlcKey);

                        // Use username if available, otherwise ID
                        const playerIdentifier = citizen.roblox_username || citizen.roblox_id;
                        const kickCommand = `:kick ${playerIdentifier} Arrestado`;

                        console.log(`[arrestar] Sending ERLC kick command: ${kickCommand}`);
                        const result = await erlcService.runCommand(kickCommand);

                        if (result) {
                            console.log(`[arrestar] ✅ Successfully kicked ${playerIdentifier} from ERLC`);
                        } else {
                            console.log(`[arrestar] ⚠️ ERLC kick command sent but no confirmation`);
                        }
                    } else {
                        console.error('[arrestar] ERLC_API_KEY not configured');
                    }
                } else {
                    console.log(`[arrestar] User ${targetUser.tag} not linked to Roblox account`);
                }
            } catch (erlcError) {
                console.error('[arrestar] ERLC kick error:', erlcError);
                // Don't fail arrest if ERLC kick fails
            }

            // 8. Calculate release time
            const releaseTime = moment().add(finalTime, 'minutes');

            // 9. Deduct money
            const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
            const ubToken = process.env.UNBELIEVABOAT_TOKEN;
            if (ubToken) {
                const ubService = new UnbelievaBoatService(ubToken);
                try {
                    await ubService.removeMoney(interaction.guildId, targetUser.id, fineAmount, `Arresto: ${articleText}`, 'bank');
                } catch (ubError) {
                    console.error('[arrestar] UB error:', ubError);
                }
            }

            // 10. Save to database
            await supabase.from('arrests').insert({
                guild_id: interaction.guildId,
                user_id: targetUser.id,
                user_tag: targetUser.tag,
                arrested_by: interaction.user.id,
                arrested_by_tag: interaction.user.tag,
                articles: validArticles.join(','), // Use sanitized valid articles
                arrest_time: finalTime,
                release_time: releaseTime.toISOString(),
                reason: articleText,
                evidence_url: evidencia.url,
                fine_amount: fineAmount
            });

            // 11. Send DM to arrested user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🚨 HAS SIDO ARRESTADO')
                    .setColor('#FF0000')
                    .setDescription('⚠️ **IMPORTANTE:** No puedes realizar roleplay durante tu arresto.\nSi roleas mientras estás arrestado, serás sancionado.')
                    .addFields(
                        { name: '⏰ Tiempo de Arresto', value: `${finalTime} minutos (${(finalTime / 60).toFixed(1)} hrs)`, inline: true },
                        { name: '📅 Liberación', value: `<t:${Math.floor(releaseTime.valueOf() / 1000)}:R>`, inline: true },
                        { name: '📜 Artículos/Cargos', value: articleText, inline: false },
                        { name: '💰 Multa Total', value: hasPremium ? `~~$${originalFine.toLocaleString()}~~ **$${fineAmount.toLocaleString()}**` : `$${fineAmount.toLocaleString()}`, inline: true },
                        { name: '⚖️ Fianza', value: sentence.noBail ? '**DENEGADA** (Delito Grave)' : 'Permitida', inline: true }
                    )
                    .setFooter({ text: 'Espera tu liberación para volver a rolear' })
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log('[arrestar] Could not DM user:', dmError.message);
            }

            // 12. Public embed
            const publicEmbed = new EmbedBuilder()
                .setTitle('🚨 ARRESTO POLICIAL')
                .setColor('#DC143C')
                .setThumbnail('https://cdn.discordapp.com/attachments/885232074083143741/1457553016743006363/25174-skull-lmfao.gif')
                .addFields(
                    { name: '👤 Arrestado', value: `<@${targetUser.id}>`, inline: true },
                    { name: '👮 Oficial', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📜 Cargos', value: articleText, inline: false },
                    { name: '⏰ Tiempo', value: `${finalTime} min (${(finalTime / 300).toFixed(1)} años RP)`, inline: true },
                    { name: '📅 Liberación', value: `<t:${Math.floor(releaseTime.valueOf() / 1000)}:R>`, inline: true },
                    { name: '💰 Multa', value: hasPremium ? `~~$${originalFine.toLocaleString()}~~ **$${fineAmount.toLocaleString()}** (50% OFF)` : `$${fineAmount.toLocaleString()}`, inline: true }
                )
                .setImage(evidencia.url)
                .setFooter({ text: `Nación MX | Sistema Judicial` })
                .setTimestamp();

            await interaction.editReply({ embeds: [publicEmbed] });

            // 13. Send to logs
            const logsChannel = await client.channels.fetch(ARREST_LOGS_CHANNEL_ID);
            if (logsChannel) {
                await logsChannel.send({ embeds: [publicEmbed] });
            }

            // Report Misión Diaria
            if (client.missionManager) {
                await client.missionManager.reportProgress(interaction.user.id, 'arrests', 1);
            }

        } catch (error) {
            console.error('[arrestar] Error:', error);
            await interaction.editReply('❌ Error al procesar el arresto. Contacta a un administrador.');
        }
    }
};
