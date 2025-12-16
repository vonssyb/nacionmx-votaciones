import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Shield, Star, Award, Clock, UserPlus, Search } from 'lucide-react';

const StaffHub = () => {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalStaff: 0, activeNow: 0, totalHours: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'cancellations'

    useEffect(() => {
        if (activeTab === 'list') {
            fetchStaffData();
        }
    }, [activeTab]);

    const fetchStaffData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Profiles
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .order('role');

            if (profileError) throw profileError;

            // 2. Fetch Time Logs (Completed)
            const { data: logs, error: logError } = await supabase
                .from('time_logs')
                .select('user_id, duration_minutes, status');

            if (logError) throw logError;

            // 3. Process Data
            const staffMap = profiles.map(user => {
                const userLogs = logs.filter(l => l.user_id === user.id);

                // Calculate Total Hours
                const totalMinutes = userLogs.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
                const totalHours = (totalMinutes / 60).toFixed(1);

                // Check active status
                // Implicitly check if there is an 'active' log? 
                // We don't have 'active' logs in the 'logs' fetch if we filtered? 
                // Actually the fetch above selects ALL logs.
                // However, 'active' logs have duration_minutes = NULL usually until finished.
                // But let's check 'status' column.
                const isActive = userLogs.some(l => l.status === 'active');
                const calculatedStatus = isActive ? 'online' : (user.status || 'offline');

                return {
                    ...user,
                    totalHours,
                    status: calculatedStatus,
                    actions: userLogs.length // Using shifts count as "actions" for now
                };
            });

            setStaff(staffMap);

            // Calculate Overall Stats
            setStats({
                totalStaff: profiles.length,
                activeNow: staffMap.filter(s => s.status === 'online').length,
                totalHours: staffMap.reduce((acc, curr) => acc + parseFloat(curr.totalHours), 0).toFixed(0)
            });

        } catch (error) {
            console.error("Error fetching staff data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getRoleColor = (role) => {
        if (!role) return '#95a5a6';
        const r = role.toLowerCase();
        if (r.includes('owner')) return '#e74c3c';
        if (r.includes('admin')) return '#f1c40f';
        if (r.includes('mod')) return '#2ecc71';
        if (r.includes('dev')) return '#3498db';
        return '#95a5a6';
    };

    const filteredStaff = staff.filter(s =>
        (s.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="staff-hub-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Directorio de Staff</h1>
                    <p className="page-subtitle">Gestión de horas y actividad del equipo.</p>
                </div>
                {/* Placeholder for Add Member */}
                <button className="btn-add">
                    <UserPlus size={18} /> Nuevo Miembro
                </button>
            </div>



            <div className="staff-tabs">
                <button
                    className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                    onClick={() => setActiveTab('list')}
                >
                    👥 Directorio
                </button>
                <button
                    className={`tab-btn ${activeTab === 'cancellations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('cancellations')}
                >
                    🚫 Cancelar Rol
                </button>
            </div>

            {
                activeTab === 'list' ? (
                    <>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'rgba(52, 152, 219, 0.2)', color: '#3498db' }}>
                                    <Shield size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>Total Staff</h3>
                                    <p>{stats.totalStaff}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71' }}>
                                    <Clock size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>Activos Ahora</h3>
                                    <p>{stats.activeNow}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'rgba(241, 196, 15, 0.2)', color: '#f1c40f' }}>
                                    <Award size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>Horas Totales</h3>
                                    <p>{stats.totalHours} hrs</p>
                                </div>
                            </div>
                        </div>

                        <div className="search-bar">
                            <Search size={18} color="var(--text-muted)" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o rol..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando datos...</div>
                        ) : (
                            <div className="staff-sections">
                                <StaffSection title="👑 Dueños / Co-Owners" roles={['owner', 'co_owner']} staff={filteredStaff} />
                                <StaffSection title="🏛️ Junta Directiva" roles={['board']} staff={filteredStaff} />
                                <StaffSection title="🛡️ Administradores" roles={['admin']} staff={filteredStaff} />
                                <StaffSection title="👮 Staff Oficial" roles={['moderator', 'staff']} staff={filteredStaff} />
                                <StaffSection title="🎓 Staff en Entrenamiento" roles={['training', 'developer']} staff={filteredStaff} />
                            </div>
                        )}
                    </>
                ) : (
                    <CancellationForm />
                )
            }



            <style>{`
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }
                .btn-add {
                    background: var(--primary);
                    color: black;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: var(--radius);
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                }
                .search-bar {
                    background: var(--bg-card);
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .search-bar input {
                    background: transparent;
                    border: none;
                    color: var(--text-main);
                    width: 100%;
                    outline: none;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }
                .stat-card {
                    background: var(--bg-card);
                    padding: 1.5rem;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .stat-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .stat-info h3 {
                    font-size: 0.9rem;
                    color: var(--text-muted);
                    margin-bottom: 0.25rem;
                }
                .stat-info p {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--text-main);
                }
                .staff-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                    gap: 1.5rem;
                }
                .staff-card {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    transition: var(--transition);
                }
                .staff-card:hover {
                    transform: translateY(-5px);
                    border-color: var(--primary);
                }
                .staff-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .staff-avatar-container {
                    position: relative;
                }
                .staff-avatar {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 2px solid var(--border);
                }
                .staff-avatar-placeholder {
                    width: 56px;
                    height: 56px;
                    background: var(--bg-card-hover);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    border: 2px solid var(--border);
                }
                .status-indicator {
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    border: 2px solid var(--bg-card);
                }
                .staff-identity h3 {
                    font-size: 1.1rem;
                    margin-bottom: 0.25rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 150px;
                }
                .role-badge {
                    font-size: 0.75rem;
                    border: 1px solid;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .staff-stats {
                    display: flex;
                    justify-content: space-between;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border);
                }
                .mini-stat {
                    display: flex;
                    flex-direction: column;
                }
                .mini-stat .label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
                .mini-stat .value {
                    font-size: 0.95rem;
                    font-weight: 600;
                }
                /* TABS */
                .staff-tabs {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    border-bottom: 1px solid var(--border);
                    padding-bottom: 1rem;
                }
                .tab-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    font-size: 1rem;
                    font-weight: 600;
                    padding: 0.5rem 1rem;
                    cursor: pointer;
                    border-radius: var(--radius);
                    transition: all 0.2s;
                }
                .tab-btn.active {
                    background: var(--bg-card-hover);
                    color: var(--primary);
                }
                .tab-btn:hover {
                    color: var(--primary);
                }
                /* FORM */
                .cancellation-form-container {
                    background: var(--bg-card);
                    padding: 2rem;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    max-width: 800px;
                    margin: 0 auto;
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
        </div >
    );
};

const CancellationForm = () => {
    const [formData, setFormData] = useState({
        targetUser: '',
        reason: '',
        location: '',
        moderatorId: '' // Added manual moderator ID
    });
    const [files, setFiles] = useState({ proof1: null, proof2: null, proof3: null });
    const [loading, setLoading] = useState(false);

    // We can keep currentUser state to know if we auto-detected or not, 
    // but primarily we'll rely on formData.moderatorId
    const [autoDetected, setAutoDetected] = useState(false);

    useEffect(() => {
        getCurrentUser();
    }, []);

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Get profile for discord_id
            const { data: profile } = await supabase.from('profiles').select('discord_id').eq('id', user.id).single();
            if (profile && profile.discord_id) {
                setFormData(prev => ({ ...prev, moderatorId: profile.discord_id }));
                setAutoDetected(true);
            }
        }
    };

    const handleUpload = async (file) => {
        if (!file) return null;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `cancellations/${fileName}`;

        // Assuming 'evidence' bucket exists (reusing existing one) or 'cancellation-proofs'
        // Let's try 'evidence' as it's cleaner to reuse if permissions allow.
        // User asked for "role cancellation", let's assume 'evidence' is fine.
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
            // Validate Moderator ID (Optional now)
            const modId = formData.moderatorId && formData.moderatorId.length > 5 ? formData.moderatorId : null;

            // if (!modId) {
            //     alert('Debes ingresar tu ID de Discord (Moderador) si no está vinculado automáticamente.');
            //     setLoading(false);
            //     return;
            // }

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
                moderator_discord_id: modId,
                moderator_name: currentUser?.username || currentUser?.full_name || 'Staff Web',
                target_user: formData.targetUser,
                reason: formData.reason,
                location: formData.location,
                proof_url_1: url1,
                proof_url_2: url2,
                proof_url_3: url3
            }]);

            if (error) throw error;

            alert('✅ Cancelación procesada correctamente. Se ha publicado en Discord.');
            // Reset form but keep moderatorId if it was auto-detected or manual? 
            // Better to keep it for convenience if they do multiple reports.
            setFormData(prev => ({ ...prev, targetUser: '', reason: '', location: '' }));
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
            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                🚫 Formulario de Cancelación de Rol
            </h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Usuario Sancionado (ID o Nombre)</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.targetUser}
                        onChange={e => setFormData({ ...formData, targetUser: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Motivo de la Cancelación</label>
                    <textarea
                        className="form-input"
                        rows="3"
                        value={formData.reason}
                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                        required
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
        </div>
    );
};

const StaffSection = ({ title, roles, staff }) => {
    const list = staff.filter(s => roles.includes((s.role || '').toLowerCase()));
    if (list.length === 0) return null;

    const getRoleColor = (role) => {
        if (!role) return '#95a5a6';
        const r = role.toLowerCase();
        if (r.includes('owner')) return '#e74c3c';
        if (r.includes('board')) return '#8e44ad';
        if (r.includes('admin')) return '#f1c40f';
        if (r.includes('mod')) return '#2ecc71';
        return '#95a5a6';
    };

    return (
        <div className="staff-section">
            <h2 className="section-title">{title}</h2>
            <div className="staff-grid">
                {list.map(member => (
                    <div key={member.id} className="staff-card card">
                        <div className="staff-header">
                            <div className="staff-avatar-container">
                                {member.avatar_url ? (
                                    <img src={member.avatar_url} className="staff-avatar" alt="avatar" />
                                ) : (
                                    <div className="staff-avatar-placeholder">
                                        {(member.username || '?').charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div
                                    className="status-indicator"
                                    style={{ background: member.status === 'online' ? '#2ecc71' : '#7f8c8d' }}
                                    title={member.status}
                                />
                            </div>
                            <div className="staff-identity">
                                <h3>{member.username || 'Sin Nombre'}</h3>
                                <span className="role-badge" style={{ borderColor: getRoleColor(member.role), color: getRoleColor(member.role) }}>
                                    {member.role || 'Miembro'}
                                </span>
                            </div>
                        </div>
                        <div className="staff-stats">
                            <div className="mini-stat">
                                <span className="label">Turnos</span>
                                <span className="value">{member.actions}</span>
                            </div>
                            <div className="mini-stat">
                                <span className="label">Horas Totales</span>
                                <span className="value" style={{ color: 'var(--primary)' }}>{member.totalHours} h</span>
                            </div>
                            {/* ADMIN: Quick Link Button */}
                            <div className="mini-stat">
                                <span className="label">Discord ID</span>
                                <span className="value" style={{ fontSize: '0.7rem', opacity: 0.7 }}>{member.discord_id ? '✅ Vinculado' : '❌ Sin Vincular'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StaffHub;
