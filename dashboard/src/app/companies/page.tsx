'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import { Building2, Users, DollarSign } from 'lucide-react'

interface Company {
    id: string
    name: string
    owner_id: string
    balance: number
    created_at: string
    active: boolean
}

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchCompanies()
    }, [])

    async function fetchCompanies() {
        try {
            setLoading(true)

            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('balance', { ascending: false })

            if (error) throw error

            setCompanies(data || [])
        } catch (error) {
            console.error('Error fetching companies:', error)
        } finally {
            setLoading(false)
        }
    }

    const activeCompanies = companies.filter(c => c.active)
    const totalBalance = companies.reduce((sum, c) => sum + (c.balance || 0), 0)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Empresas</h1>
                <p className="text-gray-400">Gestión de empresas registradas en el sistema</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Total Empresas</p>
                            <p className="text-3xl font-bold text-white mt-2">{companies.length}</p>
                        </div>
                        <Building2 className="h-12 w-12 text-yellow-500 opacity-50" />
                    </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Activas</p>
                            <p className="text-3xl font-bold text-green-400 mt-2">{activeCompanies.length}</p>
                        </div>
                        <Users className="h-12 w-12 text-green-500 opacity-50" />
                    </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Balance Total</p>
                            <p className="text-3xl font-bold text-white mt-2">{formatMoney(totalBalance)}</p>
                        </div>
                        <DollarSign className="h-12 w-12 text-yellow-500 opacity-50" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Empresa</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Propietario</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Balance</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Creada</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                                        Cargando...
                                    </td>
                                </tr>
                            ) : companies.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                                        No se encontraron empresas
                                    </td>
                                </tr>
                            ) : (
                                companies.map((company) => (
                                    <tr key={company.id} className="hover:bg-gray-750 transition">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-5 w-5 text-yellow-500" />
                                                <span className="text-sm font-medium text-white">{company.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">
                                            {company.owner_id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                            {formatMoney(company.balance || 0)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${company.active
                                                    ? 'bg-green-900 text-green-300'
                                                    : 'bg-red-900 text-red-300'
                                                }`}>
                                                {company.active ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                            {new Date(company.created_at).toLocaleDateString('es-MX', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
