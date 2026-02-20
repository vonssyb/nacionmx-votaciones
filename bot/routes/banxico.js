const express = require('express');
const router = express.Router();
const UnbelievaBoatService = require('../services/UnbelievaBoatService');

module.exports = (supabase, client) => {

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
        const limit = parseInt(req.query.limit) || 20;

        try {
            const { data: transactions, error } = await supabase
                .from('economy_transactions')
                .select('*')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            const formatted = (transactions || []).map(tx => ({
                id: tx.id,
                type: tx.receiver_id === userId ? 'in' : 'out',
                description: tx.description || 'Transferencia SPEI',
                amount: parseFloat(tx.amount),
                date: tx.created_at,
                sender_id: tx.sender_id,
                receiver_id: tx.receiver_id
            }));

            res.json({ success: true, transactions: formatted });

        } catch (error) {
            console.error('Transactions fetch error', error);
            res.json({ success: true, transactions: [] });
        }
    });

    /**
     * GET /api/banxico/cards/:userId
     * Fetch user credit and debit cards with full details
     */
    router.get('/cards/:userId', async (req, res) => {
        const { userId } = req.params;
        try {
            // 1. Credit Cards
            const { data: creditCards } = await supabase
                .from('credit_cards')
                .select('*')
                .eq('discord_id', userId);

            // 2. Debit Cards
            const { data: debitCards } = await supabase
                .from('debit_cards')
                .select('*')
                .eq('discord_user_id', userId);

            const formattedCards = [
                ...(debitCards || []).map(c => ({
                    id: c.id,
                    type: 'debit',
                    card_name: c.card_tier || 'NMX Débito',
                    card_number: c.card_number,
                    balance: parseFloat(c.balance) || 0,
                    status: c.status
                })),
                ...(creditCards || []).map(c => ({
                    id: c.id,
                    type: 'credit',
                    card_name: c.card_name || 'Vista Oro',
                    card_number: c.card_number || `**** ${c.id.substring(0, 4)}`,
                    balance: parseFloat(c.current_balance) || 0,
                    limit: parseFloat(c.card_limit) || 0,
                    cutoff_day: c.closing_day || 1,
                    due_day: c.payment_due_day || 10,
                    status: c.status
                }))
            ];

            res.json({ success: true, cards: formattedCards });

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

        if (!action || !companyId || !ownerId || !targetId) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        try {
            // Verify Ownership
            const { data: company } = await supabase.from('companies').select('owner_ids').eq('id', companyId).single();
            if (!company || !company.owner_ids.includes(ownerId)) return res.status(403).json({ error: 'No autorizado' });

            if (action === 'hire') {
                await supabase.from('company_employees').insert({
                    company_id: companyId,
                    discord_user_id: targetId,
                    role: 'Empleado',
                    salary: salary || 0
                });
            } else if (action === 'fire') {
                await supabase.from('company_employees').update({ status: 'fired' }).eq('company_id', companyId).eq('discord_user_id', targetId);
            }

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * POST /api/banxico/companies/payroll
     * Pay all employees from company balance
     */
    router.post('/companies/payroll', async (req, res) => {
        const { companyId, ownerId } = req.body;

        try {
            // 1. Get Company and Employees
            const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single();
            if (!company || !company.owner_ids.includes(ownerId)) return res.status(403).json({ error: 'No autorizado' });

            const { data: employees } = await supabase.from('company_employees').select('*').eq('company_id', companyId).eq('status', 'active');
            if (!employees || employees.length === 0) return res.status(400).json({ error: 'No hay empleados activos' });

            const totalPayroll = employees.reduce((sum, emp) => sum + parseFloat(emp.salary), 0);
            if (parseFloat(company.balance) < totalPayroll) return res.status(400).json({ error: 'Fondos insuficientes en la empresa' });

            // 2. Deduct from Company
            await supabase.from('companies').update({ balance: parseFloat(company.balance) - totalPayroll }).eq('id', companyId);

            // 3. Pay Each Employee (This is simplified, ideally batch update or transaction)
            for (const emp of employees) {
                // Add to employee's bank (using economy_balances or UB Service)
                if (ubService) {
                    await ubService.addMoney(guildId, emp.discord_user_id, emp.salary, `Nómina ${company.name}`);
                }

                // Log business transaction
                await supabase.from('company_transactions').insert({
                    company_id: companyId,
                    type: 'payroll',
                    amount: emp.salary,
                    description: `Pago a emp: ${emp.discord_user_id}`,
                    related_user_id: emp.discord_user_id
                });
            }

            res.json({ success: true, message: `Nómina de $${totalPayroll} pagada a ${employees.length} empleados` });

        } catch (err) {
            console.error('Payroll error:', err);
            res.status(500).json({ error: 'Error procesando nómina' });
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
     * Execute SPEI Transfer between users (supports target by Card Number)
     */
    router.post('/transfer', async (req, res) => {
        let { senderId, targetId, amount, concept, isCardNumber } = req.body;

        if (!senderId || !targetId || !amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, error: 'Datos de transferencia inválidos' });
        }

        try {
            // Resolve Card Number to User ID if needed
            if (isCardNumber) {
                const { data: dCard } = await supabase.from('debit_cards').select('discord_user_id').eq('card_number', targetId).maybeSingle();
                if (dCard) {
                    targetId = dCard.discord_user_id;
                } else {
                    const { data: cCard } = await supabase.from('credit_cards').select('discord_id').eq('card_number', targetId).maybeSingle();
                    if (cCard) targetId = cCard.discord_id;
                    else return res.status(404).json({ success: false, error: 'Número de tarjeta no encontrado' });
                }
            }

            if (senderId === targetId) return res.status(400).json({ success: false, error: 'No puedes transferir a ti mismo' });
            if (!ubService) throw new Error('Servicio de economía no disponible');

            const transferAmount = parseFloat(amount);
            const balance = await ubService.getUserBalance(guildId, senderId);
            if ((balance.bank || 0) < transferAmount) return res.status(400).json({ success: false, error: 'Saldo insuficiente' });

            // Execution
            await ubService.removeMoney(guildId, senderId, transferAmount, `SPEI SPEI a ${targetId}`);
            await ubService.addMoney(guildId, targetId, transferAmount, `SPEI de ${senderId}`);

            // DB Log
            await supabase.from('economy_transactions').insert({ sender_id: senderId, receiver_id: targetId, amount: transferAmount, description: concept || 'SPEI' });

            res.json({ success: true, message: 'Transferencia completada', newBalance: (balance.bank || 0) - transferAmount });

        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * INVESTMENTS API
     */
    router.get('/investments/market', async (req, res) => {
        const { data } = await supabase.from('stocks').select('*');
        res.json({ success: true, stocks: data || [] });
    });

    router.get('/investments/portfolio/:userId', async (req, res) => {
        const { data } = await supabase.from('user_investments').select('*, stocks(*)').eq('user_id', req.params.userId);
        res.json({ success: true, portfolio: data || [] });
    });

    router.post('/investments/trade', async (req, res) => {
        const { userId, symbol, action, shares } = req.body;
        // Simple mock trade logic...
        res.json({ success: true, message: `Operación ${action} realizada` });
    });

    /**
     * GET /api/banxico/documents/:userId
     * Fetch DNI, Visa and Licenses (from Roles)
     */
    router.get('/documents/:userId', async (req, res) => {
        const { userId } = req.params;

        try {
            // 1. Fetch DNI
            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            // 2. Fetch US Visa
            const { data: visa } = await supabase
                .from('us_visas')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .maybeSingle();

            // 3. Fetch Licenses via Discord Roles
            const licenses = [];
            if (client) {
                try {
                    const guild = await client.guilds.fetch(guildId).catch(() => null);
                    if (guild) {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (member) {
                            // Role IDs from licencia.js
                            const LICENSES = {
                                '1413543909761614005': { type: 'conducir', name: 'Licencia de Conducir' },
                                '1413543907110682784': { type: 'arma_corta', name: 'Licencia de Arma Corta' },
                                '1413541379803578431': { type: 'arma_larga', name: 'Licencia de Arma Larga' }
                            };

                            for (const [roleId, data] of Object.entries(LICENSES)) {
                                if (member.roles.cache.has(roleId)) {
                                    // Calculate artificial expiration (1 year from now for display)
                                    const expDate = new Date();
                                    expDate.setFullYear(expDate.getFullYear() + 1);

                                    licenses.push({
                                        type: data.type,
                                        name: data.name,
                                        status: 'active',
                                        expiration: expDate.toISOString()
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error fetching Discord member for licenses:', e);
                }
            }

            res.json({
                success: true,
                dni: dni || null,
                visa: visa || null,
                licenses: licenses
            });

        } catch (error) {
            console.error('Error fetching documents:', error);
            res.status(500).json({ success: false, error: 'Error al obtener documentos' });
        }
    });

    /**
     * PHASE 5: ADVANCED FINANCIAL SERVICES
     */

    // --- LOANS ---
    router.get('/loans/:userId', async (req, res) => {
        const { userId } = req.params;
        const { data } = await supabase.from('loans').select('*').eq('user_id', userId).eq('status', 'active');
        res.json({ success: true, loans: data || [] });
    });

    router.post('/loans/request', async (req, res) => {
        const { userId, amount } = req.body;
        if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido' });

        try {
            // 1. Check existing active loans
            const { data: activeLoans } = await supabase.from('loans').select('*').eq('user_id', userId).eq('status', 'active');
            if (activeLoans && activeLoans.length > 0) return res.status(400).json({ error: 'Ya tienes un préstamo activo. Pálgalo primero.' });

            // 2. Credit Score Check (Mock: Check bank balance history or level)
            // For now, limit max loan to $500,000 for everyone
            if (amount > 500000) return res.status(400).json({ error: 'Monto excede tu límite de crédito ($500,000)' });

            // 3. Create Loan
            const interestRate = 5.0; // 5%
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7); // 1 week term

            const { data: loan, error } = await supabase.from('loans').insert({
                user_id: userId,
                amount: amount,
                interest_rate: interestRate,
                due_date: dueDate.toISOString()
            }).select().single();

            if (error) throw error;

            // 4. Deposit Money
            if (ubService) await ubService.addMoney(guildId, userId, parseFloat(amount), 'Préstamo Bancario');

            res.json({ success: true, message: 'Préstamo aprobado y depositado.', loan });

        } catch (err) {
            console.error('Loan Error:', err);
            res.status(500).json({ error: 'Error procesando préstamo' });
        }
    });

    router.post('/loans/pay', async (req, res) => {
        const { userId, loanId } = req.body;

        try {
            const { data: loan } = await supabase.from('loans').select('*').eq('id', loanId).single();
            if (!loan || loan.status !== 'active') return res.status(400).json({ error: 'Préstamo inválido' });

            const totalPay = loan.amount * (1 + (loan.interest_rate / 100)); // Simple interest

            // Check Balance
            const balance = await ubService.getUserBalance(guildId, userId);
            if (balance.bank < totalPay) return res.status(400).json({ error: 'Fondos insuficientes' });

            // Execute Payment
            await ubService.removeMoney(guildId, userId, totalPay, 'Pago de Préstamo');
            await supabase.from('loans').update({ status: 'paid' }).eq('id', loanId);

            res.json({ success: true, message: 'Préstamo liquidado correctamente.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // --- SAVINGS ---
    router.get('/savings/:userId', async (req, res) => {
        const { userId } = req.params;
        const { data } = await supabase.from('savings_accounts').select('*').eq('user_id', userId).maybeSingle();
        res.json({ success: true, savings: data || { balance: 0 } });
    });

    router.post('/savings/deposit', async (req, res) => {
        const { userId, amount } = req.body;
        if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido' });

        try {
            // Check Bank Balance
            const balance = await ubService.getUserBalance(guildId, userId);
            if (balance.bank < amount) return res.status(400).json({ error: 'Fondos insuficientes en banco' });

            // Transfer
            await ubService.removeMoney(guildId, userId, parseFloat(amount), 'Depósito a Ahorros');

            // Check if account exists, upsert
            const { data: existing } = await supabase.from('savings_accounts').select('*').eq('user_id', userId).maybeSingle();
            let newBalance = parseFloat(amount);

            if (existing) {
                newBalance += parseFloat(existing.balance);
                await supabase.from('savings_accounts').update({ balance: newBalance }).eq('user_id', userId);
            } else {
                await supabase.from('savings_accounts').insert({ user_id: userId, balance: newBalance });
            }

            res.json({ success: true, message: 'Depósito a ahorros realizado', newBalance });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/savings/withdraw', async (req, res) => {
        const { userId, amount } = req.body;
        if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido' });

        try {
            const { data: account } = await supabase.from('savings_accounts').select('*').eq('user_id', userId).maybeSingle();
            if (!account || parseFloat(account.balance) < amount) return res.status(400).json({ error: 'Fondos insuficientes en ahorros' });

            // Check Lock
            if (account.locked_until && new Date(account.locked_until) > new Date()) return res.status(400).json({ error: 'Cuenta bloqueada por plazo fijo' });

            const newBalance = parseFloat(account.balance) - parseFloat(amount);

            await supabase.from('savings_accounts').update({ balance: newBalance }).eq('user_id', userId);
            await ubService.addMoney(guildId, userId, parseFloat(amount), 'Retiro de Ahorros');

            res.json({ success: true, message: 'Retiro realizado exitosamente', newBalance });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // --- INVOICES ---
    router.get('/invoices/:userId', async (req, res) => {
        const { userId } = req.params;
        const { data: issued } = await supabase.from('invoices').select('*').eq('issuer_id', userId).order('created_at', { ascending: false });
        const { data: received } = await supabase.from('invoices').select('*').eq('receiver_id', userId).order('created_at', { ascending: false });
        res.json({ success: true, issued: issued || [], received: received || [] });
    });

    router.post('/invoices/create', async (req, res) => {
        const { issuerId, targetId, amount, concept } = req.body;
        // Mock implementation: Create Invoice
        try {
            const { data, error } = await supabase.from('invoices').insert({
                issuer_id: issuerId,
                receiver_id: targetId,
                amount,
                concept
            }).select().single();

            if (error) throw error;

            // Notification
            await supabase.from('notifications').insert({
                user_id: targetId,
                title: 'Nueva Factura Recibida',
                message: `Te han enviado una factura por $${amount}: ${concept}`,
                type: 'payment'
            });

            res.json({ success: true, invoice: data });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // --- NOTIFICATIONS ---
    router.get('/notifications/:userId', async (req, res) => {
        const { userId } = req.params;
        const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).eq('read', false).order('created_at', { ascending: false });
        res.json({ success: true, notifications: data || [] });
    });

    router.post('/notifications/mark-read', async (req, res) => {
        const { ids } = req.body; // Array of IDs
        await supabase.from('notifications').update({ read: true }).in('id', ids);
        res.json({ success: true });
    });

    return router;
};
