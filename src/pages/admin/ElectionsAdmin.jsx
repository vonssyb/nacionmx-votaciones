import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useDiscordMember } from '../../components/auth/RoleGuard';
import { ShieldCheck, Plus, Edit, Trash2, Save, X, Image as ImageIcon, Upload, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

    // Form inputs
    const [electionForm, setElectionForm] = useState({ title: '', position: '', description: '' });
    const [candidateForm, setCandidateForm] = useState({ name: '', party: '', proposals: '', photo_url: '', logo_url: '' });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: eData, error: eError } = await supabase.from('elections').select('*').order('id');
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
                setCandidates(candidatesWithVotes);
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
            setElectionForm({ title: '', position: '', description: '' });
            fetchData();
        } catch (e) { console.error(e); alert('Error guardando elección'); }
    };

    const toggleElectionStatus = async (election) => {
        try {
            await supabase.from('elections').update({ is_active: !election.is_active }).eq('id', election.id);
            fetchData();
        } catch (e) { console.error(e); }
    };

    const handleDeleteElection = async (id) => {
        if (!window.confirm('¿Seguro? Se borrarán candidatos y votos asociados.')) return;
        try {
            await supabase.from('elections').delete().eq('id', id);
            fetchData();
        } catch (e) { console.error(e); }
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

            console.log('Upload success:', data.publicUrl);
            // DEBUG: Alert so user can see it's working
            // alert(`Imagen subida: ${data.publicUrl}`);

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

    const handleDeleteCandidate = async (id) => {
        if (!window.confirm('¿Borrar candidato?')) return;
        try {
            await supabase.from('election_candidates').delete().eq('id', id);
            fetchData();
        } catch (e) { console.error(e); }
    };


    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
                <div className="relative mb-8">
                    <img
                        src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png"
                        alt="INE Loading"
                        className="h-24 w-auto object-contain relative z-10 animate-bounce-slow"
                    />
                </div>
                <div className="w-12 h-12 border-4 border-gray-700 border-t-[#D90F74] rounded-full animate-spin mb-4"></div>
                <h2 className="text-xl font-bold text-white tracking-wider">PANEL ADMINISTRATIVO</h2>
                <p className="text-[#D90F74] text-sm font-medium mt-2 animate-pulse">Cargando datos...</p>
                <style>{`
                    @keyframes bounce-slow {
                        0%, 100% { transform: translateY(-5%); }
                        50% { transform: translateY(5%); }
                    }
                    .animate-bounce-slow {
                        animation: bounce-slow 2s infinite ease-in-out;
                    }
                `}</style>
            </div>
        );
    }

    // Defense in Depth: Double check role access
    // ALLOWED_ROLES from RoleGuard (Owner, Co-Owner, Directiva, Admin, Staff, etc.)
    const ALLOWED_ROLES = [
        '1412882240991658177', // Owner
        '1449856794980516032', // Co Owner
        '1412882245735420006', // Junta Directiva
        '1412882248411381872', // Administrador
        '1412887079612059660', // Staff (Moderador)
        '1470948248507256965'  // Instituto Nacional Electoral
    ];

    const canAccess = memberData?.roles?.some(r => ALLOWED_ROLES.includes(r));

    if (!canAccess) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
                <div className="bg-red-900/20 p-8 rounded-xl border border-red-500/50 flex flex-col items-center gap-4">
                    <ShieldCheck size={64} className="text-red-500" />
                    <h1 className="text-2xl font-bold text-red-400">Acceso Restringido</h1>
                    <p className="text-gray-300">Este panel es exclusivo para el rol <strong>Instituto Nacional Electoral</strong> y Administración.</p>
                </div>
            </div>
        );
    }

    const [activeTab, setActiveTab] = useState('elections'); // 'elections' | 'complaints'

    // Import dynamically or lazily if needed, but here we just need to import it at the top.
    // NOTE: I will add the import statement in a separate step or assume it's added.

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-6 md:p-12">
            <style>{`
                @keyframes slide-down {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-down {
                    animation: slide-down 0.3s ease-out forwards;
                }
            `}</style>
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 pb-6 border-b border-gray-700 gap-4">
                <div className="flex items-center gap-4">
                    <ShieldCheck size={40} className="text-[#D90F74]" />
                    <div>
                        <h1 className="text-3xl font-bold">Panel de Administración</h1>
                        <p className="text-gray-400">Sistema Integral Electoral</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/votaciones')}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors border border-gray-700"
                    >
                        <ArrowLeft size={20} />
                        Volver
                    </button>
                </div>
            </header>

            {/* TABS */}
            <div className="flex gap-4 mb-8 border-b border-gray-700">
                <button
                    onClick={() => setActiveTab('elections')}
                    className={`pb-3 px-4 font-bold text-sm uppercase tracking-wider transition-all border-b-2 ${activeTab === 'elections'
                        ? 'border-[#D90F74] text-[#D90F74]'
                        : 'border-transparent text-gray-400 hover:text-gray-200'
                        }`}
                >
                    Gestión de Elecciones
                </button>
                <button
                    onClick={() => setActiveTab('complaints')}
                    className={`pb-3 px-4 font-bold text-sm uppercase tracking-wider transition-all border-b-2 ${activeTab === 'complaints'
                        ? 'border-[#D90F74] text-[#D90F74]'
                        : 'border-transparent text-gray-400 hover:text-gray-200'
                        }`}
                >
                    Denuncias y Reportes
                </button>
            </div>

            {activeTab === 'complaints' ? (
                <ComplaintsAdmin />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    <div className="lg:col-span-1 space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-[#D90F74]">Elecciones</h2>
                            <button
                                onClick={() => {
                                    setEditingElection('new');
                                    setElectionForm({ title: '', position: '', description: '' });
                                }}
                                className="bg-gray-800 hover:bg-gray-700 p-2 rounded text-[#D90F74]"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        {editingElection && (
                            <div className="bg-gray-800 p-4 rounded-lg border border-[#D90F74] space-y-3">
                                <input
                                    className="w-full bg-gray-900 border border-gray-700 p-2 rounded"
                                    placeholder="Título"
                                    value={electionForm.title}
                                    onChange={e => setElectionForm({ ...electionForm, title: e.target.value })}
                                />
                                <input
                                    className="w-full bg-gray-900 border border-gray-700 p-2 rounded"
                                    placeholder="Cargo (ID)"
                                    value={electionForm.position}
                                    onChange={e => setElectionForm({ ...electionForm, position: e.target.value })}
                                />
                                <textarea
                                    className="w-full bg-gray-900 border border-gray-700 p-2 rounded"
                                    placeholder="Descripción"
                                    value={electionForm.description}
                                    onChange={e => setElectionForm({ ...electionForm, description: e.target.value })}
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setEditingElection(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                                    <button onClick={handleSaveElection} className="text-green-500 hover:text-green-400"><Save size={20} /></button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {elections.map(election => (
                                <div
                                    key={election.id}
                                    onClick={() => setSelectedElectionId(election.id)}
                                    className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedElectionId === election.id ? 'bg-[#D90F74]/20 border-[#D90F74]' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold">{election.title}</h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleElectionStatus(election); }}
                                                className={`text-xs px-2 py-0.5 rounded font-bold transition-colors cursor-pointer border ${election.is_active
                                                    ? 'bg-green-900/50 text-green-400 border-green-700 hover:bg-green-800'
                                                    : 'bg-red-900/50 text-red-400 border-red-700 hover:bg-red-800'
                                                    }`}
                                                title="Click para cambiar estado"
                                            >
                                                {election.is_active ? 'ACTIVO' : 'INACTIVO'}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingElection(election);
                                                    setElectionForm({ title: election.title, position: election.position, description: election.description });
                                                }}
                                                className="text-gray-400 hover:text-blue-400"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{election.position}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        {selectedElectionId ? (
                            <>
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold">
                                        Candidatos: <span className="text-[#D90F74]">{elections.find(e => e.id === selectedElectionId)?.title}</span>
                                    </h2>
                                    <button
                                        onClick={() => {
                                            setEditingCandidate('new');
                                            setCandidateForm({ name: '', party: '', proposals: '', photo_url: '', logo_url: '' });
                                        }}
                                        className="px-4 py-2 bg-[#D90F74] hover:bg-[#b00c5e] rounded text-white font-bold flex items-center gap-2"
                                    >
                                        <Plus size={20} /> Nuevo Candidato
                                    </button>
                                </div>

                                {editingCandidate === 'new' && (
                                    <div className="bg-gray-800 p-6 rounded-lg border border-[#D90F74] shadow-xl space-y-4 mb-6 animate-fade-in">
                                        <h3 className="font-bold text-[#D90F74] flex items-center gap-2"><Plus size={18} /> Registrando Nuevo Candidato</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input
                                                className="bg-gray-900 border border-gray-700 p-3 rounded text-white"
                                                placeholder="Nombre del Candidato"
                                                value={candidateForm.name}
                                                onChange={e => setCandidateForm({ ...candidateForm, name: e.target.value })}
                                            />
                                            <input
                                                className="bg-gray-900 border border-gray-700 p-3 rounded text-white"
                                                placeholder="Partido Político"
                                                value={candidateForm.party}
                                                onChange={e => setCandidateForm({ ...candidateForm, party: e.target.value })}
                                            />
                                        </div>
                                        <textarea
                                            className="w-full bg-gray-900 border border-gray-700 p-3 rounded text-white h-24"
                                            placeholder="Propuestas..."
                                            value={candidateForm.proposals}
                                            onChange={e => setCandidateForm({ ...candidateForm, proposals: e.target.value })}
                                        />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-20 h-20 bg-gray-900 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                                                    {candidateForm.photo_url ? (
                                                        <img src={candidateForm.photo_url} alt="Preview" className="w-full h-full object-cover" />
                                                    ) : <ImageIcon className="text-gray-600" />}
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm text-gray-400 mb-1">Foto del Candidato</label>
                                                    <input type="file" onChange={(e) => handleImageUpload(e, 'photo')} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#D90F74] file:text-white hover:file:bg-[#b00c5e] cursor-pointer" />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="w-20 h-20 bg-gray-900 rounded-full border border-gray-700 flex items-center justify-center overflow-hidden">
                                                    {candidateForm.logo_url ? (
                                                        <img src={candidateForm.logo_url} alt="Preview" className="w-full h-full object-cover" />
                                                    ) : <ImageIcon className="text-gray-600" />}
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm text-gray-400 mb-1">Logo del Partido</label>
                                                    <input type="file" onChange={(e) => handleImageUpload(e, 'logo')} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#D90F74] file:text-white hover:file:bg-[#b00c5e] cursor-pointer" />
                                                </div>
                                            </div>
                                        </div>

                                        {uploading && <p className="text-[#D90F74] text-xs text-center animate-pulse">Subiendo imagen...</p>}

                                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                                            <button onClick={() => setEditingCandidate(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
                                            <button onClick={handleSaveCandidate} disabled={uploading} className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold disabled:opacity-50">{uploading ? 'Subiendo...' : 'Crear Candidato'}</button>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-4">
                                    {candidates.filter(c => c.election_id === selectedElectionId).map(candidate => (
                                        <div key={candidate.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden transition-all duration-300">
                                            <div className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <div className="w-12 h-12 bg-gray-900 rounded-full overflow-hidden border border-gray-600">
                                                            {candidate.photo_url ? (
                                                                <img src={candidate.photo_url} alt={candidate.name} className="w-full h-full object-cover" />
                                                            ) : <User className="w-full h-full p-2 text-gray-500" />}
                                                        </div>
                                                        {candidate.logo_url && (
                                                            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full overflow-hidden drop-shadow-md bg-white/10 backdrop-blur-sm">
                                                                <img src={candidate.logo_url} alt="Logo" className="w-full h-full object-cover" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-white">{candidate.name}</h3>
                                                        <p className="text-sm text-gray-400">{candidate.party || 'Independiente'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right hidden sm:block">
                                                        <span className="block text-2xl font-bold text-[#D90F74]">{candidate.vote_count || 0}</span>
                                                        <span className="text-xs text-gray-500 uppercase">Votos</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => {
                                                            if (editingCandidate?.id === candidate.id) {
                                                                setEditingCandidate(null);
                                                            } else {
                                                                setEditingCandidate(candidate);
                                                                setCandidateForm({ name: candidate.name, party: candidate.party, proposals: candidate.proposals, photo_url: candidate.photo_url, logo_url: candidate.logo_url });
                                                            }
                                                        }} className={`p-2 rounded transition ${editingCandidate?.id === candidate.id ? 'bg-[#D90F74] text-white' : 'bg-gray-700 text-gray-300 hover:bg-blue-600 hover:text-white'}`}>
                                                            <Edit size={18} />
                                                        </button>
                                                        <button onClick={() => handleDeleteCandidate(candidate.id)} className="p-2 bg-gray-700 hover:bg-red-600 rounded text-gray-300 hover:text-white transition"><Trash2 size={18} /></button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* EXPANDABLE EDIT FORM */}
                                            {editingCandidate?.id === candidate.id && (
                                                <div className="bg-gray-900/50 p-6 border-t border-[#D90F74] animate-slide-down">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                        <input
                                                            className="bg-gray-900 border border-gray-700 p-3 rounded text-white"
                                                            placeholder="Nombre del Candidato"
                                                            value={candidateForm.name}
                                                            onChange={e => setCandidateForm({ ...candidateForm, name: e.target.value })}
                                                        />
                                                        <input
                                                            className="bg-gray-900 border border-gray-700 p-3 rounded text-white"
                                                            placeholder="Partido Político"
                                                            value={candidateForm.party}
                                                            onChange={e => setCandidateForm({ ...candidateForm, party: e.target.value })}
                                                        />
                                                    </div>
                                                    <textarea
                                                        className="w-full bg-gray-900 border border-gray-700 p-3 rounded text-white h-24 mb-6"
                                                        placeholder="Propuestas..."
                                                        value={candidateForm.proposals}
                                                        onChange={e => setCandidateForm({ ...candidateForm, proposals: e.target.value })}
                                                    />

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-20 h-20 bg-gray-900 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                                                                {candidateForm.photo_url ? (
                                                                    <img src={candidateForm.photo_url} alt="Preview" className="w-full h-full object-cover" />
                                                                ) : <ImageIcon className="text-gray-600" />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <label className="block text-sm text-gray-400 mb-1">Foto del Candidato</label>
                                                                <input type="file" onChange={(e) => handleImageUpload(e, 'photo')} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#D90F74] file:text-white hover:file:bg-[#b00c5e] cursor-pointer" />
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4">
                                                            <div className="w-20 h-20 bg-gray-900 rounded-full border border-gray-700 flex items-center justify-center overflow-hidden">
                                                                {candidateForm.logo_url ? (
                                                                    <img src={candidateForm.logo_url} alt="Preview" className="w-full h-full object-cover" />
                                                                ) : <ImageIcon className="text-gray-600" />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <label className="block text-sm text-gray-400 mb-1">Logo del Partido</label>
                                                                <input type="file" onChange={(e) => handleImageUpload(e, 'logo')} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#D90F74] file:text-white hover:file:bg-[#b00c5e] cursor-pointer" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {uploading && <p className="text-[#D90F74] text-xs text-center animate-pulse mb-4">Subiendo imagen...</p>}

                                                    <div className="flex justify-end gap-3">
                                                        <button onClick={() => setEditingCandidate(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
                                                        <button onClick={handleSaveCandidate} disabled={uploading} className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold disabled:opacity-50">{uploading ? 'Subiendo...' : 'Guardar Cambios'}</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {candidates.filter(c => c.election_id === selectedElectionId).length === 0 && <div className="text-center p-8 text-gray-500 border border-dashed border-gray-700 rounded-lg">No hay candidatos registrados en esta sección.</div>}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 border border-dashed border-gray-700 rounded-lg p-12">
                                <ShieldCheck size={64} className="mb-4 opacity-50" />
                                <p className="text-xl">Selecciona una elección del menú izquierdo.</p>
                            </div>
                        )}
                    </div>
                </div>
            );
};
            );
};

            export default ElectionsAdmin;
