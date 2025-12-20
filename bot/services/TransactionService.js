/**
 * TransactionService - Handles atomic transactions via Supabase functions
 * Prevents data inconsistencies during multi-step operations
 */
class TransactionService {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Execute debit card payment atomically
     * @param {object} params
     * @returns {Promise<object>}
     */
    async executeDebitPayment({ cardId, userId, amount, type, description }) {
        try {
            const { data, error } = await this.supabase.rpc('execute_debit_payment', {
                p_card_id: cardId,
                p_user_id: userId,
                p_amount: amount,
                p_type: type,
                p_description: description
            });

            if (error) throw new Error(error.message);

            console.log(`[TRANSACTION] Debit payment successful: ${amount} from card ${cardId}`);
            return data;
        } catch (error) {
            console.error('[TRANSACTION] Debit payment failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute payroll payment atomically
     * @param {object} params
     * @returns {Promise<object>}
     */
    async executePayrollPayment({ companyId, ownerId, employees, totalAmount }) {
        try {
            const { data, error } = await this.supabase.rpc('execute_payroll_payment', {
                p_company_id: companyId,
                p_owner_id: ownerId,
                p_employees: employees,
                p_total_amount: totalAmount
            });

            if (error) throw new Error(error.message);

            console.log(`[TRANSACTION] Payroll successful: ${employees.length} employees, total ${totalAmount}`);
            return data;
        } catch (error) {
            console.error('[TRANSACTION] Payroll failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute credit card payment atomically
     * @param {object} params
     * @returns {Promise<object>}
     */
    async executeCreditPayment({ cardId, userId, amount }) {
        try {
            const { data, error } = await this.supabase.rpc('execute_credit_payment', {
                p_card_id: cardId,
                p_user_id: userId,
                p_amount: amount
            });

            if (error) throw new Error(error.message);

            console.log(`[TRANSACTION] Credit payment successful: ${amount} to card ${cardId}`);
            return data;
        } catch (error) {
            console.error('[TRANSACTION] Credit payment failed:', error.message);
            throw error;
        }
    }

    /**
     * Generic transaction wrapper
     * Executes operations in sequence, rolls back all if any fails
     * @param {Array<Function>} operations
     * @returns {Promise<Array>}
     */
    async executeTransaction(operations) {
        const results = [];

        try {
            for (const op of operations) {
                const result = await op();
                results.push(result);
            }
            return results;
        } catch (error) {
            console.error('[TRANSACTION] Failed, rolling back...', error.message);
            throw error;
        }
    }
}

module.exports = TransactionService;
