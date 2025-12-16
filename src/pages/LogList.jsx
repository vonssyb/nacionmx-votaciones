import React, { useState, useEffect } from 'react';
import { Plus, Filter, Search, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

const LogList = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching logs:', error);
        } else {
            setLogs(data);
        }
        setLoading(false);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString('es-MX', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Temporary mock data removed

    const getBadgeStyle = (type) => {
        switch (type) {
            case 'ban': return { background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c' };
            case 'warn': return { background: 'rgba(241, 196, 15, 0.2)', color: '#f1c40f' };
            case 'kick': return { background: 'rgba(52, 152, 219, 0.2)', color: '#3498db' };
            default: return { background: 'rgba(255,255,255,0.1)', color: '#fff' };
        }
    };

    return (
        <div className="logs-container">
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'number', alignItems: 'center', gap: '2rem' }}>
                    <div>
                        <h1 className="page-title">Registros de Actividad</h1>
                        <p className="page-subtitle">Gestiona y visualiza las sanciones y reportes recentes.</p>
                    </div>
                    <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => navigate('/dashboard/new')}>
                        <Plus size={18} />
                        <span>Nuevo Registro</span>
                    </button>
                </div>
            </div>

            <div className="filters-bar">
                <div className="search-box">
                    <Search size={18} color="var(--text-muted)" />
                    <input
                        type="text"
                        placeholder="Buscar por usuario, ID o razón..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="btn-secondary">
                    <Filter size={18} />
                    <span>Filtrar</span>
                </button>
            </div>

            <div className="logs-table-container card">
                <table className="logs-table">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Usuario Sancionado</th>
                            <th>Razón</th>
                            <th>Moderador</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td>
                                    <span className="badge" style={getBadgeStyle(log.type)}>
                                        {log.type.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>{log.target_username || log.target}</td>
                                <td style={{ color: 'var(--text-muted)' }}>{log.reason}</td>
                                <td>{log.moderator_name || 'Staff'}</td>
                                <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{formatDate(log.created_at)}</td>
                                <td>
                                    <button className="icon-btn">
                                        <MoreHorizontal size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <style>{`
                .btn-primary {
                    background: var(--primary);
                    color: #000;
                    padding: 0.75rem 1.25rem;
                    border-radius: var(--radius);
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: var(--transition);
                }
                .btn-primary:hover {
                    background: var(--primary-hover);
                    transform: translateY(-1px);
                }
                .btn-secondary {
                    background: var(--bg-card);
                    color: var(--text-main);
                    border: 1px solid var(--border);
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .filters-bar {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .search-box {
                    flex: 1;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    padding: 0 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .search-box input {
                    background: transparent;
                    border: none;
                    color: var(--text-main);
                    font-size: 1rem;
                    padding: 0.75rem 0;
                    width: 100%;
                    outline: none;
                }
                .logs-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .logs-table th {
                    text-align: left;
                    padding: 1rem 1.5rem;
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    border-bottom: 1px solid var(--border);
                }
                .logs-table td {
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                }
                .logs-table tr:last-child td {
                    border-bottom: none;
                }
                .badge {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }
                .icon-btn {
                    background: transparent;
                    color: var(--text-muted);
                    padding: 4px;
                }
                .icon-btn:hover {
                    color: var(--text-main);
                }
            `}</style>
        </div>
    );
};

export default LogList;
