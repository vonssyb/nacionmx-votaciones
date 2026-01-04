"use client";

import useAuth from "@/utils/useAuth";
import { Shield, LogOut } from "lucide-react";
import { useEffect } from "react";

export default function LogoutPage() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut({
      callbackUrl: "/",
      redirect: true,
    });
  };

  useEffect(() => {
    // Auto sign out after 2 seconds if user doesn't click
    const timer = setTimeout(() => {
      handleSignOut();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0F172A] to-black relative overflow-hidden font-inter flex items-center justify-center p-4">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,215,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,215,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-xl shadow-[#FFD700]/30">
              <Shield className="w-9 h-9 text-black" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Nación MX</h1>
        </div>

        {/* Logout Card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-20 h-20 rounded-full bg-[#DC143C]/10 border border-[#DC143C]/30 flex items-center justify-center mx-auto mb-6">
            <LogOut className="w-10 h-10 text-[#DC143C]" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">Cerrar Sesión</h2>
          <p className="text-gray-400 mb-8">
            ¿Estás seguro que deseas salir del sistema?
          </p>

          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full bg-gradient-to-r from-[#DC143C] to-[#FF6B6B] text-white font-bold rounded-xl px-4 py-3 hover:shadow-lg hover:shadow-[#DC143C]/50 transition-all duration-300"
            >
              Sí, Cerrar Sesión
            </button>

            <a
              href="/"
              className="block w-full border border-white/20 text-white font-semibold rounded-xl px-4 py-3 hover:border-[#FFD700] hover:text-[#FFD700] transition-all duration-300"
            >
              Cancelar
            </a>
          </div>

          <p className="text-xs text-gray-500 mt-6">
            Cerrando sesión automáticamente en 3 segundos...
          </p>
        </div>
      </div>
    </div>
  );
}
