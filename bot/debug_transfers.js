require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const BillingService = require('./services/BillingService'); // Adjust path if needed

// Mock Client
const client = {
    users: {
        fetch: async (id) => ({
            send: (msg) => console.log(`[MockDM] To ${id}:`, msg)
        }),
        cache: { get: (id) => null }
    },
    channels: {
        fetch: async (id) => ({
            send: (msg) => console.log(`[MockChannel] To ${id}:`, msg)
        })
    }
};

async function run() {
    console.log("--- Starting Debug Transfer Script ---");

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("Missing SUPABASE env vars.");
        return;
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Check pending count
    const { count, error } = await supabase
        .from('pending_transfers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');

    console.log(`Pending Transfers Count: ${count} (Error: ${error?.message})`);

    // Check ALL transfers (ignoring status)
    const { data: allTransfers, error: allErr } = await supabase
        .from('pending_transfers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("Latest 5 Transfers (Any Status):", allTransfers);
    if (allErr) console.error("Error fetching all:", allErr);

    // Check one
    const { data: upcoming } = await supabase
        .from('pending_transfers')
        .select('*')
        .eq('status', 'PENDING')
        .limit(5);

    console.log("Sample Pending Transfers:", upcoming);

    // Run Processor
    const billing = new BillingService(client, supabase); // Pass mock client? BillingService constructor: (client, supabase) matches check?
    // Checking BillingService.js: constructor(client) -> ONLY client. 
    // Wait, earlier I edited economy.js: "new BillingService(client, supabase)"
    // Let's check BillingService.js file content again to be sure of constructor signature.
    // If constructor is `constructor(client) { this.discordClient = client; this.ubService = ubService; }` (lines 18-22 in previous view)
    // Then passing supabase as 2nd arg does nothing, but it uses GLOBAL `ubService` which uses `supabase` created inside the file via Env vars.
    // This script needs to load env vars correctly for `BillingService.js` to work internally.

    // Initialize
    console.log("Running processPendingTransfers()...");
    await billing.processPendingTransfers();
    console.log("Done.");
}

run();
