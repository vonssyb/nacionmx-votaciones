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
    const [votingAnimation, setVotingAnimation] = useState(null);
    const [inkEffect, setInkEffect] = useState(false);
    const [expandedCandidate, setExpandedCandidate] = useState(null);
    const [totalVotes, setTotalVotes] = useState(0);
    const [message, setMessage] = useState(null);
    const [timeLeft, setTimeLeft] = useState('00:00:00');

    // Timer Logic
    useEffect(() => {
        // Target Date: Use the first active election's end_date or fallback
        // If multiple elections, which one to track? Usually the "General" one.
        // For now, let's pick the first active election with an end_date.
        const activeElection = elections.find(e => e.is_active && e.end_date);
        const targetDate = activeElection?.end_date ? new Date(activeElection.end_date) : new Date('2026-02-15T20:00:00');

        const updateTimer = () => {
            const now = new Date();
            const difference = targetDate - now;

            if (difference > 0) {
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                const seconds = Math.floor((difference / 1000) % 60);
                const d = Math.floor(difference / (1000 * 60 * 60 * 24));

                const h = hours.toString().padStart(2, '0');
                const m = minutes.toString().padStart(2, '0');
                const s = seconds.toString().padStart(2, '0');

                if (d > 0) {
                    setTimeLeft(`${d}d ${h}:${m}:${s}`);
                } else {
                    setTimeLeft(`${h}:${m}:${s}`);
                }
            } else {
                setTimeLeft('CERRADO');
            }
        };

        const timerId = setInterval(updateTimer, 1000);
        updateTimer();

        return () => clearInterval(timerId);
    }, [elections]);

    useEffect(() => {
        fetchData();
        // Calculate initial total votes
        // (This will be updated in fetchData but good to init)
    }, [memberData]);

    const fetchData = async () => {
        let timeoutId;
        try {
            setLoading(true);

            // Safety timeout
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('Tiempo de espera agotado.')), 20000);
            });

            const loadData = async () => {
                let electionsData = [];
                let candidatesData = [];
                let votesData = [];
                let allVotesCount = 0;

                const { data: eData, error: eError } = await supabase
                    .from('elections')
                    .select('*')
                    .eq('is_active', true)
                    .order('id');
                if (eError) throw eError;
                electionsData = eData;

                const { data: cData, error: cError } = await supabase
                    .from('election_candidates')
                    .select('*')
                    .in('election_id', electionsData.map(e => e.id))
                    .order('party', { ascending: true });
                if (cError) throw cError;
                candidatesData = cData;

                // 3. ALWAYS Fetch User Votes (Never Cache)
                if (memberData?.user?.id) {
                    const { data: vData, error: vError } = await supabase
                        .from('election_votes')
                        .select('election_id, candidate_id')
                        .eq('user_id', memberData.user.id);

                    if (vError) throw vError;
                    votesData = vData || [];
                }

                // Global vote count disabled for stability
                // allVotesCount = ...

                return { electionsData, candidatesData, votesData };
            };

            const result = await Promise.race([loadData(), timeoutPromise]);

            setElections(result.electionsData || []);
            setCandidates(result.candidatesData || []);
            setUserVotes(result.votesData || []);

            // 4. Fetch Global Vote Count via RPC (bypasses RLS)
            if (result.electionsData.length > 0) {
                const { data: countData, error: countError } = await supabase.rpc('get_total_votes');
                if (!countError && countData !== null) {
                    setTotalVotes(countData);
                }
            }

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
        if (confirmModal && timer > 0 && !votingAnimation) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else if (confirmModal && timer === 0 && !votingAnimation) {
            // Auto-cancel logic
            setConfirmModal(null);
        }
        return () => clearInterval(interval);
    }, [confirmModal, timer, votingAnimation]);

    // Ink Effect Logic
    const triggerInkEffect = (e) => {
        const x = e.clientX;
        const y = e.clientY;
        const ink = document.createElement('div');
        ink.className = 'ink-stain animate-ink-spread';
        ink.style.left = `${x}px`;
        ink.style.top = `${y}px`;
        document.body.appendChild(ink);
        setTimeout(() => ink.remove(), 2000);
    };

    const handleVoteClick = (electionId, candidateId, candidateName, candidateParty, candidatePhoto, candidateLogo) => {
        if (!memberData?.user?.id) {
            setLoginModal(true);
            return;
        }

        // CHECK ROLE for Voting
        const REQUIRED_ROLE_ID = '1412899401000685588';
        const hasRole = memberData.roles && memberData.roles.includes(REQUIRED_ROLE_ID);

        if (!hasRole) {
            setMessage({
                type: 'error',
                text: 'No tienes permiso para votar. Necesitas el rol verificado en el servidor de Discord.'
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (voting) return;

        // Open Virtual Ballot Modal
        setConfirmModal({ electionId, candidateId, candidateName, candidateParty, candidatePhoto, candidateLogo });
        setTimer(15); // More time for the immersive experience
    };

    const confirmVote = async () => {
        if (!confirmModal) return;
        const { electionId, candidateId } = confirmModal;

        setVoting(true);
        // Start Animation Sequence
        setVotingAnimation('stamping');

        // Wait for stamp animation
        await new Promise(r => setTimeout(r, 600));

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
                setConfirmModal(null);
                setVotingAnimation(null);
            } else {
                setVotingAnimation('dropping'); // Fold and drop animation
                await new Promise(r => setTimeout(r, 1000));

                setMessage({ type: 'success', text: '¡Voto registrado y boleta depositada!' });

                // Refresh votes locally
                const newVotes = [...userVotes, { election_id: electionId, candidate_id: candidateId }];
                setUserVotes(newVotes);
                setTotalVotes(prev => prev + 1);

                setConfirmModal(null);
                setVotingAnimation(null);
                setInkEffect(true); // Show ink on finger/screen
            }

        } catch (error) {
            console.error('Error voting:', error);
            setMessage({ type: 'error', text: 'Error al registrar el voto.' });
            setConfirmModal(null);
            setVotingAnimation(null);
        } finally {
            setVoting(false);
        }
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
                <h2 className="text-xl font-bold text-white tracking-wider">SISTEMA ELECTORAL</h2>
                <p className="text-[#D90F74] text-sm font-medium mt-2 animate-pulse">Verificando padrón electoral...</p>
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

    return (
        <div className="w-full px-4 md:px-8 py-6 space-y-8 bg-gray-900 min-h-screen relative" onClick={inkEffect ? (e) => { triggerInkEffect(e); setInkEffect(false); } : undefined}>

            {/* Header with Stats */}
            <header className="mb-8 border-b border-gray-700/50 pb-6 bg-gray-900/80 backdrop-blur-md p-6 rounded-xl border border-white/5 shadow-2xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png" className="h-16 w-auto" alt="INE Logo" />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-100 uppercase tracking-widest">
                                Elecciones Federales
                            </h1>
                            <p className="text-[#D90F74] font-bold text-sm tracking-[0.2em] mt-1">INSTITUTO NACIONAL ELECTORAL</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                        <div className="hidden md:block">
                            <span className="text-gray-400 text-xs uppercase tracking-wider block">Participación Ciudadana</span>
                            <span className="text-2xl font-mono font-bold text-white">{totalVotes.toLocaleString()} <span className="text-[#D90F74] text-sm">Votos</span></span>
                        </div>
                        <div className="px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 text-center min-w-[100px]">
                            <span className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Cierre de Casillas</span>
                            <span className="text-xl font-mono text-white font-bold">{timeLeft}</span>
                        </div>
                    </div>
                </div>
                {!memberData && (
                    <div className="mt-6 p-4 bg-gray-800/80 border-l-4 border-[#D90F74] rounded-r-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <User size={24} className="text-[#D90F74]" />
                            <div>
                                <h3 className="text-white font-medium">Modo Invitado</h3>
                                <p className="text-gray-400 text-sm">Inicia sesión con Discord para ejercer tu derecho al voto.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                sessionStorage.setItem('auth_redirect', window.location.pathname);
                                window.location.hash = '/login';
                            }}
                            className="px-6 py-2 bg-[#D90F74] hover:bg-[#b00c5e] text-white font-bold rounded shadow-lg flex items-center gap-2 uppercase text-sm tracking-wider"
                        >
                            <LogIn size={18} />
                            Identificarse
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
                    <h3 className="text-xl text-gray-300">No hay procesos electorales activos.</h3>
                </div>
            ) : (
                elections.map(election => {
                    const userVotedFor = userVotes.find(v => v.election_id === election.id);
                    const electionCandidates = candidates.filter(c => c.election_id === election.id);

                    return (
                        <section key={election.id} className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden text-gray-200 shadow-2xl relative">
                            {/* Decorative header line */}
                            <div className="h-1 w-full bg-gradient-to-r from-[#D90F74] via-purple-600 to-[#D90F74]"></div>

                            <div className="p-6 border-b border-gray-700/50 bg-gray-900/50 flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold text-white uppercase tracking-wider">{election.title}</h2>
                                    <p className="text-gray-400 text-sm mt-1 max-w-2xl">{election.description}</p>
                                </div>
                                {userVotedFor && (
                                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-green-900/20 text-green-400 rounded border border-green-800/50 text-xs font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(74,222,128,0.1)]">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        Voto Registrado
                                    </div>
                                )}
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {electionCandidates.map(candidate => {
                                    const isSelected = userVotedFor?.candidate_id === candidate.id;

                                    return (
                                        <div key={candidate.id} className={`relative group rounded-lg overflow-hidden border transition-all duration-300 ${isSelected
                                            ? 'border-green-500/50 bg-green-900/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]'
                                            : 'border-gray-700/50 bg-gray-800/40 hover:border-[#D90F74]/50 hover:bg-gray-800/60 hover:shadow-lg'
                                            }`}>
                                            <div className="aspect-[16/9] bg-gray-900 relative overflow-hidden">
                                                {candidate.photo_url ? (
                                                    <img
                                                        src={candidate.photo_url}
                                                        alt={candidate.name}
                                                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700 grayscale-[20%] group-hover:grayscale-0"
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(candidate.name) + '&background=random';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-800">
                                                        <User size={48} />
                                                    </div>
                                                )}

                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90"></div>

                                                {candidate.party && (
                                                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider">
                                                        {candidate.party}
                                                    </div>
                                                )}

                                                <div className="absolute bottom-0 left-0 p-4 w-full">
                                                    <h3 className="text-xl font-bold text-white mb-0 leading-tight">{candidate.name}</h3>
                                                    <p className="text-gray-300 text-xs font-medium opacity-80 mt-1">{candidate.party || 'Candidato Independiente'}</p>
                                                </div>

                                                {candidate.logo_url && (
                                                    <div className="absolute bottom-4 right-4 w-10 h-10 rounded-full overflow-hidden border border-white/20 shadow-lg bg-white/5 backdrop-blur-sm">
                                                        <img src={candidate.logo_url} alt="Logo" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-4 border-t border-white/5">
                                                <p className="text-gray-400 text-sm mb-4 line-clamp-2 h-[2.5em]">
                                                    {candidate.proposals || "Sin propuestas registradas."}
                                                </p>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => setExpandedCandidate(candidate)}
                                                        className="py-2 px-4 rounded border border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 text-xs font-bold uppercase tracking-wider transition-colors"
                                                    >
                                                        Ver Perfil
                                                    </button>

                                                    <button
                                                        onClick={() => handleVoteClick(election.id, candidate.id, candidate.name, candidate.party, candidate.photo_url, candidate.logo_url)}
                                                        disabled={!!userVotedFor || voting || election.voting_open === false}
                                                        className={`py-2 px-4 rounded flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-wider ${isSelected
                                                            ? 'bg-green-600 text-white cursor-default'
                                                            : userVotedFor
                                                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                                : election.voting_open === false
                                                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-[#D90F74] hover:bg-[#b00c5e] text-white shadow-lg disabled:opacity-50'
                                                            }`}
                                                    >
                                                        {isSelected ? 'Votado' : (election.voting_open === false ? 'Cerrada' : 'Votar')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })
            )}

            {/* EXPANDED CANDIDATE MODAL */}
            {expandedCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setExpandedCandidate(null)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto relative shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#D90F74]/20 to-transparent pointer-events-none"></div>
                        <button className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/80" onClick={() => setExpandedCandidate(null)}><span className="text-xl">×</span></button>

                        <div className="p-8">
                            <div className="flex flex-col md:flex-row gap-6 mb-8 items-center md:items-start">
                                <img src={expandedCandidate.photo_url || "https://ui-avatars.com/api/?name=" + expandedCandidate.name} className="w-32 h-32 rounded-xl object-cover border-2 border-[#D90F74] shadow-[0_0_30px_rgba(217,15,116,0.2)]" alt="" />
                                <div>
                                    <div className="inline-block px-2 py-1 bg-[#D90F74] text-white text-[10px] font-bold uppercase tracking-widest rounded mb-2">{expandedCandidate.party}</div>
                                    <h2 className="text-3xl font-bold text-white mb-2">{expandedCandidate.name}</h2>
                                    <p className="text-gray-400 text-lg italic">"{expandedCandidate.proposals?.substring(0, 50)}..."</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-[#D90F74] font-bold uppercase tracking-widest text-sm mb-3 border-b border-gray-800 pb-2">Propuestas de Campaña</h3>
                                    <p className="text-gray-300 leading-relaxed whitespace-pre-line">{expandedCandidate.proposals || "No hay información detallada disponible."}</p>
                                </div>

                                {expandedCandidate.cabinet && expandedCandidate.cabinet.length > 0 && (
                                    <div>
                                        <h3 className="text-[#D90F74] font-bold uppercase tracking-widest text-sm mb-3 border-b border-gray-800 pb-2">Gabinete Propuesto</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {expandedCandidate.cabinet.map((m, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 rounded border border-gray-700/50">
                                                    <span className="text-gray-400 text-sm">{m.position}</span>
                                                    <span className="text-white font-medium text-sm">{m.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* VIRTUAL BALLOT MODAL */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    {/* The Ballot */}
                    <div className={`relative bg-[#f8f5e6] text-black w-full max-w-md p-8 shadow-2xl transition-all duration-500 transform 
                        ${votingAnimation === 'stamping' ? 'animate-ballot-stamp' : ''}
                        ${votingAnimation === 'dropping' ? 'animate-ballot-drop' : 'animate-ballot-slide-in'}
                        rounded-sm border-2 border-[#d4af37] pattern-paper`}
                        style={{ backgroundImage: 'radial-gradient(#d4af37 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }}
                    >
                        {/* Watermark / Header */}
                        <div className="border-b-2 border-black/80 pb-4 mb-6 flex justify-between items-center opacity-90">
                            <div>
                                <h2 className="text-lg font-bold uppercase tracking-widest">Boleta Electoral</h2>
                                <p className="text-[10px] uppercase font-bold text-gray-600">Proceso Federal 2026 • Entidad Federativa MX</p>
                            </div>
                            <img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png" className="h-10 grayscale opacity-50" alt="" />
                        </div>

                        {/* Candidate Selection Area */}
                        <div className="border-4 border-black relative p-6 mb-8 bg-white shadow-inner">
                            <div className="flex gap-4 items-center">
                                <div className="border border-gray-300 p-1 w-20 h-20 shrink-0">
                                    <img src={confirmModal.candidateLogo || confirmModal.candidatePhoto} className="w-full h-full object-contain grayscale" alt="" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-2xl uppercase">{confirmModal.candidateName}</h3>
                                    <p className="text-sm font-bold text-gray-500 uppercase">{confirmModal.candidateParty}</p>
                                </div>
                            </div>

                            {/* THE X MARK */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className={`text-9xl text-black font-handwriting transform -rotate-12 opacity-0 transition-opacity duration-300 ${votingAnimation ? 'opacity-90' : ''}`} style={{ fontFamily: 'cursive' }}>X</span>
                            </div>
                        </div>

                        {/* Stamped 'VOTADO' Effect */}
                        {votingAnimation && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-4 border-[#D90F74] text-[#D90F74] p-4 text-4xl font-bold uppercase opacity-80 rotate-[-25deg] mix-blend-multiply animate-pulse pointer-events-none z-20">
                                VOTADO
                            </div>
                        )}

                        <div className="text-center mt-4">
                            <p className="text-xs uppercase font-bold text-gray-500 mb-4">Confirme su selección para depositar la boleta.</p>
                            <div className="flex gap-2 justify-center">
                                {votingAnimation ? (
                                    <button disabled className="px-8 py-3 bg-gray-800 text-white font-bold uppercase tracking-widest rounded shadow-xl cursor-wait">
                                        Procesando...
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => setConfirmModal(null)} className="px-4 py-2 text-gray-600 hover:text-black font-bold uppercase text-xs border border-gray-400 hover:bg-gray-100 transition-colors">Cancelar</button>
                                        <button onClick={confirmVote} className="px-8 py-2 bg-black text-white hover:bg-gray-800 font-bold uppercase text-xs shadow-lg transition-transform transform hover:-translate-y-1">
                                            Depositar en Urna
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Elections;
