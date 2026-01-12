import React from 'react';
import { FileText, Check, X, Clock } from 'lucide-react';
import { supabase } from '../services/supabase';

const Applications = () => {
    // Mock data
    const [applications, setApplications] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedApp, setSelectedApp] = React.useState(null);

    React.useEffect(() => {
        fetchApplications();
    }, []);

    const fetchApplications = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('applications')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setApplications(data);
        setLoading(false);
    };

    const handleUpdateStatus = async (id, newStatus) => {
        const { error } = await supabase
            .from('applications')
            .update({ status: newStatus })
            .eq('id', id);

        if (!error) {
            fetchApplications();
            setSelectedApp(null);
        } else {
            alert("Error: " + error.message);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending': return <span className="status-pill pending"><Clock size={12} /> Pendiente</span>;
            case 'approved': return <span className="status-pill approved"><Check size={12} /> Aprobado</span>;
            case 'rejected': return <span className="status-pill rejected"><X size={12} /> Rechazado</span>;
            default: return null;
        }
    };

    return (
        <div className="apps-container">
            <div className="page-header">
                <h1 className="page-title">Centro de Solicitudes</h1>
                <p className="page-subtitle">Revisión de whitelists, oposiciones y apelaciones.</p>
            </div>

            <div className="apps-list card">
                {applications.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay solicitudes registradas.</div>
                ) : applications.map((app) => (
                    <div key={app.id} className="app-item">
                        <div className="app-icon">
                            <FileText size={24} color="var(--primary)" />
                        </div>
                        <div className="app-content">
                            <div className="app-header">
                                <h3>{app.applicant_username}</h3>
                                <span className="app-type">{app.type}</span>
                            </div>
                            <span className="app-date">{new Date(app.created_at).toLocaleString()}</span>
                        </div>
                        <div className="app-status">
                            {getStatusBadge(app.status)}
                        </div>
                        <div className="app-actions">
                            <button className="btn-sm" onClick={() => setSelectedApp(app)}>Ver Detalles</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Application Detail Modal Overlay */}
            {selectedApp && (
                <div className="modal-overlay" onClick={() => setSelectedApp(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Solicitud de {selectedApp.applicant_username}</h2>
                            <button className="btn-close" onClick={() => setSelectedApp(null)}><X size={24} /></button>
                        </div>

                        <div className="modal-body">
                            <div className="detail-grid">
                                {Object.entries(selectedApp.form_data || {}).map(([key, value]) => (
                                    <div key={key} className="detail-item">
                                        <label>{key.replace(/_/g, ' ').toUpperCase()}</label>
                                        <div className="value">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {selectedApp.status === 'pending' && (
                            <div className="modal-actions">
                                <button className="btn-reject" onClick={() => handleUpdateStatus(selectedApp.id, 'rejected')}>
                                    <X size={18} /> Rechazar
                                </button>
                                <button className="btn-approve" onClick={() => handleUpdateStatus(selectedApp.id, 'approved')}>
                                    <Check size={18} /> Aprobar Candidato
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .apps-list {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                }
                .app-item {
                    display: flex;
                    align-items: center;
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--border);
                    gap: 1.5rem;
                    transition: background 0.2s;
                }
                .app-item:last-child { border-bottom: none; }
                .app-item:hover { background: var(--bg-card-hover); }
                
                .app-icon {
                    background: rgba(212, 175, 55, 0.1);
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .app-content { flex: 1; }
                .app-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem; }
                .app-header h3 { font-size: 1.1rem; font-weight: 600; }
                .app-type { 
                    font-size: 0.8rem; 
                    background: var(--bg-dark); 
                    padding: 2px 8px; 
                    border-radius: 10px; 
                    color: var(--text-muted);
                    border: 1px solid var(--border);
                }
                .app-date { font-size: 0.85rem; color: var(--text-muted); }

                .status-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .status-pill.pending { background: rgba(241, 196, 15, 0.15); color: #f1c40f; }
                .status-pill.approved { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
                .status-pill.rejected { background: rgba(231, 76, 60, 0.15); color: #e74c3c; }

                .btn-sm {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--border);
                    background: transparent;
                    color: var(--text-main);
                    border-radius: var(--radius);
                    font-size: 0.9rem;
                    transition: var(--transition);
                }
                .btn-sm:hover {
                    background: var(--primary);
                    color: black;
                    border-color: var(--primary);
                }

                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.8);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 2rem;
                }
                .modal-content {
                    background: var(--bg-dark);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    width: 100%;
                    max-width: 800px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .modal-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-header h2 { font-size: 1.5rem; color: var(--primary); }
                .btn-close { background: none; border: none; color: var(--text-muted); cursor: pointer; }
                
                .modal-body {
                    padding: 1.5rem;
                    overflow-y: auto;
                    flex: 1;
                }
                .detail-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 1.5rem;
                }
                .detail-item label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-bottom: 0.5rem;
                    font-weight: 700;
                }
                .detail-item .value {
                    background: var(--bg-card);
                    padding: 1rem;
                    border-radius: 8px;
                    border: 1px solid var(--border);
                    white-space: pre-wrap;
                }

                .modal-actions {
                    padding: 1.5rem;
                    border-top: 1px solid var(--border);
                    display: flex;
                    justify-content: flex-end;
                    gap: 1rem;
                }
                .btn-approve {
                    background: #2ecc71;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: var(--radius);
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                }
                .btn-reject {
                    background: #e74c3c;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: var(--radius);
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
};

export default Applications;
