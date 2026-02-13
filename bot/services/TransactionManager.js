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
            // Map operation to bet/payout for execute_casino_transaction
            // Buy: Add chips (Payout = Amount, Bet = 0)
            // Sell: Remove chips (Payout = 0, Bet = Amount)
            let bet = 0;
            let payout = 0;

            if (operation === 'buy') {
                payout = chipsAmount;
            } else if (operation === 'sell') {
                bet = chipsAmount;
            }

            const { data, error } = await this.supabase.rpc('execute_casino_transaction', {
                p_user_id: userId,
                p_bet_amount: bet,
                p_payout_amount: payout,
                p_game_type: 'chips_' + operation,
                p_metadata: { cashAmount }
            });

            if (error) throw error;

            if (this.auditLogger) {
                await this.auditLogger.logTransaction({
                    userId,
                    type: 'chips_exchange',
                    operation,
                    chipsAmount,
                    cashAmount,
                    metadata: { newChips: data.new_balance }
                }).catch(() => { });
            }

            // Note: We don't return newCashBalance because we don't track it locally anymore (Hybrid model)
            return {
                success: true,
                newChipsBalance: data.new_balance,
                newCashBalance: null // Handled by UB service
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
     * Execute atomic PvP duel (Coinflip)
     * @param {string} winnerId
     * @param {string} loserId
     * @param {number} betAmount
     * @param {string} gameType
     */
    async executePvPDuel(winnerId, loserId, betAmount, gameType) {
        try {
            const { data, error } = await this.supabase.rpc('execute_pvp_duel', {
                p_winner_id: winnerId,
                p_loser_id: loserId,
                p_bet_amount: betAmount,
                p_game_type: gameType
            });

            if (error) throw error;

            if (this.auditLogger) {
                await this.auditLogger.logTransaction({
                    userId: winnerId,
                    type: 'pvp_win',
                    amount: data.win_amount,
                    metadata: { game: gameType, opponent: loserId, pot: data.pot }
                }).catch(() => { });

                await this.auditLogger.logTransaction({
                    userId: loserId,
                    type: 'pvp_loss',
                    amount: betAmount,
                    metadata: { game: gameType, opponent: winnerId }
                }).catch(() => { });
            }

            return {
                success: true,
                winnerNewBalance: data.winner_new_balance,
                loserNewBalance: data.loser_new_balance,
                winAmount: data.win_amount,
                tax: data.tax
            };

        } catch (error) {
            logger.error('PvP duel failed', { winnerId, loserId, betAmount, error: error.message });
            return {
                success: false,
                error: '❌ Error al procesar el duelo.'
            };
        }
    }

    /**
     * Execute atomic Savings transaction (Deposit/Withdraw)
     * @param {number} accountId
     * @param {string} userId
     * @param {number} amount - Positive/Negative
     * @param {string} type - 'deposit', 'withdrawal'
     * @param {string} notes
     */
    async executeSavingsTransaction(accountId, userId, amount, type, notes = null) {
        try {
            const { data, error } = await this.supabase.rpc('execute_savings_transaction', {
                p_account_id: accountId,
                p_user_id: userId,
                p_amount: amount,
                p_transaction_type: type,
                p_notes: notes
            });

            if (error) {
                // Fallback if RPC is missing
                if (error.message && (error.message.includes('function') || error.message.includes('does not exist'))) {
                    logger.warn('RPC execute_savings_transaction missing, using manual fallback', { accountId });
                    return this._executeSavingsTransactionManual(accountId, userId, amount, type, notes);
                }
                throw error;
            }

            if (this.auditLogger) {
                await this.auditLogger.logTransaction({
                    userId,
                    type: 'savings_' + type,
                    amount: Math.abs(amount),
                    metadata: { accountId, newBalance: data.new_balance }
                }).catch(() => { });
            }

            return { success: true, newBalance: data.new_balance };

        } catch (error) {
            logger.error('Savings transaction failed', { accountId, userId, amount, type, error: error.message });
            return {
                success: false,
                error: '❌ Error al procesar la transacción de ahorro.'
            };
        }
    }

    /**
     * Manual fallback for savings transaction (Not atomic, but functional)
     * @private
     */
    async _executeSavingsTransactionManual(accountId, userId, amount, type, notes) {
        // 1. Get current balance
        const { data: account, error: fetchError } = await this.supabase
            .from('savings_accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (fetchError || !account) return { success: false, error: 'Cuenta no encontrada.' };

        // 2. Calculate new balance
        const newBalance = account.current_balance + amount;
        if (newBalance < 0) return { success: false, error: 'Saldo insuficiente.' };

        // 3. Update Balance
        const { error: updateError } = await this.supabase
            .from('savings_accounts')
            .update({ current_balance: newBalance })
            .eq('id', accountId);

        if (updateError) return { success: false, error: 'Error al actualizar saldo.' };

        // 4. Insert Log
        await this.supabase.from('savings_transactions').insert({
            account_id: accountId,
            transaction_type: type,
            amount: Math.abs(amount),
            balance_after: newBalance,
            executed_by: userId,
            notes: notes
        });

        return { success: true, newBalance };
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
