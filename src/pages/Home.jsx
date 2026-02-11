import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, User, ChevronRight, CheckCircle, HelpCircle } from 'lucide-react';

const Home = () => {
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">


            {/* Hero Section */}
            <header className="relative py-20 lg:py-32 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png')] bg-center bg-no-repeat opacity-5 blur-3xl scale-150 animate-pulse"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png" alt="INE Logo" className="h-32 w-auto mx-auto mb-8 animate-fade-in" />
                    <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-4 animate-slide-up">
                        Instituto Nacional Electoral <span className="text-[#D90F74]">NaciónMX</span>
                    </h1>
                    <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-400 animate-slide-up animation-delay-200">
                        Garantizando la democracia, transparencia y la participación ciudadana en cada elección.
                    </p>
                    <div className="mt-10 animate-slide-up animation-delay-400">
                        <Link to="/votaciones" className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-bold rounded-full shadow-lg text-white bg-[#D90F74] hover:bg-[#b00c5e] transition-all transform hover:scale-105 hover:shadow-[#D90F74]/50">
                            Ir a las Urnas <ChevronRight className="ml-2" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Live Stats Section */}
            <section className="bg-gray-800 border-y border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-gray-700">
                        <div>
                            <p className="text-3xl font-bold text-white">2026</p>
                            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Proceso Electoral</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-[#D90F74]">3</p>
                            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Elecciones Activas</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-white">24/7</p>
                            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Monitoreo</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-[#D90F74]">98%</p>
                            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Participación</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features / Information Grid */}
            <main className="flex-grow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                        {/* Card 1: Rules */}
                        <Link to="/reglas" className="block">
                            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 hover:border-[#D90F74]/50 transition-all hover:bg-gray-800/80 group h-full cursor-pointer relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="text-[#D90F74]" />
                                </div>
                                <div className="w-12 h-12 bg-[#D90F74]/20 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <FileText className="text-[#D90F74]" size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-4">Reglas Electorales</h3>
                                <p className="text-gray-400 mb-4">Conoce los lineamientos y normativas que rigen nuestros procesos democráticos para asegurar elecciones justas.</p>
                                <ul className="text-sm text-gray-500 space-y-2">
                                    <li className="flex items-center"><CheckCircle size={14} className="mr-2 text-green-500" /> Voto libre y secreto</li>
                                    <li className="flex items-center"><CheckCircle size={14} className="mr-2 text-green-500" /> Un voto por ciudadano</li>
                                    <li className="flex items-center"><CheckCircle size={14} className="mr-2 text-green-500" /> Transparencia total</li>
                                </ul>
                            </div>
                        </Link>

                        {/* Card 2: Presidency */}
                        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 hover:border-[#D90F74]/50 transition-all hover:bg-gray-800/80 group">
                            <div className="w-12 h-12 bg-[#D90F74]/20 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <User className="text-[#D90F74]" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">Presidencia del INE</h3>
                            <p className="text-gray-400 mb-4">Liderazgo comprometido con la imparcialidad y el fortalecimiento de nuestras instituciones democráticas.</p>
                            <div className="flex items-center gap-4 mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
                                <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden">
                                    <img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/candidates/vonssyb.png" alt="Presidente del INE" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">Consejero Presidente</p>
                                    <p className="text-[#D90F74] text-xs">Instituto Nacional Electoral</p>
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Help/FAQ */}
                        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 hover:border-[#D90F74]/50 transition-all hover:bg-gray-800/80 group">
                            <div className="w-12 h-12 bg-[#D90F74]/20 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <HelpCircle className="text-[#D90F74]" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">¿Cómo Votar?</h3>
                            <p className="text-gray-400 mb-4">Participar es sencillo. Solo necesitas tu cuenta verificada y seguir estos pasos:</p>
                            <ol className="list-decimal list-inside text-sm text-gray-500 space-y-2">
                                <li>Inicia sesión con Discord.</li>
                                <li>Dirígete a la sección de <Link to="/votaciones" className="text-[#D90F74] hover:underline">Votaciones</Link>.</li>
                                <li>Selecciona tus candidatos.</li>
                                <li>Confirma tu voto.</li>
                            </ol>
                        </div>

                    </div>

                    {/* News Section */}
                    <div className="mt-20">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-bold text-white border-l-4 border-[#D90F74] pl-4">Noticias Recientes</h2>
                            <button className="text-sm text-[#D90F74] hover:text-white transition-colors uppercase font-bold tracking-wider">Ver todas</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <article className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-600 transition-all">
                                <div className="h-48 bg-gray-700 relative">
                                    <div className="absolute top-4 left-4 bg-[#D90F74] text-white text-xs font-bold px-2 py-1 rounded">COMUNICADO</div>
                                    <img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png" className="w-full h-full object-cover opacity-50" alt="News" />
                                </div>
                                <div className="p-6">
                                    <p className="text-gray-400 text-sm mb-2">10 de Febrero, 2026</p>
                                    <h3 className="text-xl font-bold text-white mb-2">Inicia el Proceso Electoral 2026</h3>
                                    <p className="text-gray-400 line-clamp-2">El Consejo General del INE declara formalmente el inicio de las actividades para la elección de cargos federales.</p>
                                    <button className="mt-4 text-[#D90F74] hover:text-white text-sm font-bold flex items-center">Leer más <ChevronRight className="ml-1" size={16} /></button>
                                </div>
                            </article>
                            <article className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-600 transition-all">
                                <div className="h-48 bg-gray-700 relative">
                                    <div className="absolute top-4 left-4 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">TECNOLOGÍA</div>
                                    <img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png" className="w-full h-full object-cover opacity-50" alt="News" />
                                </div>
                                <div className="p-6">
                                    <p className="text-gray-400 text-sm mb-2">08 de Febrero, 2026</p>
                                    <h3 className="text-xl font-bold text-white mb-2">Nuevo Sistema de Votación Digital</h3>
                                    <p className="text-gray-400 line-clamp-2">NaciónMX implementa moderna plataforma de voto electrónico garantizando seguridad y transparencia mediante tecnología blockchain.</p>
                                    <button className="mt-4 text-[#D90F74] hover:text-white text-sm font-bold flex items-center">Leer más <ChevronRight className="ml-1" size={16} /></button>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-gray-900 border-t border-gray-800 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png" alt="INE Logo" className="h-8 w-auto grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all" />
                        <span className="text-gray-500 text-sm">© 2026 INE NaciónMX. Todos los derechos reservados.</span>
                    </div>
                    <div className="flex gap-6 text-gray-500 text-sm">
                        <a href="#" className="hover:text-[#D90F74] transition-colors">Aviso de Privacidad</a>
                        <a href="#" className="hover:text-[#D90F74] transition-colors">Términos y Condiciones</a>
                        <a href="#" className="hover:text-[#D90F74] transition-colors">Contacto</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Home;
