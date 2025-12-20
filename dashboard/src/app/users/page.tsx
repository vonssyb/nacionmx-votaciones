'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import { Search, CreditCard, Users } from 'lucide-react'

interface User {
    discord_user_id: string
    debit_cards: number
    credit_cards: number
    total_balance: number
    last_activity: string
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        fetchUsers()
    }, [])

    async function fetchUsers() {
        try {
            setLoading(true)

            // Get all debit cards
            const { data: debitCards } = await supabase
                .from('debit_cards')
                .select('discord_user_id, balance, created_at')
                .eq('status', 'active')

            // Get all credit cards  
            const { data: creditCards } = await supabase
                .from('credit_cards')
                .select('discord_user_id, created_at')
                .eq('status', 'active')

            // Aggregate by user
            const userMap = new Map<string, User>()

            debitCards?.forEach(card => {
                if (!userMap.has(card.discord_user_id)) {
                    userMap.set(card.discord_user_id, {
                        discord_user_id: card.discord_user_id,
                        debit_cards: 0,
                        credit_cards: 0,
                        total_balance: 0,
                        last_activity: card.created_at
                    })
                }
                const user = userMap.get(card.discord_user_id)!
                user.debit_cards++
                user.total_balance += card.balance || 0
                if (new Date(card.created_at) > new Date(user.last_activity)) {
                    user.last_activity = card.created_at
                }
            })

            creditCards?.forEach(card => {
                if (!userMap.has(card.discord_user_id)) {
                    userMap.set(card.discord_user_id, {
                        discord_user_id: card.discord_user_id,
                        debit_cards: 0,
                        credit_cards: 0,
                        total_balance: 0,
                        last_activity: card.created_at
                    })
                }
                const user = userMap.get(card.discord_user_id)!
                user.credit_cards++
                if (new Date(card.created_at) > new Date(user.last_activity)) {
                    user.last_activity = card.created_at
                }
            })

            const usersArray = Array.from(userMap.values())
                .sort((a, b) => b.total_balance - a.total_balance)

            setUsers(usersArray)
        } catch (error) {
            console.error('Error fetching users:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredUsers = users.filter(user =>
        user.discord_user_id.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Usuarios</h1>
                <p className="text-gray-400">Gestión de usuarios con tarjetas en el sistema</p>
            </div>

            {/* Search */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Buscar por Discord ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <p className="text-gray-400 text-sm">Total Usuarios</p>
                    <p className="text-2xl font-bold text-white">{users.length.toLocaleString()}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <p className="text-gray-400 text-sm">Total Tarjetas Débito</p>
                    <p className="text-2xl font-bold text-white">
                        {users.reduce((sum, u) => sum + u.debit_cards, 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <p className="text-gray-400 text-sm">Total Tarjetas Crédito</p>
                    <p className="text-2xl font-bold text-white">
                        {users.reduce((sum, u) => sum + u.credit_cards, 0).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Usuario</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tarjetas Débito</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tarjetas Crédito</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Balance Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Última Actividad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                                        Cargando...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-400">
                                        No se encontraron usuarios
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.discord_user_id} className="hover:bg-gray-750 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">
                                            {user.discord_user_id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="h-4 w-4 text-blue-400" />
                                                {user.debit_cards}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="h-4 w-4 text-yellow-400" />
                                                {user.credit_cards}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                            {formatMoney(user.total_balance)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                            {new Date(user.last_activity).toLocaleDateString('es-MX')}
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
