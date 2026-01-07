const axios = require('axios');

class RobloxService {
    /**
     * Fetch Roblox ID and specific Username from a given username string.
     * @param {string} username - The username to search for.
     * @returns {Promise<{id: number, name: string}|null>} - Object with ID and Case-Correct Name, or null if not found.
     */
    static async getIdFromUsername(username) {
        try {
            const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [username],
                excludeBannedUsers: true
            });

            if (response.data && response.data.data && response.data.data.length > 0) {
                const user = response.data.data[0];
                return {
                    id: user.id,
                    name: user.name // Normalized case from Roblox
                };
            }
            return null;
        } catch (error) {
            console.error('[RobloxService] Error fetching ID:', error.message);
            return null;
        }
    }
}

module.exports = RobloxService;
