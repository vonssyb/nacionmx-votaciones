import React, { useState } from 'react';
import { ShieldAlert, Ban, Eye, FileWarning, CheckCircle, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';

const Rules = () => {
    const [showReportModal, setShowReportModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [reportData, setReportData] = useState({
        offender_name: '',
        description: '',
        evidence_url: ''
    });

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `evidence_${Date.now()}.${fileExt}`;
            const filePath = `evidence/complaints/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('evidence')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('evidence').getPublicUrl(filePath);
            setReportData({ ...reportData, evidence_url: data.publicUrl });
        } catch (error) {
            console.error('Error uploading evidence:', error);
            alert('Error al subir la imagen. Por favor intenta de nuevo.');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmitReport = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const { error } = await supabase
                .from('electoral_complaints')
                .insert([
                    {
                        offender_name: reportData.offender_name,
                        description: reportData.description,
                        evidence_url: reportData.evidence_url,
                        status: 'pending'
                    }
                ]);

            if (error) throw error;

            alert('Denuncia enviada correctamente. Gracias por proteger la democracia.');
            setShowReportModal(false);
            setReportData({ offender_name: '', description: '', evidence_url: '' });
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Error al enviar el reporte. Intenta nuevamente.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
                        Normativa <span className="text-[#D90F74]">Electoral</span>
                    </h1>
                    <p className="text-xl text-gray-400">
                        Para garantizar elecciones justas, libres y transparentes, establecemos reglas claras que todos los ciudadanos deben respetar.
                    </p>
                </div>

                {/* Main Warning: Vote Buying */}
                {/* Main Warning: Vote Buying */}
                <div className="relative overflow-hidden rounded-2xl bg-gray-800 border border-gray-700 shadow-2xl mb-12 group hover:border-red-500/50 transition-colors duration-300">
                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-red-500 to-red-700"></div>
                    <div className="absolute top-0 right-0 p-4">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-wider">
                            <ShieldAlert size={12} /> Delito Grave
                        </span>
                    </div>

                    <div className="p-8 md:p-10 flex flex-col md:flex-row gap-8 items-start">
                        <div className="flex-shrink-0">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20 transform group-hover:scale-105 transition-transform duration-300">
                                <Ban className="text-white w-8 h-8" strokeWidth={3} />
                            </div>
                        </div>

                        <div className="flex-grow">
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                                Compra y Coacción del Voto
                            </h2>
                            <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                                El voto es personal, libre y secreto. <span className="text-red-400 font-bold">Está terminantemente prohibido</span> aceptar dinero, bienes, favores o privilegios a cambio de tu elección en las urnas.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 hover:border-red-500/30 transition-colors">
                                    <h4 className="flex items-center gap-2 text-white font-bold mb-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        Sobornos (IC / OOC)
                                    </h4>
                                    <p className="text-sm text-gray-400">Ofrecer dinero, rangos o beneficios externos para alterar el voto.</p>
                                </div>
                                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 hover:border-red-500/30 transition-colors">
                                    <h4 className="flex items-center gap-2 text-white font-bold mb-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                        Amenazas
                                    </h4>
                                    <p className="text-sm text-gray-400">Intimidar con expulsiones o castigos si no se vota por alguien.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid of Rules */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                            <Eye className="text-[#D90F74]" /> Transparencia
                        </h3>
                        <p className="text-gray-400 text-sm">
                            Todos los candidatos deben hacer públicas sus propuestas. No se permiten agendas ocultas ni acuerdos secretos que perjudiquen a la comunidad.
                        </p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                            <FileWarning className="text-[#D90F74]" /> Propaganda Limpia
                        </h3>
                        <p className="text-gray-400 text-sm">
                            Está prohibido el spam masivo, el acoso a usuarios o la difusión de noticias falsas (Fake News) sobre otros candidatos.
                        </p>
                    </div>
                </div>

                {/* Sanctions Section */}
                <div className="mb-16">
                    <h2 className="text-3xl font-bold text-white mb-8 text-center">Sanciones</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-800 p-6 rounded-lg text-center border-t-4 border-yellow-500">
                            <h3 className="font-bold text-lg text-white mb-2">Amonestación</h3>
                            <p className="text-gray-400 text-sm">Para infracciones leves o errores administrativos.</p>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg text-center border-t-4 border-orange-500">
                            <h3 className="font-bold text-lg text-white mb-2">Anulación de Votos</h3>
                            <p className="text-gray-400 text-sm">Se eliminarán los votos obtenidos de manera fraudulenta.</p>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg text-center border-t-4 border-red-600">
                            <h3 className="font-bold text-lg text-white mb-2">Expulsión / Veto</h3>
                            <p className="text-gray-400 text-sm">Veto permanente de cargos públicos y posible expulsión de la comunidad.</p>
                        </div>
                    </div>
                </div>

                {/* Call to Action */}
                <div className="bg-[#D90F74]/10 rounded-2xl p-8 text-center border border-[#D90F74]/30">
                    <h2 className="text-2xl font-bold text-white mb-4">¿Fuiste testigo de una infracción?</h2>
                    <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                        Tu denuncia es anónima y segura. Ayúdanos a mantener la integridad de nuestras elecciones.
                    </p>
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => setShowReportModal(true)}
                            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg hover:shadow-red-500/30 flex items-center gap-2 transform hover:scale-105"
                        >
                            <ShieldAlert size={20} /> Denunciar Delito
                        </button>
                        <Link to="/" className="text-gray-400 hover:text-white px-6 py-2 font-medium flex items-center transition-colors">
                            Volver al Inicio
                        </Link>
                    </div>
                </div>

                {/* Report Modal */}
                {showReportModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                                <ShieldAlert className="text-red-500" /> Reportar Infracción
                            </h2>
                            <p className="text-gray-400 text-sm mb-6">
                                Tu reporte ayuda a mantener elecciones justas. Proporciona evidencias claras.
                            </p>

                            <form onSubmit={handleSubmitReport} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Nombre del Infractor (o Partido)</label>
                                    <input
                                        type="text"
                                        required
                                        value={reportData.offender_name}
                                        onChange={(e) => setReportData({ ...reportData, offender_name: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all placeholder-gray-500"
                                        placeholder="Ej. Juan Pérez / Partido Rojo"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Descripción de los Hechos</label>
                                    <textarea
                                        required
                                        rows="4"
                                        value={reportData.description}
                                        onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all placeholder-gray-500"
                                        placeholder="Describe qué sucedió, dónde y cuándo..."
                                    ></textarea>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Evidencia (Captura o URL)</label>

                                    {/* Upload Option */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('evidence-upload').click()}
                                            disabled={uploading}
                                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm border border-gray-600 transition-colors flex items-center gap-2"
                                        >
                                            <Upload size={16} />
                                            {uploading ? 'Subiendo...' : 'Subir Imagen'}
                                        </button>
                                        <input
                                            id="evidence-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageUpload}
                                        />
                                        <span className="text-gray-500 text-xs">o pega un enlace abajo</span>
                                    </div>

                                    <input
                                        type="url"
                                        value={reportData.evidence_url}
                                        onChange={(e) => setReportData({ ...reportData, evidence_url: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all text-sm placeholder-gray-600"
                                        placeholder="https://imgur.com/..."
                                    />
                                    {reportData.evidence_url && (
                                        <div className="mt-2 text-xs text-green-500 flex items-center gap-1">
                                            <CheckCircle size={12} /> Evidencia adjuntada
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className={`w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-900/20 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {submitting ? 'Enviando Reporte...' : 'Enviar Denuncia Anónima'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Rules;
