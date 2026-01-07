// MINIMAL TEST - ONLY EXPRESS, NO DISCORD
console.log('🚀 [TEST] Starting minimal test...');

// Catch all errors
process.on('uncaughtException', (err) => {
    console.error('💥 [TEST] UNCAUGHT:', err);
    console.error(err.stack);
});

process.on('unhandledRejection', (err) => {
    console.error('💥 [TEST] UNHANDLED REJECTION:', err);
});

try {
    console.log('📦 [TEST] About to require express...');
    const express = require('express');
    console.log('✅ [TEST] Express loaded successfully');

    console.log('🏗️ [TEST] Creating app...');
    const app = express();
    console.log('✅ [TEST] App created');

    const port = process.env.PORT || 3003;
    console.log(`🔌 [TEST] Will bind to port ${port}`);

    console.log('🌐 [TEST] Setting up route...');
    app.get('/', (req, res) => {
        res.send('🤖 TEST Bot is running!');
    });
    console.log('✅ [TEST] Route configured');

    console.log('🎧 [TEST] Calling listen...');
    const server = app.listen(port, () => {
        console.log(`✅✅✅ [TEST] Server ACTIVE on port ${port}`);
    });

    server.on('error', (err) => {
        console.error('💥 [TEST] Server error:', err);
    });

    console.log('✅ [TEST] Listen call completed');

    // Keep alive
    setInterval(() => {
        console.log('💓 [TEST] Heartbeat...');
    }, 30000);

} catch (error) {
    console.error('💥💥💥 [TEST] FATAL ERROR:', error);
    console.error('Stack:', error.stack);
    console.error('Name:', error.name);
    console.error('Message:', error.message);
    process.exit(1);
}
