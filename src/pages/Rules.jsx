import React from 'react';
import { ShieldAlert, Ban, Eye, FileWarning, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Rules = () => {
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
                        <button className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-full font-bold transition-colors">
                            Contactar Admin
                        </button>
                        <Link to="/" className="text-[#D90F74] hover:text-[#b00c5e] px-6 py-2 font-bold flex items-center">
                            Volver al Inicio
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Rules;
