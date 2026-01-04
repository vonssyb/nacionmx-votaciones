const axios = require('axios');

/**
 * Uploads an attachment from a URL to Supabase Storage
 * @param {Object} supabase - Supabase client instance
 * @param {string} attachmentUrl - The URL of the Discord attachment
 * @param {string} fileName - Original file name
 * @returns {Promise<string|null>} - The public URL of the uploaded file or null
 */
async function uploadEvidence(supabase, attachmentUrl, fileName) {
    try {
        // 1. Download image
        const response = await axios.get(attachmentUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');

        // 2. Generate unique path
        // Clean filename of special chars
        const cleanName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `evidence/${Date.now()}_${cleanName}`;

        const contentType = response.headers['content-type'] || 'image/png';

        // 3. Upload to Supabase
        const { data, error } = await supabase
            .storage
            .from('evidence') // Bucket name
            .upload(path, buffer, {
                contentType: contentType,
                upsert: false
            });

        if (error) {
            console.error('Supabase Upload Error:', error);
            // If bucket doesn't exist, we might need to handle that, but assuming 'evidence' exists
            return null;
        }

        // 4. Get Public URL
        const { data: publicUrlData } = supabase
            .storage
            .from('evidence')
            .getPublicUrl(path);

        return publicUrlData.publicUrl;

    } catch (err) {
        console.error('Storage Service Error:', err);
        return null; // Fail gracefully, maybe fallback to original URL?
    }
}

module.exports = { uploadEvidence };
