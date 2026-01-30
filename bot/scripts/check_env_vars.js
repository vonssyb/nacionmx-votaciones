const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('Checking Environment Variables...');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Found' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Found' : '❌ Missing');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Found' : '❌ Missing');
console.log('DIRECT_URL:', process.env.DIRECT_URL ? '✅ Found' : '❌ Missing');
