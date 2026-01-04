"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  Shield,
} from "lucide-react";

export default function AdminDashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchApplications();
  }, [filter, search]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.append("status", filter);
      if (search) params.append("search", search);

      const res = await fetch(`/api/applications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewed_by: "Admin",
        }),
      });

      if (res.ok) {
        fetchApplications();
      }
    } catch (error) {
      console.error("Error updating application:", error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: {
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/30",
        text: "text-yellow-500",
        icon: Clock,
        label: "Pendiente",
      },
      reviewing: {
        bg: "bg-blue-500/10",
        border: "border-blue-500/30",
        text: "text-blue-500",
        icon: Eye,
        label: "En Revisión",
      },
      approved: {
        bg: "bg-green-500/10",
        border: "border-green-500/30",
        text: "text-green-500",
        icon: CheckCircle,
        label: "Aprobado",
      },
      rejected: {
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        text: "text-red-500",
        icon: XCircle,
        label: "Rechazado",
      },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${badge.bg} ${badge.border} ${badge.text}`}
      >
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{badge.label}</span>
      </div>
    );
  };

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0F172A] to-black relative overflow-hidden font-inter">
      {/* rest of background effects */}

      {/* Header */}
      <div className="relative z-10 px-6 py-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            {/* rest of header content */}
            <a
              href="/"
              className="px-4 py-2 border border-white/20 rounded-xl text-gray-300 hover:border-[#FFD700] hover:text-[#FFD700] transition-all duration-300"
            >
              Volver al inicio
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {[
            {
              label: "Total",
              value: stats.total,
              icon: Shield,
              color: "from-[#FFD700] to-[#FFA500]",
            },
            {
              label: "Pendientes",
              value: stats.pending,
              icon: Clock,
              color: "from-yellow-500 to-yellow-600",
            },
            {
              label: "Aprobados",
              value: stats.approved,
              icon: CheckCircle,
              color: "from-green-500 to-green-600",
            },
            {
              label: "Rechazados",
              value: stats.rejected,
              icon: XCircle,
              color: "from-red-500 to-red-600",
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}
              >
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-black text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/20 outline-none transition-all duration-300"
              />
            </div>

            <div className="flex gap-2">
              {["all", "pending", "reviewing", "approved", "rejected"].map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                      filter === f
                        ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black"
                        : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    {f === "all"
                      ? "Todos"
                      : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Applications Table */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-[#FFD700]/20 border-t-[#FFD700] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Cargando aplicaciones...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No se encontraron aplicaciones</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/10">
                  <tr className="text-left">
                    <th className="px-6 py-4 text-sm font-semibold text-gray-300">
                      Candidato
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-300">
                      Roblox
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-300">
                      Rango
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-300">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-300">
                      Fecha
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-300">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr
                      key={app.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-white font-medium">
                            {app.nombre_completo}
                          </p>
                          <p className="text-sm text-gray-400">{app.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white font-mono text-sm">
                          {app.roblox_username}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white">{app.rango_deseado}</p>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(app.status)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-400 text-sm">
                          {new Date(app.created_at).toLocaleDateString("es-MX")}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {app.status === "pending" && (
                            <>
                              <button
                                onClick={() =>
                                  updateApplicationStatus(app.id, "approved")
                                }
                                className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500 hover:bg-green-500/20 transition-all"
                                title="Aprobar"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  updateApplicationStatus(app.id, "rejected")
                                }
                                className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 transition-all"
                                title="Rechazar"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
