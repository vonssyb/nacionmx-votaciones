const express = require('express');
const router = express.Router();
const UnbelievaBoatService = require('../services/UnbelievaBoatService');

module.exports = (supabase) => {

    const ubToken = process.env.UNBELIEVABOAT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID || '1398525215134318713';
    const ubService = ubToken ? new UnbelievaBoatService(ubToken) : null;

    /**
     * POST /api/banxico/login
     * Verifies access code and returns user data (DNI Profile + UnbelievaBoat Balance)
     */
    router.post('/login', async (req, res) => {
        const { code } = req.body;
        console.log('[API] Login attempt:', code);

        if (!code) {
            return res.status(400).json({ success: false, error: 'Falta el código de acceso' });
        }

        try {
            // 1. Verify Code in banxico_auth_codes
            const { data: authCode, error } = await supabase
                .from('banxico_auth_codes')
                .select('*')
                .eq('code', code)
                .maybeSingle();

            if (error || !authCode) {
                if (error) console.error('[API] Supabase Query Error:', error);
                return res.status(401).json({ success: false, error: 'Código inválido o ya utilizado' });
            }

            // Expiration Check
            const expirationTime = new Date(authCode.expires_at).getTime();
            if (Date.now() > expirationTime) {
                await supabase.from('banxico_auth_codes').delete().eq('code', code);
                return res.status(401).json({ success: false, error: 'El código ha expirado' });
            }

            const discordId = authCode.user_id;

            // Consume code (One-time use)
            await supabase.from('banxico_auth_codes').delete().eq('code', code);

            // 2. Fetch REAL name from citizen_dni
            let fullName = `Ciudadano ${discordId.substring(0, 5)}`;
            let profileImage = null;

            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('nombre, apellido, foto_url')
                .eq('user_id', discordId)
                .maybeSingle();

            if (dni) {
                fullName = `${dni.nombre} ${dni.apellido}`;
                profileImage = dni.foto_url;
            }

            // 3. Fetch REAL balance from UnbelievaBoat
            let cash = 0, bank = 0;
            if (ubService) {
                try {
                    const balance = await ubService.getUserBalance(guildId, discordId);
                    cash = balance.cash || 0;
                    bank = balance.bank || 0;
                } catch (ubError) {
                    console.error('[API] UnbelievaBoat error:', ubError.message);
                }
            }

            // Construct Response compatible with app.js
            res.json({
                success: true,
                user: {
                    id: discordId,
                    name: fullName,
                    profile_image: profileImage,
                    balance: bank,
                    cash: cash,
                    accountNumber: `BX-${discordId.substring(0, 8)}`,
                    avatar: profileImage || `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`
                }
            });

        } catch (error) {
            console.error('[API] Auth error:', error);
            res.status(500).json({ success: false, error: 'Error interno del servidor' });
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
     * GET /api/banxico/transactions/:userId
     * Fetch real transaction history
     */
    router.get('/transactions/:userId', async (req, res) => {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        try {
            // Try economy_transactions first
            const { data: transactions, error } = await supabase
                .from('economy_transactions')
                .select('*')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (!error && transactions && transactions.length > 0) {
                const formatted = transactions.map(tx => ({
                    id: tx.id,
                    type: tx.receiver_id === userId ? 'in' : 'out',
                    description: tx.description || 'Transferencia',
                    amount: parseFloat(tx.amount),
                    date: tx.created_at
                }));
                return res.json({ success: true, transactions: formatted });
            }

            // Fallback to banxico_logs
            const { data: logs } = await supabase
                .from('banxico_logs')
                .select('*')
                .eq('executor_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            const formattedLogs = (logs || []).map(l => ({
                id: l.id,
                type: 'out',
                description: l.action,
                amount: 0,
                date: l.created_at
            }));

            res.json({ success: true, transactions: formattedLogs });

        } catch (error) {
            console.error('Transactions fetch error', error);
            res.json({ success: true, transactions: [] });
        }
    });

    /**
     * GET /api/banxico/cards/:userId
     * Fetch user credit cards
     */
    router.get('/cards/:userId', async (req, res) => {
        const { userId } = req.params;
        try {
            const { data: cards, error } = await supabase
                .from('credit_cards')
                .select('*')
                .eq('discord_user_id', userId);

            if (error) throw error;

            res.json({
                success: true,
                cards: (cards || []).map(card => ({
                    id: card.id,
                    card_name: card.card_name || 'VISA',
                    current_balance: parseFloat(card.current_balance) || 0,
                    discord_user_id: card.discord_user_id
                }))
            });
        } catch (error) {
            console.error('[API] Cards error:', error);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    /**
     * POST /api/banxico/companies
     * Returns companies owned by the user and their employment status
     */
    router.post('/companies', async (req, res) => {
        // ... (Existing implementation)
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



    /**
     * POST /api/banxico/cards/pay
     * Pay off credit card debt
     */
    router.post('/cards/pay', async (req, res) => {
        const { userId, cardId, amount } = req.body; // Amount is optional (if null, pay full debt)

        if (!userId || !cardId) return res.status(400).json({ error: 'Datos incompletos' });

        try {
            // 1. Get Card Details
            const { data: card, error: cardError } = await supabase
                .from('credit_cards')
                .select('*')
                .eq('id', cardId)
                .single();

            if (cardError || !card) return res.status(404).json({ error: 'Tarjeta no encontrada' });

            const debt = parseFloat(card.current_balance || 0);
            if (debt <= 0) return res.status(400).json({ error: 'La tarjeta no tiene deuda pendiente' });

            // Determine Payment Amount
            let payAmount = amount ? parseFloat(amount) : debt;
            if (payAmount > debt) payAmount = debt; // Cap at max debt
            if (payAmount <= 0) return res.status(400).json({ error: 'Monto inválido' });

            // 2. Check User Bank Balance
            const { data: economy, error: ecoError } = await supabase
                .from('economy_balances')
                .select('*')
                .eq('user_id', userId)
                .eq('guild_id', '1398525215134318713')
                .single();

            if (ecoError || !economy) return res.status(400).json({ error: 'Cuenta bancaria no encontrada' });
            if (economy.bank < payAmount) return res.status(400).json({ error: 'Fondos insuficientes en banco' });

            // 3. Process Transaction
            // Deduct from Bank
            const newBankBalance = parseFloat(economy.bank) - payAmount;
            const { error: bankUpdateError } = await supabase
                .from('economy_balances')
                .update({ bank: newBankBalance })
                .eq('user_id', userId)
                .eq('guild_id', '1398525215134318713');

            if (bankUpdateError) throw bankUpdateError;

            // Reduce Card Debt
            const newCardDebt = debt - payAmount;
            const { error: cardUpdateError } = await supabase
                .from('credit_cards')
                .update({ current_balance: newCardDebt })
                .eq('id', cardId);

            if (cardUpdateError) throw cardUpdateError;

            // Log Transaction
            await supabase.from('banxico_logs').insert({
                action: 'credit_payment',
                executor_id: userId,
                details: { card_id: cardId, amount: payAmount, old_debt: debt, new_debt: newCardDebt }
            });

            res.json({
                success: true,
                message: `Pago de $${payAmount.toLocaleString('es-MX')} realizado correctamente`,
                newBalance: newBankBalance,
                newDebt: newCardDebt
            });

        } catch (err) {
            console.error('Card Payment Error:', err);
            res.status(500).json({ error: 'Error procesando el pago de tarjeta' });
        }
    });

    /**
     * POST /api/banxico/transfer
     * Execute SPEI Transfer between users
     */
    router.post('/transfer', async (req, res) => {
        const { senderId, targetId, amount, concept } = req.body;

        if (!senderId || !targetId || !amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, error: 'Datos de transferencia inválidos' });
        }

        if (senderId === targetId) {
            return res.status(400).json({ success: false, error: 'No puedes transferir a ti mismo' });
        }

        try {
            if (!ubService) throw new Error('Servicio de economía no disponible');

            const transferAmount = parseFloat(amount);

            // 1. Verify Sender Balance
            const balance = await ubService.getUserBalance(guildId, senderId);
            const bankBalance = balance.bank || 0;

            if (bankBalance < transferAmount) {
                return res.status(400).json({ success: false, error: 'Fondos insuficientes en Cuenta Maestra' });
            }

            // 2. Perform Transfer (UnbelievaBoat)
            // Deduct from sender
            await ubService.removeMoney(guildId, senderId, transferAmount, `SPEI a ${targetId}: ${concept || 'Sin concepto'}`);
            // Add to receiver
            await ubService.addMoney(guildId, targetId, transferAmount, `SPEI de ${senderId}: ${concept || 'Sin concepto'}`);

            // 3. Log to Supabase (economy_transactions)
            await supabase.from('economy_transactions').insert({
                sender_id: senderId,
                receiver_id: targetId,
                amount: transferAmount,
                description: concept || 'Transferencia SPEI',
            });

            // 4. Log to Banxico Logs
            await supabase.from('banxico_logs').insert({
                action: 'spei_transfer',
                executor_id: senderId,
                details: { target: targetId, amount: transferAmount, concept }
            });

            res.json({
                success: true,
                message: 'Transferencia SPEI exitosa',
                newBalance: bankBalance - transferAmount
            });

        } catch (error) {
            console.error('[API] Transfer error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
};
