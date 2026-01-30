const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase Credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VEHICLES = [
    {
        make: 'Toyota',
        model: 'Supra MK5',
        category: 'deportivo',
        price: 85000,
        stock: 5,
        image_url: 'https://img.gta5-mods.com/q95/images/toyota-supra-gr-2020-add-on-tuning-template/8a3f8f-2.jpg',
        specs: { velocidad: '250 km/h', motor: '3.0L Turbo', plazas: 2 },
        finance_available: true
    },
    {
        make: 'BMW',
        model: 'M4 Competition',
        category: 'deportivo',
        price: 120000,
        stock: 10,
        image_url: 'https://hips.hearstapps.com/hmg-prod/images/2025-bmw-m4-cs-101-664366555198d.jpg',
        specs: { velocidad: '290 km/h', motor: 'Twin Turbo I6', plazas: 4 },
        finance_available: true
    },
    {
        make: 'Mercedes-Benz',
        model: 'G63 AMG',
        category: 'suv',
        price: 250000,
        stock: 3,
        image_url: 'https://www.topgear.com/sites/default/files/2024/03/1-Mercedes-G-Class-review.jpg',
        specs: { velocidad: '220 km/h', motor: 'V8 Biturbo', plazas: 5 },
        finance_available: true
    },
    {
        make: 'Yamaha',
        model: 'R1',
        category: 'moto',
        price: 45000,
        stock: 15,
        image_url: 'https://www.yamaha-motor.eu/bw/en/products/motorcycles/supersport/r1m-2024/jcr:content/root/image.coreimg.jpeg/1715003666579/2024-yamaha-r1m-eu-icon-performance-studio-001-03.jpeg',
        specs: { velocidad: '299 km/h', motor: '1000cc', plazas: 1 },
        finance_available: false
    },
    {
        make: 'Rolls Royce',
        model: 'Phantom',
        category: 'lujo',
        price: 550000,
        stock: 1,
        image_url: 'https://cdn.motor1.com/images/mgl/mrz1e/s3/rolls-royce-phantom-tempus-collection.jpg',
        specs: { velocidad: '240 km/h', motor: 'V12', plazas: 4 },
        finance_available: true
    }
];

(async () => {
    console.log('🌱 Seeding Dealership Catalog...');

    for (const car of VEHICLES) {
        const { error } = await supabase
            .from('dealership_catalog')
            .upsert(car, { onConflict: 'make,model' }); // Composite key constraint might fail if not set, but simple insert is fine for seed

        if (error) {
            console.error(`❌ Failed to insert ${car.model}:`, error.message);
        } else {
            console.log(`✅ Inserted: ${car.model}`);
        }
    }
    console.log('🏁 Seed Complete');
})();
