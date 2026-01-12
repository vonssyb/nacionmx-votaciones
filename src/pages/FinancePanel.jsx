import React, { useState, useEffect } from 'react';
import { CreditCard, Search, User, DollarSign, AlertCircle, CheckCircle, Wallet, Plus, Send, Camera, X, Ban, FileText } from 'lucide-react';
import { supabase } from '../services/supabase';
import './FinancePanel.css';

const CARD_LEVELS = [
    { name: 'NMX Start', cost: 2000, limit: 15000, interest: 15, color: '#A0522D', icon: '🟤' },
    { name: 'NMX Básica', cost: 4000, limit: 40000, interest: 13, color: '#4169E1', icon: '🔵' },
    { name: 'NMX Plus', cost: 6000, limit: 80000, interest: 11, color: '#32CD32', icon: '🟢' },
    { name: 'NMX Plata', cost: 10000, limit: 150000, interest: 9, color: '#C0C0C0', icon: '🟡' },
    { name: 'NMX Oro', cost: 15000, limit: 300000, interest: 7, color: '#FFD700', icon: '🟠' },
    { name: 'NMX Rubí', cost: 25000, limit: 500000, interest: 6, color: '#DC143C', icon: '🔴' },
    { name: 'NMX Black', cost: 40000, limit: 750000, interest: 5, color: '#111111', icon: '⚫' },
    { name: 'NMX Diamante', cost: 60000, limit: 1000000, interest: 4, color: '#00BFFF', icon: '💎' },
];

// Placeholder Webhook URL - Replace with actual URL later
const DISCORD_WEBHOOK_URL = import.meta.env.VITE_DISCORD_WEBHOOK_URL || "";

