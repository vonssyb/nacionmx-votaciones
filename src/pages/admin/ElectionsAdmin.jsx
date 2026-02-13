import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { useDiscordMember } from '../../components/auth/RoleGuard';
import { ShieldCheck, Plus, Edit, Trash2, Save, X, Image as ImageIcon, Upload, ArrowLeft, AlertCircle, Download, Archive, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toPng } from 'html-to-image';
import ComplaintsAdmin from './ComplaintsAdmin';

const ElectionsAdmin = () => {
    const memberData = useDiscordMember();
    const navigate = useNavigate();

    // Data State
    const [elections, setElections] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);

    // Editors State
    const [editingElection, setEditingElection] = useState(null);
    const [editingCandidate, setEditingCandidate] = useState(null);
    const [selectedElectionId, setSelectedElectionId] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);
    const [resultsModal, setResultsModal] = useState(null); // { election, candidates: [] }
    const resultsRef = useRef(null);

    // Form inputs
    const [electionForm, setElectionForm] = useState({ title: '', position: '', description: '', end_date: '' });
    const [candidateForm, setCandidateForm] = useState({ name: '', party: '', proposals: '', photo_url: '', logo_url: '' });
    const [viewMode, setViewMode] = useState('active'); // 'active' | 'archived'
    const [activeTab, setActiveTab] = useState('elections');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: eData, error: eError } = await supabase.from('elections').select('*').order('id', { ascending: false }); // Newest first
            if (eError) throw eError;

            const { data: cData, error: cError } = await supabase.from('election_candidates').select('*').order('election_id');
            if (cError) throw cError;

            setElections(eData);

            const { data: vData, error: vError } = await supabase.from('election_votes').select('election_id, candidate_id');

            if (!vError && vData) {
                const counts = {};
                vData.forEach(v => {
                    const key = `${v.election_id}-${v.candidate_id}`;
                    counts[key] = (counts[key] || 0) + 1;
                });

                const candidatesWithVotes = cData.map(c => ({
                    ...c,
                    vote_count: counts[`${c.election_id}-${c.id}`] || 0
                }));

                // Calculate percentages for results modal
                const electionTotalVotes = {};
                candidatesWithVotes.forEach(c => {
                    electionTotalVotes[c.election_id] = (electionTotalVotes[c.election_id] || 0) + c.vote_count;
                });

                setCandidates(candidatesWithVotes.map(c => ({
                    ...c,
                    percentage: electionTotalVotes[c.election_id] > 0
                        ? ((c.vote_count / electionTotalVotes[c.election_id]) * 100).toFixed(1)
                        : 0
                })));
            } else {
                setCandidates(cData);
            }

        } catch (error) {
            console.error(error);
            alert('Error cargando datos de administración');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveElection = async () => {
        if (!electionForm.title || !electionForm.position) return alert('Completa título y cargo');
        try {
            if (editingElection === 'new') {
                const { error } = await supabase.from('elections').insert([electionForm]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('elections').update(electionForm).eq('id', editingElection.id);
                if (error) throw error;
            }
            setEditingElection(null);
            setElectionForm({ title: '', position: '', description: '', end_date: '' });
            fetchData();
        } catch (e) { console.error(e); alert('Error guardando elección'); }
    };

    const toggleElectionStatus = async (election) => {
        try {
            const { error } = await supabase.from('elections').update({ is_active: !election.is_active }).eq('id', election.id);
            if (error) throw error;
            fetchData();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const toggleVotingOpen = async (election) => {
        try {
            const { error } = await supabase.from('elections').update({ voting_open: !election.voting_open }).eq('id', election.id);
            if (error) throw error;
            fetchData();
        } catch (e) {
            console.error(e);
            alert('Error actualizando estado de votación: ' + e.message);
        }
    };

    const handleFinalizeElection = (election) => {
        setConfirmModal({
            type: 'election',
            title: '¿Finalizar/Archivar Elección?',
            message: 'Esto cerrará la votación y marcará la elección como inactiva. Se guardará en el historial.',
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('elections')
                        .update({ is_active: false, voting_open: false })
                        .eq('id', election.id);
                    if (error) throw error;
                    fetchData();
                    setConfirmModal(null);
                } catch (e) { console.error(e); alert('Error al finalizar: ' + e.message); }
            }
        });
    };

    const handleDeleteElection = (id) => {
        setConfirmModal({
            type: 'election',
            title: '¿Eliminar Elección?',
            message: 'Esta acción borrará la elección y todos los votos. NO SE PUEDE DESHACER.',
            onConfirm: async () => {
                try {
                    await supabase.from('elections').delete().eq('id', id);
                    fetchData();
                    setConfirmModal(null);
                } catch (e) { console.error(e); }
            }
        });
    };

    const openResultsModal = (election) => {
        const electionCandidates = candidates
            .filter(c => c.election_id === election.id)
            .sort((a, b) => b.vote_count - a.vote_count);

        setResultsModal({ election, candidates: electionCandidates });
    };

    const downloadResultsKeywords = async () => {
        if (!resultsRef.current) return;
        try {
            const dataUrl = await toPng(resultsRef.current, { quality: 0.95, backgroundColor: '#111827' });
            const link = document.createElement('a');
            link.download = `Resultados_${resultsModal.election.title.replace(/\s+/g, '_')}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Error generando imagen', err);
            alert('Error generando la imagen.');
        }
    };

    const handleImageUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `candidates/${type}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from('evidence').upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('evidence').getPublicUrl(fileName);
            if (!data || !data.publicUrl) throw new Error('Error al obtener URL pública');

            setCandidateForm(prev => ({
                ...prev,
                [type === 'logo' ? 'logo_url' : 'photo_url']: data.publicUrl
            }));

        } catch (error) {
            console.error(error);
            alert('Error subiendo imagen');
        } finally {
            setUploading(false);
        }
    };

    const handleSaveCandidate = async () => {
        if (!candidateForm.name || !selectedElectionId) return alert('Nombre y Elección son requeridos');
        try {
            const payload = { ...candidateForm, election_id: selectedElectionId };
            if (editingCandidate === 'new') {
                const { error } = await supabase.from('election_candidates').insert([payload]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('election_candidates').update(payload).eq('id', editingCandidate.id);
                if (error) throw error;
            }
            setEditingCandidate(null);
            setCandidateForm({ name: '', party: '', proposals: '', photo_url: '', logo_url: '' });
            fetchData();
        } catch (e) { console.error(e); alert('Error guardando candidato'); }
    };

    const handleDeleteCandidate = (id) => {
        setConfirmModal({
            type: 'candidate',
            title: '¿Eliminar Candidato?',
            message: 'Eliminarás este candidato permanentemente. ¿Estás seguro?',
            onConfirm: async () => {
                try {
                    await supabase.from('election_candidates').delete().eq('id', id);
                    fetchData();
                    setConfirmModal(null);
                } catch (e) { console.error(e); }
            }
        });
    };


    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
                <div className="w-12 h-12 border-4 border-gray-700 border-t-[#D90F74] rounded-full animate-spin mb-4"></div>
                <p className="text-[#D90F74]">Cargando...</p>
            </div>
        );
    }

    const ALLOWED_ROLES = [
        '1412882240991658177', '1449856794980516032', '1412882245735420006',
        '1412882248411381872', '1412887079612059660', '1470948248507256965'
    ];
    const canAccess = memberData?.roles?.some(r => ALLOWED_ROLES.includes(r));

    if (!canAccess) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-500">Acceso Denegado</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-6 md:p-12">
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 pb-6 border-b border-gray-700 gap-4">
                <div className="flex items-center gap-4">
                    <ShieldCheck size={40} className="text-[#D90F74]" />
                    <div>
                        <h1 className="text-3xl font-bold">Panel de Administración</h1>
                        <p className="text-gray-400">Sistema Integral Electoral</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => navigate('/votaciones')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 border border-gray-700">
                        <ArrowLeft size={20} /> Volver
                    </button>
                </div>
            </header>

            <div className="flex gap-4 mb-8 border-b border-gray-700">
                <button onClick={() => setActiveTab('elections')} className={`pb-3 px-4 font-bold text-sm uppercase tracking-wider border-b-2 ${activeTab === 'elections' ? 'border-[#D90F74] text-[#D90F74]' : 'border-transparent text-gray-400'}`}>Gestión de Elecciones</button>
                <button onClick={() => setActiveTab('complaints')} className={`pb-3 px-4 font-bold text-sm uppercase tracking-wider border-b-2 ${activeTab === 'complaints' ? 'border-[#D90F74] text-[#D90F74]' : 'border-transparent text-gray-400'}`}>Denuncias y Reportes</button>
            </div>

            {activeTab === 'complaints' ? <ComplaintsAdmin /> : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-[#D90F74]">{viewMode === 'active' ? 'Elecciones Activas' : 'Historial de Elecciones'}</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setViewMode(viewMode === 'active' ? 'archived' : 'active')}
                                    className={`p-2 rounded transition-colors ${viewMode === 'archived' ? 'bg-[#D90F74] text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                                    title={viewMode === 'active' ? "Ver Historial / Archivadas" : "Ver Activas"}
                                >
                                    <Archive size={20} />
                                </button>
                                <button onClick={() => { setEditingElection('new'); setElectionForm({ title: '', position: '', description: '', end_date: '' }); }} className="bg-gray-800 hover:bg-gray-700 p-2 rounded text-[#D90F74]"><Plus size={20} /></button>
                            </div>
                        </div>

                        {editingElection && (
                            <div className="bg-gray-800 p-4 rounded-lg border border-[#D90F74] space-y-3">
                                <input className="w-full bg-gray-900 border border-gray-700 p-2 rounded" placeholder="Título" value={electionForm.title} onChange={e => setElectionForm({ ...electionForm, title: e.target.value })} />
                                <input className="w-full bg-gray-900 border border-gray-700 p-2 rounded" placeholder="Cargo" value={electionForm.position} onChange={e => setElectionForm({ ...electionForm, position: e.target.value })} />
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Cierre de Casillas (Fecha y Hora)</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-white"
                                        value={electionForm.end_date ? new Date(electionForm.end_date).toISOString().slice(0, 16) : ''}
                                        onChange={e => setElectionForm({ ...electionForm, end_date: e.target.value })}
                                    />
                                </div>
                                <textarea className="w-full bg-gray-900 border border-gray-700 p-2 rounded" placeholder="Descripción" value={electionForm.description} onChange={e => setElectionForm({ ...electionForm, description: e.target.value })} />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setEditingElection(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                                    <button onClick={handleSaveElection} className="text-green-500 hover:text-green-400"><Save size={20} /></button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                            {elections.filter(e => viewMode === 'active' ? e.is_active : !e.is_active).map(election => (
                                <div key={election.id} onClick={() => setSelectedElectionId(election.id)}
                                    className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedElectionId === election.id ? 'bg-[#D90F74]/20 border-[#D90F74]' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'} ${!election.is_active ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold">{election.title}</h3>
                                            {!election.is_active && <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded uppercase tracking-wider ml-0">Archivado</span>}
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); toggleElectionStatus(election); }} className={`p-1 rounded ${election.is_active ? 'text-green-400' : 'text-gray-500'}`} title={election.is_active ? "Activo (Click para desactivar)" : "Inactivo (Click para activar)"}>{election.is_active ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                                            <button onClick={(e) => { e.stopPropagation(); toggleVotingOpen(election); }} className={`p-1 rounded ${election.voting_open ? 'text-blue-400' : 'text-orange-400'}`} title={election.voting_open ? "Votación Abierta" : "Votación Cerrada"}><ShieldCheck size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleFinalizeElection(election); }} className="p-1 text-gray-400 hover:text-gray-300" title="Finalizar/Archivar Elección"><Archive size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); openResultsModal(election); }} className="p-1 text-purple-400 hover:text-purple-300" title="Resultados e Imagen"><Download size={16} /></button>

                                            <button onClick={(e) => { e.stopPropagation(); setEditingElection(election); setElectionForm({ title: election.title, position: election.position, description: election.description, end_date: election.end_date }); }} className="p-1 text-blue-400 hover:text-blue-300" title="Editar"><Edit size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteElection(election.id); }} className="p-1 text-red-400 hover:text-red-300" title="Eliminar"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 truncate">{election.position}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        {selectedElectionId ? (
                            <>
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold">Candidatos: <span className="text-[#D90F74]">{elections.find(e => e.id === selectedElectionId)?.title}</span></h2>
                                    <button onClick={() => { setEditingCandidate('new'); setCandidateForm({ name: '', party: '', proposals: '', photo_url: '', logo_url: '' }); }} className="px-4 py-2 bg-[#D90F74] hover:bg-[#b00c5e] rounded text-white font-bold flex items-center gap-2"><Plus size={20} /> Nuevo Candidato</button>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {candidates.filter(c => c.election_id === selectedElectionId).map(candidate => (
                                        <div key={candidate.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <img src={candidate.photo_url || "https://ui-avatars.com/api/?name=" + candidate.name} className="w-12 h-12 rounded-full object-cover border border-gray-600" alt="" />
                                                <div>
                                                    <h3 className="font-bold text-white">{candidate.name}</h3>
                                                    <p className="text-sm text-gray-400">{candidate.party}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="block text-xl font-bold text-[#D90F74]">{candidate.vote_count}</span>
                                                    <span className="text-[10px] text-gray-500">VOTOS</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => { setEditingCandidate(candidate); setCandidateForm({ name: candidate.name, party: candidate.party, proposals: candidate.proposals, photo_url: candidate.photo_url, logo_url: candidate.logo_url }); }} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"><Edit size={16} /></button>
                                                    <button onClick={() => handleDeleteCandidate(candidate.id)} className="p-2 bg-gray-700 hover:bg-red-900 rounded text-red-400"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500 border border-dashed border-gray-700 rounded-lg p-12">Selecciona una elección.</div>
                        )}
                    </div>
                </div>
            )}

            {/* RESULTS MODAL (Auto-Generated Image Layout) */}
            {resultsModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-gray-900 border border-[#D90F74] rounded-xl max-w-4xl w-full shadow-2xl relative">
                        <div className="flex justify-between items-center p-6 border-b border-gray-800">
                            <h3 className="text-xl font-bold text-white">Generar Resultados Oficiales</h3>
                            <button onClick={() => setResultsModal(null)} className="text-gray-400 hover:text-white"><X size={24} /></button>
                        </div>

                        <div className="p-8 flex justify-center bg-[#0a0a0a]">
                            {/* THIS DIV IS WHAT GETS CAPTURED AS IMAGE */}
                            <div ref={resultsRef} className="w-[800px] bg-[#111827] text-white p-8 relative overflow-hidden border-2 border-[#D90F74] shadow-2xl">
                                {/* Watermark / Background Texture */}
                                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #D90F74 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                                {/* Header */}
                                <div className="flex justify-between items-center mb-8 border-b-2 border-[#D90F74] pb-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png" className="h-20 object-contain" alt="INE Logo" />
                                        <div>
                                            <h1 className="text-3xl font-bold text-white uppercase tracking-wider">Resultados Oficiales</h1>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 bg-[#D90F74] text-white text-xs font-bold rounded">INE NACIÓN MX</span>
                                                <span className="text-gray-400 text-sm">{new Date().toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-xl font-bold text-[#D90F74] max-w-[300px] leading-tight text-right">{resultsModal.election.title}</h2>
                                        <p className="text-gray-500 text-sm uppercase tracking-widest mt-1">{resultsModal.election.position}</p>
                                    </div>
                                </div>

                                {/* Winner Highlight (if any votes) */}
                                {resultsModal.candidates.length > 0 && resultsModal.candidates[0].vote_count > 0 && (
                                    <div className="mb-8 flex items-center bg-[#D90F74]/10 border border-[#D90F74]/30 rounded-xl p-4 gap-6 relative z-10">
                                        <div className="relative">
                                            <img src={resultsModal.candidates[0].photo_url} className="w-24 h-24 rounded-full object-cover border-4 border-[#D90F74]" alt="" />
                                            {resultsModal.candidates[0].logo_url && (
                                                <img src={resultsModal.candidates[0].logo_url} className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full border-2 border-[#111827]" alt="" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[#D90F74] font-bold text-sm uppercase tracking-wider mb-1 block">GANADOR VIRTUAL</span>
                                            <h2 className="text-3xl font-bold text-white">{resultsModal.candidates[0].name}</h2>
                                            <p className="text-gray-400">{resultsModal.candidates[0].party}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-4xl font-bold text-[#D90F74]">{resultsModal.candidates[0].percentage}%</span>
                                            <span className="text-gray-500 text-xs uppercase">de los votos</span>
                                        </div>
                                    </div>
                                )}

                                {/* Results List */}
                                <div className="space-y-3 relative z-10">
                                    {resultsModal.candidates.map((candidate, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                                            <span className="text-gray-500 font-mono w-6 text-center">{idx + 1}</span>
                                            <img src={candidate.photo_url || "https://ui-avatars.com/api/?name=" + candidate.name} className="w-10 h-10 rounded-full object-cover bg-gray-700" alt="" />
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="font-bold text-white">{candidate.name}</span>
                                                    <span className="font-mono text-[#D90F74]">{isValidVote(candidate) ? candidate.vote_count : 0} Votos</span>
                                                </div>
                                                <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                                                    <div className="bg-[#D90F74] h-full transition-all duration-500" style={{ width: `${candidate.percentage}%` }}></div>
                                                </div>
                                            </div>
                                            <span className="font-bold text-white w-12 text-right">{candidate.percentage}%</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Footer */}
                                <div className="mt-8 pt-4 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500 relative z-10">
                                    <span>Sistema Integral Electoral • Nación MX</span>
                                    <span>Certificado Digital de Resultados</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-800 flex justify-end gap-4 bg-gray-900 rounded-b-xl">
                            <button onClick={() => setResultsModal(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cerrar</button>
                            <button onClick={downloadResultsKeywords} className="px-6 py-2 bg-[#D90F74] hover:bg-[#b00c5e] text-white font-bold rounded flex items-center gap-2">
                                <Download size={20} />
                                Descargar Imagen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-[#D90F74] rounded-xl p-6 max-w-sm w-full">
                        <h3 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h3>
                        <p className="text-gray-300 mb-6 text-sm">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded">Cancelar</button>
                            <button onClick={confirmModal.onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded font-bold">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper to avoid NaN/Undefined errors
const isValidVote = (c) => c && typeof c.vote_count === 'number';

export default ElectionsAdmin;
