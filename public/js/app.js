// Banxico Frontend Logic
// Initialize Supabase (Placeholder for now, but logical structure is ready)
const SUPABASE_URL = 'https://igjedwdxqwkpbgrmtrrq.supabase.co';
// NOTE: Ideally this comes from env, but for this demo/static site we might need it exposed or use a backend proxy.
const SUPABASE_KEY_PLACEHOLDER = '';


// Logic defined in global scope to ensure availability
window.handleBanxicoLogin = async (e) => {
    if (e) e.preventDefault();
    console.log('Login Action Triggered via ' + (e ? 'Event' : 'Manual Call'));

    const performLoginBtn = document.getElementById('perform-login-btn');
    const codeInput = document.getElementById('code-input');

    if (!performLoginBtn || !codeInput) {
        console.error('Elements missing');
        Swal.fire('Error', 'No se encontraron los elementos de login', 'error');
        return;
    }

    const code = codeInput.value.trim();

    // Validation
    if (code.length < 6) {
        Swal.fire({
            icon: 'warning',
            title: 'Código Invalido',
            text: 'El código de acceso debe tener 6 caracteres.',
            background: '#1f2937',
            color: '#fff',
            confirmButtonColor: '#b38728'
        });
        return;
    }

    // Loading State
    const originalText = performLoginBtn.innerHTML;
    performLoginBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verificando...';
    performLoginBtn.disabled = true;
    performLoginBtn.classList.add('opacity-75', 'cursor-not-allowed');

    // Perform Login Request
    try {
        const response = await fetch('/api/banxico/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Error de autenticación');
        }

        // SUCCESS
        const user = data.user;
        window.currentUser = user; // Set Global for other functions

        performLoginBtn.innerHTML = '<i class="fas fa-check"></i> Acceso Concedido';
        performLoginBtn.classList.remove('bg-[#b38728]', 'hover:bg-[#967020]');
        performLoginBtn.classList.add('bg-green-600', 'hover:bg-green-700');

        setTimeout(() => {
            // Transition to Dashboard
            const loginModal = document.getElementById('login-modal');
            if (loginModal) {
                loginModal.classList.add('opacity-0');
                setTimeout(() => loginModal.classList.add('hidden'), 300);
            }

            // Show Welcome Toast
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                background: '#1f2937',
                color: '#fff',
                iconColor: '#b38728'
            });
            Toast.fire({
                icon: 'success',
                title: `Bienvenido, ${user.name}`
            });

            // Switch Views
            const landingPage = document.getElementById('landing-page');
            const dashboard = document.getElementById('dashboard');
            const navLoginBtn = document.getElementById('nav-login-btn');
            const navUserProfile = document.getElementById('nav-user-profile');
            const userAvatar = document.getElementById('user-avatar');
            const dashAvatar = document.getElementById('dashboard-avatar');

            if (landingPage) landingPage.classList.add('hidden');
            if (dashboard) dashboard.classList.remove('hidden');
            if (navLoginBtn) navLoginBtn.classList.add('hidden');
            if (navUserProfile) navUserProfile.classList.remove('hidden');

            // Set Avatar
            const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=b38728&color=fff`;
            if (userAvatar) userAvatar.src = avatarUrl;
            if (dashAvatar) dashAvatar.src = avatarUrl;

            // Load Dashboard
            // Since this function is now global, these helper functions must be available or this logic needs to be robust.
            // Check if loadDashboardData is defined, if not wait or fail gracefully?
            // Actually, loadDashboardData is defined inside DOMContentLoaded. 
            // WE MUST MOVE HELPER FUNCTIONS TO GLOBAL SCOPE AS WELL or attach them to window.
            if (typeof window.loadDashboardData === 'function') {
                window.loadDashboardData(user);
                window.loadBusinessData(user.id);
                window.loadCreditCards(user.id);
                window.loadSatDebts();
                window.initializeChart();
            } else {
                console.error('Helper functions not loaded yet!');
                // Fallback: Trigger event? Or just hope they are hoisted/attached? 
                // They were defined as function declarations so they are hoisted within the closure.
                // We need to move them out too.
            }

        }, 800);

    } catch (error) {
        console.error(error);
        performLoginBtn.innerHTML = originalText;
        performLoginBtn.disabled = false;
        performLoginBtn.classList.remove('opacity-75', 'cursor-not-allowed');

        Swal.fire({
            icon: 'error',
            title: 'Error de Acceso',
            text: error.message,
            background: '#1f2937',
            color: '#fff',
            confirmButtonColor: '#d33'
        });
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('App.js Loaded - DOM Ready');

    window.loadCreditCards = async function (userId) {
        const container = document.getElementById('cards-container');
        // ...

        try {
            const response = await fetch(`/api/banxico/cards/${userId}`);
            const data = await response.json();

            if (!data.success) return;

            if (data.cards.length > 0) {
                // Determine card provider based on name (mock logic)
                const getProvider = (name) => name.toLowerCase().includes('amex') ? 'amex' : 'visa';

                const cardsHTML = data.cards.map(card => {
                    const debt = parseFloat(card.current_balance || 0);
                    const provider = getProvider(card.card_name || 'VISA');
                    const bgClass = provider === 'amex' ? 'bg-gradient-to-br from-slate-900 to-black border-slate-700' : 'bg-gradient-to-br from-indigo-900 to-blue-900 border-indigo-500';
                    const logoIcon = provider === 'amex' ? 'fa-cc-amex' : 'fa-cc-visa';

                    return `
                        <div class="glass-card p-6 rounded-xl relative overflow-hidden ${bgClass} border opacity-0 animate-fade-in text-white group" style="animation-fill-mode: forwards;">
                            <div class="flex justify-between items-start mb-8">
                                <i class="fab ${logoIcon} text-4xl opacity-80"></i>
                                <div class="text-right">
                                    <div class="text-[10px] uppercase opacity-60 font-bold tracking-widest">${card.card_name}</div>
                                    <div class="font-mono text-lg tracking-widest text-[#b38728] font-bold">**** ${card.id.substring(0, 4)}</div>
                                </div>
                            </div>
                            
                            <div class="flex justify-between items-end">
                                <div>
                                    <div class="text-[9px] uppercase opacity-50 mb-1">Deuda Actual</div>
                                    <div class="text-xl font-mono font-bold ${debt > 0 ? 'text-red-400' : 'text-green-400'}">
                                        $${debt.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                ${debt > 0 ? `
                                <button onclick="payCard('${card.id}', ${debt})" 
                                    class="bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded transition backdrop-blur-sm border border-white/10">
                                    Pagar
                                </button>
                                ` : '<div class="text-[10px] text-gray-400 px-2"><i class="fas fa-check"></i> Al corriente</div>'}
                            </div>
                        </div>
                    `;
                }).join('');

                container.insertAdjacentHTML('beforeend', cardsHTML);
            }

        } catch (e) {
            console.error('Error loading cards', e);
        }
    }

    window.payCard = async (cardId, currentDebt) => {
        const { value: amount } = await Swal.fire({
            title: 'Pagar Tarjeta',
            text: `Deuda actual: $${currentDebt.toLocaleString('es-MX')}`,
            input: 'text',
            inputLabel: 'Monto a pagar (Dejar vacío para pagar todo)',
            inputValue: currentDebt,
            showCancelButton: true,
            confirmButtonColor: '#b38728',
            confirmButtonText: 'Pagar',
            background: '#1f2937', color: '#fff',
            inputValidator: (value) => {
                if (!value) return null; // Accept empty for full payment
                if (isNaN(value) || parseFloat(value) <= 0) return 'Ingresa un monto válido';
                if (parseFloat(value) > currentDebt) return 'No puedes pagar más de la deuda';
            }
        });

        if (amount !== undefined) { // If confirmed
            try {
                Swal.showLoading();
                const response = await fetch('/api/banxico/cards/pay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: window.currentUser.id,
                        cardId,
                        amount: amount ? parseFloat(amount) : null
                    })
                });

                const res = await response.json();
                if (!res.success) throw new Error(res.error);

                Swal.fire({
                    icon: 'success', title: 'Pago Exitoso',
                    text: res.message,
                    background: '#1f2937', color: '#fff',
                    confirmButtonColor: '#b38728'
                });

                // Refresh Dashboard (Cards + Balance)
                document.getElementById('cards-container').innerHTML = ''; // Clear to reload
                window.loadDashboardData(window.currentUser); // Reload static
                window.loadCreditCards(window.currentUser.id); // Reload dynamic
                // Also update global balance display if returned
                if (res.newBalance) document.getElementById('balance-display').innerHTML = `$${res.newBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

            } catch (e) {
                Swal.fire({
                    icon: 'error', title: 'Error',
                    text: e.message,
                    background: '#1f2937', color: '#fff'
                });
            }
        }
    };

    // Global Helper: Open Employee Modal
    window.openEmployeeModal = (companyId) => {
        const company = window.myCompanies ? window.myCompanies.find(c => c.id === companyId) : null;
        if (!company) return;

        const modal = document.getElementById('employee-modal');
        const title = document.getElementById('emp-modal-company-name');
        const list = document.getElementById('modal-employee-list');
        const hireBtn = document.getElementById('btn-hire');
        const hireId = document.getElementById('hire-id-input');
        const hireSalary = document.getElementById('hire-salary-input');
        const closeBtn = document.getElementById('close-emp-btn');
        const overlay = document.getElementById('close-emp-overlay');

        if (title) title.innerText = company.name;

        // Show Modal
        if (modal) {
            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.remove('opacity-0'), 10);
        }

        // Render List
        const renderList = () => {
            if (!company.company_employees || company.company_employees.length === 0) {
                list.innerHTML = '<div class="text-xs text-gray-500 italic">No hay empleados registrados.</div>';
            } else {
                list.innerHTML = company.company_employees.map(emp => `
                    <div class="flex justify-between items-center bg-gray-900/50 p-2 rounded border border-white/5">
                        <div>
                            <div class="text-xs font-bold text-gray-300">ID: ${emp.discord_id}</div>
                            <div class="text-[10px] text-gray-500">Sueldo: $${emp.salary}</div>
                        </div>
                        <button onclick="fireEmployee('${company.id}', '${emp.discord_id}')" class="text-red-500 hover:text-red-400 text-xs">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `).join('');
            }
        };
        renderList();

        // Close Logic
        const close = () => {
            modal.classList.add('opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 300);
        };
        if (closeBtn) closeBtn.onclick = close;
        if (overlay) overlay.onclick = close;

        // Hire Action
        if (hireBtn) hireBtn.onclick = async () => {
            const targetId = hireId.value.trim();
            const salary = parseInt(hireSalary.value) || 0;

            if (!targetId) return Swal.fire('Error', 'Ingresa un ID', 'warning');

            hireBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                const response = await fetch('/api/banxico/companies/employees/manage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'hire',
                        companyId: company.id,
                        ownerId: window.currentUser.id,
                        targetId: targetId,
                        salary: salary
                    })
                });

                const res = await response.json();
                if (!res.success) throw new Error(res.error);

                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'Empleado Contratado', timer: 2000, showConfirmButton: false
                });

                // Refresh Data
                if (typeof window.loadBusinessData === 'function') window.loadBusinessData(window.currentUser.id);
                close();

            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            } finally {
                hireBtn.innerHTML = '<i class="fas fa-user-plus mr-1"></i> Contratar';
            }
        };

        window.fireEmployee = async (compId, targetId) => {
            try {
                const response = await fetch('/api/banxico/companies/employees/manage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'fire',
                        companyId: compId,
                        ownerId: window.currentUser.id,
                        targetId: targetId
                    })
                });
                const res = await response.json();
                if (!res.success) throw new Error(res.error);

                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'Empleado Despedido', timer: 2000, showConfirmButton: false
                });

                if (typeof window.loadBusinessData === 'function') window.loadBusinessData(window.currentUser.id);
                close();

            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        };
    };

    // Business Data Loading
    window.loadBusinessData = async function (userId) {
        const companiesContainer = document.getElementById('companies-list');
        const employmentContainer = document.getElementById('employment-list');

        try {
            const response = await fetch('/api/banxico/companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            // Render Owned Companies
            if (companiesContainer) {
                if (data.owned.length === 0) {
                    companiesContainer.innerHTML = `
                        <div class="p-4 border border-dashed border-gray-700 rounded-lg text-center">
                            <i class="fas fa-folder-open text-gray-600 text-xl mb-2"></i>
                            <div class="text-xs text-gray-500">No tienes empresas registradas</div>
                        </div>`;
                } else {
                    // Store companies globally for modal access
                    window.myCompanies = data.owned;

                    companiesContainer.innerHTML = data.owned.map(comp => `
                        <div class="bg-gray-800/50 p-3 rounded border border-white/5 flex justify-between items-center group hover:border-[#b38728]/50 transition">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded bg-[#b38728]/10 text-[#b38728] flex items-center justify-center font-bold text-xs uppercase">
                                    ${comp.name.substring(0, 2)}
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-gray-200">${comp.name}</div>
                                    <div class="text-[9px] text-gray-500 uppercase tracking-wider">Dueño</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="font-mono font-bold text-xs text-[#b38728]">
                                    $${(comp.balance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </div>
                                <button onclick="openEmployeeModal('${comp.id}')" class="text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition">
                                    <i class="fas fa-cog"></i>
                                </button>
                            </div>
                        </div>
                    `).join('');
                }
            }

            // Render Employment
            if (employmentContainer) {
                if (data.employment.length === 0) {
                    employmentContainer.innerHTML = `
                         <div class="p-4 border border-dashed border-gray-700 rounded-lg text-center">
                            <i class="fas fa-user-slash text-gray-600 text-xl mb-2"></i>
                            <div class="text-xs text-gray-500">No tienes empleos registrados</div>
                        </div>`;
                } else {
                    employmentContainer.innerHTML = data.employment.map(emp => `
                        <div class="bg-gray-800/50 p-3 rounded border border-white/5 flex justify-between items-center">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                                    <i class="fas fa-briefcase"></i>
                                </div>
                                <div>
                                    <div class="text-xs font-bold text-gray-200">${emp.companies?.name || 'Empresa'}</div>
                                    <div class="text-[9px] text-gray-500 uppercase tracking-wider">Empleado</div>
                                </div>
                            </div>
                            <div class="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase font-bold">Activo</div>
                        </div>
                    `).join('');
                }
            }

        } catch (e) {
            console.error(e);
            if (companiesContainer) companiesContainer.innerHTML = '<div class="text-red-500 text-xs">Error cargando empresas</div>';
        }
    };

// Dashboard Data Loading
window.loadDashboardData = function (user) {
    const balanceEl = document.getElementById('balance-display');
    const cardsContainer = document.getElementById('cards-container');
    const transactionsList = document.getElementById('transactions-list');

    // REAL DATA
    const realBalance = user.balance; // Bank Balance
    const realCash = user.cash; // Cash Money

    const realCards = [
        { type: 'CUENTA MAESTRA', number: user.accountNumber, bank: 'BANXICO', balance: realBalance, chip: true },
        { type: 'EFECTIVO', number: '---- ----', bank: 'BOLSILLO', balance: realCash, chip: false }
    ];

    // Animate Balance
    if (balanceEl) {
        window.animateValue(balanceEl, 0, realBalance, 2000);
    }

    // Render Cards with Glass/Premium Look
    if (cardsContainer) {
        cardsContainer.innerHTML = realCards.map((card, i) => `
                <div class="relative h-48 rounded-xl p-6 text-white shadow-2xl overflow-hidden group cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(179,135,40,0.2)] border border-white/10"
                     style="background: linear-gradient(135deg, ${i === 0 ? '#1f2937, #111827' : '#0f172a, #1e293b'});">
                    
                    <!-- Shine Effect -->
                    <div class="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent transform skew-x-12 transition-all duration-1000 group-hover:left-[100%]"></div>
                    
                    <div class="flex justify-between items-start mb-8 relative z-10">
                         <img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/banxico/sinfondo.png" class="h-8 opacity-90 drop-shadow-md">
                         <span class="font-mono text-[10px] tracking-widest opacity-60">${card.type}</span>
                    </div>
                    
                    <div class="flex items-center gap-3 mb-4 relative z-10">
                        <div class="w-10 h-7 bg-gradient-to-br from-yellow-200 to-yellow-500 rounded flex items-center justify-center overflow-hidden border border-yellow-600 shadow-inner">
                            <div class="w-full h-[1px] bg-black/20 my-[2px]"></div>
                            <div class="w-[1px] h-full bg-black/20 mx-[2px]"></div>
                        </div>
                        <i class="fas fa-wifi rotate-90 text-gray-500/50"></i>
                    </div>
                    
                    <div class="font-mono text-xl tracking-[0.2em] mb-4 text-shadow relative z-10">${card.number}</div>
                    
                    <div class="flex justify-between items-end relative z-10">
                        <div>
                            <div class="text-[8px] uppercase opacity-40">Titular</div>
                            <div class="text-xs font-bold tracking-wider">${user.name.toUpperCase()}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-[8px] uppercase opacity-40">Disponibilidad</div>
                            <div class="text-sm font-mono font-bold text-[#b38728]">$${card.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                </div>
            `).join('');
    }

    // Render Transactions (Mock for now, as we don't have transaction history API yet)
    const mockTransactions = [
        { date: 'Hoy', desc: 'Consulta de Saldo', amount: 0, type: 'in' }
    ];

    if (transactionsList) {
        transactionsList.innerHTML = mockTransactions.map(t => `
                <div class="flex justify-between items-center p-3 hover:bg-white/5 rounded-lg transition border-b border-white/5 last:border-0 group">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full ${t.type === 'in' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'} flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform">
                            <i class="fas ${t.type === 'in' ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs"></i>
                        </div>
                        <div>
                            <div class="font-bold text-xs text-gray-200">${t.desc}</div>
                            <div class="text-[10px] text-gray-500 uppercase tracking-wider">${t.date}</div>
                        </div>
                    </div>
                    <div class="font-mono font-bold text-xs ${t.type === 'in' ? 'text-green-400' : 'text-gray-400'}">
                        ${t.type === 'in' ? '+' : ''}$${Math.abs(t.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            `).join('');
    }
}

// Chart Initialization
window.initializeChart = function () {
    const ctx = document.getElementById('balanceChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
                datasets: [{
                    label: 'Balance Histórico',
                    data: [12000, 19000, 15000, 22000, 28000, 35000],
                    borderColor: '#b38728',
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        gradient.addColorStop(0, 'rgba(179, 135, 40, 0.5)');
                        gradient.addColorStop(1, 'rgba(179, 135, 40, 0)');
                        return gradient;
                    },
                    borderWidth: 2,
                    tension: 0.4,
                    pointBackgroundColor: '#111827',
                    pointBorderColor: '#b38728',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#6b7280', font: { size: 10, family: 'monospace' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#6b7280', font: { size: 10 } }
                    }
                }
            }
        });
    }
}

