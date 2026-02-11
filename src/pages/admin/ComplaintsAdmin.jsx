import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { ShieldAlert, CheckCircle, XCircle, ExternalLink, Calendar, Search, Filter } from 'lucide-react';

const ComplaintsAdmin = () => {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, pending, reviewed

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('electoral_complaints')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setComplaints(data || []);
        } catch (error) {
            console.error('Error fetching complaints:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id, newStatus) => {
        try {
            const { error } = await supabase
                .from('electoral_complaints')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            fetchComplaints(); // Refresh list
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error updating status');
        }
    };

    const filteredComplaints = complaints.filter(c =>
        filter === 'all' ? true : c.status === filter
    );

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending':
                return <span className="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded text-xs font-bold uppercase border border-yellow-500/30">Pendiente</span>;
            case 'reviewed':
                return <span className="bg-blue-500/20 text-blue-500 px-2 py-1 rounded text-xs font-bold uppercase border border-blue-500/30">Revisado</span>;
            case 'dismissed':
                return <span className="bg-gray-500/20 text-gray-500 px-2 py-1 rounded text-xs font-bold uppercase border border-gray-500/30">Desestimado</span>;
            case 'resolved':
                return <span className="bg-green-500/20 text-green-500 px-2 py-1 rounded text-xs font-bold uppercase border border-green-500/30">Resuelto</span>;
            default:
                return status;
        }
    };

    return (
        <div className="text-gray-100 font-inter animate-fade-in">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                            <ShieldAlert className="text-red-500" /> Panel de Denuncias
                        </h1>
                        <p className="text-gray-400">Gestiona y revisa los reportes de infracciones electorales.</p>
                    </div>

                    {/* Filters */}
                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'all' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setFilter('pending')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-yellow-500/20 text-yellow-500 shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            Pendientes
                        </button>
                        <button
                            onClick={() => setFilter('reviewed')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'reviewed' ? 'bg-blue-500/20 text-blue-500 shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            Revisadas
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {filteredComplaints.length === 0 ? (
                            <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                                <CheckCircle className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                                <h3 className="text-lg font-medium text-white">No hay denuncias</h3>
                                <p className="text-gray-400">No se encontraron denuncias con el filtro seleccionado.</p>
                            </div>
                        ) : (
                            filteredComplaints.map((complaint) => (
                                <div key={complaint.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors">
                                    <div className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(complaint.status)}
                                                <span className="text-gray-500 text-sm flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {new Date(complaint.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                {complaint.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => updateStatus(complaint.id, 'reviewed')}
                                                            className="text-blue-400 hover:text-blue-300 text-sm font-medium px-3 py-1 bg-blue-400/10 rounded-lg border border-blue-400/20 transition-colors"
                                                        >
                                                            Marcar Revisado
                                                        </button>
                                                        <button
                                                            onClick={() => updateStatus(complaint.id, 'dismissed')}
                                                            className="text-gray-400 hover:text-gray-300 text-sm font-medium px-3 py-1 bg-gray-700 rounded-lg border border-gray-600 transition-colors"
                                                        >
                                                            Desestimar
                                                        </button>
                                                    </>
                                                )}
                                                {complaint.status === 'reviewed' && (
                                                    <button
                                                        onClick={() => updateStatus(complaint.id, 'resolved')}
                                                        className="text-green-400 hover:text-green-300 text-sm font-medium px-3 py-1 bg-green-400/10 rounded-lg border border-green-400/20 transition-colors"
                                                    >
                                                        Resolver
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="md:col-span-2">
                                                <h3 className="text-lg font-bold text-white mb-1">
                                                    <span className="text-gray-400 font-normal text-sm uppercase tracking-wider block mb-1">Infractor / Partido</span>
                                                    {complaint.offender_name}
                                                </h3>

                                                <div className="mt-4">
                                                    <span className="text-gray-400 font-normal text-sm uppercase tracking-wider block mb-2">Descripción de los Hechos</span>
                                                    <p className="text-gray-300 bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 text-sm leading-relaxed whitespace-pre-wrap">
                                                        {complaint.description}
                                                    </p>
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-gray-400 font-normal text-sm uppercase tracking-wider block mb-2">Evidencia</span>
                                                {complaint.evidence_url ? (
                                                    <a
                                                        href={complaint.evidence_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="group block relative rounded-lg overflow-hidden border border-gray-700 bg-gray-900"
                                                    >
                                                        <img
                                                            src={complaint.evidence_url}
                                                            alt="Evidencia"
                                                            className="w-full h-40 object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <ExternalLink className="text-white" />
                                                        </div>
                                                    </a>
                                                ) : (
                                                    <div className="h-40 bg-gray-900/50 rounded-lg border border-gray-700/50 flex items-center justify-center text-gray-500 text-sm italic">
                                                        Sin evidencia adjunta
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComplaintsAdmin;
