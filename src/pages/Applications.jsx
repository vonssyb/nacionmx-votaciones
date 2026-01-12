import React from 'react';
import { FileText, Check, X, Clock, Download, Save, MessageSquare } from 'lucide-react';
import { supabase } from '../services/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Applications = () => {
    const [applications, setApplications] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedApp, setSelectedApp] = React.useState(null);
    const [adminNote, setAdminNote] = React.useState('');
    const [savingNote, setSavingNote] = React.useState(false);

    React.useEffect(() => {
        fetchApplications();
    }, []);

    const fetchApplications = async () => {
        setLoading(true);
        // Ensure we fetch admin_notes if it exists (using * gets all)
        const { data, error } = await supabase
            .from('applications')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setApplications(data);
        if (error) console.error('Error fetching applications:', error);
        setLoading(false);
    };

    const handleUpdateStatus = async (id, newStatus) => {
        const { error } = await supabase
            .from('applications')
            .update({
                status: newStatus,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id);

        if (!error) {
            fetchApplications();
            setSelectedApp(null);
        } else {
            alert("Error: " + error.message);
        }
    };

    const handleSaveNote = async () => {
        if (!selectedApp) return;
        setSavingNote(true);
        const { error } = await supabase
            .from('applications')
            .update({ admin_notes: adminNote })
            .eq('id', selectedApp.id);

        if (!error) {
            // Update local state
            setApplications(applications.map(app =>
                app.id === selectedApp.id ? { ...app, admin_notes: adminNote } : app
            ));
            alert("Nota guardada");
        } else {
            alert("Error al guardar nota: " + error.message);
        }
        setSavingNote(false);
    };

    const openApplication = (app) => {
        setSelectedApp(app);
        setAdminNote(app.admin_notes || '');
    };

    const generatePDF = () => {
        if (!selectedApp) return;
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text(`Solicitud de Staff: ${selectedApp.applicant_username}`, 10, 10);

        doc.setFontSize(10);
        doc.text(`Discord ID: ${selectedApp.applicant_discord_id}`, 10, 20);
        doc.text(`Fecha: ${new Date(selectedApp.created_at).toLocaleString()}`, 10, 25);
        doc.text(`Estado: ${selectedApp.status.toUpperCase()}`, 10, 30);

        let yPos = 40;

        // Parse content
        let content = selectedApp.content;
        if (typeof content === 'string') {
            // Try to parse if it's a JSON string, else treat as raw text
            try {
                content = JSON.parse(content);
            } catch (e) {
                // It's raw text
            }
        }

        if (typeof content === 'object' && content !== null) {
            // Personal Info
            if (content.personal_info) {
                doc.setFontSize(14);
                doc.text("Información Personal", 10, yPos);
                yPos += 10;
                doc.setFontSize(10);
                const info = [
                    [`Nombre`, content.personal_info.nombre],
                    [`Edad`, content.personal_info.edad],
                    [`Zona Horaria`, content.personal_info.zona_horaria],
                    [`Recomendado Por`, content.personal_info.recomendado_por || 'N/A']
                ];
                doc.autoTable({
                    startY: yPos,
                    head: [],
                    body: info,
                    theme: 'plain'
                });
                yPos = doc.lastAutoTable.finalY + 10;
            }

            // Answers
            if (content.respuestas && Array.isArray(content.respuestas)) {
                doc.setFontSize(14);
                doc.text("Cuestionario", 10, yPos);
                yPos += 5;

                const tableBody = content.respuestas.map((item, i) => [
                    `P${i + 1}: ${item.question}`,
                    `R: ${item.answer}`
                ]);

                doc.autoTable({
                    startY: yPos,
                    head: [['Pregunta', 'Respuesta']],
                    body: tableBody,
                    styles: { cellWidth: 'wrap' },
                    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 100 } }
                });
            } else {
                // Fallback for legacy JSON or different structure
                doc.setFontSize(10);
                doc.text(JSON.stringify(content, null, 2), 10, yPos);
            }
        } else {
            // Raw text fallback
            const splitText = doc.splitTextToSize(String(content), 190);
            doc.text(splitText, 10, yPos);
        }

        doc.save(`solicitud_${selectedApp.applicant_username}.pdf`);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending': return <span className="status-pill pending"><Clock size={12} /> Pendiente</span>;
            case 'approved': return <span className="status-pill approved"><Check size={12} /> Aprobado</span>;
            case 'rejected': return <span className="status-pill rejected"><X size={12} /> Rechazado</span>;
            default: return null;
        }
    };

    // Helper to extract displayable content
    const renderContent = () => {
        if (!selectedApp) return null;
        let content = selectedApp.content;

        // Handle legacy string content
        if (typeof content === 'string') {
            try {
                content = JSON.parse(content);
            } catch {
                return <pre className="raw-text">{content}</pre>;
            }
        }

        // Handle JSON content
        if (content.personal_info && content.respuestas) {
            return (
                <div className="app-details">
                    <div className="detail-section">
                        <h4>Información Personal</h4>
                        <div className="info-grid">
                            <div className="info-item"><label>Nombre:</label> {content.personal_info.nombre}</div>
                            <div className="info-item"><label>Edad:</label> {content.personal_info.edad}</div>
                            <div className="info-item"><label>Zona Horaria:</label> {content.personal_info.zona_horaria}</div>
                            <div className="info-item"><label>Recomendado:</label> {content.personal_info.recomendado_por}</div>
                        </div>
                    </div>

                    <div className="detail-section">
                        <h4>Experiencia y Motivación</h4>
                        <div className="qa-item">
                            <label>Experiencia:</label>
                            <p>{content.experiencia}</p>
                        </div>
                        <div className="qa-item">
                            <label>Disponibilidad:</label>
                            <p>{content.disponibilidad}</p>
                        </div>
                        <div className="qa-item">
                            <label>Motivación:</label>
                            <p>{content.motivacion}</p>
                        </div>
                    </div>

                    <div className="detail-section">
                        <h4>Cuestionario Staff</h4>
                        <div className="questions-list">
                            {content.respuestas.map((qa, i) => (
                                <div key={i} className="qa-pair">
                                    <div className="question"><strong>{i + 1}.</strong> {qa.question}</div>
                                    <div className="answer">{qa.answer}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        // Fallback for unexpected JSON
        return <pre className="raw-text">{JSON.stringify(content, null, 2)}</pre>;
    };

    return (
        <div className="apps-container">
            <div className="page-header">
                <h1 className="page-title">Centro de Solicitudes</h1>
                <p className="page-subtitle">Gestión de postulaciones y equipo.</p>
            </div>

            <div className="apps-list card">
                {applications.length === 0 ? (
                    <div className="empty-state">No hay solicitudes registradas.</div>
                ) : applications.map((app) => (
                    <div key={app.id} className="app-item">
                        <div className="app-icon">
                            {app.discord_avatar ?
                                <img src={app.discord_avatar} alt="avatar" className="app-avatar-img" /> :
                                <FileText size={24} color="var(--primary)" />
                            }
                        </div>
                        <div className="app-content-summary">
                            <div className="app-header">
                                <h3>{app.applicant_username}</h3>
                                <span className={`app-type ${app.type}`}>{app.type}</span>
                            </div>
                            <span className="app-date">{new Date(app.created_at).toLocaleString()}</span>
                        </div>
                        <div className="app-status">
                            {getStatusBadge(app.status)}
                        </div>
                        <div className="app-actions">
                            <button className="btn-sm" onClick={() => openApplication(app)}>Ver Detalles</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Application Detail Modal */}
            {selectedApp && (
                <div className="modal-overlay" onClick={() => setSelectedApp(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">
                                <h2>Solicitud de {selectedApp.applicant_username}</h2>
                                <span className="modal-subtitle">ID: {selectedApp.applicant_discord_id}</span>
                            </div>
                            <button className="btn-close" onClick={() => setSelectedApp(null)}><X size={24} /></button>
                        </div>

                        <div className="modal-body">
                            {renderContent()}

                            <div className="admin-notes-section">
                                <h4><MessageSquare size={16} /> Notas Administrativas</h4>
                                <textarea
                                    value={adminNote}
                                    onChange={(e) => setAdminNote(e.target.value)}
                                    placeholder="Escribe notas internas aquí..."
                                    rows={3}
                                />
                                <button className="btn-save-note" onClick={handleSaveNote} disabled={savingNote}>
                                    <Save size={16} /> {savingNote ? 'Guardando...' : 'Guardar Nota'}
                                </button>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-pdf" onClick={generatePDF}>
                                <Download size={18} /> Descargar PDF
                            </button>

                            {selectedApp.status === 'pending' && (
                                <div className="decision-actions">
                                    <button className="btn-reject" onClick={() => handleUpdateStatus(selectedApp.id, 'rejected')}>
                                        <X size={18} /> Rechazar
                                    </button>
                                    <button className="btn-approve" onClick={() => handleUpdateStatus(selectedApp.id, 'approved')}>
                                        <Check size={18} /> Aprobar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .apps-container { padding: 2rem; max-width: 1200px; margin: 0 auto; color: white; }
                .page-header { margin-bottom: 2rem; }
                .page-title { font-size: 2rem; font-weight: 800; color: #fff; }
                .page-subtitle { color: #888; }

                .empty-state { padding: 3rem; text-align: center; color: #666; font-style: italic; }

                .app-avatar-img { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
                .apps-list { background: #1a1a1a; border-radius: 12px; border: 1px solid #333; overflow: hidden; }
                .app-item { display: flex; align-items: center; padding: 1.5rem; border-bottom: 1px solid #333; gap: 1.5rem; transition: background 0.2s; }
                .app-item:hover { background: #252525; }
                .app-icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: rgba(255, 215, 0, 0.1); border-radius: 50%; }
                .app-content-summary { flex: 1; }
                .app-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.25rem; }
                .app-header h3 { font-weight: 700; font-size: 1.1rem; }
                .app-type { font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; border: 1px solid #444; background: #000; text-transform: capitalize; }
                .app-date { font-size: 0.85rem; color: #888; }
                
                .status-pill { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; }
                .status-pill.pending { background: rgba(241, 196, 15, 0.15); color: #f1c40f; }
                .status-pill.approved { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
                .status-pill.rejected { background: rgba(231, 76, 60, 0.15); color: #e74c3c; }

                .btn-sm { padding: 0.5rem 1rem; background: transparent; border: 1px solid #444; color: #ccc; border-radius: 6px; cursor: pointer; transition: 0.2s; }
                .btn-sm:hover { border-color: #f1c40f; color: #f1c40f; }

                /* Modal */
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 2rem; }
                .modal-content { background: #111; border: 1px solid #333; border-radius: 16px; width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
                .modal-header { padding: 1.5rem; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: flex-start; }
                .modal-title h2 { color: #f1c40f; margin: 0; font-size: 1.5rem; }
                .modal-subtitle { color: #666; font-family: monospace; font-size: 0.9rem; }
                .btn-close { background: none; border: none; color: #666; cursor: pointer; }
                .btn-close:hover { color: white; }

                .modal-body { padding: 2rem; overflow-y: auto; flex: 1; }
                
                .app-details h4 { color: #f1c40f; border-bottom: 1px solid #333; padding-bottom: 0.5rem; margin-bottom: 1rem; margin-top: 1.5rem; }
                .app-details h4:first-child { margin-top: 0; }
                
                .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
                .info-item { display: flex; flex-direction: column; gap: 0.25rem; }
                .info-item label { color: #888; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
                
                .qa-item { margin-bottom: 1rem; }
                .qa-item label { display: block; color: #888; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.25rem; }
                
                .qa-pair { margin-bottom: 1.5rem; background: #1a1a1a; padding: 1rem; border-radius: 8px; border: 1px solid #2a2a2a; }
                .qa-pair .question { color: #ddd; margin-bottom: 0.5rem; font-weight: 500; }
                .qa-pair .answer { color: #bbb; white-space: pre-wrap; padding-left: 1rem; border-left: 2px solid #444; }

                .raw-text { background: #000; padding: 1rem; border-radius: 8px; color: #0f0; font-family: monospace; white-space: pre-wrap; overflow-x: auto; }

                .admin-notes-section { margin-top: 2rem; background: #1a1a1a; padding: 1.5rem; border-radius: 8px; border: 1px solid #333; }
                .admin-notes-section h4 { display: flex; align-items: center; gap: 0.5rem; color: #ccc; margin-top: 0; margin-bottom: 1rem; border: none; }
                .admin-notes-section textarea { width: 100%; background: #000; border: 1px solid #333; color: white; padding: 1rem; border-radius: 8px; resize: vertical; margin-bottom: 1rem; }
                .admin-notes-section textarea:focus { border-color: #f1c40f; outline: none; }
                .btn-save-note { background: #333; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
                .btn-save-note:hover { background: #444; }

                .modal-actions { padding: 1.5rem; border-top: 1px solid #333; display: flex; justify-content: space-between; align-items: center; background: #161616; border-radius: 0 0 16px 16px; }
                .decision-actions { display: flex; gap: 1rem; }
                
                .btn-pdf { background: #3498db; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: 0.2s; }
                .btn-pdf:hover { background: #2980b9; transform: translateY(-1px); }
                
                .btn-approve { background: #2ecc71; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: 0.2s; }
                .btn-approve:hover { background: #27ae60; transform: translateY(-1px); }
                
                .btn-reject { background: #e74c3c; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: 0.2s; }
                .btn-reject:hover { background: #c0392b; transform: translateY(-1px); }

                @media (max-width: 768px) {
                    .modal-content { max-height: 100vh; border-radius: 0; }
                    .modal-actions { flex-direction: column; gap: 1rem; }
                    .decision-actions { width: 100%; justify-content: space-between; }
                    .btn-pdf { width: 100%; justify-content: center; }
                    .info-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Applications;
