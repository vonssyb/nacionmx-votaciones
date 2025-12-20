import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format large numbers with K/M/B notation
 */
export function formatNumber(num: number, decimals: number = 1): string {
    if (num === undefined || num === null) return '0'

    const absNum = Math.abs(num)
    const sign = num < 0 ? '-' : ''

    if (absNum >= 1e9) {
        return sign + (absNum / 1e9).toFixed(decimals) + 'B'
    }
    if (absNum >= 1e6) {
        return sign + (absNum / 1e6).toFixed(decimals) + 'M'
    }
    if (absNum >= 1e3) {
        return sign + (absNum / 1e3).toFixed(decimals) + 'K'
    }
    return sign + absNum.toString()
}

/**
 * Format money with $ and commas
 */
export function formatMoney(amount: number): string {
    if (amount === undefined || amount === null) return '$0'
    return '$' + amount.toLocaleString()
}

/**
 * Format money with smart notation for large amounts
 */
export function formatSmartMoney(amount: number, threshold: number = 1000000): string {
    if (amount === undefined || amount === null) return '$0'

    if (Math.abs(amount) >= threshold) {
        return '$' + formatNumber(amount)
    }
    return formatMoney(amount)
}
