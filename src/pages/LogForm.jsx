import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, Upload, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';

const LogForm = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [evidenceList, setEvidenceList] = useState(['']);
    const [formData, setFormData] = useState({
        type: 'warn',
        target: '',
        robloxId: '',
        reason: '',
        notes: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEvidenceChange = (index, value) => {
        const newList = [...evidenceList];
        newList[index] = value;
        setEvidenceList(newList);
    };

    const addEvidenceField = () => {
        if (evidenceList.length < 6) {
            setEvidenceList([...evidenceList, '']);
        }
    };

    const removeEvidenceField = (index) => {
        if (evidenceList.length > 1) {
            const newList = [...evidenceList];
            newList.splice(index, 1);
            setEvidenceList(newList);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('activity_logs')
                .insert({
                    moderator_id: user.id,
                    moderator_name: user.email, // Or profile name
                    target_username: formData.target,
                    roblox_id: formData.robloxId,
                    type: formData.type,
                    reason: formData.reason,
                    evidence: evidenceList.filter(url => url.trim() !== ''),
                    notes: formData.notes,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;
            navigate('/dashboard');
        } catch (err) {
            console.error("Error submitting log:", err);
            alert("Error al guardar el registro: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container">
            <div className="page-header">
                <h1 className="page-title">Nuevo Registro Logístico</h1>
                <p className="page-subtitle">Sanciones, Recomendaciones y Reportes de Actividad.</p>
            </div>

            <form onSubmit={handleSubmit} className="log-form card">
                <div className="form-grid">
                    <div className="form-group">
                        <label>Tipo de Acción</label>
                        <select name="type" value={formData.type} onChange={handleChange} className="input">
                            <option value="warn">Advertencia (Warn)</option>
                            <option value="kick">Expulsión (Kick)</option>
                            <option value="ban">Bloqueo (Ban)</option>
                            <option value="recommendation">Recomendación (Staff)</option>
                            <option value="ticket">Atención de Ticket</option>
                            <option value="patrol">Patrullaje / Rol</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Usuario (Roblox)</label>
                        <input
                            type="text"
                            name="target"
                            value={formData.target}
                            onChange={handleChange}
                            placeholder="Nombre de usuario"
                            className="input"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>ID de Roblox (Opcional)</label>
                        <input
                            type="text"
                            name="robloxId"
                            value={formData.robloxId}
                            onChange={handleChange}
                            placeholder="123456789"
                            className="input"
                        />
                    </div>

                    <div className="form-group full-width">
                        <label>Razón / Motivo / Recomendación</label>
                        <input
                            type="text"
                            name="reason"
                            value={formData.reason}
                            onChange={handleChange}
                            placeholder="Ej: Excelente desempeño en patrullaje"
                            className="input"
                            required
                        />
                    </div>

                    <div className="form-group full-width">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ margin: 0 }}>Evidencias (Hasta 6 URLs)</label>
                            {evidenceList.length < 6 && (
                                <button type="button" onClick={addEvidenceField} className="text-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <Plus size={14} /> Añadir Más
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {evidenceList.map((url, index) => (
                                <div key={index} className="input-with-icon" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <Upload size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="url"
                                            value={url}
                                            onChange={(e) => handleEvidenceChange(index, e.target.value)}
                                            placeholder="https://imgur.com/..."
                                            className="input"
                                            style={{ paddingLeft: '2.5rem' }}
                                        />
                                    </div>
                                    {evidenceList.length > 1 && (
                                        <button type="button" onClick={() => removeEvidenceField(index)} className="btn-icon-danger">
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="form-group full-width">
                        <label>Notas Adicionales / Detalles</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows="4"
                            className="input"
                        ></textarea>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary" disabled={loading}>
                        <X size={18} /> Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        <Save size={18} /> {loading ? 'Guardando...' : 'Guardar Registro'}
                    </button>
                </div>
            </form>

            <style>{`
                .log-form { padding: 2rem; max-width: 800px; }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
                .full-width { grid-column: 1 / -1; }
                .form-group label { display: block; margin-bottom: 0.5rem; color: var(--text-muted); font-size: 0.9rem; }
                .input { width: 100%; background: var(--bg-dark); border: 1px solid var(--border); padding: 0.75rem; border-radius: var(--radius); color: var(--text-main); font-size: 1rem; }
                .input:focus { border-color: var(--primary); outline: none; }
                .text-primary { color: var(--primary); }
                .btn-icon-danger { background: rgba(231, 76, 60, 0.1); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.2); border-radius: var(--radius); padding: 0.5rem; cursor: pointer; transition: all 0.2s; }
                .btn-icon-danger:hover { background: #e74c3c; color: white; }
                .form-actions { display: flex; justify-content: flex-end; gap: 1rem; border-top: 1px solid var(--border); padding-top: 1.5rem; }
            `}</style>
        </div>
    );
};

export default LogForm;
