const logger = require('./Logger');

class DealershipService {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Obtiene el catálogo de vehículos, opcionalmente filtrado por categoría
     */
    async getCatalog(category = null, page = 1, pageSize = 10) {
        try {
            let query = this.supabase
                .from('dealership_catalog')
                .select('*', { count: 'exact' })
                .eq('is_active', true);

            if (category) {
                query = query.eq('category', category);
            }

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                .range(from, to)
                .order('price', { ascending: true });

            if (error) throw error;

            return {
                data,
                meta: {
                    page,
                    pageSize,
                    totalItems: count,
                    totalPages: Math.ceil(count / pageSize)
                }
            };
        } catch (error) {
            logger.errorWithContext('Error fetching catalog', error);
            throw error;
        }
    }

    /**
     * Obtiene detalles de un vehículo específico
     */
    async getVehicleDetails(nameOrId) {
        try {
            let query = this.supabase
                .from('dealership_catalog')
                .select('*');

            // Intenta buscar por ID si es numérico, sino por nombre parcial
            if (!isNaN(nameOrId)) {
                query = query.eq('id', parseInt(nameOrId));
            } else {
                query = query.ilike('model', `%${nameOrId}%`);
            }

            const { data, error } = await query.limit(1).maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.errorWithContext('Error fetching vehicle details', error, { query: nameOrId });
            throw error;
        }
    }

    /**
     * Inicia una solicitud de compra (Crea Ticket y Record)
     */
    async createSaleRequest(userId, guildId, vehicleId, paymentMethod) {
        try {
            const vehicle = await this.getVehicleDetails(vehicleId);
            if (!vehicle) throw new Error('Vehículo no encontrado');
            if (vehicle.stock < 1) throw new Error('Vehículo sin stock');

            const { data, error } = await this.supabase
                .from('dealership_sales')
                .insert({
                    user_id: userId,
                    guild_id: guildId,
                    vehicle_id: vehicleId,
                    price_total: vehicle.price,
                    payment_method: paymentMethod,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.errorWithContext('Error creating sale request', error);
            throw error;
        }
    }

    /**
     * Finaliza una venta (Entrega vehículo)
     */
    async completeSale(saleId, adminId) {
        try {
            // 1. Get Sale
            const { data: sale, error: fetchError } = await this.supabase
                .from('dealership_sales')
                .select('*, dealership_catalog(*)')
                .eq('id', saleId)
                .single();

            if (fetchError || !sale) throw new Error('Venta no encontrada');
            if (sale.status === 'completed') throw new Error('Venta ya completada');

            // 2. Decrement Stock
            const { error: stockError } = await this.supabase.rpc('decrement_dealership_stock', {
                vehicle_id: sale.vehicle_id
            });
            // Fallback if RPC doesn't exist (we will create it later or handle manually here)
            // Manual update:
            const { error: manualStockError } = await this.supabase
                .from('dealership_catalog')
                .update({ stock: sale.dealership_catalog.stock - 1 })
                .eq('id', sale.vehicle_id);

            if (manualStockError) logger.error('Error updating stock manually', manualStockError);


            // 3. Register User Vehicle Ownership (Using existing economy/RP tables logic if available)
            // Assuming 'user_vehicles' table exists as per previous analysis or we create a new relation
            // For now, we update the sale status as proof of ownership

            const { error: updateError } = await this.supabase
                .from('dealership_sales')
                .update({
                    status: 'completed',
                    approver_id: adminId,
                    updated_at: new Date()
                })
                .eq('id', saleId);

            if (updateError) throw updateError;

            return sale;

        } catch (error) {
            logger.errorWithContext('Error completing sale', error, { saleId });
            throw error;
        }
    }
}

module.exports = DealershipService;
