/**
 * AuditLogger - Transaction audit logging system
 * Records all monetary transactions for security and debugging
 * 
 * Features:
 * - Logs all casino, bank, and transfer operations
 * - Anomaly detection for suspicious patterns
 * - Admin alerts for large transactions
 * - Transaction history tracking
 */

const logger = require('./Logger');

class AuditLogger {
    constructor(supabase, alertChannel = null) {
        this.supabase = supabase;
        this.alertChannel = alertChannel; // Discord channel for admin alerts
        this.anomalyThresholds = {
            largeTransaction: 5000000,
            rapidTransactions: 10, // Max transactions per minute
            suspiciousWinRate: 0.85 // 85% win rate in casino
        };
    }

    /**
     * Log a transaction to the audit table
     * @param {object} transaction
     */
    async logTransaction(transaction) {
        try {
            const {
                userId,
                type,
                amount = 0,
                gameType = null,
                betAmount = 0,
                payoutAmount = 0,
                balanceBefore = null,
                balanceAfter = null,
                transferType = null,
                targetUser = null,
                operation = null,
                metadata = {}
            } = transaction;

            const auditEntry = {
                user_id: userId,
                transaction_type: type,
                amount: amount || betAmount,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                metadata: {
                    gameType,
                    betAmount,
                    payoutAmount,
                    transferType,
                    targetUser,
                    operation,
                    ...metadata,
                    timestamp: new Date().toISOString()
                }
            };

            const { error } = await this.supabase
                .from('transaction_audit')
                .insert(auditEntry);

            if (error) {
                logger.error('Failed to log transaction', { error: error.message, transaction });
            }

            // Check for anomalies
            await this.checkForAnomalies(userId, transaction);

        } catch (error) {
            logger.error('Audit logging exception', { error: error.message });
        }
    }

    /**
     * Check for suspicious transaction patterns
     * @param {string} userId
     * @param {object} transaction
     */
    async checkForAnomalies(userId, transaction) {
        try {
            // Check for large transactions
            if (transaction.amount > this.anomalyThresholds.largeTransaction ||
                transaction.payoutAmount > this.anomalyThresholds.largeTransaction) {
                await this.sendAlert('🚨 Large Transaction Detected', {
                    userId,
                    amount: transaction.amount || transaction.payoutAmount,
                    type: transaction.type
                });
            }

            // Check for rapid transactions (more than 10 in the last minute)
            const { data: recentTxs } = await this.supabase
                .from('transaction_audit')
                .select('id')
                .eq('user_id', userId)
                .gte('created_at', new Date(Date.now() - 60000).toISOString());

            if (recentTxs && recentTxs.length > this.anomalyThresholds.rapidTransactions) {
                await this.sendAlert('⚡ Rapid Transactions Detected', {
                    userId,
                    count: recentTxs.length,
                    timeframe: '1 minute'
                });
            }

            // Check casino win rate (if casino transaction)
            if (transaction.type === 'casino') {
                const stats = await this.getCasinoStats(userId);
                if (stats.winRate > this.anomalyThresholds.suspiciousWinRate && stats.totalGames > 20) {
                    await this.sendAlert('🎰 Suspicious Win Rate', {
                        userId,
                        winRate: `${(stats.winRate * 100).toFixed(1)}%`,
                        totalGames: stats.totalGames
                    });
                }
            }

        } catch (error) {
            logger.error('Anomaly check failed', { error: error.message });
        }
    }

    /**
     * Get casino statistics for a user
     * @param {string} userId
     */
    async getCasinoStats(userId) {
        try {
            const { data: account } = await this.supabase
                .from('casino_chips')
                .select('total_won, total_lost, games_played')
                .eq('user_id', userId)
                .single();

            if (!account || account.games_played === 0) {
                return { winRate: 0, totalGames: 0 };
            }

            const totalBet = account.total_won + account.total_lost;
            const winRate = totalBet > 0 ? account.total_won / totalBet : 0;

            return {
                winRate,
                totalGames: account.games_played,
                totalWon: account.total_won,
                totalLost: account.total_lost
            };

        } catch (error) {
            logger.error('Failed to get casino stats', { userId, error: error.message });
            return { winRate: 0, totalGames: 0 };
        }
    }

    /**
     * Send alert to admin channel
     * @param {string} title
     * @param {object} details
     */
    async sendAlert(title, details) {
        try {
            if (!this.alertChannel) {
                logger.warn('Alert channel not configured', { title, details });
                return;
            }

            const message = `**${title}**\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\``;
            await this.alertChannel.send(message);

            logger.info('Alert sent to admin channel', { title });

        } catch (error) {
            logger.error('Failed to send alert', { error: error.message });
        }
    }

    /**
     * Get audit log for a user
     * @param {string} userId
     * @param {number} limit
     */
    async getUserAuditLog(userId, limit = 50) {
        try {
            const { data, error } = await this.supabase
                .from('transaction_audit')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];

        } catch (error) {
            logger.error('Failed to get audit log', { userId, error: error.message });
            return [];
        }
    }

    /**
     * Get suspicious users based on patterns
     */
    async getSuspiciousUsers(timeframe = 24) {
        try {
            const since = new Date(Date.now() - timeframe * 60 * 60 * 1000).toISOString();

            // Get users with many large transactions
            const { data, error } = await this.supabase
                .from('transaction_audit')
                .select('user_id, COUNT(*) as tx_count, SUM(amount) as total_amount')
                .gte('created_at', since)
                .gte('amount', this.anomalyThresholds.largeTransaction)
                .group('user_id')
                .order('tx_count', { ascending: false })
                .limit(10);

            if (error) throw error;
            return data || [];

        } catch (error) {
            logger.error('Failed to get suspicious users', { error: error.message });
            return [];
        }
    }
}

module.exports = AuditLogger;
