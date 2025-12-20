/**
 * Utilities Helper Functions
 * Common helpers for formatting, validation, etc.
 */

/**
 * Format large numbers with K/M/B notation
 * @param {number} num - Number to format
 * @param {number} decimals - Decimal places (default: 1)
 * @returns {string} Formatted string
 * 
 * Examples:
 * formatNumber(1234) => "1.2K"
 * formatNumber(1234567) => "1.2M"  
 * formatNumber(1234567890) => "1.2B"
 * formatNumber(500) => "500"
 */
function formatNumber(num, decimals = 1) {
    if (num === undefined || num === null) return '0';

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (absNum >= 1e9) {
        return sign + (absNum / 1e9).toFixed(decimals) + 'B';
    }
    if (absNum >= 1e6) {
        return sign + (absNum / 1e6).toFixed(decimals) + 'M';
    }
    if (absNum >= 1e3) {
        return sign + (absNum / 1e3).toFixed(decimals) + 'K';
    }
    return sign + absNum.toString();
}

/**
 * Format money with $ and commas
 * @param {number} amount - Amount to format
 * @returns {string} Formatted money string
 * 
 * Examples:
 * formatMoney(1234567) => "$1,234,567"
 * formatMoney(500) => "$500"
 */
function formatMoney(amount) {
    if (amount === undefined || amount === null) return '$0';
    return '$' + amount.toLocaleString();
}

/**
 * Format money with smart notation for large amounts
 * @param {number} amount - Amount to format
 * @param {number} threshold - Use notation above this (default: 1M)
 * @returns {string} Formatted money string
 * 
 * Examples:
 * formatSmartMoney(1234567) => "$1.2M"
 * formatSmartMoney(500) => "$500"
 */
function formatSmartMoney(amount, threshold = 1000000) {
    if (amount === undefined || amount === null) return '$0';

    if (Math.abs(amount) >= threshold) {
        return '$' + formatNumber(amount);
    }
    return formatMoney(amount);
}

/**
 * Format percentage
 * @param {number} value - Percentage value (e.g., 75 for 75%)
 * @param {number} decimals - Decimal places (default: 1)
 * @returns {string} Formatted percentage
 */
function formatPercent(value, decimals = 1) {
    if (value === undefined || value === null) return '0%';
    return value.toFixed(decimals) + '%';
}

/**
 * Format duration in human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 * 
 * Examples:
 * formatDuration(5000) => "5s"
 * formatDuration(65000) => "1m 5s"
 * formatDuration(3665000) => "1h 1m 5s"
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Get uptime in human-readable format
 * @param {number} startTime - Start timestamp in ms
 * @returns {string} Uptime string
 */
function getUptime(startTime) {
    return formatDuration(Date.now() - startTime);
}

/**
 * Truncate string with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Max length (default: 100)
 * @returns {string} Truncated string
 */
function truncate(str, maxLength = 100) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

module.exports = {
    formatNumber,
    formatMoney,
    formatSmartMoney,
    formatPercent,
    formatDuration,
    getUptime,
    truncate
};
