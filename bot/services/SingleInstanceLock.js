const { createClient } = require('@supabase/supabase-js');

class SingleInstanceLock {
    constructor(supabase, instanceId) {
        this.supabase = supabase;
        this.instanceId = instanceId;
        this.lockKey = 'main_bot_lock';
        this.heartbeatInterval = null;
        this.checkIntervalTime = 30000; // 30 seconds
    }

    async acquireLock() {
        console.log(`🔒 [Lock] Attempting to acquire lock for instance ${this.instanceId}...`);

        // 1. Check current lock
        const { data: currentLock, error } = await this.supabase
            .from('bot_heartbeats')
            .select('*')
            .eq('id', this.lockKey)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
            console.error('❌ [Lock] Error checking lock:', error.message);
            return true; // Fail open (let it run if DB is down, risk duplication but better than downtime)
        }

        const now = new Date();

        if (currentLock) {
            const lastHeartbeat = new Date(currentLock.last_heartbeat);
            const diffMs = now - lastHeartbeat;

            // If lock exists and is fresh (less than 1.5 mins old), and it's NOT us
            if (diffMs < 90000 && currentLock.instance_id !== this.instanceId) {
                console.error(`🛑 [Lock] ACTIVE INSTANCE DETECTED! (${currentLock.instance_id})`);
                console.error(`🛑 [Lock] Last heartbeat: ${diffMs / 1000}s ago.`);
                console.error(`🛑 [Lock] Shutting down to prevent duplication.`);
                return false; // ABORT STARTUP
            }
        }

        // 2. Upsert our lock
        const { error: upsertError } = await this.supabase
            .from('bot_heartbeats')
            .upsert({
                id: this.lockKey,
                instance_id: this.instanceId,
                last_heartbeat: new Date().toISOString(),
                started_at: currentLock ? currentLock.started_at : new Date().toISOString() // Keep original start time if just taking over
            });

        if (upsertError) {
            console.error('❌ [Lock] Failed to acquire lock:', upsertError.message);
            return true; // Attempt to run anyway
        }

        console.log(`✅ [Lock] Lock acquired for ${this.instanceId}`);
        this.startHeartbeat();
        return true;
    }

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

        this.heartbeatInterval = setInterval(async () => {
            const { error } = await this.supabase
                .from('bot_heartbeats')
                .update({ last_heartbeat: new Date().toISOString() })
                .eq('id', this.lockKey)
                .eq('instance_id', this.instanceId); // Only update if WE still own it

            if (error) {
                console.error('⚠️ [Lock] Heartbeat failed:', error.message);
            }
        }, this.checkIntervalTime);
    }
}

module.exports = SingleInstanceLock;
