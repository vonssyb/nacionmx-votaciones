const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getAvailablePaymentMethods, processPayment, createPaymentButtons, createPaymentEmbed } = require('../../utils/economyUtils');
const { logToChannel } = require('../../utils/economyUtils'); // Creating/mocking if not exists, but usually I need to import relevant logging
const BillingService = require('../../services/BillingService');

const LOG_TIENDA = '1452499876737978438';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tienda')
        .setDescription('🛒 Tienda Premium - Pases, roles y beneficios exclusivos')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Ver catálogo completo de la tienda'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('comprar')
                .setDescription('Comprar un item de la tienda')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('Item a comprar')
                        .setRequired(true)
                        .addChoices(
                            { name: '👑 Rol Premium - $4,000,000 (30d)', value: 'premium_role' },
                            { name: '🔫 Armas Pesadas - $320,000 (3d)', value: 'heavy_weapons' },
                            { name: '🏎️ Coche Deportivo - $280,000 (7d)', value: 'sports_car' },
                            { name: '🚓 Armamento SWAT - $120,000 (3d)', value: 'swat_vehicle' },
                            { name: '🛡️ Escolta ANTIROBO - $60,000 (7d)', value: 'anti_rob' },
                            { name: '🎨 Sticker Personalizado - $350,000 (permanente)', value: 'custom_sticker' },
                            { name: '🎰 Casino - $600,000 (1h)', value: 'casino_access' },
                            { name: '💚 Anti CK Seguro - $700,000 (3d, 1 uso)', value: 'anti_ck' },
                            { name: '🚗 Vehículo Undercover - $100,000 (3d)', value: 'undercover_vehicle' },
                            { name: '💸 Evasión Impuestos - $380,000 (7d)', value: 'tax_evasion' },
                            { name: '📸 Fotos y Pantalla - $150,000 (7d)', value: 'content_creator' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mispases')
                .setDescription('Ver tus pases activos')),

    async execute(interaction, client, supabase) {
        const billingService = new BillingService(client);
        const subcommand = interaction.options.getSubcommand();

        // 1. DNI CHECK
        if (['comprar'].includes(subcommand)) {
            const { data: shopDni } = await supabase
                .from('citizen_dni')
                .select('id')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', interaction.user.id)
                .maybeSingle();

            if (!shopDni) {
                return interaction.reply({
                    content: '❌ **DNI Requerido**\n\nNecesitas un DNI válido para comprar en la tienda.\nCrea uno usando `/dni crear`.',
                    ephemeral: true
                });
            }
        }

        // 2. SUBCOMMANDS
        if (subcommand === 'ver') {
            await interaction.deferReply();
            try {
                const { data: items, error } = await supabase
                    .from('store_items')
                    .select('*')
                    .eq('active', true)
                    .order('display_order', { ascending: true });

                if (error) throw error;

                if (!items || items.length === 0) {
                    return interaction.editReply('🛒 La tienda está vacía por el momento.');
                }

                // Filtering by explicit hardcoded options if needed, but DB is source of truth.
                // We trust the DB has the matching 'item_key' for the choices above.

                const itemsPerPage = 3;
                const pages = [];

                for (let i = 0; i < items.length; i += itemsPerPage) {
                    const pageItems = items.slice(i, i + itemsPerPage);
                    const embed = new EmbedBuilder()
                        .setTitle('🛒 Tienda Premium Nación MX')
                        .setColor('#FFD700')
                        .setDescription('💰 **Beneficios exclusivos para mejorar tu experiencia**\n\nUsa `/tienda comprar` para adquirir un item.')
                        .setFooter({ text: `Página ${Math.floor(i / itemsPerPage) + 1}/${Math.ceil(items.length / itemsPerPage)}` });

                    for (const item of pageItems) {
                        const benefits = item.benefits ? item.benefits.join('\n• ') : 'Sin descripción';
                        const duration = item.duration_days
                            ? `⏰ ${item.duration_days} días`
                            : item.duration_hours
                                ? `⏰ ${item.duration_hours} hora(s)`
                                : '♾️ Permanente';

                        const extraInfo = item.max_uses ? `\n🎫 Usos: ${item.max_uses}` : '';
                        const ticket = item.requires_ticket ? '\n📩 Requiere ticket para activación' : '';

                        embed.addFields({
                            name: `${item.icon_emoji} ${item.name}`,
                            value: `💵 **$${item.price.toLocaleString()}**\n${item.description}\n\n**Beneficios:**\n• ${benefits}\n${duration}${extraInfo}${ticket}`,
                            inline: false
                        });
                    }
                    pages.push(embed);
                }

                if (pages.length === 0) return interaction.editReply('No hay items para mostrar.');

                let currentPage = 0;
                const getRow = (page) => {
                    const row = new ActionRowBuilder();
                    row.addComponents(
                        new ButtonBuilder().setCustomId('prev').setLabel('◀️ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(pages.length === 1),
                        new ButtonBuilder().setCustomId('next').setLabel('Siguiente ▶️').setStyle(ButtonStyle.Secondary).setDisabled(pages.length === 1)
                    );
                    return row;
                };

                const msg = await interaction.editReply({ embeds: [pages[0]], components: [getRow(0)] });

                if (pages.length === 1) return;

                const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) return i.reply({ content: 'No es tu menú.', ephemeral: true });

                    if (i.customId === 'prev') {
                        currentPage = (currentPage - 1 + pages.length) % pages.length;
                    } else if (i.customId === 'next') {
                        currentPage = (currentPage + 1) % pages.length;
                    }
                    await i.update({ embeds: [pages[currentPage]], components: [getRow(currentPage)] });
                });

                collector.on('end', () => msg.edit({ components: [] }).catch(() => { }));

            } catch (error) {
                console.error('[Tienda Ver] Error:', error);
                await interaction.editReply('❌ Error cargando la tienda.');
            }

        } else if (subcommand === 'comprar') {
            await interaction.deferReply();
            const itemKey = interaction.options.getString('item');
            const userId = interaction.user.id;

            try {
                // Fetch Item
                const { data: item, error: itemError } = await supabase
                    .from('store_items')
                    .select('*')
                    .eq('item_key', itemKey)
                    .eq('active', true)
                    .single();

                if (itemError || !item) {
                    return interaction.editReply('❌ Item no encontrado en la base de datos o no disponible. Contacta a un admin.');
                }

                // Check Existing Active Purchase
                const { data: existing } = await supabase
                    .from('user_purchases')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('item_key', itemKey)
                    .eq('status', 'active')
                    .maybeSingle();

                if (existing) {
                    const expiryDate = existing.expiration_date ? `\nExpira: <t:${Math.floor(new Date(existing.expiration_date).getTime() / 1000)}:R>` : '';
                    return interaction.editReply(`⚠️ Ya tienes este item activo.${expiryDate}`);
                }

                // Payment Flow
                const pmStore = await getAvailablePaymentMethods(supabase, userId, interaction.guildId);
                const pbStore = createPaymentButtons(pmStore, 'store_pay');
                const storeEmbed = createPaymentEmbed(`${item.icon_emoji} ${item.name}`, item.price, pmStore);

                const msg = await interaction.editReply({ embeds: [storeEmbed], components: [pbStore] });

                const filter = i => i.user.id === userId && i.customId.startsWith('store_pay_');
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });

                collector.on('collect', async i => {
                    try {
                        await i.deferUpdate();
                        const method = i.customId.replace('store_pay_', '');

                        const paymentResult = await processPayment(billingService, supabase, method, userId, interaction.guildId, item.price, `[Tienda] ${item.name}`, pmStore);

                        if (!paymentResult.success) {
                            return i.followUp({ content: `❌ ${paymentResult.error}`, ephemeral: true }); // Using followUp to keep embed
                        }

                        // Calculate Expiration
                        let expirationDate = null;
                        if (item.duration_days) {
                            expirationDate = new Date();
                            expirationDate.setDate(expirationDate.getDate() + item.duration_days);
                        } else if (item.duration_hours) {
                            expirationDate = new Date();
                            expirationDate.setHours(expirationDate.getHours() + item.duration_hours);
                        }

                        // Record Purchase
                        const { data: purchase, error: purchaseError } = await supabase
                            .from('user_purchases')
                            .insert({
                                user_id: userId,
                                item_key: itemKey,
                                expiration_date: expirationDate ? expirationDate.toISOString() : null,
                                status: 'active',
                                uses_remaining: item.max_uses || null
                            })
                            .select()
                            .single();

                        if (purchaseError) throw purchaseError;

                        // Log Transaction
                        await supabase.from('purchase_transactions').insert({
                            user_id: userId,
                            item_key: itemKey,
                            amount_paid: item.price,
                            payment_method: method,
                            purchase_id: purchase.id,
                            transaction_type: 'purchase'
                        });

                        // Assign Role if applicable (Directly or via service)
                        if (item.role_id) {
                            const member = await interaction.guild.members.fetch(userId).catch(() => null);
                            if (member) await member.roles.add(item.role_id).catch(e => console.error('Role assign error:', e));
                        }

                        // Success Message
                        const duration = item.duration_days
                            ? `\n⏰ Válido por **${item.duration_days} días**`
                            : item.duration_hours
                                ? `\n⏰ Válido por **${item.duration_hours} hora(s)**`
                                : '\n♾️ **Permanente**';

                        const ticketMsg = item.requires_ticket ? `\n\n📩 **Abre un ticket** en <#${item.ticket_channel_id}> para activar tu beneficio.` : '';

                        const successEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ Compra Exitosa')
                            .setDescription(`${item.icon_emoji} **${item.name}**\n\n💰 Pagado: $${item.price.toLocaleString()}\n💳 Método: ${paymentResult.method}${duration}${ticketMsg}`)
                            .setFooter({ text: 'Gracias por tu compra!' })
                            .setTimestamp();

                        // Log to Channel
                        const logChannel = interaction.guild.channels.cache.get(LOG_TIENDA);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setTitle('🛒 Nueva Compra en Tienda')
                                .setColor('#AA00FF')
                                .addFields(
                                    { name: 'Cliente', value: `<@${userId}>`, inline: true },
                                    { name: 'Item', value: item.name, inline: true },
                                    { name: 'Precio', value: `$${item.price.toLocaleString()}`, inline: true },
                                    { name: 'Método', value: paymentResult.method, inline: true }
                                )
                                .setTimestamp();
                            logChannel.send({ embeds: [logEmbed] }).catch(console.error);
                        }

                        await interaction.editReply({ embeds: [successEmbed], components: [] });

                    } catch (err) {
                        console.error('Purchase error:', err);
                        await interaction.followUp({ content: `❌ Error catastrófico: ${err.message}`, ephemeral: true });
                    }
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time' && collected.size === 0) {
                        interaction.editReply({ content: '⏰ Tiempo agotado para completar el pago.', components: [] });
                    }
                });

            } catch (error) {
                console.error('[Tienda Comprar] Root Error:', error);
                await interaction.editReply('❌ Error iniciando el proceso de compra.');
            }

        } else if (subcommand === 'mispases') {
            await interaction.deferReply();
            try {
                // Join store_items to get names
                const { data: purchases, error } = await supabase
                    .from('user_purchases')
                    .select('*, store_items(name, icon_emoji, description)')
                    .eq('user_id', interaction.user.id)
                    .eq('status', 'active');

                if (error) throw error;

                if (!purchases || purchases.length === 0) {
                    return interaction.editReply('❌ No tienes pases activos.');
                }

                const embed = new EmbedBuilder()
                    .setTitle('🎒 Mis Pases y Artículos')
                    .setColor('#00ADFF')
                    .setDescription(`Tienes **${purchases.length}** artículos activos.`)
                    .setTimestamp();

                for (const p of purchases) {
                    const item = p.store_items;
                    const expiry = p.expiration_date ? `<t:${Math.floor(new Date(p.expiration_date).getTime() / 1000)}:R>` : '♾️ Permanente';
                    const uses = p.uses_remaining !== null ? `\n🎫 Usos restantes: **${p.uses_remaining}**` : '';

                    embed.addFields({
                        name: `${item?.icon_emoji || '📦'} ${item?.name || p.item_key}`,
                        value: `Caduca: ${expiry}${uses}\n${item?.description || ''}`,
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('[Mis Pases] Error:', error);
                await interaction.editReply('❌ Error al consultar tus pases.');
            }
        }
    }
};
