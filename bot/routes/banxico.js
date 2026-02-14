const express = require('express');
const router = express.Router();

module.exports = (supabase) => {

    /**
     * POST /api/banxico/login
     * Verifies access code and returns user data + session token
     */
    router.post('/login', async (req, res) => {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Falta el código de acceso' });
        }

        try {
            // 1. Verify Code
            const { data: authCode, error } = await supabase
                .from('banxico_auth_codes')
                .select('*')
                .eq('code', code)
                .gt('expires_at', new Date().toISOString())
                .single();

            if (error || !authCode) {
                return res.status(401).json({ error: 'Código inválido o expirado' });
            }

            // 2. Get User Citizen Data (Name, Avatar)
            const { data: citizen } = await supabase
                .from('citizens')
                .select('*')
                .eq('discord_id', authCode.user_id)
                .single();

            // 3. Get Economy Data (Bank Balance)
            // Note: Balances might be in 'economy_balances' or 'bank_accounts'
            // For now, let's fetch from 'economy_balances' (UnbelievaBoat sync or similar)
            // Or 'bank_accounts' if using advanced banking. 
            // Let's assume 'economy_balances' for cash/bank total.

            const { data: economy } = await supabase
                .from('economy_balances')
                .select('*')
                .eq('user_id', authCode.user_id)
                .eq('guild_id', '1398525215134318713') // Main Guild
                .maybeSingle();

            // Delete code after use (One-time use)
            await supabase.from('banxico_auth_codes').delete().eq('code', code);

            // Construct Response
            const userData = {
                id: authCode.user_id,
                name: citizen ? citizen.full_name : 'Ciudadano',
                avatar: citizen ? citizen.dni : null, // Using DNI image as avatar for now, or fetch from Discord if needed
                balance: economy ? economy.bank : 0,
                cash: economy ? economy.cash : 0,
                accountNumber: `MX-${authCode.user_id.substring(0, 8)}` // Mock account number based on ID
            };

            res.json({ success: true, user: userData });

        } catch (err) {
            console.error('Banxico Login Error:', err);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    });

    /**
     * GET /api/banxico/indicators
     * Returns public economic indicators
     */
    router.get('/indicators', async (req, res) => {
        const { data, error } = await supabase
            .from('banxico_indicators')
            .select('*');

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    });

    return router;
};
