const { createClient } = require('@supabase/supabase-js');

class CompanyService {
    constructor(supabaseUrl, supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    /**
     * Create a new company
     * @param {Object} companyData 
     */
    async createCompany(companyData) {
        try {
            const { error, data } = await this.supabase
                .from('companies')
                .insert([companyData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating company:', error);
            throw error;
        }
    }

    /**
     * Get company by owner ID (Discord ID)
     * @param {string} discordId 
     */
    async getCompanyByOwner(discordId) {
        try {
            // Use config-based query or raw SQL if array filtering is tricky with standard builder in some versions,
            // but .contains('owner_ids', [discordId]) is standard for Postgres arrays in Supabase JS.
            const { data, error } = await this.supabase
                .from('companies')
                .select('*')
                .contains('owner_ids', [discordId])
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting company by owner:', error);
            return null;
        }
    }

    /**
     * Update company details
     * @param {string} companyId 
     * @param {Object} updates 
     */
    async updateCompany(companyId, updates) {
        try {
            const { data, error } = await this.supabase
                .from('companies')
                .update(updates)
                .eq('id', companyId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating company:', error);
            throw error;
        }
    }
}

module.exports = CompanyService;
