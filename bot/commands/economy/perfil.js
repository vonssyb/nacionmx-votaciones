const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('👤 Ver tu perfil económico y registros en Nación MX')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Ver el perfil de otro usuario (opcional)')
                .setRequired(false)),

    async execute(interaction, client, supabase) {
        // Explicitly defer to prevent "Application not responding"
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const isOwnProfile = targetUser.id === interaction.user.id;

        try {
            // Fetch Economy Data from UnbelievaBoat API
            const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
            const ubToken = process.env.UNBELIEVABOAT_TOKEN;

            if (!ubToken) {
                console.error('[perfil] UNBELIEVABOAT_TOKEN not configured');
                return interaction.editReply('❌ Error de configuración del bot.');
            }

            const ubService = new UnbelievaBoatService(ubToken);

            let cash = 0, bank = 0;

            try {
                // Add explicit timeout for external API
                const balancePromise = ubService.getUserBalance(interaction.guildId, targetUser.id);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('UB Timeout')), 3000));

                const balance = await Promise.race([balancePromise, timeoutPromise]);
                cash = balance.cash || 0;
                bank = balance.bank || 0;
                console.log('[perfil] UnbelievaBoat balance:', { userId: targetUser.id, cash, bank });
            } catch (ubError) {
                console.error('[perfil] Error fetching UnbelievaBoat balance:', ubError.message);
                // Continue with 0 if API fails
                await interaction.followUp({ content: '⚠️ Alerta: No se pudo verificar el saldo en tiempo real (UnbelievaBoat lento).', flags: [64] });
            }

            const total = cash + bank;

            // Fetch member first (needed for roles)
            const member = await interaction.guild.members.fetch(targetUser.id);

            // **PARALLEL DATA FETCHING** - All queries run simultaneously
            const [creditCard, licenses, sanctions, passes, dni, vehicleCount, activeArrest, americanId, ownedCompanies, employmentData] = await Promise.all([
                // Fetch Credit Card
                (async () => {
                    try {
                        // First find the citizen associated with this discord user
                        const { data: citizen } = await supabase
                            .from('citizens')
                            .select('id')
                            .eq('discord_id', targetUser.id)
                            .maybeSingle();

                        if (!citizen) return null;

                        const { data: creditCards, error } = await supabase
                            .from('credit_cards')
                            .select('card_type, credit_limit, current_balance')
                            .eq('citizen_id', citizen.id)
                            .eq('status', 'active');

                        if (error) {
                            console.error('[perfil] Credit card query error:', error);
                            return null;
                        }

                        if (!creditCards || creditCards.length === 0) return null;

                        const card = creditCards[0];
                        return {
                            card_type: card.card_type,
                            total_limit: card.credit_limit,
                            used_limit: card.current_balance,
                            available_limit: card.credit_limit - card.current_balance
                        };
                    } catch (e) {
                        console.error('[perfil] Failed to fetch credit cards:', e.message);
                        return null;
                    }
                })(),

                // Fetch Licenses
                (async () => {
                    try {
                        const licenseRoles = {
                            '1413543909761614005': '🚗 Licencia de Conducir',
                            '1413543907110682784': '🔫 Licencia de Armas Cortas',
                            '1413541379803578431': '🎯 Licencia de Armas Largas'
                        };
                        const found = [];
                        for (const [roleId, licenseName] of Object.entries(licenseRoles)) {
                            if (member.roles.cache.has(roleId)) {
                                found.push(licenseName);
                            }
                        }
                        return found;
                    } catch (e) {
                        console.error('[perfil] Failed to fetch licenses:', e.message);
                        return [];
                    }
                })(),

                // Fetch Sanctions - Last 3
                (async () => {
                    try {
                        console.log(`[perfil] Querying sanctions for user ${targetUser.id}`);
                        const { data, error } = await supabase
                            .from('sanctions')
                            .select('type, reason, created_at, status')
                            .eq('discord_user_id', targetUser.id)  // Correct column name
                            .order('created_at', { ascending: false })
                            .limit(3);  // Changed from 5 to 3

                        if (error) {
                            console.error('[perfil] Sanctions query error:', error);
                            return { recent: [], counts: { notificacion: 0, sa: 0, general: 0, total: 0 } };
                        }

                        // Also get counts by type (ONLY ACTIVE SANCTIONS)
                        const { data: allSanctions, error: countError } = await supabase
                            .from('sanctions')
                            .select('type, status')
                            .eq('discord_user_id', targetUser.id)
                            .eq('status', 'active');  // ONLY COUNT ACTIVE SANCTIONS

                        const counts = {
                            notificacion: 0,
                            sa: 0,
                            general: 0,
                            total: 0
                        };

                        if (!countError && allSanctions) {
                            counts.total = allSanctions.length;
                            counts.notificacion = allSanctions.filter(s => s.type === 'notificacion').length;
                            counts.sa = allSanctions.filter(s => s.type === 'sa').length;
                            counts.general = allSanctions.filter(s => s.type === 'general').length;
                        }

                        if (data && data.length > 0) {
                            console.log(`[perfil] ✅ Found ${data.length} recent sanction(s), ${counts.total} active total`);
                        } else {
                            console.log(`[perfil] ℹ️ No sanctions found for user ${targetUser.id}`);
                        }

                        return { recent: data || [], counts };
                    } catch (e) {
                        console.error('[perfil] Failed to fetch sanctions:', e.message);
                        return { recent: [], counts: { notificacion: 0, sa: 0, general: 0, total: 0 } };
                    }
                })(),

                // Fetch Active Passes
                (async () => {
                    try {
                        const { data, error } = await supabase
                            .from('user_purchases')
                            .select(`
                                expiration_date,
                                uses_remaining,
                                item:store_items (
                                    name
                                )
                            `)
                            .eq('user_id', targetUser.id)
                            .eq('status', 'active')
                            .or(`expiration_date.gt.${new Date().toISOString()},expiration_date.is.null`);

                        if (error) {
                            console.error('[perfil] Passes query error:', error);
                            return [];
                        }

                        // Map to a cleaner format
                        return (data || []).map(p => ({
                            item_name: p.item?.name || 'Item Desconocido',
                            expires_at: p.expiration_date,
                            uses_remaining: p.uses_remaining
                        }));
                    } catch (e) {
                        console.error('[perfil] Failed to fetch passes:', e.message);
                        return [];
                    }
                })(),

                // Fetch DNI - CRITICAL WITH DETAILED LOGGING
                (async () => {
                    try {
                        console.log(`[perfil] Querying DNI for user ${targetUser.id} in guild ${interaction.guildId}`);
                        const { data, error } = await supabase
                            .from('citizen_dni')
                            .select('nombre, apellido, fecha_nacimiento, edad')
                            .eq('guild_id', interaction.guildId)
                            .eq('user_id', targetUser.id)
                            .maybeSingle();

                        if (error) {
                            console.error('[perfil] DNI query error:', error);
                            return null;
                        }

                        if (data) {
                            console.log(`[perfil] ✅ DNI found: ${data.nombre} ${data.apellido} (${data.edad} años)`);
                        } else {
                            console.log(`[perfil] ❌ No DNI found for user ${targetUser.id} in guild ${interaction.guildId}`);
                        }
                        return data;
                    } catch (e) {
                        console.error('[perfil] Failed to fetch DNI:', e.message, e.stack);
                        return null;
                    }
                })(),

                // Fetch Vehicle Count
                (async () => {
                    try {
                        const { count, error } = await supabase
                            .from('vehicles')
                            .select('*', { count: 'exact', head: true })
                            .eq('guild_id', interaction.guildId)
                            .eq('user_id', targetUser.id);

                        if (error) {
                            console.error('[perfil] Vehicles query error:', error);
                            return 0;
                        }
                        return count || 0;
                    } catch (e) {
                        console.error('[perfil] Failed to fetch vehicles:', e.message);
                        return 0;
                    }
                })(),

                // Fetch Arrest Status
                (async () => {
                    try {
                        const { data, error } = await supabase
                            .from('arrests')
                            .select('release_time, reason')
                            .eq('guild_id', interaction.guildId)
                            .eq('user_id', targetUser.id)
                            .gt('release_time', new Date().toISOString())
                            .maybeSingle();

                        if (error) {
                            console.error('[perfil] Arrests query error:', error);
                            return null;
                        }
                        return data;
                    } catch (e) {
                        console.error('[perfil] Failed to fetch arrests:', e.message);
                        return null;
                    }
                })(),

                // Fetch American ID
                (async () => {
                    try {
                        const { data } = await supabase
                            .from('american_id')
                            .select('*')
                            .eq('guild_id', interaction.guildId)
                            .eq('user_id', targetUser.id)
                            .maybeSingle();
                        return data;
                    } catch (e) {
                        return null;
                    }
                })(),

                // Fetch Owned Companies
                (async () => {
                    try {
                        const { data, error } = await supabase
                            .from('companies')
                            .select('name, balance')
                            .contains('owner_ids', [targetUser.id]);

                        if (error) {
                            console.error('[perfil] Companies query error:', error);
                            return [];
                        }
                        return data || [];
                    } catch (e) {
                        console.error('[perfil] Failed to fetch companies:', e.message);
                        return [];
                    }
                })(),

                // Fetch Employment Data
                (async () => {
                    try {
                        const { data: emp, error } = await supabase
                            .from('company_employees')
                            .select('company_id, role, salary')
                            .eq('discord_id', targetUser.id)
                            .is('fired_at', null)
                            .maybeSingle();

                        if (error || !emp) {
                            return null;
                        }

                        // Get company name
                        const { data: company } = await supabase
                            .from('companies')
                            .select('name')
                            .eq('id', emp.company_id)
                            .maybeSingle();

                        return {
                            company_name: company?.name || 'Empresa Desconocida',
                            role: emp.role,
                            salary: emp.salary
                        };
                    } catch (e) {
                        console.error('[perfil] Failed to fetch employment:', e.message);
                        return null;
                    }
                })()
            ]);

            console.log(`[perfil] All data fetched. DNI status:`, dni ? `Found (${dni.nombre} ${dni.apellido})` : 'Not found');

            const ARRESTED_ROLE_ID = '1413540729623679056';
            const isArrestedRole = member.roles.cache.has(ARRESTED_ROLE_ID);

            // Build Embed
            const embed = new EmbedBuilder()
                .setTitle(`${isOwnProfile ? '👤 Tu Perfil Ciudadano' : `👤 Perfil de ${targetUser.username}`}`)
                .setColor(isArrestedRole ? '#FF0000' : '#00AAC0') // Red if arrested
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTimestamp();

            // 1. Identity Section
            const fullName = dni ? `${dni.nombre} ${dni.apellido}` : 'Ciudadano sin DNI';
            const birthDate = dni?.fecha_nacimiento
                ? new Date(dni.fecha_nacimiento).toLocaleDateString('es-MX')
                : 'No registrado';

            const arrestStatus = isArrestedRole
                ? `🚨 **ARRESTADO** (Hasta: ${activeArrest ? new Date(activeArrest.release_time).toLocaleString('es-MX') : 'Indefinido'})`
                : '✅ Libre';

            embed.addFields({
                name: '🆔 Identidad (México)',
                value: `**Nombre:** ${fullName}\n**Nacimiento:** ${birthDate}\n**Estado Legal:** ${arrestStatus}`,
                inline: false
            });

            if (americanId) {
                embed.addFields({
                    name: '🇺🇸 Identidad (USA)',
                    value: `**Nombre:** ${americanId.first_name} ${americanId.last_name}\n**Nivel:** ${americanId.gender} (${americanId.age} años)\n**Estado:** ${americanId.state || 'N/A'}`,
                    inline: false
                });
            }

            // 2. Assets Section
            embed.addFields({
                name: '🚗 Patrominio',
                value: `**Vehículos Registrados:** ${vehicleCount || 0}`,
                inline: true
            });

            // Economy Section - Enhanced Display with USD support
            let economyText = `💵 **EFECTIVO (MXN):** $${cash.toLocaleString()}\n`;
            economyText += `🏦 **BANCO / DÉBITO (MXN):** $${bank.toLocaleString()}`;

            if (creditCard) {
                const available = creditCard.available_limit || 0;
                const used = creditCard.used_limit || 0;

                economyText += `\n💳 **CRÉDITO (MXN):** Disponible $${available.toLocaleString()}`;
            }

            // Fetch USD data
            const { data: usdStats } = await supabase
                .from('user_stats')
                .select('usd_cash')
                .eq('discord_user_id', targetUser.id)
                .maybeSingle();

            const { data: usdCards } = await supabase
                .from('us_credit_cards')
                .select('credit_limit, current_balance')
                .eq('user_id', targetUser.id)
                .eq('status', 'active');

            const usdCash = usdStats?.usd_cash || 0;
            let usdCreditAvailable = 0;
            if (usdCards && usdCards.length > 0) {
                usdCards.forEach(c => {
                    const limit = c.credit_limit || 0;
                    const debt = c.current_balance || 0;
                    usdCreditAvailable += (limit - debt);
                });
            }

            // Only show USD if user has any
            if (usdCash > 0 || usdCreditAvailable > 0) {
                economyText += `\n\n💵 **EFECTIVO (USD):** $${usdCash.toLocaleString()} USD`;
                if (usdCreditAvailable > 0) {
                    economyText += `\n💳 **CRÉDITO US:** Disponible $${usdCreditAvailable.toLocaleString()} USD`;
                }
            }

            embed.addFields({ name: '💼 Finanzas', value: economyText, inline: false });

            // Licenses Section
            if (licenses.length > 0) {
                embed.addFields({
                    name: '🪪 Licencias',
                    value: licenses.join('\n'),
                    inline: true
                });
            }

            // Active Passes Section
            if (passes && passes.length > 0) {
                const passText = passes.map(p => {
                    const expires = new Date(p.expires_at);
                    const remaining = p.uses_remaining
                        ? ` (${p.uses_remaining} usos)`
                        : ` (Vence: ${expires.toLocaleDateString('es-MX')})`;
                    return `• ${p.item_name}${remaining}`;
                }).join('\n');

                embed.addFields({
                    name: '🎫 Pases',
                    value: passText,
                    inline: false
                });
            }

            // Sanctions Section (only show own if viewing own profile, or if staff)
            const juntaDirectivaRoleId = '1412882245735420006';
            const isStaff = interaction.member.roles.cache.has(juntaDirectivaRoleId) ||
                interaction.member.permissions.has('Administrator');

            if ((isOwnProfile || isStaff) && sanctions && (sanctions.recent?.length > 0 || sanctions.counts?.total > 0)) {
                // Display counters
                const countersText = `📊 **Total:** ${sanctions.counts.total} | 📝 **Notificaciones:** ${sanctions.counts.notificacion} | ⚠️ **SA:** ${sanctions.counts.sa} | 🚫 **Generales:** ${sanctions.counts.general}`;

                let sanctionValue = countersText;

                // Add recent sanctions if any
                if (sanctions.recent && sanctions.recent.length > 0) {
                    const sanctionText = sanctions.recent.map(s => {
                        const date = new Date(s.created_at).toLocaleDateString('es-MX');
                        const statusIcon = s.status === 'active' ? '🔴' : s.status === 'archived' ? '⚪' : '🔵';
                        return `${statusIcon} **${s.type.toUpperCase()}** (${date})\n   ${s.reason}`;
                    }).join('\n\n');

                    sanctionValue += `\n\n**Últimas 3:**\n${sanctionText}`;
                }

                embed.addFields({
                    name: '📋 Historial de Sanciones',
                    value: sanctionValue.substring(0, 1024), // Discord limit
                    inline: false,
                });
            } else if ((isOwnProfile || isStaff)) {
                embed.addFields({
                    name: '📋 Historial de Sanciones',
                    value: '✅ Registro limpio\n📊 **Total:** 0 | 📝 **Notificaciones:** 0 | ⚠️ **SA:** 0 | 🚫 **Generales:** 0',
                    inline: false
                });
            }

            // Company/Employment Section
            if (ownedCompanies && ownedCompanies.length > 0) {
                const companyList = ownedCompanies.map(c => `🏢 **${c.name}** - Balance: $${(c.balance || 0).toLocaleString()}`).join('\n');
                embed.addFields({
                    name: '🏢 Empresas Propias',
                    value: companyList,
                    inline: false
                });
            }

            if (employmentData) {
                embed.addFields({
                    name: '💼 Empleo Actual',
                    value: `🏢 **${employmentData.company_name}**\n📋 Cargo: ${employmentData.role}\n💰 Salario: $${employmentData.salary.toLocaleString()}/mes`,
                    inline: false
                });
            }

            embed.setFooter({
                text: isOwnProfile
                    ? 'Tu información personal en Nación MX'
                    : `Información solicitada por ${interaction.user.tag}`
            });

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[perfil] Critical Error:', error);
            console.error('[perfil] Stack:', error.stack);
            await interaction.editReply('❌ Error al cargar el perfil. Intenta de nuevo más tarde.');
        }
    }
};
