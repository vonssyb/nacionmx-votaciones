// MINIMAL TEST - ONLY EXPRESS, NO DISCORD
console.log('🚀 [TEST] Starting minimal test...');

try {
    const express = require('express');
    console.log('✅ [TEST] Express loaded');

    const app = express();
    const port = process.env.PORT || 3003;

    console.log(`🔌 [TEST] Binding to port ${port}`);

    app.get('/', (req, res) => {
        res.send('🤖 TEST Bot is running!');
    });

    app.listen(port, () => {
        console.log(`✅ [TEST] Server listening on port ${port}`);
    });

    console.log('✅ [TEST] All done, keeping alive...');

    // Keep alive
    setInterval(() => {
        console.log('💓 [TEST] Still alive...');
    }, 10000);

} catch (error) {
    console.error('💥 [TEST] ERROR:', error);
    console.error(error.stack);
    process.exit(1);
}