// Utility: Number Animation
window.animateValue = function (obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        obj.innerHTML = `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = `$${end.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        }
    };
    window.requestAnimationFrame(step);
}

window.loadSatDebts = async function () {
    const container = document.getElementById('sat-debts-list');
    // We need to check if container exists, it's in the SAT modal
    if (!container || !window.currentUser) return;

    try {
        const response = await fetch(`/api/banxico/taxes/${window.currentUser.id}`);
        const data = await response.json();

        if (data.success && data.debts && data.debts.length > 0) {
            container.innerHTML = data.debts.map(debt => `
                <div class="bg-gray-800/50 p-4 rounded border border-white/5 flex justify-between items-center">
                    <div>
                        <div class="text-xs font-bold text-gray-200">Impuesto ID: ${debt.id.substring(0, 8)}</div>
                        <div class="text-[10px] text-gray-500 text-red-400">Vence: ${new Date(debt.due_date).toLocaleDateString()}</div>
                    </div>
                     <div class="text-right">
                        <div class="text-sm font-bold text-white">$${debt.amount}</div>
                        <button class="text-[10px] text-[#b38728] hover:underline" onclick="payTax('${debt.id}', ${debt.amount})">Pagar</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div class="text-center py-4 text-xs text-gray-500">No tienes deudas fiscales pendientes.</div>';
        }
    } catch (e) {
        console.error('Error loading SAT debts', e);
        container.innerHTML = '<div class="text-center py-4 text-xs text-red-500">Error cargando información fiscal.</div>';
    }
};

window.payTax = async (debtId, amount) => {
    try {
        const { isConfirmed } = await Swal.fire({
            title: 'Pagar Impuesto',
            text: `¿Deseas pagar el impuesto por $${amount}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#b38728',
            confirmButtonText: 'Sí, pagar',
            cancelButtonText: 'Cancelar',
            background: '#1f2937', color: '#fff'
        });

        if (isConfirmed) {
            Swal.showLoading();
            const response = await fetch('/api/banxico/taxes/pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: window.currentUser.id, debtId })
            });
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            Swal.fire({
                icon: 'success', title: 'Pago Exitoso',
                text: data.message,
                background: '#1f2937', color: '#fff'
            });

            window.loadSatDebts();
            if (data.newBalance) document.getElementById('balance-display').innerHTML = `$${data.newBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error', text: e.message, background: '#1f2937', color: '#fff' });
    }
};

});
