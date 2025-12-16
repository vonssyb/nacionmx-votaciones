import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Shield, Key, RefreshCw, UserCheck } from 'lucide-react';

const AdminPanel = () => {
    const [stats, setStats] = useState({ profiles: 0, logs: 0, proofs: 0 });
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState(null);

    useEffect(() => {
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        setLoading(true);
        try {
            const { count: profileCount, data: loadedProfiles } = await supabase.from('profiles').select('*', { count: 'exact' });
            const { count: logCount } = await supabase.from('time_logs').select('*', { count: 'exact', head: true });

            setStats({ profiles: profileCount || 0, logs: logCount || 0, proofs: 0 });
            setProfiles(loadedProfiles || []);
        } catch (error) {
            console.error("Admin Fetch Error:", error);
            setFeedback({ type: 'error', text: 'Error de Conexión: ' + (error.message || 'Consulta fallida') });
        } finally {
            setLoading(false);
        }
    };

    const handleLinkDiscord = async (userId, username) => {
        const discordId = prompt(`Ingresa el Discord ID para ${username}:`);
        if (!discordId) return;

        const { error } = await supabase
            .from('profiles')
            .update({ discord_id: discordId })
            .eq('id', userId);

        if (error) {
            setFeedback({ type: 'error', text: 'Error al vincular: ' + error.message });
        } else {
            setFeedback({ type: 'success', text: `Discord ID vinculado a ${username}` });
            fetchAdminData(); // Refresh
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Panel de Administración</h1>
                    <p style={styles.subtitle}>Control maestro del sistema.</p>
                </div>
                <button onClick={fetchAdminData} style={styles.iconBtn} title="Recargar"><RefreshCw size={20} /></button>
            </div>

            {loading && <div style={styles.loading}>Cargando datos del sistema...</div>}

            {feedback && (
                <div style={{ ...styles.feedback, background: feedback.type === 'error' ? '#e74c3c20' : '#2ecc7120', borderColor: feedback.type === 'error' ? '#e74c3c' : '#2ecc71' }}>
                    {feedback.text}
                </div>
            )}

            {/* Quick Stats */}
            <div style={styles.grid}>
                <div style={styles.card}>
                    <h3>{stats.profiles}</h3>
                    <span style={styles.label}>Usuarios Totales</span>
                </div>
                <div style={styles.card}>
                    <h3>{stats.logs}</h3>
                    <span style={styles.label}>Registros de Turno</span>
                </div>
            </div>

            {/* User Management */}
            <h2 style={styles.sectionTitle}>Gestión de Usuarios & Discord</h2>
            <div style={styles.tableCard}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left' }}>Usuario</th>
                            <th style={{ textAlign: 'left' }}>Rol</th>
                            <th style={{ textAlign: 'left' }}>Discord ID</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {profiles.map(p => (
                            <tr key={p.id} style={styles.tr}>
                                <td>{p.username || p.full_name || 'Sin Nombre'}</td>
                                <td><span style={styles.badge}>{p.role}</span></td>
                                <td style={{ fontFamily: 'monospace', color: p.discord_id ? '#2ecc71' : '#e74c3c' }}>
                                    {p.discord_id || 'Sin vincular'}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        onClick={() => handleLinkDiscord(p.id, p.username)}
                                        style={styles.actionBtn}
                                        title="Vincular Discord ID manualmente"
                                    >
                                        <Key size={16} /> Vincular
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const styles = {
    container: { paddingBottom: '2rem' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
    title: { fontSize: '1.8rem', fontWeight: 'bold' },
    subtitle: { color: 'var(--text-muted)' },
    iconBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' },
    card: { background: 'var(--bg-card)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center' },
    label: { color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' },
    sectionTitle: { fontSize: '1.2rem', marginBottom: '1rem', marginTop: '2rem', color: 'var(--primary)' },
    tableCard: { background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse' },
    tr: { borderBottom: '1px solid var(--border)' },
    badge: { background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' },
    actionBtn: { background: 'var(--primary)', color: 'black', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 'bold' },
    feedback: { padding: '1rem', marginBottom: '1rem', borderRadius: 'var(--radius)', border: '1px solid', color: 'white' },
    loading: { padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }
};

export default AdminPanel;
