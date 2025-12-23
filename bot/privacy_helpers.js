// Privacy Helper Functions
// Add at top of index.js or create separate privacy.js module

// Check if user has active privacy
async function hasPrivacy(userId, minLevel = 'basico') {
    const { data } = await supabase
        .from('privacy_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (!data) return false;

    // Check expiration
    if (new Date(data.expires_at) < new Date()) {
        await supabase.from('privacy_accounts').delete().eq('user_id', userId);
        return false;
    }

    const levels = { basico: 1, vip: 2, elite: 3 };
    return levels[data.level] >= levels[minLevel];
}

// Get privacy level
async function getPrivacyLevel(userId) {
    const { data } = await supabase
        .from('privacy_accounts')
        .select('level, offshore_name')
        .eq('user_id', userId)
        .maybeSingle();

    if (!data) return null;
    if (new Date(data.expires_at) < new Date()) return null;

    return data;
}

// Hide balance if user has privacy
async function displayBalance(userId, actualBalance) {
    const privacy = await hasPrivacy(userId);
    return privacy ? '🔒 ***' : `$${actualBalance.toLocaleString()}`;
}

// Get sender name (use offshore if Elite)
async function getSenderName(userId, interaction) {
    const privacy = await getPrivacyLevel(userId);

    if (privacy && privacy.level === 'elite' && privacy.offshore_name) {
        return privacy.offshore_name;
    }

    return interaction.user.tag;
}

// INTEGRATION EXAMPLES:

// 1. In /debito estado - Hide balance
const displayedBalance = await displayBalance(interaction.user.id, balance.bank);
embed.addFields({ name: '🏦 Banco', value: displayedBalance });

// 2. In /robar - Check privacy protection
const targetPrivacy = await hasPrivacy(targetUser.id);
if (targetPrivacy) {
    return interaction.reply('🛡️ Este usuario tiene protección bancaria activa');
}

// 3. In /transferir - Use offshore name
const senderName = await getSenderName(interaction.user.id, interaction);
const message = `Transferencia de ${senderName}`;

// 4. In /top-ricos - Exclude Elite users
const { data: eliteUsers } = await supabase
    .from('privacy_accounts')
    .select('user_id')
    .eq('level', 'elite');

const eliteIds = eliteUsers.map(u => u.user_id);
// Filter out eliteIds from leaderboard

module.exports = {
    hasPrivacy,
    getPrivacyLevel,
    displayBalance,
    getSenderName
};
