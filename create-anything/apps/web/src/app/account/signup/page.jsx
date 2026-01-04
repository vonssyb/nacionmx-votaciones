"use client";

import { useState } from "react";
import useAuth from "@/utils/useAuth";
import { Shield, Lock, Mail, AlertCircle, User } from "lucide-react";

export default function SignUpPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const { signUpWithCredentials } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password || !name) {
      setError("Por favor completa todos los campos");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setLoading(false);
      return;
    }

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const callbackUrl = urlParams.get("callbackUrl") || "/";

      await signUpWithCredentials({
        email,
        password,
        name,
        callbackUrl,
        redirect: true,
      });
    } catch (err) {
      setError("Este email ya está registrado o hubo un error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0F172A] to-black relative overflow-hidden font-inter flex items-center justify-center p-4">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,215,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,215,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      {/* Glow Effects */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#FFD700]/10 rounded-full blur-[120px] animate-pulse"></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-xl shadow-[#FFD700]/30">
              <Shield className="w-9 h-9 text-black" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Nación MX</h1>
          <p className="text-gray-400">Crear Cuenta Elite</p>
        </div>

        {/* Form */}
        <form
          onSubmit={onSubmit}
          className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl"
        >
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Registro
          </h2>

          <div className="space-y-5">
            {/* Name Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Nombre Completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  required
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 outline-none transition-all duration-300 font-mono"
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  required
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 outline-none transition-all duration-300 font-mono"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  required
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 outline-none transition-all duration-300 font-mono"
                />
              </div>
              <p className="text-xs text-gray-500">Mínimo 6 caracteres</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 bg-[#DC143C]/10 border border-[#DC143C]/30 rounded-xl p-3 text-[#DC143C] text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-bold rounded-xl px-4 py-3 hover:shadow-lg hover:shadow-[#FFD700]/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                  Creando cuenta...
                </span>
              ) : (
                "Crear Cuenta"
              )}
            </button>

            {/* Sign In Link */}
            <p className="text-center text-sm text-gray-400">
              ¿Ya tienes una cuenta?{" "}
              <a
                href={`/account/signin${typeof window !== "undefined" ? window.location.search : ""}`}
                className="text-[#FFD700] hover:text-[#FFA500] font-semibold transition-colors"
              >
                Iniciar sesión
              </a>
            </p>
          </div>
        </form>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-gray-400 hover:text-[#FFD700] text-sm transition-colors"
          >
            ← Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
