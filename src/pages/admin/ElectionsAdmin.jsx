import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useDiscordMember } from '../../components/auth/RoleGuard';
import { ShieldCheck, Plus, Edit, Trash2, Save, X, Image as ImageIcon, Upload } from 'lucide-react';

const ElectionsAdmin = () => {
    const memberData = useDiscordMember();

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


    if (loading) return <div className="p-8 text-white text-center">Cargando Panel...</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-6 md:p-12">
            <header className="flex justify-between items-center mb-10 pb-6 border-b border-gray-700">
                <div className="flex items-center gap-4">
                    <ShieldCheck size={40} className="text-[#D90F74]" />
                    <div>
                        <h1 className="text-3xl font-bold">Panel de Administración INE</h1>
                        <p className="text-gray-400">Gestión de Elecciones y Candidatos</p>
                    </div>
                </div>
            </header>

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
                                            className={`text-xs px-2 py-0.5 rounded ${election.is_active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}
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

                            {editingCandidate && (
                                <div className="bg-gray-800 p-6 rounded-lg border border-[#D90F74] shadow-xl space-y-4">
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
                                            <div className="w-20 h-20 bg-gray-900 rounded border border-gray-700 flex items-center justify-center overflow-hidden">
                                                {candidateForm.logo_url ? (
                                                    <img src={candidateForm.logo_url} alt="Preview" className="w-full h-full object-contain p-1" />
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
                                        <button onClick={handleSaveCandidate} disabled={uploading} className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold disabled:opacity-50">{uploading ? 'Subiendo...' : 'Guardar'}</button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4">
                                {candidates.filter(c => c.election_id === selectedElectionId).map(candidate => (
                                    <div key={candidate.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className="w-12 h-12 bg-gray-900 rounded-full overflow-hidden border border-gray-600">
                                                    {candidate.photo_url ? (
                                                        <img src={candidate.photo_url} alt={candidate.name} className="w-full h-full object-cover" />
                                                    ) : <User className="w-full h-full p-2 text-gray-500" />}
                                                </div>
                                                {candidate.logo_url && (
                                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full border border-gray-500 overflow-hidden shadow-sm">
                                                        <img src={candidate.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white">{candidate.name}</h3>
                                                <p className="text-sm text-gray-400">{candidate.party || 'Independiente'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <span className="block text-2xl font-bold text-[#D90F74]">{candidate.vote_count || 0}</span>
                                                <span className="text-xs text-gray-500 uppercase">Votos</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setEditingCandidate(candidate); setCandidateForm({ name: candidate.name, party: candidate.party, proposals: candidate.proposals, photo_url: candidate.photo_url, logo_url: candidate.logo_url }); }} className="p-2 bg-gray-700 hover:bg-blue-600 rounded text-gray-300 hover:text-white transition"><Edit size={18} /></button>
                                                <button onClick={() => handleDeleteCandidate(candidate.id)} className="p-2 bg-gray-700 hover:bg-red-600 rounded text-gray-300 hover:text-white transition"><Trash2 size={18} /></button>
                                            </div>
                                        </div>
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
        </div>
    );
};

export default ElectionsAdmin;
