-- Tabla de Préstamos Personales
CREATE TABLE IF NOT EXISTS loans (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    discord_user_id VARCHAR(20) NOT NULL,
    loan_amount BIGINT NOT NULL, -- Monto del préstamo
    interest_rate DECIMAL(5,2) DEFAULT 5.00, -- Tasa de interés % anual
    term_months INTEGER NOT NULL, -- Plazo en meses
    monthly_payment BIGINT NOT NULL, -- Pago mensual calculado
    total_to_pay BIGINT NOT NULL, -- Total a pagar (capital + intereses)
    amount_paid BIGINT DEFAULT 0, -- Monto ya pagado
    payments_made INTEGER DEFAULT 0, -- Número de pagos realizados
    status VARCHAR(20) DEFAULT 'active', -- active, paid, defaulted
    purpose TEXT, -- Propósito del préstamo
    approved_by VARCHAR(20), -- ID del banquero que aprobó
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    next_payment_due TIMESTAMPTZ, -- Fecha del siguiente pago
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Tabla de Cuentas de Ahorro
CREATE TABLE IF NOT EXISTS savings_accounts (
    id BIGSERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    discord_user_id VARCHAR(20) NOT NULL,
    account_number VARCHAR(16) UNIQUE NOT NULL, -- Número de cuenta generado
    initial_deposit BIGINT NOT NULL, -- Depósito inicial
    current_balance BIGINT NOT NULL, -- Balance actual
    interest_rate DECIMAL(5,2) DEFAULT 3.00, -- Tasa de interés % anual
    term_months INTEGER NOT NULL, -- Plazo del ahorro (3, 6, 12, 24 meses)
    status VARCHAR(20) DEFAULT 'active', -- active, matured, closed
    opened_by VARCHAR(20), -- ID del banquero que abrió
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    maturity_date TIMESTAMPTZ NOT NULL, -- Fecha de vencimiento
    last_interest_paid TIMESTAMPTZ, -- Última vez que se pagaron intereses
    withdrawal_penalty DECIMAL(5,2) DEFAULT 10.00, -- Penalización % por retiro anticipado
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Tabla de Pagos de Préstamos (historial)
CREATE TABLE IF NOT EXISTS loan_payments (
    id BIGSERIAL PRIMARY KEY,
    loan_id BIGINT REFERENCES loans(id) ON DELETE CASCADE,
    payment_amount BIGINT NOT NULL,
    payment_type VARCHAR(20) DEFAULT 'regular', -- regular, extra, final
    paid_by VARCHAR(20) NOT NULL, -- Discord user ID
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Tabla de Movimientos de Cuenta de Ahorro
CREATE TABLE IF NOT EXISTS savings_transactions (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT REFERENCES savings_accounts(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL, -- deposit, interest, withdrawal, penalty
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL, -- Balance después de la transacción
    executed_by VARCHAR(20), -- Discord user ID (banquero o sistema)
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(discord_user_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_guild ON loans(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_savings_user ON savings_accounts(discord_user_id, status);
CREATE INDEX IF NOT EXISTS idx_savings_guild ON savings_accounts(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_loan_payments ON loan_payments(loan_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_savings_transactions ON savings_transactions(account_id, executed_at);

-- Comentarios
COMMENT ON TABLE loans IS 'Registro de préstamos personales otorgados por el banco';
COMMENT ON TABLE savings_accounts IS 'Cuentas de ahorro con intereses';
COMMENT ON TABLE loan_payments IS 'Historial de pagos realizados a préstamos';
COMMENT ON TABLE savings_transactions IS 'Movimientos de las cuentas de ahorro';
