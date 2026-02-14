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

    /**
     * POST /api/banxico/companies
     * Returns companies owned by the user and their employment status
     */
    router.post('/companies', async (req, res) => {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'Falta User ID' });

        try {
            // 1. Get Owned Companies
            const { data: ownedCompanies, error: ownedError } = await supabase
                .from('companies')
                .select('*, company_employees(*)')
                .eq('owner_id', userId);

            if (ownedError) throw ownedError;

            // 2. Get Employment (Where user is an employee but not owner)
            const { data: employment, error: empError } = await supabase
                .from('company_employees')
                .select('*, companies(*)')
                .eq('discord_id', userId);

            if (empError) throw empError;

            res.json({
                success: true,
                owned: ownedCompanies || [],
                employment: employment || []
            });

        } catch (err) {
            console.error('Banxico Companies Error:', err);
            res.status(500).json({ error: 'Error obteniendo empresas' });
        }
    });

    /**
     * POST /api/banxico/companies/employees/manage
     * Handle Hire/Fire/Update actions
     */
    router.post('/companies/employees/manage', async (req, res) => {
        const { action, companyId, ownerId, targetId, salary } = req.body;
        // Actions: 'hire', 'fire', 'update'

        if (!action || !companyId || !ownerId || !targetId) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        try {
            // 1. Verify Ownership
            const { data: company, error: compError } = await supabase
                .from('companies')
                .select('id, owner_id')
                .eq('id', companyId)
                .single();

            if (compError || !company) return res.status(404).json({ error: 'Empresa no encontrada' });
            if (company.owner_id !== ownerId) return res.status(403).json({ error: 'No tienes permiso' });

            // 2. Perform Action
            if (action === 'hire') {
                const { error } = await supabase.from('company_employees').insert({
                    company_id: companyId,
                    discord_id: targetId,
                    salary: salary || 0, // Default salary
                    role: 'Empleado'
                });
                if (error) throw error;
            } else if (action === 'fire') {
                const { error } = await supabase.from('company_employees')
                    .delete()
                    .eq('company_id', companyId)
                    .eq('discord_id', targetId);
                if (error) throw error;
            } else if (action === 'update') {
                const { error } = await supabase.from('company_employees')
                    .update({ salary: salary })
                    .eq('company_id', companyId)
                    .eq('discord_id', targetId);
                if (error) throw error;
            }

            res.json({ success: true, message: 'Operación exitosa' });

        } catch (err) {
            console.error('Employee Management Error:', err);
            res.status(500).json({ error: err.message || 'Error en la operación' });
        }
    });

    res.status(500).json({ error: err.message || 'Error en la operación' });
}
    });

/**
 * GET /api/banxico/taxes/:userId
 * Fetch outstanding tax debts
 */
router.get('/taxes/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const { data, error } = await supabase
            .from('sat_tax_debts')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['pending', 'overdue'])
            .order('due_date', { ascending: true });

        if (error) throw error;
        res.json({ success: true, debts: data });
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo impuestos' });
    }
});

/**
 * POST /api/banxico/taxes/pay
 * Pay a specific tax debt
 */
router.post('/taxes/pay', async (req, res) => {
    const { userId, debtId } = req.body;

    if (!userId || !debtId) return res.status(400).json({ error: 'Datos incompletos' });

    try {
        // 1. Get Debt Details
        const { data: debt, error: debtError } = await supabase
            .from('sat_tax_debts')
            .select('*')
            .eq('id', debtId)
            .single();

        if (debtError || !debt) return res.status(404).json({ error: 'Deuda no encontrada' });
        if (debt.status === 'paid') return res.status(400).json({ error: 'Esta deuda ya está pagada' });

        // 2. Check User Balance
        const { data: economy, error: ecoError } = await supabase
            .from('economy_balances')
            .select('*')
            .eq('user_id', userId)
            .eq('guild_id', '1398525215134318713') // Main Guild
            .single();

        if (ecoError || !economy) return res.status(400).json({ error: 'Cuenta no encontrada' });
        if (economy.bank < debt.amount) return res.status(400).json({ error: 'Fondos insuficientes en banco' });

        // 3. Process Payment (Sequential for now, ideally atomic transaction)

        // Deduct Balance
        const newBalance = parseFloat(economy.bank) - parseFloat(debt.amount);
        const { error: updateError } = await supabase
            .from('economy_balances')
            .update({ bank: newBalance })
            .eq('user_id', userId)
            .eq('guild_id', '1398525215134318713');

        if (updateError) throw updateError;

        // Mark Debt as Paid
        await supabase
            .from('sat_tax_debts')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', debtId);

        // Log Payment
        await supabase.from('sat_payment_logs').insert({
            debt_id: debtId,
            user_id: userId,
            amount: debt.amount,
            payment_method: 'banxico_debit'
        });

        res.json({ success: true, newBalance, message: 'Impuesto pagado correctamente' });

    } catch (err) {
        console.error('Tax Payment Error:', err);
        res.status(500).json({ error: 'Error procesando el pago' });
    }
});

return router;
};
