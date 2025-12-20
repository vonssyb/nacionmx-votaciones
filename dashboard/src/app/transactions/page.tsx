'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import { Search, Filter, Download } from 'lucide-react'

interface Transaction {
    id: string
    discord_user_id: string
    amount: number
    type: string
    status: string
    created_at: string
    card_id: string
}

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const pageSize = 50

    useEffect(() => {
        fetchTransactions()
    }, [page, filter])

    async function fetchTransactions() {
        try {
            setLoading(true)

            let query = supabase
                .from('transaction_logs')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range((page - 1) * pageSize, page * pageSize - 1)

            if (filter !== 'all') {
                query = query.eq('status', filter)
            }

            if (search) {
                query = query.or(`discord_user_id.ilike.%${search}%,type.ilike.%${search}%`)
            }

            const { data, count, error } = await query

            if (error) throw error

            setTransactions(data || [])
            setTotal(count || 0)
        } catch (error) {
            console.error('Error fetching transactions:', error)
        } finally {
            setLoading(false)
        }
    }

    const totalPages = Math.ceil(total / pageSize)

    function exportToCSV() {
        const headers = ['ID', 'Usuario', 'Monto', 'Tipo', 'Estado', 'Fecha']
        const rows = transactions.map(t => [
            t.id,
            t.discord_user_id,
            t.amount,
            t.type,
            t.status,
            new Date(t.created_at).toLocaleString()
        ])

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Transacciones</h1>
                <p className="text-gray-400">Historial completo de transacciones del sistema</p>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700">
                <div className="flex flex-wrap gap-4 items-center">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                            <input
                                type="text"
                                placeholder="Buscar por usuario o tipo..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchTransactions()}
                                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                        </div>
                    </div>

                    {/* Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="text-gray-400 h-5 w-5" />
                        <select
                            value={filter}
                            onChange={(e) => { setFilter(e.target.value); setPage(1) }}
                            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        >
                            <option value="all">Todos</option>
                            <option value="SUCCESS">Exitosas</option>
                            <option value="FAILED">Fallidas</option>
                            <option value="PENDING">Pendientes</option>
                        </select>
                    </div>

                    {/* Export */}
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-400 transition font-medium"
                    >
                        <Download className="h-5 w-5" />
                        Exportar CSV
                    </button>

                    {/* Search Button */}
                    <button
                        onClick={fetchTransactions}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition font-medium"
                    >
                        Buscar
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <p className="text-gray-400 text-sm">Total</p>
                    <p className="text-2xl font-bold text-white">{total.toLocaleString()}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <p className="text-gray-400 text-sm">Página</p>
                    <p className="text-2xl font-bold text-white">{page} / {totalPages}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <p className="text-gray-400 text-sm">Mostrando</p>
                    <p className="text-2xl font-bold text-white">{transactions.length}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <p className="text-gray-400 text-sm">Estado</p>
                    <p className="text-2xl font-bold text-white">{filter === 'all' ? 'Todos' : filter}</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Usuario</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Monto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                                        Cargando...
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                                        No se encontraron transacciones
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-gray-750 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            @{tx.discord_user_id.substring(0, 8)}...
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                            {formatMoney(tx.amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            {tx.type}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.status === 'SUCCESS' ? 'bg-green-900 text-green-300' :
                                                    tx.status === 'FAILED' ? 'bg-red-900 text-red-300' :
                                                        'bg-yellow-900 text-yellow-300'
                                                }`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                            {new Date(tx.created_at).toLocaleDateString('es-MX', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    ← Anterior
                </button>
                <span className="text-gray-400">
                    Página {page} de {totalPages}
                </span>
                <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Siguiente →
                </button>
            </div>
        </div>
    )
}
