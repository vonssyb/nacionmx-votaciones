import React from 'react';
import { ShieldAlert, Ban, Eye, FileWarning, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';

const Rules = () => {
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
            <Navbar />
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
                <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-8 mb-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 bg-red-500 text-white text-xs font-bold px-4 py-2 transform rotate-45">
                        DELITO GRAVE
                    </div>
                    <div className="flex items-start gap-6">
                        <div className="bg-red-500/20 p-4 rounded-full hidden sm:block">
                            <Ban className="text-red-500 w-12 h-12" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                <span className="sm:hidden"><Ban className="text-red-500 w-6 h-6 inline" /></span>
                                Compra y Coacción del Voto
                            </h2>
                            <p className="text-gray-300 mb-4">
                                El voto es personal, libre y secreto. <strong>Está terminantemente prohibido</strong> aceptar dinero, bienes, favores o privilegios a cambio de tu voto.
                            </p>
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-red-500/20">
                                <h3 className="font-bold text-red-400 mb-2">¿Qué se considera delito?</h3>
                                <ul className="space-y-2 text-sm text-gray-400">
                                    <li className="flex items-start gap-2">
                                        <ShieldAlert size={16} className="mt-1 flex-shrink-0" />
                                        Ofrecer o recibir dinero (IC o OOC) por un voto.
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ShieldAlert size={16} className="mt-1 flex-shrink-0" />
                                        Amenazar con expulsiones o sanciones si no se vota por cierto candidato.
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ShieldAlert size={16} className="mt-1 flex-shrink-0" />
                                        Pedir capturas de pantalla del voto como "prueba".
                                    </li>
                                </ul>
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
