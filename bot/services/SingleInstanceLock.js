const { createClient } = require('@supabase/supabase-js');

class SingleInstanceLock {
    constructor(supabase, instanceId) {
        this.supabase = supabase;
        this.instanceId = instanceId;
        this.lockKey = 'main_bot_lock';
        this.heartbeatInterval = null;
        this.checkIntervalTime = 30000; // 30 seconds
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 5;
        this.circuitBreakerOpen = false;
        this.lastSuccessfulHeartbeat = Date.now();
    }

    /**
     * Wraps a Supabase operation with timeout and retry logic
     * @param {Function} operation - Async function to execute
     * @param {number} timeoutMs - Timeout in milliseconds
     * @param {number} maxRetries - Maximum number of retries
     * @returns {Promise} - Result of the operation
     */
    async withTimeout(operation, timeoutMs = 10000, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
                );

                const result = await Promise.race([operation(), timeoutPromise]);

                // Success - reset circuit breaker
                this.consecutiveFailures = 0;
                this.circuitBreakerOpen = false;
                this.lastSuccessfulHeartbeat = Date.now();

                return { data: result, error: null };
            } catch (error) {
                const isLastAttempt = attempt === maxRetries;
                const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);

                console.warn(`⚠️ [Lock] Operation failed (attempt ${attempt}/${maxRetries}): ${error.message}`);

                if (!isLastAttempt) {
                    console.log(`🔄 [Lock] Retrying in ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                } else {
                    this.consecutiveFailures++;

                    // Open circuit breaker if too many failures
                    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                        this.circuitBreakerOpen = true;
                        console.error(`🚨 [Lock] Circuit breaker opened after ${this.consecutiveFailures} consecutive failures`);
                    }

                    return { data: null, error };
                }
            }
        }
    }

    async acquireLock() {
        console.log(`🔒 [Lock] Attempting to acquire lock for instance ${this.instanceId}...`);

        // 1. Check current lock with timeout and retry
        const checkResult = await this.withTimeout(async () => {
            const { data, error } = await this.supabase
                .from('bot_heartbeats')
                .select('*')
                .eq('id', this.lockKey)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data;
        });

        if (checkResult.error && checkResult.error.code !== 'PGRST116') {
            console.error('❌ [Lock] Error checking lock after retries:', checkResult.error.message);
            console.warn('⚠️ [Lock] Continuing with fail-open strategy (risk of duplicate instances)');
            this.startHeartbeat(); // Start heartbeat anyway, it will retry
            return true;
        }

        const currentLock = checkResult.data;
        const now = new Date();

        if (currentLock) {
            const lastHeartbeat = new Date(currentLock.last_heartbeat);
            const diffMs = now - lastHeartbeat;

            // If lock exists and is fresh (less than 60s old), and it's NOT us
            if (diffMs < 60000 && currentLock.instance_id !== this.instanceId) {
                console.log(`🔒 [Lock] Active instance detected: ${currentLock.instance_id} (Heartbeat: ${diffMs / 1000}s ago)`);
                return false; // Lock held, retry later
            }
        }

        // 2. Upsert our lock with timeout and retry
        const upsertResult = await this.withTimeout(async () => {
            return await this.supabase
                .from('bot_heartbeats')
                .upsert({
                    id: this.lockKey,
                    instance_id: this.instanceId,
                    last_heartbeat: new Date().toISOString(),
                    started_at: currentLock ? currentLock.started_at : new Date().toISOString()
                });
        });

        if (upsertResult.error) {
            console.error('❌ [Lock] Failed to acquire lock after retries:', upsertResult.error.message);
            console.warn('⚠️ [Lock] Continuing anyway (fail-open strategy)');
            this.startHeartbeat(); // Start heartbeat, it will keep trying
            return true;
        }

        console.log(`✅ [Lock] Lock acquired for ${this.instanceId}`);
        this.startHeartbeat();
        return true;
    }

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

        this.heartbeatInterval = setInterval(async () => {
            // Skip heartbeat if circuit breaker is open
            if (this.circuitBreakerOpen) {
                const timeSinceLastSuccess = Date.now() - this.lastSuccessfulHeartbeat;
                console.warn(`⚠️ [Lock] Circuit breaker open. Skipping heartbeat. Time since last success: ${Math.floor(timeSinceLastSuccess / 1000)}s`);

                // Try to reset circuit breaker after 5 minutes
                if (timeSinceLastSuccess > 300000) {
                    console.log('🔄 [Lock] Attempting to reset circuit breaker...');
                    this.circuitBreakerOpen = false;
                    this.consecutiveFailures = 0;
                }
                return;
            }

            const heartbeatResult = await this.withTimeout(async () => {
                return await this.supabase
                    .from('bot_heartbeats')
                    .update({ last_heartbeat: new Date().toISOString() })
                    .eq('id', this.lockKey)
                    .eq('instance_id', this.instanceId);
            }, 10000, 2); // 10s timeout, 2 retries

            if (heartbeatResult.error) {
                console.error(`⚠️ [Lock] Heartbeat failed (${this.consecutiveFailures}/${this.maxConsecutiveFailures} failures):`, heartbeatResult.error.message);

                if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                    console.error('🚨 [Lock] Too many consecutive heartbeat failures. Bot will continue running but may lose lock.');
                }
            } else {
                // Success
                if (this.consecutiveFailures > 0) {
                    console.log('✅ [Lock] Heartbeat recovered after failures');
                }
            }
        }, this.checkIntervalTime);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    async releaseLock() {
        this.stopHeartbeat();
        console.log(`🔓 [Lock] Releasing lock for instance ${this.instanceId}...`);

        // Remove or nullify the lock in DB so next instance picks it up immediately
        const releaseResult = await this.withTimeout(async () => {
            return await this.supabase
                .from('bot_heartbeats')
                .update({
                    instance_id: null,
                    last_heartbeat: new Date(0).toISOString()
                })
                .eq('id', this.lockKey)
                .eq('instance_id', this.instanceId);
        }, 5000, 2); // 5s timeout, 2 retries

        if (releaseResult.error) {
            console.error('❌ [Lock] Failed to release lock after retries:', releaseResult.error.message);
            console.warn('⚠️ [Lock] Lock may still be held in database. Next instance will take over after timeout.');
        } else {
            console.log('✅ [Lock] Lock released successfully.');
        }
    }
}

module.exports = SingleInstanceLock;
