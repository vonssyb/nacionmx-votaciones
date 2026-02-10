import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useDiscordMember } from '../components/auth/RoleGuard';
import { Check, AlertCircle, Vote, User, LogIn } from 'lucide-react';

const Elections = () => {
    const memberData = useDiscordMember();
    const [elections, setElections] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [userVotes, setUserVotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmModal, setConfirmModal] = useState(null);
    const [loginModal, setLoginModal] = useState(false);
    const [timer, setTimer] = useState(10);
    const [message, setMessage] = useState(null);
    const [voting, setVoting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [memberData]);

    const fetchData = async () => {
        let timeoutId;
        try {
            setLoading(true);

            // Safety timeout: 8 seconds
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('Tiempo de espera agotado (Timeout). Verifica tu conexión.')), 8000);
            });

            // Data fetch promise
            const loadDataPromise = async () => {
                // 1. Fetch Active Elections
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

                // 3. Fetch User Votes
                let votesData = [];
                if (memberData?.user?.id) {
                    const { data: vData, error: vError } = await supabase
                        .from('election_votes')
                        .select('election_id, candidate_id')
                        .eq('user_id', memberData.user.id);

                    if (vError) throw vError;
                    votesData = vData || [];
                }

                return { electionsData, candidatesData, votesData };
            };

            // Race between fetch and timeout
            const result = await Promise.race([loadDataPromise(), timeoutPromise]);

            setElections(result.electionsData || []);
            setCandidates(result.candidatesData || []);
            setUserVotes(result.votesData || []);

        } catch (error) {
            console.error('Error fetching election data:', error);
            setMessage({ type: 'error', text: `Error al cargar datos: ${error.message || 'Error desconocido'}` });
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    };

    useEffect(() => {
        let interval;
        if (confirmModal && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else if (confirmModal && timer === 0) {
            // Auto-cancel logic
            setConfirmModal(null);
        }
        return () => clearInterval(interval);
    }, [confirmModal, timer]);

    const handleVoteClick = (electionId, candidateId, candidateName) => {
        if (!memberData?.user?.id) {
            setLoginModal(true);
            return;
        }

        if (voting) return;

        // Open Confirmation Modal
        setConfirmModal({ electionId, candidateId, candidateName });
        setTimer(10);
    };

    const confirmVote = async () => {
        if (!confirmModal) return;
        const { electionId, candidateId } = confirmModal;

        setVoting(true);
        setMessage(null);
        setConfirmModal(null); // Close modal

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
        <div className="p-6 max-w-7xl mx-auto space-y-8 bg-gray-900 min-h-screen relative">
            <header className="mb-8 border-b border-gray-700 pb-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <img
                            src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png"
                            alt="INE Logo"
                            className="h-16 w-auto object-contain"
                        />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-100">
                                Instituto Nacional Electoral
                            </h1>
                            <p className="text-[#D90F74] font-medium mt-1">Proceso Electoral Federal 2026</p>
                        </div>
                    </div>
                </div>
                {!memberData && (
                    <div className="mt-6 p-4 bg-gray-800/80 border-l-4 border-[#D90F74] rounded-r-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#D90F74]/10 rounded-full text-[#D90F74]">
                                <User size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-medium">Modo Invitado</h3>
                                <p className="text-gray-400 text-sm">Inicia sesión con Discord para poder emitir tu voto.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                sessionStorage.setItem('auth_redirect', '/votaciones');
                                window.location.hash = '/login';
                            }}
                            className="px-6 py-2.5 bg-[#D90F74] hover:bg-[#b00c5e] text-white font-bold rounded-lg transition-all shadow-lg shadow-[#D90F74]/20 flex items-center gap-2 whitespace-nowrap"
                        >
                            <LogIn size={20} />
                            Iniciar Sesión
                        </button>
                    </div>
                )}
            </header>

            {message && (
                <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 border ${message.type === 'error' ? 'bg-red-900/50 text-red-200 border-red-700' : 'bg-green-900/50 text-green-200 border-green-700'
                    }`}>
                    {message.type === 'error' ? <AlertCircle size={20} className="shrink-0" /> : <Check size={20} className="shrink-0" />}
                    <span>{message.text}</span>
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
                                <h2 className="text-2xl font-bold text-[#D90F74]">{election.title}</h2>
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
                                                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
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
                                                <p className="text-gray-400 text-sm mb-4 min-h-[2.5em]">
                                                    {candidate.proposals || "Sin propuestas registradas."}
                                                </p>

                                                {/* Gabinete Section */}
                                                {candidate.cabinet && candidate.cabinet.length > 0 && (
                                                    <div className="mb-4 bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-700/50 pb-1">Gabinete</h4>
                                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                                            {candidate.cabinet.map((member, idx) => (
                                                                <div key={idx} className="flex justify-between items-start text-xs">
                                                                    <div className="font-medium text-gray-300">{member.position}:</div>
                                                                    <div className="text-gray-400 text-right">{member.name}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => handleVoteClick(election.id, candidate.id, candidate.name)}
                                                    disabled={!!userVotedFor || voting}
                                                    className={`w-full py-2 px-4 rounded font-medium flex items-center justify-center gap-2 transition-all ${isSelected
                                                        ? 'bg-green-600 text-white cursor-default'
                                                        : userVotedFor
                                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
                                                            : 'bg-[#D90F74] hover:bg-[#b00c5e] text-white shadow-lg hover:shadow-[#D90F74]/30'
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

            {/* Login Modal */}
            {loginModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-[#D90F74]/50 rounded-xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-[#D90F74]"></div>
                        <div className="flex justify-center mb-4">
                            <div className="p-3 bg-[#D90F74]/20 rounded-full text-[#D90F74]">
                                <LogIn size={32} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2 text-center">Iniciar Sesión</h3>
                        <p className="text-gray-300 mb-6 text-center">
                            Para garantizar la seguridad y unicidad del voto, es necesario iniciar sesión con tu cuenta de Discord.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    sessionStorage.setItem('auth_redirect', '/votaciones');
                                    window.location.hash = '/login';
                                }}
                                className="w-full py-3 bg-[#D90F74] hover:bg-[#b00c5e] text-white font-bold rounded-lg transition-all shadow-lg shadow-[#D90F74]/20 flex items-center justify-center gap-2"
                            >
                                <LogIn size={20} />
                                Iniciar Sesión con Discord
                            </button>
                            <button
                                onClick={() => setLoginModal(false)}
                                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 font-medium rounded-lg transition-all border border-gray-700"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-[#D90F74]/50 rounded-xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
                        {/* Pink top bar */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-[#D90F74]"></div>

                        <h3 className="text-2xl font-bold text-white mb-2">Confirmar Voto</h3>
                        <p className="text-gray-300 mb-6">
                            Estás a punto de emitir tu voto por <span className="text-[#D90F74] font-bold">{confirmModal.candidateName}</span>.
                            <br /><br />
                            ¿Estás seguro?
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={confirmVote}
                                className="w-full py-3 bg-[#D90F74] hover:bg-[#b00c5e] text-white font-bold rounded-lg transition-all shadow-lg shadow-[#D90F74]/20 flex items-center justify-center gap-2"
                            >
                                <Check size={20} />
                                Confirmar Voto
                            </button>
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 font-medium rounded-lg transition-all border border-gray-700"
                            >
                                Cancelar ({timer}s)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Elections;
