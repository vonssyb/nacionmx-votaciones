import { LucideIcon } from 'lucide-react'
import { formatNumber, formatSmartMoney } from '@/lib/utils'

interface StatCardProps {
    title: string
    value: number | string
    icon: LucideIcon
    trend?: number
    format?: 'number' | 'money' | 'none'
    loading?: boolean
}

export default function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    format = 'none',
    loading = false
}: StatCardProps) {
    const formattedValue = () => {
        if (loading) return '...'
        if (typeof value === 'string') return value

        switch (format) {
            case 'number':
                return formatNumber(value)
            case 'money':
                return formatSmartMoney(value)
            default:
                return value.toLocaleString()
        }
    }

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 hover:border-yellow-500 transition-all duration-200">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                        {title}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-white">
                        {formattedValue()}
                    </p>
                    {trend !== undefined && (
                        <p className={`mt-2 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs yesterday
                        </p>
                    )}
                </div>
                <div className="ml-4">
                    <div className="bg-yellow-500 bg-opacity-20 rounded-full p-3">
                        <Icon className="h-8 w-8 text-yellow-500" />
                    </div>
                </div>
            </div>
        </div>
    )
}
