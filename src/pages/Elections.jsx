import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useDiscordMember } from '../components/auth/RoleGuard';
import { toPng } from 'html-to-image';
import { Check, AlertCircle, Vote, User, LogIn, Download, FileText, BarChart2, CreditCard } from 'lucide-react';

const Elections = () => {
    const memberData = useDiscordMember();
    const [elections, setElections] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [userVotes, setUserVotes] = useState([]);
    const [publicResults, setPublicResults] = useState({}); // { electionId: { candidateId: count } }
    const [dniData, setDniData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [confirmModal, setConfirmModal] = useState(null);
    const [loginModal, setLoginModal] = useState(false);
    const [showCertificate, setShowCertificate] = useState(null); // { election, folio, date }
    const certificateRef = React.useRef(null);
    const [timer, setTimer] = useState(10);
    const [votingAnimation, setVotingAnimation] = useState(null);
    const [inkEffect, setInkEffect] = useState(false);
    const [expandedCandidate, setExpandedCandidate] = useState(null);
    const [totalVotes, setTotalVotes] = useState(0);
    const [message, setMessage] = useState(null);
    const [timeLeft, setTimeLeft] = useState('00:00:00');
    const [voting, setVoting] = useState(false);

    // Timer Logic
    useEffect(() => {
        // Target Date: Use the first active election's end_date or fallback
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
                        .select('election_id, candidate_id, folio')
                        .eq('user_id', memberData.user.id);

                    if (vError) throw vError;
                    votesData = vData || [];

                    // Fetch DNI Name (Adapting to actual DB schema: user_id, nombre, apellido)
                    const discordId = memberData.user.user_metadata?.provider_id || memberData.user.identities?.[0]?.id; // Discord ID

                    if (discordId) {
                        // Fetch DNI data - Try both column names for compatibility
                        const { data: dData, error: dError } = await supabase
                            .from('citizen_dni')
                            .select('*')
                            .or(`discord_user_id.eq.${discordId},user_id.eq.${discordId}`)
                            .maybeSingle();

                        if (!dError && dData) {
                            setDniData(dData);
                        }
                    }
                }

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

                // 5. Fetch Public Results for Closed Elections
                const closedElections = result.electionsData.filter(e => e.end_date && new Date(e.end_date) < new Date());
                const newPublicResults = {};

                await Promise.all(closedElections.map(async (e) => {
                    const { data: resData, error: resError } = await supabase.rpc('get_election_results_v2', { p_election_id: e.id });
                    if (!resError && resData) {
                        newPublicResults[e.id] = {};
                        resData.forEach(r => {
                            newPublicResults[e.id][r.candidate_id] = r.vote_count;
                        });
                    }
                }));
                setPublicResults(newPublicResults);
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
        console.log('Vote Clicked:', { electionId, candidateId, user: memberData?.user?.id });

        if (!memberData?.user?.id) {
            console.log('User not logged in');
            setLoginModal(true);
            return;
        }

        // CHECK ROLE for Voting
        const REQUIRED_ROLE_ID = '1412899401000685588';
        console.log('User Roles:', memberData.roles);
        const hasRole = memberData.roles && memberData.roles.includes(REQUIRED_ROLE_ID);

        if (!hasRole) {
            console.error('Role Check Failed. Required:', REQUIRED_ROLE_ID);
            setMessage({
                type: 'error',
                text: 'No tienes permiso para votar. Necesitas el rol verificado en el servidor de Discord.'
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (voting) {
            console.warn('Vote ignored: Already voting');
            return;
        }

        // CHECK DATE
        const election = elections.find(e => e.id === electionId);
        console.log('Election Data:', election);

        if (election && election.end_date) {
            const endDate = new Date(election.end_date);
            const now = new Date();
            console.log('Date Check:', { now, endDate, isClosed: now > endDate });

            if (now > endDate) {
                setMessage({
                    type: 'error',
                    text: 'Las votaciones para esta elección han cerrado.'
                });
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }

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
            const { data, error } = await supabase
                .from('election_votes')
                .insert({
                    user_id: memberData.user.id,
                    election_id: electionId,
                    candidate_id: candidateId
                })
                .select()
                .single();

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
                const newVote = { election_id: electionId, candidate_id: candidateId, folio: data?.folio };
                const newVotes = [...userVotes, newVote];
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

    const downloadCertificate = async () => {
        if (!certificateRef.current || !showCertificate) return;
        try {
            const dataUrl = await toPng(certificateRef.current, { quality: 0.95, backgroundColor: '#f3f4f6' });
            const link = document.createElement('a');
            link.download = `INE_Certificado_${showCertificate.folio?.slice(0, 8)}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Error generando certificado', err);
            setMessage({ type: 'error', text: 'Error al descargar certificado.' });
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

                {
                    !memberData && (
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
                    )
                }
            </header >

            {
                message && (
                    <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 border ${message.type === 'error' ? 'bg-red-900/50 text-red-200 border-red-700' : 'bg-green-900/50 text-green-200 border-green-700'
                        }`}>
                        {message.type === 'error' ? <AlertCircle size={20} className="shrink-0" /> : <Check size={20} className="shrink-0" />}
                        <span>{message.text}</span>
                    </div>
                )
            }

            {
                elections.length === 0 ? (
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
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2 px-4 py-2 bg-green-900/20 text-green-400 rounded border border-green-800/50 text-xs font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(74,222,128,0.1)]">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                Voto Registrado
                                            </div>
                                            {userVotedFor.folio && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono text-gray-500">Folio: {userVotedFor.folio.slice(0, 8)}...</span>
                                                    <button
                                                        onClick={() => setShowCertificate({
                                                            election,
                                                            folio: userVotedFor.folio,
                                                            date: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
                                                        })}
                                                        className="text-[#D90F74] hover:text-white transition-colors"
                                                        title="Descargar Certificado de Votación"
                                                    >
                                                        <FileText size={14} />
                                                    </button>
                                                </div>
                                            )}
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

                                                        {/* PUBLIC RESULTS OR VOTE BUTTONS */}
                                                        {election.end_date && new Date(election.end_date) < new Date() && publicResults[election.id] ? (
                                                            <div className="col-span-2">
                                                                <div className="flex justify-between text-xs mb-1">
                                                                    <span className="font-bold text-gray-300">Resultados Preliminares</span>
                                                                    <span className="font-mono text-[#D90F74]">{publicResults[election.id][candidate.id] || 0} Votos</span>
                                                                </div>
                                                                <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                                                                    <div
                                                                        className="bg-[#D90F74] h-full transition-all duration-1000"
                                                                        style={{
                                                                            width: `${(publicResults[election.id][candidate.id] || 0) / (Object.values(publicResults[election.id]).reduce((a, b) => a + b, 0) || 1) * 100}%`
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        ) : (
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
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })
                )
            }

            {/* EXPANDED CANDIDATE MODAL */}
            {
                expandedCandidate && (
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
                )
            }

            {/* VIRTUAL BALLOT MODAL */}
            {
                confirmModal && (
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
                )
            }

            {/* CERTIFICATE MODAL */}
            {
                showCertificate && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden">
                            <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText className="text-[#D90F74]" size={20} /> Certificado de Participación Ciudadana</h3>
                                <button onClick={() => setShowCertificate(null)} className="text-gray-500 hover:text-black">×</button>
                            </div>

                            <div className="p-8 bg-gray-50 flex justify-center">
                                {/* CERTIFICATE TEMPLATE */}
                                <div ref={certificateRef} className="w-[600px] h-[400px] bg-white border-8 border-double border-[#D90F74]/20 relative p-8 text-center shadow-lg text-gray-900"
                                    style={{
                                        backgroundImage: 'radial-gradient(circle at center, #f3f4f6 1px, transparent 1px)',
                                        backgroundSize: '20px 20px',
                                        fontFamily: 'serif'
                                    }}>
                                    <div className="absolute top-4 left-4 opacity-50"><img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png" className="h-16 grayscale" alt="" /></div>
                                    <div className="absolute bottom-4 right-4 opacity-50"><img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png" className="h-16 grayscale" alt="" /></div>

                                    <h1 className="text-3xl font-bold text-[#D90F74] mb-1 uppercase tracking-widest border-b-2 border-[#D90F74] inline-block pb-1">Constancia de Voto</h1>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.3em] mb-4">Instituto Nacional Electoral • Nación MX</p>

                                    <p className="text-base text-gray-600 italic mb-2">Se hace constar que el ciudadano/a:</p>
                                    <h2 className="text-2xl font-bold text-black mb-4 uppercase underline decoration-[#D90F74]/30 decoration-4 underline-offset-4">
                                        {dniData ? `${dniData.nombre} ${dniData.apellido || ''}` : (memberData?.user?.username || "Ciudadano Distinguido")}
                                    </h2>

                                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                        Ha ejercido su derecho al voto libre y secreto en el proceso electoral:
                                        <br />
                                        <strong className="text-[#D90F74] text-base">{showCertificate.election.title}</strong>
                                    </p>

                                    <div className="border-t border-gray-300 pt-2 mt-2 flex flex-col gap-2">
                                        <div className="flex justify-between items-center px-4">
                                            <div className="text-left">
                                                <p className="text-[10px] text-gray-400 uppercase font-bold">Fecha de Emisión</p>
                                                <p className="font-mono font-bold text-sm text-gray-800">{showCertificate.date}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-400 uppercase font-bold">Entidad</p>
                                                <p className="font-mono font-bold text-sm text-gray-800">Nación MX</p>
                                            </div>
                                        </div>

                                        <div className="text-center bg-gray-50 p-1.5 rounded border border-gray-100 mx-auto w-3/4">
                                            <p className="text-[8px] text-gray-400 uppercase font-bold tracking-[0.2em] mb-0.5">Folio Digital de Autenticidad</p>
                                            <p className="font-mono font-bold text-[#D90F74] text-[10px] tracking-wider break-all leading-tight">{showCertificate.folio}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-100 border-t flex justify-end gap-3">
                                <button onClick={() => setShowCertificate(null)} className="px-4 py-2 text-gray-600 font-medium">Cerrar</button>
                                <button onClick={downloadCertificate} className="px-6 py-2 bg-[#D90F74] hover:bg-[#b00c5e] text-white font-bold rounded shadow-lg flex items-center gap-2">
                                    <Download size={18} /> Descargar Imagen
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Elections;
