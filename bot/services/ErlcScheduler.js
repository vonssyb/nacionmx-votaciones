const ErlcService = require('./ErlcService');

class ErlcScheduler {
    constructor(supabase, erlcApiKey) {
        this.supabase = supabase;
        this.erlcApiKey = erlcApiKey;
        this.erlcService = new ErlcService(erlcApiKey);
        this.interval = null;
        this.isRunning = false;
    }

    start(intervalMs = 2 * 60 * 1000) { // Default: 2 minutes
        // console.log('🕒 [ErlcScheduler] Started. Checking every 2 minutes...');
        // Run immediately on start
        this.checkPendingActions();

        this.interval = setInterval(() => {
            this.checkPendingActions();
        }, intervalMs);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        // console.log('🛑 [ErlcScheduler] Stopped.');
    }

    async checkPendingActions() {
        if (this.isRunning) return; // Prevent overlapping runs
        this.isRunning = true;

        try {
            // 1. Check if Server is Online first to avoid wasted calls
            const serverInfo = await this.erlcService.getServerInfo();
            if (!serverInfo) {
                // console.log('[ErlcScheduler] Server Offline or API Down. Skipping check.');
                this.isRunning = false;
                return;
            }

            // 2. Fetch Pending Actions
            const { data: actions, error } = await this.supabase
                .from('erlc_pending_actions')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(10); // Batch size

            if (error) throw error;
            if (!actions || actions.length === 0) {
                this.isRunning = false;
                return;
            }

            // console.log(`[ErlcScheduler] Processing ${actions.length} pending actions...`);

            for (const action of actions) {
                await this.processAction(action);
            }

        } catch (err) {
            console.error('[ErlcScheduler] Error checking pending actions:', err.message);
        } finally {
            this.isRunning = false;
        }
    }

    async processAction(action) {
        try {
            // console.log(`[ErlcScheduler] Retrying Action ID: ${action.id} - ${action.command.substring(0, 50)}...`);

            // EXECUTE COMMAND
            const success = await this.erlcService.runCommand(action.command);

            if (success) {
                await this.supabase
                    .from('erlc_pending_actions')
                    .update({
                        status: 'completed',
                        last_attempt: new Date().toISOString(),
                        attempts: action.attempts + 1
                    })
                    .eq('id', action.id);

                // console.log(`✅ [ErlcScheduler] Action ${action.id} Completed successfully.`);
            } else {
                // MARK AS FAILED ATTEMPT (Increment count)
                // If max attempts reached? Maybe retry indefinitely if it's a ban?
                // For now, just increment and leave as pending (or failed if > 100)
                const newStatus = (action.attempts + 1 >= 50) ? 'failed' : 'pending';

                await this.supabase
                    .from('erlc_pending_actions')
                    .update({
                        attempts: action.attempts + 1,
                        last_attempt: new Date().toISOString(),
                        status: newStatus,
                        error_log: 'Command execution returned false (Likely API error or blocked)'
                    })
                    .eq('id', action.id);
            }

        } catch (err) {
            console.error(`[ErlcScheduler] Fatal Error processing action ${action.id}:`, err);
            await this.supabase
                .from('erlc_pending_actions')
                .update({
                    attempts: action.attempts + 1,
                    last_attempt: new Date().toISOString(),
                    error_log: err.message
                })
                .eq('id', action.id);
        }
    }

    // Helper to queue an action (Used by commands)
    static async queueAction(supabase, command, reason, robloxUser = null) {
        try {
            await supabase.from('erlc_pending_actions').insert({
                command: command,
                reason: reason,
                roblox_username: robloxUser?.username,
                roblox_id: robloxUser?.id,
                status: 'pending'
            });
            // console.log(`[ErlcScheduler] Action queued: ${command.substring(0, 30)}...`);
            return true;
        } catch (e) {
            console.error('[ErlcScheduler] Failed to queue action:', e);
            return false;
        }
    }
}

module.exports = ErlcScheduler;
