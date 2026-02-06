import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useDiscordMember } from '../components/auth/RoleGuard';
import { Check, AlertCircle, Vote, User } from 'lucide-react';

const Elections = () => {
    const memberData = useDiscordMember();
    const [elections, setElections] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [userVotes, setUserVotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchData();
    }, [memberData]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Active Elections (Anyone can see this now)
            const { data: electionsData, error: eError } = await supabase
                .from('elections')
                .select('*')
                .eq('is_active', true)
                .order('id');

            if (eError) throw eError;

            // 2. Fetch Candidates
            const { data: candidatesData, error: cError } = await supabase
                .from('election_candidates')
                .select('*')
                .in('election_id', electionsData.map(e => e.id));

            if (cError) throw cError;

            // 3. Fetch User Votes (ONLY if logged in)
            let votesData = [];
            if (memberData?.user?.id) {
                const { data: vData, error: vError } = await supabase
                    .from('election_votes')
                    .select('election_id, candidate_id')
                    .eq('user_id', memberData.user.id);

                if (vError) throw vError;
                votesData = vData || [];
            }

            setElections(electionsData);
            setCandidates(candidatesData);
            setUserVotes(votesData);

        } catch (error) {
            console.error('Error fetching election data:', error);
            setMessage({ type: 'error', text: 'Error al cargar las votaciones.' });
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (electionId, candidateId) => {
        // If not logged in, redirect to login
        if (!memberData?.user?.id) {
            const confirmLogin = window.confirm("Debes iniciar sesión con Discord para votar. ¿Quieres ir al login ahora?");
            if (confirmLogin) {
                // Redirect mostly to login page
                window.location.hash = '/login';
            }
            return;
        }

        if (voting) return;
        setVoting(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('election_votes')
                .insert({
                    user_id: memberData.user.id,
                    election_id: electionId,
                    candidate_id: candidateId
                });

            if (error) {
                if (error.code === '23505') { // Unique violation
                    setMessage({ type: 'error', text: 'Ya has votado en esta elección.' });
                } else {
                    throw error;
                }
            } else {
                setMessage({ type: 'success', text: '¡Voto registrado exitosamente!' });
                // Refresh votes locally
                setUserVotes([...userVotes, { election_id: electionId, candidate_id: candidateId }]);
            }

        } catch (error) {
            console.error('Error voting:', error);
            setMessage({ type: 'error', text: 'Error al registrar el voto.' });
        } finally {
            setVoting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-white">Cargando votaciones...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 bg-gray-900 min-h-screen">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
                    <Vote size={32} className="text-yellow-500" />
                    Centro de Votaciones 2026
                </h1>
                <p className="text-gray-400 mt-2">Elige a tus representantes para construir una mejor Nación.</p>
                {!memberData && (
                    <div className="mt-4 p-3 bg-blue-900/30 border border-blue-800 rounded text-blue-200 text-sm inline-block">
                        ℹ️ Estás en modo invitado. Debes iniciar sesión para emitir tu voto.
                    </div>
                )}
            </header>

            {message && (
                <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${message.type === 'error' ? 'bg-red-900/50 text-red-200 border border-red-700' : 'bg-green-900/50 text-green-200 border border-green-700'
                    }`}>
                    {message.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
                    {message.text}
                </div>
            )}

            {elections.length === 0 ? (
                <div className="text-center p-12 bg-gray-800/50 rounded-xl border border-gray-700">
                    <Vote size={48} className="mx-auto text-gray-600 mb-4" />
                    <h3 className="text-xl text-gray-300">No hay elecciones activas en este momento.</h3>
                </div>
            ) : (
                elections.map(election => {
                    const userVotedFor = userVotes.find(v => v.election_id === election.id);
                    const electionCandidates = candidates.filter(c => c.election_id === election.id);

                    return (
                        <section key={election.id} className="bg-gray-800/40 rounded-xl border border-gray-700 overflow-hidden text-gray-200">
                            <div className="p-6 border-b border-gray-700 bg-gray-900/50">
                                <h2 className="text-2xl font-bold text-yellow-500">{election.title}</h2>
                                <p className="text-gray-400 text-sm mt-1">{election.description}</p>
                                {userVotedFor && (
                                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-green-900/30 text-green-400 rounded-full border border-green-800 text-xs font-medium">
                                        <Check size={14} />
                                        Ya has votado en esta elección
                                    </div>
                                )}
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {electionCandidates.map(candidate => {
                                    const isSelected = userVotedFor?.candidate_id === candidate.id;

                                    return (
                                        <div key={candidate.id} className={`relative group rounded-lg overflow-hidden border transition-all duration-300 ${isSelected
                                            ? 'border-green-500 bg-green-900/10 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                                            : 'border-gray-700 bg-gray-800 hover:border-gray-500 hover:bg-gray-750'
                                            }`}>
                                            <div className="aspect-video bg-gray-900 relative overflow-hidden">
                                                {candidate.photo_url ? (
                                                    <img
                                                        src={candidate.photo_url}
                                                        alt={candidate.name}
                                                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(candidate.name) + '&background=random';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                                                        <User size={48} />
                                                    </div>
                                                )}

                                                {candidate.party && (
                                                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs font-bold text-white border border-white/10">
                                                        {candidate.party}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-5">
                                                <h3 className="text-xl font-bold text-white mb-1">{candidate.name}</h3>
                                                <p className="text-gray-400 text-sm mb-4 line-clamp-2 min-h-[2.5em]">
                                                    {candidate.proposals || "Sin propuestas registradas."}
                                                </p>

                                                <button
                                                    onClick={() => handleVote(election.id, candidate.id)}
                                                    disabled={!!userVotedFor || voting}
                                                    className={`w-full py-2 px-4 rounded font-medium flex items-center justify-center gap-2 transition-all ${isSelected
                                                        ? 'bg-green-600 text-white cursor-default'
                                                        : userVotedFor
                                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
                                                            : 'bg-yellow-600 hover:bg-yellow-500 text-black shadow-lg hover:shadow-yellow-500/20'
                                                        }`}
                                                >
                                                    {isSelected ? (
                                                        <>
                                                            <Check size={18} />
                                                            Votado
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Vote size={18} />
                                                            {memberData?.user?.id ? 'Votar' : 'Iniciar Sesión para Votar'}
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })
            )}
        </div>
    );
};

export default Elections;
