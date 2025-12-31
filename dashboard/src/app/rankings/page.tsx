'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trophy, TrendingUp, TrendingDown, Medal, User } from 'lucide-react'

type RankingType = 'wealth' | 'level' | 'debt'

interface RankingItem {
    id: string
    discord_user_id: string
    name?: string // Optional if we don't have username mapping yet
    value: number
    secondary?: string
}

export default function RankingsPage() {
    const [activeTab, setActiveTab] = useState<RankingType>('wealth')
    const [data, setData] = useState<RankingItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchRanking(activeTab)
    }, [activeTab])

    async function fetchRanking(type: RankingType) {
        setLoading(true)
        try {
            let result = []

            if (type === 'wealth') {
                const { data: cards, error } = await supabase
                    .from('debit_cards')
                    .select('discord_user_id, balance, card_type')
                    .order('balance', { ascending: false })
                    .limit(50)

                if (!error && cards) {
                    result = cards.map(c => ({
                        id: c.discord_user_id, // using user id as key
                        discord_user_id: c.discord_user_id,
                        value: c.balance,
                        secondary: c.card_type
                    }))
                }
            } else if (type === 'level') {
                const { data: stats, error } = await supabase
                    .from('user_stats')
                    .select('discord_user_id, level, xp')
                    .order('level', { ascending: false })
                    .order('xp', { ascending: false })
                    .limit(50)

                if (!error && stats) {
                    result = stats.map(s => ({
                        id: s.discord_user_id,
                        discord_user_id: s.discord_user_id,
                        value: s.level,
                        secondary: `${s.xp.toLocaleString()} XP`
                    }))
                }
            } else if (type === 'debt') {
                const { data: debts, error } = await supabase
                    .from('credit_cards')
                    .select('discord_user_id, current_balance, start_card_name')
                    .order('current_balance', { ascending: false })
                    .limit(50)

                if (!error && debts) {
                    result = debts.map(d => ({
                        id: d.discord_user_id,
                        discord_user_id: d.discord_user_id,
                        value: d.current_balance,
                        secondary: d.start_card_name
                    }))
                }
            }

            setData(result)
        } catch (error) {
            console.error('Error fetching rankings:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Trophy className="text-yellow-500" /> Rankings Globales
                    </h1>
                    <p className="text-gray-400">Top 50 usuarios por categoría</p>
                </div>

                <div className="flex space-x-2 bg-gray-800 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('wealth')}
                        className={`px-4 py-2 rounded-md flex items-center gap-2 transition ${activeTab === 'wealth' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        <TrendingUp size={16} /> Ricos
                    </button>
                    <button
                        onClick={() => setActiveTab('level')}
                        className={`px-4 py-2 rounded-md flex items-center gap-2 transition ${activeTab === 'level' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Medal size={16} /> Niveles
                    </button>
                    <button
                        onClick={() => setActiveTab('debt')}
                        className={`px-4 py-2 rounded-md flex items-center gap-2 transition ${activeTab === 'debt' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        <TrendingDown size={16} /> Morosos
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-700">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-900/50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">#</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Usuario</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    {activeTab === 'wealth' ? 'Saldo Banco' : activeTab === 'level' ? 'Nivel' : 'Deuda Total'}
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    {activeTab === 'wealth' ? 'Tarjeta' : activeTab === 'level' ? 'Experiencia' : 'Tarjeta'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400 animate-pulse">
                                        Cargando datos...
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                                        No hay datos disponibles.
                                    </td>
                                </tr>
                            ) : (
                                data.map((item, index) => {
                                    let rankColor = 'text-gray-300'
                                    let icon = null
                                    if (index === 0) { rankColor = 'text-yellow-400 font-bold'; icon = '👑' }
                                    else if (index === 1) { rankColor = 'text-gray-300 font-bold'; icon = '🥈' }
                                    else if (index === 2) { rankColor = 'text-amber-600 font-bold'; icon = '🥉' }

                                    return (
                                        <tr key={index} className="hover:bg-gray-750 transition">
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${rankColor}`}>
                                                {icon || `#${index + 1}`}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                                                        <User size={16} className="text-gray-400" />
                                                    </div>
                                                    <div className="text-sm font-medium text-white">
                                                        {item.discord_user_id}
                                                    </div>
                                                    {/* In a real app, we'd fetch usernames via API or store them */}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                                {activeTab === 'level'
                                                    ? `Nivel ${item.value}`
                                                    : `$${item.value.toLocaleString()}`}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                                {item.secondary}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
