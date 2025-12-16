const axios = require('axios');

class UnbelievableBoatService {
    constructor(token) {
        this.token = token;
        this.baseUrl = 'https://unbelievaboat.com/api/v1';
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': this.token,
                'Accept': 'application/json'
            }
        });
    }

    /**
     * Get user balance
     * @param {string} guildId 
     * @param {string} userId 
     */
    async getUserBalance(guildId, userId) {
        try {
            const response = await this.client.get(`/guilds/${guildId}/users/${userId}`);
            // UnbelievaBoat might return { cash: number, bank: number, total: number }
            return response.data;
        } catch (error) {
            console.error('Error fetching balance:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Modify user balance (remove money)
     * To remove money, use negative amount with 'update'? No, standard is usually Patch with 'cash' operation.
     * API Docs say: PATCH /guilds/{guild_id}/users/{user_id}
     * Body: { cash: number, bank: number, reason: string }
     * The number is the amount to SET or ADD? Default is usually relative or absolute depending on flags.
     * Let's check typical behavior: Usually 'cash' adds if positive, removes if negative.
     */
    async removeMoney(guildId, userId, amount, reason = "Cobro Banco NMX") {
        try {
            // UnbelievaBoat API: Use negative value to subtract
            const payload = {
                cash: -Math.abs(amount),
                reason: reason
            };

            const response = await this.client.patch(`/guilds/${guildId}/users/${userId}`, payload);
            return { success: true, newBalance: response.data };
        } catch (error) {
            console.error('Error removing money:', error.response?.data || error.message);
            return { success: false, error: error.response?.data || error.message };
        }
    }

    /**
     * Add money to user balance
     */
    async addMoney(guildId, userId, amount, reason = "Préstamo Banco NMX") {
        try {
            const payload = {
                cash: Math.abs(amount),
                reason: reason
            };

            const response = await this.client.patch(`/guilds/${guildId}/users/${userId}`, payload);
            return { success: true, newBalance: response.data };
        } catch (error) {
            console.error('Error adding money:', error.response?.data || error.message);
            return { success: false, error: error.response?.data || error.message };
        }
    }
}

module.exports = UnbelievableBoatService;
