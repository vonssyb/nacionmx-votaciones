import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Play, Pause, Square, AlertTriangle, Camera, Clock, XCircle, CheckCircle, Upload } from 'lucide-react';

const MIN_MINUTES = 30;

const ShiftPanel = () => {
    const [sessionData, setSessionData] = useState(null); // DB Row
    const [status, setStatus] = useState('idle'); // idle, active, paused, ending
    const [elapsed, setElapsed] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form State for Ending
    const [description, setDescription] = useState('');
    const [photos, setPhotos] = useState(Array(6).fill(null)); // Stores File objects or URLs

    useEffect(() => {
        fetchCurrentSession();
    }, []);

    // Timer Logic
    useEffect(() => {
        let interval;
        if (status === 'active' && sessionData) {
            interval = setInterval(() => {
                // Calculate elapsed time taking breaks into account
                // This is a simplified client-side calculation. 
                // Reliable calc should happen based on clock_in - sum(breaks)
                const now = Date.now();
                const start = new Date(sessionData.clock_in).getTime();

                // Subtract breaks duration
                let breaksDuration = 0;
                if (sessionData.breaks) {
                    sessionData.breaks.forEach(b => {
                        if (b.end) {
                            breaksDuration += new Date(b.end).getTime() - new Date(b.start).getTime();
                        } else {
                            // Currently on break (paused), code shouldn't reach here if status is active
                            // But for safety:
                            // breaksDuration += now - new Date(b.start).getTime(); 
                        }
                    });
                }

                setElapsed(now - start - breaksDuration);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [status, sessionData]);

    const fetchCurrentSession = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch active log
        const { data, error } = await supabase
            .from('time_logs')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['active', 'paused'])
            .single();

        if (data) {
            setSessionData(data);
            setStatus(data.status);

            // Init elapsed time ref
            const now = Date.now();
            const start = new Date(data.clock_in).getTime();
            let breaksDuration = 0;
            if (data.breaks) {
                data.breaks.forEach(b => {
                    const bStart = new Date(b.start).getTime();
                    const bEnd = b.end ? new Date(b.end).getTime() : now;
                    breaksDuration += bEnd - bStart;
                });
            }
            setElapsed(now - start - breaksDuration);

        } else {
            setStatus('idle');
            setSessionData(null);
        }
        setLoading(false);
    };

    const handleStart = async () => {
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('time_logs')
            .insert([{
                user_id: user.id,
                clock_in: new Date().toISOString(),
                status: 'active',
                breaks: []
            }])
            .select()
            .single();

        if (error) {
            setError('Error al iniciar turno.');
            console.error(error);
        } else {
            setSessionData(data);
            setStatus('active');
        }
    };

    const handlePause = async () => {
        if (!sessionData) return;

        // Start a break
        const newBreak = { start: new Date().toISOString(), end: null };
        const updatedBreaks = [...(sessionData.breaks || []), newBreak];

        const { error } = await supabase
            .from('time_logs')
            .update({
                status: 'paused',
                breaks: updatedBreaks
            })
            .eq('id', sessionData.id);

        if (!error) {
            setSessionData({ ...sessionData, status: 'paused', breaks: updatedBreaks });
            setStatus('paused');
        }
    };

    const handleResume = async () => {
        if (!sessionData) return;

        // End the last break
        const breaks = [...(sessionData.breaks || [])];
        if (breaks.length > 0) {
            breaks[breaks.length - 1].end = new Date().toISOString();
        }

        const { error } = await supabase
            .from('time_logs')
            .update({
                status: 'active',
                breaks: breaks
            })
            .eq('id', sessionData.id);

        if (!error) {
            setSessionData({ ...sessionData, status: 'active', breaks: breaks });
            setStatus('active');
        }
    };

    const handleRequestEnd = () => {
        // Validate Min Time
        const minutes = Math.floor(elapsed / 60000);
        if (minutes < MIN_MINUTES) {
            setError(`Debes cumplir mínimo ${MIN_MINUTES} minutos. Llevas ${minutes}.`);
            return;
        }
        setStatus('ending');
    };

    const handleCancelEnd = () => {
        setStatus(sessionData.status); // Return to DB status
        setError(null);
    };

    const handlePhotoUpload = async (index, file) => {
        if (!file) return;

        const newPhotos = [...photos];
        newPhotos[index] = { file, status: 'uploading' };
        setPhotos(newPhotos);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${sessionData.id}_${index}_${Date.now()}.${fileExt}`;
            const filePath = `${sessionData.user_id}/${fileName}`;

            const { data, error } = await supabase.storage
                .from('evidence')
                .upload(filePath, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('evidence')
                .getPublicUrl(filePath);

            newPhotos[index] = { url: publicUrl, status: 'done' };
            setPhotos(newPhotos);

        } catch (err) {
            console.error(err);
            newPhotos[index] = { status: 'error' };
            setPhotos(newPhotos);
            setError('Error al subir imagen.');
        }
    };

    const handleConfirmEnd = async () => {
        if (!description.trim()) {
            setError('La descripción es obligatoria.');
            return;
        }

        // Validate uploads if strict (e.g., must have at least 1 photo)
        // const hasPhotos = photos.some(p => p && p.status === 'done');
        // if (!hasPhotos) { setError("Sube al menos una foto"); return; }

        // Extract URLs
        const uploadedUrls = photos
            .filter(p => p && p.status === 'done')
            .map(p => p.url);

        // Finalize
        const now = new Date();
        const minutes = Math.floor(elapsed / 60000);

        // Only finalize the current active break if paused (edge case), but UI prevents Ending while Paused usually.
        // Assuming Ending from Active.

        const { error } = await supabase
            .from('time_logs')
            .update({
                clock_out: now.toISOString(),
                status: 'completed',
                duration_minutes: minutes,
                description: description,
                photos: uploadedUrls
            })
            .eq('id', sessionData.id);

        if (error) {
            setError('Error al guardar el registro.');
        } else {
            // Reset
            setStatus('idle');
            setSessionData(null);
            setElapsed(0);
            setDescription('');
            setPhotos(Array(6).fill(null));
        }
    };

    // --- RENDER HELPERS ---
    const formatTime = (ms) => {
        const totalSecs = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // --- UI COMPONENTS ---

    if (loading) return <div style={styles.center}><Clock className="animate-spin" /> Cargando...</div>;

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>Gestión de Turno</h1>
                <p style={styles.subtitle}>Panel de Control de Asistencia</p>
            </header>

            {error && (
                <div style={styles.errorBanner}>
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            <div style={styles.mainCard}>
                {status === 'idle' && (
                    <div style={styles.idleState}>
                        <div style={styles.iconCircle}>
                            <Clock size={48} color="var(--primary)" />
                        </div>
                        <h2>No hay turno activo</h2>
                        <button style={styles.btnStart} onClick={handleStart}>
                            <Play size={20} fill="currentColor" /> INICIAR SERVICIO
                        </button>
                    </div>
                )}

                {(status === 'active' || status === 'paused') && (
                    <div style={styles.activeState}>
                        <div style={styles.timerDisplay}>
                            <span style={styles.timerLabel}>TIEMPO TRANSCURRIDO</span>
                            <div style={styles.time}>{formatTime(elapsed)}</div>
                            <div style={{
                                ...styles.statusBadge,
                                background: status === 'active' ? '#27ae60' : '#f39c12'
                            }}>
                                {status === 'active' ? 'EN CURSO' : 'PAUSADO'}
                            </div>
                        </div>

                        <div style={styles.controlsGrid}>
                            {status === 'active' ? (
                                <button style={styles.btnPause} onClick={handlePause}>
                                    <Pause size={20} fill="currentColor" /> PAUSAR
                                </button>
                            ) : (
                                <button style={styles.btnResume} onClick={handleResume}>
                                    <Play size={20} fill="currentColor" /> CONTINUAR
                                </button>
                            )}

                            <button style={styles.btnEnd} onClick={handleRequestEnd}>
                                <Square size={20} fill="currentColor" /> TERMINAR
                            </button>
                        </div>
                    </div>
                )}

                {status === 'ending' && (
                    <div style={styles.endingState}>
                        <h2>Finalizar Turno</h2>
                        <p style={{ color: '#aaa', marginBottom: '1rem' }}>Completa el reporte para cerrar tu sesión.</p>

                        <div style={styles.formGroup}>
                            <label>Descripción de los Hechos</label>
                            <textarea
                                style={styles.textarea}
                                placeholder="Describe brevemente lo realizado durante el turno..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label>Evidencia Fotográfica (6 Fotos)</label>
                            <div style={styles.photoGrid}>
                                {photos.map((p, i) => (
                                    <label key={i} style={{
                                        ...styles.photoSlot,
                                        backgroundImage: p?.url ? `url(${p.url})` : 'none',
                                        backgroundSize: 'cover',
                                        border: p?.status === 'error' ? '1px solid red' : styles.photoSlot.border
                                    }}>
                                        {!p?.url && (
                                            <>
                                                {p?.status === 'uploading' ? (
                                                    <Clock className="animate-spin" size={24} color="var(--primary)" />
                                                ) : (
                                                    <Camera size={24} color="#555" />
                                                )}
                                                <span style={{ fontSize: '10px', color: '#555' }}>
                                                    {p?.status === 'uploading' ? 'Subiendo...' : `Foto ${i + 1}`}
                                                </span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handlePhotoUpload(i, e.target.files[0])}
                                            disabled={p?.status === 'uploading'}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={styles.actionButtons}>
                            <button style={styles.btnCancel} onClick={handleCancelEnd}>
                                Cancelar
                            </button>
                            <button style={styles.btnConfirm} onClick={handleConfirmEnd}>
                                <Upload size={18} /> Enviar y Cerrar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    container: {
        padding: '2rem',
        maxWidth: '800px',
        margin: '0 auto',
        color: 'var(--text-main)',
    },
    header: {
        marginBottom: '2rem',
        textAlign: 'center',
    },
    title: {
        fontSize: '2rem',
        color: 'var(--primary)',
        margin: 0,
    },
    subtitle: {
        color: 'var(--text-muted)',
    },
    mainCard: {
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '2rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
    center: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        color: 'var(--text-muted)',
        gap: '0.5rem',
    },
    idleState: {
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
    },
    iconCircle: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'rgba(212, 175, 55, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--primary)',
    },
    btnStart: {
        background: 'linear-gradient(45deg, #27ae60, #2ecc71)',
        border: 'none',
        padding: '1rem 3rem',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        color: 'white',
        borderRadius: '50px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        boxShadow: '0 4px 15px rgba(39, 174, 96, 0.4)',
        transition: 'transform 0.2s',
    },
    activeState: {
        textAlign: 'center',
    },
    timerDisplay: {
        marginBottom: '3rem',
    },
    time: {
        fontSize: '5rem',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        color: 'var(--text-main)',
        lineHeight: 1,
        textShadow: '0 0 20px rgba(212, 175, 55, 0.2)',
    },
    timerLabel: {
        color: 'var(--text-muted)',
        fontSize: '0.9rem',
        letterSpacing: '2px',
        display: 'block',
        marginBottom: '0.5rem',
    },
    statusBadge: {
        display: 'inline-block',
        padding: '0.25rem 1rem',
        borderRadius: '20px',
        color: 'white',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        marginTop: '1rem',
    },
    controlsGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        maxWidth: '500px',
        margin: '0 auto',
    },
    btnPause: {
        background: '#f39c12',
        border: 'none',
        padding: '1rem',
        borderRadius: 'var(--radius)',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
    },
    btnResume: {
        background: '#27ae60',
        border: 'none',
        padding: '1rem',
        borderRadius: 'var(--radius)',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
    },
    btnEnd: {
        background: '#c0392b',
        border: 'none',
        padding: '1rem',
        borderRadius: 'var(--radius)',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
    },
    endingState: {
        textAlign: 'left',
    },
    formGroup: {
        marginBottom: '1.5rem',
    },
    textarea: {
        width: '100%',
        height: '100px',
        background: 'var(--bg-dark)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1rem',
        color: 'var(--text-main)',
        resize: 'none',
    },
    photoGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
    },
    photoSlot: {
        background: 'var(--bg-dark)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius)',
        height: '80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
    },
    actionButtons: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '1rem',
        marginTop: '2rem',
    },
    btnCancel: {
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
        padding: '0.75rem 1.5rem',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
    },
    btnConfirm: {
        background: 'var(--primary)',
        border: 'none',
        color: '#000',
        padding: '0.75rem 1.5rem',
        borderRadius: 'var(--radius)',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    errorBanner: {
        background: 'rgba(231, 76, 60, 0.2)',
        color: '#e74c3c',
        padding: '1rem',
        borderRadius: 'var(--radius)',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    }
};

export default ShiftPanel;