const FinancePanel = () => {
    const [activeTab, setActiveTab] = useState('register'); // register, list
    const [loading, setLoading] = useState(false);
    const [cards, setCards] = useState([]);
    const [searchDni, setSearchDni] = useState('');

    // Cancel / Loan State
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [targetCard, setTargetCard] = useState(null);
    const [loanAmount, setLoanAmount] = useState('');
    const [loanNotes, setLoanNotes] = useState('');
    const [loanFile, setLoanFile] = useState(null);

    // Form State
    const [dni, setDni] = useState('');
    const [dniFile, setDniFile] = useState(null);
    const [fullName, setFullName] = useState('');
    const [discordId, setDiscordId] = useState('');
    const [selectedLevel, setSelectedLevel] = useState(CARD_LEVELS[0]);
    const [hasLoans, setHasLoans] = useState(false);
    const [notes, setNotes] = useState('');
    const [feedback, setFeedback] = useState(null);

    // Fetch existing cards
    const fetchCards = async () => {
        setLoading(true);
        let query = supabase.from('credit_cards')
            .select(`
                *,
                citizens (dni, full_name)
            `)
            .order('created_at', { ascending: false });

        if (searchDni) {
            // Need to filter by joined table, which is tricky in one go if not perfectly set up. 
            // For now let's fetch all and filter client side or improve query if needed.
            // Or better, search by exact citizen DNI if we can join properly. 
            // Supabase allows simple filtering on related tables:
            // .eq('citizens.dni', searchDni) - this might require inner join hint
        }

        const { data, error } = await query;
        if (error) console.error(error);
        else {
            if (searchDni) {
                const filtered = data.filter(c => c.citizens?.dni.includes(searchDni) || c.citizens?.full_name.toLowerCase().includes(searchDni.toLowerCase()));
                setCards(filtered);
            } else {
                setCards(data);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        if (activeTab === 'list') {
            fetchCards();
        }
    }, [activeTab, searchDni]);

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setFeedback(null);

        try {
            // 1. Check/Create Citizen
            let citizenId;
            const { data: existingCitizen } = await supabase
                .from('citizens')
                .select('id')
                .eq('dni', dni)
                .single();

            if (existingCitizen) {
                citizenId = existingCitizen.id;
            } else {
                // Upload DNI Image if present
                let dniImageUrl = null;
                if (dniFile) {
                    const fileExt = dniFile.name.split('.').pop();
                    const fileName = `${dni}_${Date.now()}.${fileExt}`;
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('dni-images')
                        .upload(fileName, dniFile);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('dni-images')
                        .getPublicUrl(fileName);

                    dniImageUrl = publicUrl;
                }

                const { data: newCitizen, error: citizenError } = await supabase
                    .from('citizens')
                    .insert([{ dni, full_name: fullName, dni_image_url: dniImageUrl, discord_id: discordId }])
                    .select()
                    .single();

                if (citizenError) throw citizenError;
                citizenId = newCitizen.id;
            }

            // 2. Create Card
            const cardData = {
                citizen_id: citizenId,
                card_type: selectedLevel.name,
                credit_limit: selectedLevel.limit,
                interest_rate: selectedLevel.interest,
                has_loans: hasLoans,
                notes: notes,
                status: 'active'
            };

            const { error: cardError } = await supabase
                .from('credit_cards')
                .insert([cardData]);

            if (cardError) throw cardError;

            // 3. Webhook Notification (Option A)
            if (DISCORD_WEBHOOK_URL) {
                const embed = {
                    title: "💳 Nueva Tarjeta Emitida",
                    color: 3447003, // Blue-ish
                    fields: [
                        { name: "Titular", value: fullName, inline: true },
                        { name: "DNI", value: dni, inline: true },
                        { name: "Nivel", value: `${selectedLevel.icon} ${selectedLevel.name}`, inline: true },
                        { name: "Límite", value: `$${selectedLevel.limit.toLocaleString()}`, inline: true },
                        { name: "Costo Emisión", value: `$${selectedLevel.cost.toLocaleString()}`, inline: true }
                    ],
                    footer: { text: "Banco Nacional RP" },
                    timestamp: new Date().toISOString()
                };

                await fetch(DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [embed] })
                }).catch(err => console.error("Webhook failed", err));
            }

            setFeedback({ type: 'success', msg: 'Tarjeta registrada exitosamente.' });
            setDni('');
            setDniFile(null);
            setFullName('');
            setDiscordId('');
            setNotes('');
        } catch (err) {
            console.error(err);
            setFeedback({ type: 'error', msg: 'Error al registrar: ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    const openLoanModal = (card) => {
        setTargetCard(card);
        setShowLoanModal(true);
    };

    const handleLoanSubmit = async (e) => {
        e.preventDefault();
        if (!targetCard || !loanAmount) return;
        setLoading(true);

        try {
            // Upload Proof
            let proofUrl = null;
            if (loanFile) {
                const fileExt = loanFile.name.split('.').pop();
                const fileName = `loan_${targetCard.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('ledger-proofs')
                    .upload(fileName, loanFile);
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('ledger-proofs')
                    .getPublicUrl(fileName);
                proofUrl = publicUrl;
            }

            // Insert Transaction
            const amount = parseFloat(loanAmount);
            const { error: txnError } = await supabase.from('card_transactions').insert([{
                card_id: targetCard.id,
                amount: amount,
                type: 'loan',
                proof_url: proofUrl,
                notes: loanNotes
            }]);
            if (txnError) throw txnError;

            // Update Card Balance
            const { data: currentCard } = await supabase.from('credit_cards').select('current_balance').eq('id', targetCard.id).single();
            const newBalance = (currentCard.current_balance || 0) + amount;

            const { error: updateError } = await supabase.from('credit_cards')
                .update({ current_balance: newBalance })
                .eq('id', targetCard.id);

            if (updateError) throw updateError;

            setFeedback({ type: 'success', msg: 'Préstamo registrado exitosamente.' });
            setShowLoanModal(false);
            setLoanAmount('');
            setLoanNotes('');
            setLoanFile(null);
            fetchCards(); // Refresh UI
        } catch (err) {
            console.error(err);
            setFeedback({ type: 'error', msg: 'Error al registrar préstamo: ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCancelCard = async (cardId) => {
        if (!window.confirm("¿Estás seguro de cancelar esta tarjeta? Esta acción es irreversible.")) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('credit_cards').update({ status: 'cancelled' }).eq('id', cardId);
            if (error) throw error;
            fetchCards();
            setFeedback({ type: 'success', msg: 'Tarjeta cancelada.' });
        } catch (err) {
            alert("Error al cancelar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="finance-panel">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Banco Nacional RP</h1>
                    <p className="page-subtitle">Sistema de Gestión de Crédito</p>
                </div>
                <div className="finance-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
                        onClick={() => setActiveTab('register')}
                    >
                        <Plus size={18} /> Nueva Tarjeta
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                        onClick={() => setActiveTab('list')}
                    >
                        <Wallet size={18} /> Ver Tarjetas
                    </button>
                </div>
            </header>

            {activeTab === 'register' && (
                <div className="register-container fade-in">
                    <form onSubmit={handleRegister} className="finance-form">
                        <h3><User size={20} /> Datos del Ciudadano</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label>DNI (Número) *</label>
                                <input
                                    type="text"
                                    value={dni}
                                    onChange={(e) => setDni(e.target.value)}
                                    required
                                    placeholder="Ej: 123456789"
                                    className="premium-input"
                                />
                            </div>

                            <div className="form-group">
                                <label>Nombre Completo</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                    placeholder="Nombre Apellido"
                                    className="premium-input"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Captura del DNI</label>
                                <div className="file-input-wrapper">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setDniFile(e.target.files[0])}
                                        id="dni-upload"
                                        style={{ display: 'none' }}
                                    />
                                    <label htmlFor="dni-upload" className="file-upload-btn premium-btn">
                                        <Camera size={18} />
                                        <span>{dniFile ? dniFile.name : "Subir Foto"}</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group full-width">
                                <label>ID de Discord (Obligatorio)</label>
                                <input
                                    type="text"
                                    value={discordId}
                                    onChange={(e) => setDiscordId(e.target.value)}
                                    required
                                    placeholder="Ej: 123456789012345678"
                                    title="Activa el Modo Desarrollador en Discord para copiar IDs"
                                    className="premium-input"
                                />
                            </div>
                        </div>

                        <h3><CreditCard size={20} /> Detalles de la Tarjeta</h3>
                        <div className="form-group">
                            <label>Nivel de Tarjeta</label>
                            <div className="card-levels-grid">
                                {CARD_LEVELS.map(level => (
                                    <div
                                        key={level.name}
                                        className={`level-card ${selectedLevel.name === level.name ? 'selected' : ''}`}
                                        onClick={() => setSelectedLevel(level)}
                                        style={{ '--level-color': level.color }}
                                    >
                                        <div className="level-icon">{level.icon}</div>
                                        <div className="level-name">{level.name}</div>
                                        <div className="level-cost">Costo: ${level.cost.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="level-details-summary">
                            <div className="detail-item">
                                <span className="label">Límite de Crédito</span>
                                <span className="value">${selectedLevel.limit.toLocaleString()}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Interés Semanal</span>
                                <span className="value">{selectedLevel.interest}%</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Costo Emisión</span>
                                <span className="value">${selectedLevel.cost.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="form-group checkbox-group">
                            <label className="custom-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={hasLoans}
                                    onChange={(e) => setHasLoans(e.target.checked)}
                                    className="hidden-checkbox"
                                />
                                <span className={`custom-checkbox ${hasLoans ? 'checked' : ''}`}>
                                    {hasLoans && <CheckCircle size={14} />}
                                </span>
                                ¿Ha solicitado préstamos anteriormente?
                            </label>
                        </div>

                        <div className="form-group">
                            <label>Notas Adicionales</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notas sobre buró, historial, etc."
                            />
                        </div>

                        {feedback && (
                            <div className={`feedback-msg ${feedback.type}`}>
                                {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                                {feedback.msg}
                            </div>
                        )}

                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading ? 'Procesando...' : 'Emitir Tarjeta'}
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="list-container fade-in">
                    <div className="search-bar">
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por DNI o Nombre..."
                            value={searchDni}
                            onChange={(e) => setSearchDni(e.target.value)}
                        />
                    </div>

                    <div className="cards-grid">
                        {cards.map(card => {
                            const levelData = CARD_LEVELS.find(l => l.name === card.card_type) || CARD_LEVELS[0];
                            return (
                                <div key={card.id} className="credit-card-item" style={{ borderLeft: `4px solid ${levelData.color}` }}>
                                    <div className="card-header-row">
                                        <span className="card-type-badge" style={{ backgroundColor: levelData.color + '20', color: levelData.color }}>
                                            {levelData.icon} {card.card_type}
                                        </span>
                                        <span className={`status-badge ${card.status}`}>{card.status}</span>
                                    </div>
                                    <div className="card-citizen">
                                        <h4>{card.citizens?.full_name}</h4>
                                        <span className="dni">DNI: {card.citizens?.dni}</span>
                                    </div>
                                    <div className="card-financials">
                                        <div className="financial-row">
                                            <span>Límite:</span>
                                            <strong>${card.credit_limit.toLocaleString()}</strong>
                                        </div>
                                        <div className="financial-row">
                                            <span>Deuda:</span>
                                            <strong className="debtor">${card.current_balance?.toLocaleString() || 0}</strong>
                                        </div>
                                    </div>
                                    <div className="card-footer">
                                        <small>Interés: {card.interest_rate}%</small>
                                        <button
                                            className="copy-btn"
                                            onClick={() => {
                                                const text = `Titular: ${card.citizens.full_name}\nTarjeta: ${card.card_type}\nBanco: Banco Nacional RP\nLímite: $${card.credit_limit}\nDeuda: $${card.current_balance || 0}\nPago mínimo: 25%\nCorte: Cada 7 días\nEstado: ${card.status}`;
                                                navigator.clipboard.writeText(text);
                                                alert("Copiado al portapapeles");
                                            }}
                                        >
                                            Copiar Discord
                                        </button>
                                        <div className="card-actions">
                                            <button
                                                className="action-btn loan-btn"
                                                onClick={() => openLoanModal(card)}
                                                disabled={card.status !== 'active'}
                                                title="Agregar Deuda/Préstamo"
                                            >
                                                <DollarSign size={16} />
                                            </button>
                                            <button
                                                className="action-btn cancel-btn"
                                                onClick={() => handleCancelCard(card.id)}
                                                disabled={card.status === 'cancelled'}
                                                title="Cancelar Tarjeta"
                                            >
                                                <Ban size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}


            {/* Loan Modal */}
            {
                showLoanModal && (
                    <div className="modal-overlay">
                        <div className="modal-content fade-in">
                            <div className="modal-header">
                                <h3>Agregar Deuda / Préstamo</h3>
                                <button className="close-btn" onClick={() => setShowLoanModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleLoanSubmit}>
                                <div className="form-group">
                                    <label>Monto a Agregar</label>
                                    <input
                                        type="number"
                                        value={loanAmount}
                                        onChange={e => setLoanAmount(e.target.value)}
                                        required
                                        placeholder="Ej: 5000"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Comprobante (Obligatorio)</label>
                                    <div className="file-input-wrapper">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setLoanFile(e.target.files[0])}
                                            id="loan-upload"
                                            required
                                            style={{ display: 'none' }}
                                        />
                                        <label htmlFor="loan-upload" className="file-upload-btn">
                                            <Camera size={18} />
                                            {loanFile ? loanFile.name : "Subir Captura"}
                                        </label>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Motivo / Notas</label>
                                    <textarea
                                        value={loanNotes}
                                        onChange={e => setLoanNotes(e.target.value)}
                                        placeholder="Razón del cargo..."
                                    />
                                </div>
                                <button type="submit" className="submit-btn" disabled={loading}>
                                    {loading ? 'Procesando...' : 'Confirmar Deuda'}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default FinancePanel;
