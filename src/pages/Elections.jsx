import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useDiscordMember } from '../components/auth/RoleGuard';
import { Check, AlertCircle, Vote, User, LogIn } from 'lucide-react';

const Elections = () => {
    const memberData = useDiscordMember();
    // ... (lines 6-54)
} catch (error) {
    console.error('Error fetching election data:', error);
    setMessage({ type: 'error', text: `Error al cargar las votaciones: ${error.message}` });
} finally {
    setLoading(false);
}
    };

const handleVote = async (electionId, candidateId) => {
    // ... (lines 96-103)
    <p className="text-gray-400 mt-2">Elige a tus representantes para construir una mejor Nación.</p>
    {
        !memberData && (
            <div className="mt-6 p-4 bg-gray-800/80 border border-yellow-600/30 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-600/10 rounded-full text-yellow-500">
                        <User size={24} />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">Modo Invitado</h3>
                        <p className="text-gray-400 text-sm">Inicia sesión con Discord para poder emitir tu voto.</p>
                    </div>
                </div>
                <button
                    onClick={() => window.location.hash = '/login'}
                    className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg transition-all shadow-lg shadow-yellow-600/20 flex items-center gap-2 whitespace-nowrap"
                >
                    <LogIn size={20} />
                    Iniciar Sesión
                </button>
            </div>
        )
    }
            </header >

    { message && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 border ${message.type === 'error' ? 'bg-red-900/50 text-red-200 border-red-700' : 'bg-green-900/50 text-green-200 border-green-700'
            }`}>
            {message.type === 'error' ? <AlertCircle size={20} className="shrink-0" /> : <Check size={20} className="shrink-0" />}
            <span>{message.text}</span>
        </div>
    )}

{
    elections.length === 0 ? (
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
)
}
        </div >
    );
};

export default Elections;
