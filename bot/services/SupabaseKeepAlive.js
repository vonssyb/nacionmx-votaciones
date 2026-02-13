/**
 * Supabase Keep-Alive Service
 * Prevents automatic pausing by pinging the database every 6 days
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Ping interval: Every 6 days (Supabase pauses after 7 days)
const PING_INTERVAL = 6 * 24 * 60 * 60 * 1000; // 6 days in milliseconds

class SupabaseKeepAlive {
    constructor() {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        this.intervalId = null;
        this.lastPing = null;
    }

    async ping() {
        try {
            console.log(`[SupabaseKeepAlive] Pinging database... (${new Date().toISOString()})`);

            // Simple query to keep database active
            const { data, error } = await this.supabase
                .from('bot_heartbeats')
                .select('id')
                .limit(1);

            if (error) {
                console.error('[SupabaseKeepAlive] ❌ Ping failed:', error.message);
                return false;
            }

            this.lastPing = new Date();
            console.log('[SupabaseKeepAlive] ✅ Ping successful');

            // Update heartbeat
            await this.supabase
                .from('bot_heartbeats')
                .upsert({
                    instance_id: 'keep_alive_service',
                    last_heartbeat: new Date().toISOString(),
                    status: 'active'
                });

            return true;
        } catch (err) {
            console.error('[SupabaseKeepAlive] ❌ Exception during ping:', err.message);
            return false;
        }
    }

    start() {
        if (this.intervalId) {
            console.log('[SupabaseKeepAlive] ⚠️  Already running');
            return;
        }

        console.log('[SupabaseKeepAlive] 🚀 Starting keep-alive service');
        console.log(`[SupabaseKeepAlive] 📅 Will ping every 6 days`);

        // Ping immediately on start
        this.ping();

        // Then ping every 6 days
        this.intervalId = setInterval(() => {
            this.ping();
        }, PING_INTERVAL);

        console.log('[SupabaseKeepAlive] ✅ Keep-alive service started');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[SupabaseKeepAlive] 🛑 Keep-alive service stopped');
        }
    }

    getStatus() {
        return {
            running: !!this.intervalId,
            lastPing: this.lastPing,
            nextPing: this.lastPing
                ? new Date(this.lastPing.getTime() + PING_INTERVAL)
                : null,
            intervalDays: 6
        };
    }
}

// Singleton instance
const keepAliveService = new SupabaseKeepAlive();

module.exports = keepAliveService;
