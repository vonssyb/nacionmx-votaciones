const { createClient } = require('@supabase/supabase-js');

class TaxService {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Calculate corporate tax for a user
     * @param {string} discordId 
     */
    async calculateCorporateTax(discordId) {
        try {
            // 1. Check if user is a "Company" (Has Business Card)
            // Business cards start with "NMX Business"
            const { data: businessCards } = await this.supabase
                .from('credit_cards')
                .select('citizen_id, citizens!inner(discord_id)')
                .eq('citizens.discord_id', discordId)
                .eq('status', 'active')
                .ilike('card_type', 'NMX Business%');

            if (!businessCards || businessCards.length === 0) {
                return { isCompany: false, message: 'No es una cuenta empresarial.' };
            }

            // 2. Get Income (Deposits + Transfers In) from last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: transactions } = await this.supabase
                .from('debit_transactions')
                .select('amount')
                .eq('discord_user_id', discordId)
                .in('transaction_type', ['deposit', 'transfer_in'])
                .gte('created_at', thirtyDaysAgo.toISOString());

            const totalIncome = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

            // 2b. Check if Company is Private
            // We need to find the company owned by this discordId
            // Note: owner_ids is an array. We check if the array contains the discordId.
            const { data: companies } = await this.supabase
                .from('companies')
                .select('is_private')
                .contains('owner_ids', [discordId])
                .eq('status', 'active');

            let isPrivateCompany = false;
            // If user owns multiple, and ANY is private, we apply surcharge (simplification)
            if (companies && companies.length > 0) {
                isPrivateCompany = companies.some(c => c.is_private);
            }

            // 3. Calculate Tax Tier
            let taxRate = 0;
            if (totalIncome > 5000000) taxRate = 0.15;      // > 5M
            else if (totalIncome > 1000000) taxRate = 0.10; // 1M - 5M
            else taxRate = 0.05;                            // 0 - 1M

            // 3b. Apply Surcharge
            if (isPrivateCompany) {
                taxRate += 0.05; // +5% for private companies
            }

            const taxAmount = totalIncome * taxRate;

            return {
                isCompany: true,
                period: 'Últimos 30 días',
                income: totalIncome,
                rate: taxRate * 100,
                taxAmount: taxAmount,
                nextPayment: 'Día 1 de cada mes'
            };

        } catch (error) {
            console.error('Error calculating tax:', error);
            throw error;
        }
    }
}

module.exports = TaxService;
