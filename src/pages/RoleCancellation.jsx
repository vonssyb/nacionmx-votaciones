import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const RoleCancellation = () => {
    const [formData, setFormData] = useState({
        targetUser: 'No Especificado', // Default value as input is removed
        reason: '',
        location: '',
        moderatorId: ''
    });
    const [files, setFiles] = useState({ proof1: null, proof2: null, proof3: null });
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [autoDetected, setAutoDetected] = useState(false);

    useEffect(() => {
        getCurrentUser();
    }, []);

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Get profile for discord_id
            const { data: profile } = await supabase.from('profiles').select('discord_id, full_name, username').eq('id', user.id).single();
            if (profile) {
                setCurrentUser(profile);
                if (profile.discord_id) {
                    setFormData(prev => ({ ...prev, moderatorId: profile.discord_id }));
                    setAutoDetected(true);
                }
            }
        }
    };

    const handleUpload = async (file) => {
        if (!file) return null;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `cancellations/${fileName}`;

        let { error: uploadError } = await supabase.storage.from('evidence').upload(filePath, file);

        if (uploadError) {
            console.error('Upload Error:', uploadError);
            return null;
        }

        const { data: publicUrlData } = supabase.storage.from('evidence').getPublicUrl(filePath);
        return publicUrlData.publicUrl;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Upload Files
            const url1 = await handleUpload(files.proof1);
            const url2 = await handleUpload(files.proof2);
            const url3 = await handleUpload(files.proof3);

            if (!url1) {
                alert('La prueba #1 es obligatoria.');
                setLoading(false);
                return;
            }

            // Insert to DB
            const { error } = await supabase.from('rp_cancellations').insert([{
                moderator_discord_id: formData.moderatorId || null,
                moderator_name: currentUser?.username || currentUser?.full_name || 'Staff Web',
                target_user: formData.targetUser, // Using default or maybe we should ask in reason?
                reason: formData.reason,
                location: formData.location,
                proof_url_1: url1,
                proof_url_2: url2,
                proof_url_3: url3
            }]);

            if (error) throw error;

            alert('✅ Cancelación procesada correctamente. Se ha publicado en Discord.');
            // Reset form
            setFormData(prev => ({ ...prev, reason: '', location: '' }));
            setFiles({ proof1: null, proof2: null, proof3: null });

        } catch (err) {
            console.error(err);
            alert('Error al procesar la solicitud.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="cancellation-form-container">
            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', color: '#e74c3c' }}>
                🚫 Formulario de Cancelación de Rol
            </h2>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Tu Discord ID (Moderador)</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.moderatorId || 'No detectado (Se usará tu nombre)'}
                        readOnly
                        style={{ opacity: 0.7, cursor: 'not-allowed', background: '#2c3e50' }}
                    />
                    <small style={{ color: '#95a5a6' }}>Este campo se rellena automáticamente.</small>
                </div>

                {/* Target User Input Removed as requested */}

                <div className="form-group">
                    <label>Motivo de la Cancelación (Incluye Nombre del Sancionado aquí si es necesario)</label>
                    <textarea
                        className="form-input"
                        rows="4"
                        value={formData.reason}
                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                        required
                        placeholder="Explica la razón y menciona al usuario sancionado..."
                    ></textarea>
                </div>
                <div className="form-group">
                    <label>Ubicación / Contexto</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.location}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Evidencias (Máx 3 Fotos)</label>
                    <div className="file-inputs">
                        <div>
                            <span style={{ fontSize: '0.8rem', color: '#e74c3c' }}>Prueba 1 (Obligatoria)</span>
                            <input type="file" accept="image/*" onChange={e => setFiles({ ...files, proof1: e.target.files[0] })} required className="form-input" />
                        </div>
                        <div>
                            <span style={{ fontSize: '0.8rem' }}>Prueba 2 (Opcional)</span>
                            <input type="file" accept="image/*" onChange={e => setFiles({ ...files, proof2: e.target.files[0] })} className="form-input" />
                        </div>
                        <div>
                            <span style={{ fontSize: '0.8rem' }}>Prueba 3 (Opcional)</span>
                            <input type="file" accept="image/*" onChange={e => setFiles({ ...files, proof3: e.target.files[0] })} className="form-input" />
                        </div>
                    </div>
                </div>

                <button type="submit" className="btn-submit" disabled={loading}>
                    {loading ? 'Procesando...' : 'ENVIAR REPORTE AL DISCORD'}
                </button>
            </form>

            <style>{`
                .cancellation-form-container {
                    background: var(--bg-card);
                    padding: 2rem;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    max-width: 800px;
                    margin: 2rem auto;
                }
                .form-group {
                    margin-bottom: 1.5rem;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                    color: var(--text-muted);
                    font-size: 0.9rem;
                }
                .form-input {
                    width: 100%;
                    padding: 0.75rem;
                    background: var(--bg-main);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    color: white;
                    outline: none;
                }
                .form-input:focus {
                    border-color: var(--primary);
                }
                .btn-submit {
                    width: 100%;
                    padding: 1rem;
                    background: #e74c3c;
                    color: white;
                    border: none;
                    border-radius: var(--radius);
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 1rem;
                }
                .btn-submit:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .file-inputs {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }
            `}</style>
        </div>
    );
};

export default RoleCancellation;
