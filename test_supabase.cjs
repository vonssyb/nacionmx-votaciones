const { createClient } = require('@supabase/supabase-js');

try {
    console.log('Testing createClient with undefined URL...');
    const supabase = createClient(undefined, undefined); // Should throw
    console.log('Success (Unexpected)');
} catch (e) {
    console.error('Caught expected error:', e.message);
}

try {
    console.log('Testing createClient with empty string URL...');
    const supabase = createClient('', ''); // Should throw
    console.log('Success (Unexpected)');
} catch (e) {
    console.error('Caught expected error:', e.message);
}
