// Banxico Frontend Logic
// Initialize Supabase (Placeholder for now, but logical structure is ready)
const SUPABASE_URL = 'https://igjedwdxqwkpbgrmtrrq.supabase.co';
// NOTE: Ideally this comes from env, but for this demo/static site we might need it exposed or use a backend proxy.
const SUPABASE_KEY_PLACEHOLDER = '';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Banxico Portal Loaded | Premium Mode');

    // Elements
    const navLoginBtn = document.getElementById('nav-login-btn');
    const loginModal = document.getElementById('login-modal');
    const closeLoginBtn = document.getElementById('close-login-btn');
    const closeLoginOverlay = document.getElementById('close-login-overlay');
    const performLoginBtn = document.getElementById('perform-login-btn');
    const codeInput = document.getElementById('code-input');

    // Modal Logic
    const toggleModal = (show) => {
        if (loginModal) {
            if (show) {
                loginModal.classList.remove('hidden');
                setTimeout(() => loginModal.classList.remove('opacity-0'), 10);
                if (codeInput) codeInput.focus();
            } else {
                loginModal.classList.add('opacity-0');
                setTimeout(() => loginModal.classList.add('hidden'), 300);
            }
        }
    };

    if (navLoginBtn) navLoginBtn.addEventListener('click', () => toggleModal(true));
    if (closeLoginBtn) closeLoginBtn.addEventListener('click', () => toggleModal(false));
    if (closeLoginOverlay) closeLoginOverlay.addEventListener('click', () => toggleModal(false));

    // Login Logic
    if (performLoginBtn && codeInput) {
        performLoginBtn.addEventListener('click', async () => {
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

                performLoginBtn.innerHTML = '<i class="fas fa-check"></i> Acceso Concedido';
                performLoginBtn.classList.remove('bg-[#b38728]', 'hover:bg-[#967020]');
                performLoginBtn.classList.add('bg-green-600', 'hover:bg-green-700');

                setTimeout(() => {
                    // Transition to Dashboard
                    toggleModal(false);

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
                    loadDashboardData(user);
                    initializeChart();

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
        });
    }

    // Dashboard Data Loading
    function loadDashboardData(user) {
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
            animateValue(balanceEl, 0, realBalance, 2000);
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
    function initializeChart() {
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
    function animateValue(obj, start, end, duration) {
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
});
