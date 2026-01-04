import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Shield,
    Lock,
    Award,
    ChevronRight,
    Users,
    TrendingUp,
    CheckCircle2,
} from "lucide-react";
import { supabase } from "../services/supabase";

export default function LandingPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalApplications: 1250,
        activeStaff: 47,
        approvalRate: 12,
    });

    useEffect(() => {
        // 1. Auth Check
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user || null);
            setLoading(false);
        };
        checkUser();

        // 2. Real Stats (Optional - using placeholders for now to ensure speed)
        // You can implement real counts here if needed
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0F172A] to-black relative overflow-hidden font-inter">
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,215,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,215,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>

            {/* Glow Effects */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FFD700]/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#DC143C]/10 rounded-full blur-[120px] animate-pulse delay-700"></div>

            {/* Navbar */}
            <nav className="relative z-50 px-6 py-4">
                <div className="max-w-7xl mx-auto">
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-6 py-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            {/* Logo */}
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-lg shadow-[#FFD700]/20">
                                    <Shield className="w-7 h-7 text-black" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">Nación MX</h1>
                                    <p className="text-xs text-gray-400">Portal Elite</p>
                                </div>
                            </div>

                            {/* Nav Links */}
                            <div className="hidden md:flex items-center gap-8">
                                <Link
                                    to="/"
                                    className="text-gray-300 hover:text-[#FFD700] transition-all duration-300 relative group"
                                >
                                    Inicio
                                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#FFD700] group-hover:w-full transition-all duration-300"></span>
                                </Link>
                                <Link
                                    to="/aplicar"
                                    className="text-gray-300 hover:text-[#FFD700] transition-all duration-300 relative group"
                                >
                                    Aplicar
                                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#FFD700] group-hover:w-full transition-all duration-300"></span>
                                </Link>
                                <Link
                                    to="/dashboard"
                                    className="text-gray-300 hover:text-[#FFD700] transition-all duration-300 relative group"
                                >
                                    Dashboard
                                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#FFD700] group-hover:w-full transition-all duration-300"></span>
                                </Link>
                            </div>

                            {/* User Status */}
                            {loading ? (
                                <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse"></div>
                            ) : user ? (
                                <div className="flex items-center gap-3">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-sm font-medium text-white">
                                            {user.user_metadata?.full_name || user.email}
                                        </p>
                                        <p className="text-xs text-[#FFD700]">Sesión Activa</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-lg">
                                        <span className="text-black font-bold text-sm">
                                            {(user.user_metadata?.full_name || user.email || "U").charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <Link
                                    to="/login"
                                    className="px-6 py-2.5 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-[#FFD700]/50 transition-all duration-300"
                                >
                                    Iniciar Sesión
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
                <div className="text-center mb-16">
                    <div className="inline-block mb-4">
                        <div className="px-4 py-2 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-full text-[#FFD700] text-sm font-medium backdrop-blur-sm">
                            🔒 Sistema de Reclutamiento Avanzado
                        </div>
                    </div>

                    <h1 className="text-6xl md:text-7xl font-black text-white mb-6 tracking-tight">
                        Nación MX
                        <span className="block mt-2 bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700] text-transparent bg-clip-text">
                            Portal de Reclutamiento
                        </span>
                    </h1>

                    <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                        Únete a la élite. Protege el orden. Sirve a la nación.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Link
                            to={user ? "/aplicar" : "/login"}
                            className="group relative px-8 py-4 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-bold rounded-xl overflow-hidden shadow-xl shadow-[#FFD700]/30 hover:shadow-2xl hover:shadow-[#FFD700]/50 transition-all duration-300"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <span className="relative flex items-center gap-2">
                                {user ? "Enviar Aplicación" : "Iniciar con Discord"}
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </Link>

                        <a
                            href="#features"
                            className="px-8 py-4 border border-white/20 text-white font-semibold rounded-xl hover:border-[#FFD700] hover:text-[#FFD700] transition-all duration-300 backdrop-blur-sm"
                        >
                            Conocer Más
                        </a>
                    </div>
                </div>

                {/* Feature Cards */}
                <div id="features" className="grid md:grid-cols-3 gap-6 mb-16">
                    {[
                        {
                            icon: Shield,
                            title: "Seguridad Avanzada",
                            description:
                                "Sistema de verificación multicapa con integración Roblox y Discord",
                            color: "from-[#FFD700] to-[#FFA500]",
                        },
                        {
                            icon: Lock,
                            title: "Proceso Transparente",
                            description:
                                "Seguimiento en tiempo real del estado de tu aplicación",
                            color: "from-[#DC143C] to-[#FF6B6B]",
                        },
                        {
                            icon: Award,
                            title: "Rangos Exclusivos",
                            description:
                                "Acceso a posiciones de élite en la comunidad más prestigiosa",
                            color: "from-[#4F46E5] to-[#7C3AED]",
                        },
                    ].map((feature, idx) => (
                        <div
                            key={idx}
                            className="group relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
                        >
                            <div
                                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}
                            >
                                <feature.icon className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">
                                {feature.title}
                            </h3>
                            <p className="text-gray-400">{feature.description}</p>

                            {/* Hover Glow */}
                            <div
                                className="absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
                                style={{
                                    background: `linear-gradient(135deg, ${feature.color.includes("FFD700") ? "#FFD700" : feature.color.includes("DC143C") ? "#DC143C" : "#4F46E5"}, transparent)`,
                                }}
                            ></div>
                        </div>
                    ))}
                </div>

                {/* Stats Section */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 mb-16">
                    <h2 className="text-3xl font-bold text-white mb-8 text-center">
                        Estadísticas en <span className="text-[#FFD700]">Tiempo Real</span>
                    </h2>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-black" />
                            </div>
                            <div className="text-4xl font-black text-white mb-2">
                                {stats.totalApplications}
                            </div>
                            <div className="text-gray-400">Aplicaciones Totales</div>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-white" />
                            </div>
                            <div className="text-4xl font-black text-white mb-2">
                                {stats.activeStaff}
                            </div>
                            <div className="text-gray-400">Staff Activo</div>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#DC143C] to-[#FF6B6B] flex items-center justify-center mx-auto mb-4">
                                <TrendingUp className="w-8 h-8 text-white" />
                            </div>
                            <div className="text-4xl font-black text-white mb-2">
                                {stats.approvalRate}%
                            </div>
                            <div className="text-gray-400">Tasa de Aprobación</div>
                        </div>
                    </div>
                </div>

                {/* Process Timeline */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8">
                    <h2 className="text-3xl font-bold text-white mb-8 text-center">
                        Proceso de <span className="text-[#FFD700]">Aplicación</span>
                    </h2>

                    <div className="grid md:grid-cols-4 gap-6">
                        {[
                            {
                                step: "01",
                                title: "Registro",
                                desc: "Crea tu cuenta con Discord",
                            },
                            {
                                step: "02",
                                title: "Aplicación",
                                desc: "Completa el formulario de 10 pasos",
                            },
                            {
                                step: "03",
                                title: "Revisión",
                                desc: "El equipo evalúa tu perfil",
                            },
                            {
                                step: "04",
                                title: "Aprobación",
                                desc: "Bienvenido al equipo elite",
                            },
                        ].map((item, idx) => (
                            <div key={idx} className="relative">
                                <div className="text-6xl font-black text-white/5 mb-2">
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">
                                    {item.title}
                                </h3>
                                <p className="text-gray-400 text-sm">{item.desc}</p>

                                {idx < 3 && (
                                    <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-[#FFD700]/50 to-transparent"></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 border-t border-white/10 mt-20">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-gray-400 text-sm">
                            © 2026 Nación MX. Todos los derechos reservados.
                        </p>
                        <div className="flex gap-6">
                            <a
                                href="#"
                                className="text-gray-400 hover:text-[#FFD700] transition-colors"
                                onClick={(e) => e.preventDefault()}
                            >
                                Términos
                            </a>
                            <a
                                href="#"
                                className="text-gray-400 hover:text-[#FFD700] transition-colors"
                                onClick={(e) => e.preventDefault()}
                            >
                                Privacidad
                            </a>
                            <a
                                href="#"
                                className="text-gray-400 hover:text-[#FFD700] transition-colors"
                                onClick={(e) => e.preventDefault()}
                            >
                                Contacto
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
