const { createClient } = require('@supabase/supabase-js');

class StoreService {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;

        // Channel IDs
        this.CASINO_CHANNEL_ID = '1451398359540826306';
        this.TICKET_CHANNEL_ID = '1398889153919189042';

        // Role mappings (from store_items table)
        this.ROLE_MAP = {
            premium_role: '1449950535166726317',
            heavy_weapons: '1449949468517470285',
            sports_car: '1449949914154012878',
            swat_vehicle: '1449949722050691132',
            anti_rob: '1449947645383675939',
            custom_sticker: '1449950778499268619',
            casino_access: '1449951345611378841',
            anti_ck: '1449950413993410651',
            undercover_vehicle: '1449950079887605880',
            tax_evasion: '1449950636371214397',
            content_creator: '1449948475935424583'
        };
    }

    /**
     * Get all active store items
     */
    async getStoreItems() {
        const { data, error } = await this.supabase
            .from('store_items')
            .select('*')
            .eq('active', true)
            .order('display_order');

        if (error) throw error;
        return data;
    }

    /**
     * Get a specific store item
     */
    async getStoreItem(itemKey) {
        const { data, error } = await this.supabase
            .from('store_items')
            .select('*')
            .eq('item_key', itemKey)
            .eq('active', true)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get user's active purchases
     */
    async getUserActivePurchases(userId) {
        const { data, error } = await this.supabase
            .rpc('get_user_active_purchases', { p_user_id: userId });

        if (error) throw error;
        return data || [];
    }

    /**
     * Check if user has an active purchase of a specific item
     */
    async hasActivePurchase(userId, itemKey) {
        const { data, error } = await this.supabase
            .from('user_purchases')
            .select('id')
            .eq('user_id', userId)
            .eq('item_key', itemKey)
            .eq('status', 'active')
            .gte('expiration_date', new Date().toISOString())
            .maybeSingle();

        if (error) throw error;
        return data !== null;
    }

    /**
     * Purchase an item
     */
    async purchaseItem(userId, itemKey, discordMember, billingService) {
        // 1. Get item details
        const item = await this.getStoreItem(itemKey);
        if (!item) {
            throw new Error('Item no encontrado en la tienda');
        }

        // 2. Check if user already has this item (prevent duplicates for some items)
        const hasActive = await this.hasActivePurchase(userId, itemKey);
        if (hasActive && !['anti_ck'].includes(itemKey)) {
            throw new Error(`Ya tienes un "${item.name}" activo`);
        }

        // 3. Check user balance
        const { data: card } = await this.supabase
            .from('debit_cards')
            .select('balance')
            .eq('discord_user_id', userId)
            .eq('status', 'active')
            .maybeSingle();

        if (!card || card.balance < item.price) {
            throw new Error(`Saldo insuficiente. Necesitas $${item.price.toLocaleString()}`);
        }

        // 4. Deduct money
        await this.supabase
            .from('debit_cards')
            .update({ balance: card.balance - item.price })
            .eq('discord_user_id', userId)
            .eq('status', 'active');

        // 5. Calculate expiration date
        let expirationDate = null;
        if (item.duration_days) {
            expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + item.duration_days);
        } else if (item.duration_hours) {
            expirationDate = new Date();
            expirationDate.setHours(expirationDate.getHours() + item.duration_hours);
        }

        // 6. Create purchase record
        const { data: purchase, error: purchaseError } = await this.supabase
            .from('user_purchases')
            .insert({
                user_id: userId,
                item_key: itemKey,
                expiration_date: expirationDate,
                status: 'active',
                uses_remaining: item.max_uses,
                metadata: {}
            })
            .select()
            .single();

        if (purchaseError) {
            // Rollback payment
            await this.supabase
                .from('debit_cards')
                .update({ balance: card.balance })
                .eq('discord_user_id', userId);
            throw purchaseError;
        }

        // 7. Log transaction
        await this.supabase
            .from('purchase_transactions')
            .insert({
                user_id: userId,
                item_key: itemKey,
                amount_paid: item.price,
                purchase_id: purchase.id,
                transaction_type: 'purchase'
            });

        // 8. Assign Discord role if applicable
        if (item.role_id && discordMember) {
            try {
                await discordMember.roles.add(item.role_id);
                console.log(`✅ Role ${item.role_id} assigned to ${userId} for ${itemKey}`);
            } catch (roleError) {
                console.error(`❌ Failed to assign role ${item.role_id}:`, roleError);
            }
        }

        return {
            purchase,
            item,
            expirationDate
        };
    }

    /**
     * Expire old purchases and remove roles
     */
    async expirePurchases(client, cancellationChannelId) {
        console.log('[StoreService] Checking for expired purchases...');

        // Get purchases that just expired
        const { data: expiredPurchases } = await this.supabase
            .from('user_purchases')
            .select(`
                id,
                user_id,
                item_key,
                store_items!inner(role_id, name)
            `)
            .eq('status', 'active')
            .lt('expiration_date', new Date().toISOString());

        if (!expiredPurchases || expiredPurchases.length === 0) {
            console.log('[StoreService] No purchases to expire');
            return 0;
        }

        console.log(`[StoreService] Found ${expiredPurchases.length} expired purchases`);

        for (const purchase of expiredPurchases) {
            try {
                // Remove Discord role
                if (purchase.store_items.role_id) {
                    const guild = client.guilds.cache.first();
                    if (guild) {
                        const member = await guild.members.fetch(purchase.user_id).catch(() => null);
                        if (member) {
                            await member.roles.remove(purchase.store_items.role_id);
                            console.log(`✅ Removed role ${purchase.store_items.role_id} from ${purchase.user_id}`);

                            // Log to Cancellations Channel
                            if (cancellationChannelId) {
                                try {
                                    const channel = await client.channels.fetch(cancellationChannelId);
                                    if (channel) {
                                        const { EmbedBuilder } = require('discord.js');
                                        const logEmbed = new EmbedBuilder()
                                            .setTitle('❌ Rol / Item Vencido')
                                            .setColor('#FF0000')
                                            .setDescription(`El periodo de **${purchase.store_items.name}** ha finalizado.`)
                                            .addFields(
                                                { name: '👤 Usuario', value: `<@${purchase.user_id}>`, inline: true },
                                                { name: '📦 Item', value: purchase.store_items.name, inline: true },
                                                { name: '⏰ Expiró', value: `<t:${Math.floor(new Date(purchase.expiration_date).getTime() / 1000)}:R>`, inline: true }
                                            )
                                            .setTimestamp();
                                        await channel.send({ embeds: [logEmbed] });
                                    }
                                } catch (logErr) {
                                    console.error('Error logging cancellation:', logErr);
                                }
                            }
                        }
                    }
                }

                // Notify user via DM
                try {
                    const user = await client.users.fetch(purchase.user_id);
                    await user.send({
                        content: `⏰ **Pase Expirado**\n\nTu pase de **${purchase.store_items.name}** ha expirado.\n\n¿Quieres renovarlo? Usa \`/tienda comprar\``
                    });
                } catch (dmError) {
                    console.log(`Could not DM user ${purchase.user_id}`);
                }

            } catch (error) {
                console.error(`Error processing expired purchase ${purchase.id}:`, error);
            }
        }

        // Mark as expired in database
        const { error } = await this.supabase
            .rpc('expire_old_purchases');

        if (error) {
            console.error('[StoreService] Error expiring purchases:', error);
            return 0;
        }

        return expiredPurchases.length;
    }

    /**
     * Consume anti-ck insurance (called when player gets FEC)
     */
    async consumeAntiCK(userId) {
        const { data, error } = await this.supabase
            .rpc('consume_anti_ck', { p_user_id: userId });

        if (error) throw error;
        return data; // true if consumed, false if no insurance available
    }

    /**
     * Get tax evaders list (for police)
     */
    async getTaxEvaders() {
        const { data, error } = await this.supabase
            .from('tax_evaders')
            .select('*');

        if (error) throw error;
        return data || [];
    }

    /**
     * Check if user has tax evasion active
     */
    async hasTaxEvasion(userId) {
        return await this.hasActivePurchase(userId, 'tax_evasion');
    }

    /**
     * Check if user has anti-rob protection
     */
    async hasAntiRob(userId) {
        return await this.hasActivePurchase(userId, 'anti_rob');
    }
}

module.exports = StoreService;
