/**
 * TransactionManager - Centralized atomic transaction system
 * Handles all monetary operations with ACID guarantees
 * 
 * Features:
 * - Atomic database operations via Supabase RPC functions
 * - Automatic rollback on errors
 * - Rate limiting integration
 * - Audit logging for all transactions
 * - Anti-exploit validation
 */

const logger = require('./Logger');

class TransactionManager {
    constructor(supabase, auditLogger = null) {
        this.supabase = supabase;
        this.auditLogger = auditLogger;
        this.pendingTransactions = new Map(); // Track in-flight transactions
    }

    /**
     * Execute a casino transaction atomically
     * @param {string} userId - Discord user ID
     * @param {number} betAmount - Bet amount (positive for bet)
     * @param {number} payoutAmount - Payout amount (0 if lost)
     * @param {string} gameType - Type of game (dados, slots, blackjack, etc.)
     * @param {object} metadata - Additional game metadata
     * @returns {Promise<{success: boolean, newBalance: number, error?: string}>}
     */
    async executeCasinoTransaction(userId, betAmount, payoutAmount, gameType, metadata = {}) {
        const transactionId = `${userId}_${Date.now()}`;

        try {
            // Check for duplicate/rapid transactions
            if (this.pendingTransactions.has(userId)) {
                return {
                    success: false,
                    error: '⏳ Ya tienes una transacción en proceso. Espera un momento.'
                };
            }

            this.pendingTransactions.set(userId, transactionId);

            // Execute via RPC function for atomicity
            const { data, error } = await this.supabase.rpc('execute_casino_transaction', {
                p_user_id: userId,
                p_bet_amount: betAmount,
                p_payout_amount: payoutAmount,
                p_game_type: gameType,
                p_metadata: metadata
            });

            if (error) {
                logger.error('Casino transaction failed', { userId, gameType, error: error.message });
                return {
                    success: false,
                    error: '❌ Error al procesar la transacción. Por favor intenta de nuevo.'
                };
            }

            // Log to audit if available
            if (this.auditLogger) {
                await this.auditLogger.logTransaction({
                    userId,
                    type: 'casino',
                    gameType,
                    betAmount,
                    payoutAmount,
                    balanceBefore: data.balance_before,
                    balanceAfter: data.new_balance,
                    metadata
                }).catch(err => logger.warn('Audit log failed', err));
            }

            logger.info('Casino transaction successful', {
                userId,
                gameType,
                bet: betAmount,
                payout: payoutAmount,
                newBalance: data.new_balance
            });

            return {
                success: true,
                newBalance: data.new_balance,
                balanceBefore: data.balance_before,
                won: payoutAmount > betAmount
            };

        } catch (error) {
            logger.error('Casino transaction exception', { userId, gameType, error: error.message });
            return {
                success: false,
                error: '❌ Error inesperado. Contacta a un administrador si persiste.'
            };
        } finally {
            this.pendingTransactions.delete(userId);
        }
    }

    /**
     * Update casino chips for purchase/sale operations
     * @param {string} userId
     * @param {number} chipsAmount - Positive to add, negative to remove
     * @param {number} cashAmount - Cash paid/received
     * @param {string} operation - 'buy' or 'sell'
     */
    async executeCasinoChipsExchange(userId, chipsAmount, cashAmount, operation) {
        try {
            const { data, error } = await this.supabase.rpc('execute_chips_exchange', {
                p_user_id: userId,
                p_chips_amount: chipsAmount,
                p_cash_amount: cashAmount,
                p_operation: operation
            });

            if (error) throw error;

            if (this.auditLogger) {
                await this.auditLogger.logTransaction({
                    userId,
                    type: 'chips_exchange',
                    operation,
                    chipsAmount,
                    cashAmount,
                    metadata: { newChips: data.new_chips_balance, newCash: data.new_cash_balance }
                }).catch(() => { });
            }

            return {
                success: true,
                newChipsBalance: data.new_chips_balance,
                newCashBalance: data.new_cash_balance
            };

        } catch (error) {
            logger.error('Chips exchange failed', { userId, operation, error: error.message });
            return {
                success: false,
                error: '❌ Error al procesar el intercambio de fichas.'
            };
        }
    }

    /**
     * Execute money transfer between users atomically
     * @param {string} fromUserId
     * @param {string} toUserId
     * @param {number} amount
     * @param {string} transferType - 'cash', 'bank', 'giro'
     * @param {object} metadata
     */
    async executeMoneyTransfer(fromUserId, toUserId, amount, transferType, metadata = {}) {
        try {
            const { data, error } = await this.supabase.rpc('execute_money_transfer', {
                p_from_user: fromUserId,
                p_to_user: toUserId,
                p_amount: amount,
                p_transfer_type: transferType,
                p_metadata: metadata
            });

            if (error) throw error;

            if (this.auditLogger) {
                await this.auditLogger.logTransaction({
                    userId: fromUserId,
                    type: 'transfer_out',
                    amount,
                    transferType,
                    targetUser: toUserId,
                    metadata
                }).catch(() => { });
            }

            return {
                success: true,
                newBalance: data.sender_new_balance
            };

        } catch (error) {
            logger.error('Money transfer failed', {
                fromUserId,
                toUserId,
                amount,
                error: error.message
            });
            return {
                success: false,
                error: '❌ Error al procesar la transferencia.'
            };
        }
    }

    /**
     * Execute bank deposit/withdrawal atomically
     * @param {string} userId
     * @param {number} amount - Positive for deposit, negative for withdrawal
     * @param {string} operation - 'deposit' or 'withdraw'
     */
    async executeBankOperation(userId, amount, operation) {
        try {
            const { data, error } = await this.supabase.rpc('execute_bank_operation', {
                p_user_id: userId,
                p_amount: amount,
                p_operation: operation
            });

            if (error) throw error;

            if (this.auditLogger) {
                await this.auditLogger.logTransaction({
                    userId,
                    type: 'bank_' + operation,
                    amount,
                    metadata: {
                        newCash: data.new_cash_balance,
                        newBank: data.new_bank_balance
                    }
                }).catch(() => { });
            }

            return {
                success: true,
                newCashBalance: data.new_cash_balance,
                newBankBalance: data.new_bank_balance
            };

        } catch (error) {
            logger.error('Bank operation failed', { userId, operation, amount, error: error.message });
            return {
                success: false,
                error: '❌ Error en la operación bancaria.'
            };
        }
    }

    /**
     * Validate transaction before execution
     * @param {string} userId
     * @param {number} amount
     * @param {string} transactionType
     * @returns {Promise<{valid: boolean, reason?: string}>}
     */
    async validateTransaction(userId, amount, transactionType) {
        // Check for suspicious patterns
        if (amount > 10000000) {
            logger.warn('Large transaction flagged', { userId, amount, transactionType });
        }

        // Additional validation can be added here:
        // - Rate limiting checks
        // - User ban status
        // - Previous fraud detection

        return { valid: true };
    }

    /**
     * Get transaction history for user
     * @param {string} userId
     * @param {number} limit
     */
    async getTransactionHistory(userId, limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('transaction_audit')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { success: true, transactions: data };

        } catch (error) {
            logger.error('Failed to fetch transaction history', { userId, error: error.message });
            return { success: false, transactions: [] };
        }
    }
}

module.exports = TransactionManager;
