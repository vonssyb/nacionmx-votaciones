import React from 'react';
import { FileText, Check, X, Clock } from 'lucide-react';
import { supabase } from '../services/supabase';

const Applications = () => {
    // Mock data
    const [applications, setApplications] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

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
                {applications.map((app) => (
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
                            <button className="btn-sm">Ver Detalles</button>
                        </div>
                    </div>
                ))}
            </div>

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
            `}</style>
        </div>
    );
};

export default Applications;
