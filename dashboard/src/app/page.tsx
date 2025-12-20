'use client'

import { use, useEffect, useState } from 'react'
import StatCard from '@/components/StatCard'
import { Users, CreditCard, DollarSign, TrendingUp, Building2, ArrowLeftRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DashboardStats {
  totalUsers: number
  totalCards: number
  moneyCirculation: number
  totalTransactions: number
  activeCompanies: number
  todayTransactions: number
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalCards: 0,
    moneyCirculation: 0,
    totalTransactions: 0,
    activeCompanics: 0,
    todayTransactions: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      setLoading(true)

      // Total users (unique discord_ids with cards)
      const { count: debitUsers } = await supabase
        .from('debit_cards')
        .select('discord_user_id', { count: 'exact', head: true })

      const { count: creditUsers } = await supabase
        .from('credit_cards')
        .select('discord_user_id', { count: 'exact', head: true })

      // Total active cards
      const { count: debitCards } = await supabase
        .from('debit_cards')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      const { count: creditCards } = await supabase
        .from('credit_cards')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      // Money in circulation (sum of debit card balances)
      const { data: debitBalances } = await supabase
        .from('debit_cards')
        .select('balance')
        .eq('status', 'active')

      const moneyCirculation = debitBalances?.reduce((sum, card) => sum + (card.balance || 0), 0) || 0

      // Total transactions
      const { count: totalTrans } = await supabase
        .from('transaction_logs')
        .select('*', { count: 'exact', head: true })

      // Today's transactions
      const today = new Date().toISOString().split('T')[0]
      const { count: todayTrans } = await supabase
        .from('transaction_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today)

      // Active companies
      const { count: companies } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)

      setStats({
        totalUsers: (debitUsers || 0) + (creditUsers || 0),
        totalCards: (debitCards || 0) + (creditCards || 0),
        moneyCirculation,
        totalTransactions: totalTrans || 0,
        activeCompanies: companies || 0,
        todayTransactions: todayTrans || 0
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Sistema bancario NacionMX - Vista general</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Usuarios"
          value={stats.totalUsers}
          icon={Users}
          format="number"
          loading={loading}
        />
        <StatCard
          title="Tarjetas Activas"
          value={stats.totalCards}
          icon={CreditCard}
          format="number"
          loading={loading}
        />
        <StatCard
          title="Dinero en Circulación"
          value={stats.moneyCirculation}
          icon={DollarSign}
          format="money"
          loading={loading}
        />
        <StatCard
          title="Transacciones Totales"
          value={stats.totalTransactions}
          icon={TrendingUp}
          format="number"
          loading={loading}
        />
        <StatCard
          title="Empresas Activas"
          value={stats.activeCompanies}
          icon={Building2}
          format="number"
          loading={loading}
        />
        <StatCard
          title="Transacciones Hoy"
          value={stats.todayTransactions}
          icon={ArrowLeftRight}
          format="number"
          loading={loading}
        />
      </div>

      {/* Quick Actions / Recent Activity */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">Vista Rápida</h2>
        <div className="text-gray-300 space-y-2">
          <p>✅ Sistema operando normalmente</p>
          <p>📊 {stats.todayTransactions} transacciones procesadas hoy</p>
          <p>💰 ${stats.moneyCirculation.toLocaleString()} en el sistema</p>
          {!loading && (
            <button
              onClick={fetchStats}
              className="mt-4 px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-400 transition font-medium"
            >
              🔄 Actualizar Stats
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
