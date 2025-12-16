import React from 'react';
import { AlertTriangle, Skull, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../services/supabase';

const BoloBoard = () => {
    const [bolos, setBolos] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetchBolos();
    }, []);

    const fetchBolos = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('bolos')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setBolos(data);
        setLoading(false);
    };

    const getStatusBadge = (status) => {
        if (status === 'wanted') return <span className="status-badge wanted"><AlertTriangle size={14} /> BUSCADO</span>;
        if (status === 'captured') return <span className="status-badge captured"><CheckCircle size={14} /> CAPTURADO</span>;
        return null;
    };

    return (
        <div className="bolo-container">
            <div className="page-header header-with-actions">
                <div>
                    <h1 className="page-title text-danger">B.O.L.O BOARD</h1>
                    <p className="page-subtitle">Be On Look Out - Objetivos de Alto Valor</p>
                </div>
                <button className="btn-danger">
                    <Skull size={18} /> REPORTAR AVISTAMIENTO
                </button>
            </div>

            <div className="bolo-grid">
                {bolos.map(bolo => (
                    <div key={bolo.id} className={`bolo-card ${bolo.status}`}>
                        <div className="bolo-image-placeholder">
                            <Skull size={48} color={bolo.status === 'wanted' ? '#e74c3c' : '#2ecc71'} />
                            {bolo.status === 'captured' && <div className="captured-overlay">CAPTURADO</div>}
                        </div>
                        <div className="bolo-info">
                            <div className="bolo-header">
                                <h2>{bolo.name}</h2>
                                {getStatusBadge(bolo.status)}
                            </div>
                            <div className="bolo-details">
                                <div className="detail-row">
                                    <span className="label">Cargos:</span>
                                    <span className="value">
                                        {Array.isArray(bolo.crimes) ? bolo.crimes.join(', ') : bolo.crimes}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Recompensa:</span>
                                    <span className="value highlight">{bolo.bounty}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Última vez:</span>
                                    <span className="value">{bolo.lastSeen}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                .text-danger { color: #e74c3c; letter-spacing: 2px; }
                .btn-danger {
                    background: #e74c3c;
                    color: white;
                    border-radius: var(--radius);
                    padding: 0.75rem 1.25rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: var(--transition);
                }
                .btn-danger:hover {
                    background: #c0392b;
                    box-shadow: 0 0 15px rgba(231, 76, 60, 0.4);
                }
                .header-with-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .bolo-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 2rem;
                }
                .bolo-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    overflow: hidden;
                    position: relative;
                    transition: var(--transition);
                }
                .bolo-card.wanted { border-color: #e74c3c; }
                .bolo-card.captured { opacity: 0.7; }
                
                .bolo-image-placeholder {
                    height: 200px;
                    background: #1a1a1a;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                .captured-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-15deg);
                    border: 4px solid #2ecc71;
                    color: #2ecc71;
                    font-size: 2rem;
                    font-weight: 900;
                    padding: 0.5rem 1rem;
                    text-transform: uppercase;
                    background: rgba(0,0,0,0.8);
                }
                .bolo-info { padding: 1.5rem; }
                .bolo-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1rem;
                }
                .bolo-header h2 { font-size: 1.5rem; font-weight: 800; text-transform: uppercase; }
                
                .status-badge {
                    display: flex; 
                    align-items: center; 
                    gap: 4px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 800;
                }
                .status-badge.wanted { background: rgba(231, 76, 60, 0.2); color: #e74c3c; }
                .status-badge.captured { background: rgba(46, 204, 113, 0.2); color: #2ecc71; }

                .bolo-details { display: flex; flex-direction: column; gap: 0.5rem; }
                .detail-row { display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
                .detail-row:last-child { border-bottom: none; }
                .detail-row .label { color: var(--text-muted); font-size: 0.9rem; }
                .detail-row .value { font-weight: 600; text-align: right; }
                .detail-row .value.highlight { color: #f1c40f; }

            `}</style>
        </div>
    );
};

export default BoloBoard;
