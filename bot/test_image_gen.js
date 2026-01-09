const ImageGenerator = require('./utils/ImageGenerator');
const fs = require('fs');
const path = require('path');

async function main() {
    // Dummy Data for DNI
    const dniData = {
        id: '12345678',
        nombre: 'Juan',
        apellido: 'Perez',
        edad: 25,
        genero: 'Masculino',
        fecha_nacimiento: '2000-05-15',
        user_tag: 'juan.perez',
        foto_url: 'https://cdn.discordapp.com/embed/avatars/0.png' // Default Discord Avatar
    };

    // Generate DNI
    try {
        console.log('Generating DNI...');
        const dniBuffer = await ImageGenerator.generateDNI(dniData);
        fs.writeFileSync('dni_sample.png', dniBuffer);
        console.log('DNI saved to dni_sample.png');
    } catch (e) {
        console.error('DNI Error:', e);
    }

    // Generate Visa
    try {
        const visaData = {
            visa_type: 'turista',
            visa_number: 'USA-1234-2025',
            nombre: 'Juan',
            apellido: 'Perez',
            expiration_date: '2030-01-01',
            foto_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
        };
        console.log('Generating Visa...');
        const visaBuffer = await ImageGenerator.generateVisa(visaData);
        fs.writeFileSync('visa_sample.png', visaBuffer);
        console.log('Visa saved to visa_sample.png');
    } catch (e) {
        console.error('Visa Error:', e);
    }

    // Generate Licenses
    try {
        console.log('Generating Driving License...');
        const licBuffer = await ImageGenerator.generateLicense(dniData, 'conducir', '05/05/2026');
        fs.writeFileSync('licencia_conducir.png', licBuffer);
        console.log('Driving License saved.');

        console.log('Generating Gun License...');
        const gunBuffer = await ImageGenerator.generateLicense(dniData, 'arma_corta', '05/05/2026');
        fs.writeFileSync('licencia_arma.png', gunBuffer);
        console.log('Gun License saved.');
    } catch (e) {
        console.error('License Error:', e);
    }

    // Generate Car Card
    try {
        console.log('Generating Car Card...');
        const carData = {
            plate: 'ABC-123',
            model: 'Nissan Tsuru 2001',
            color: 'Blanco',
            type: 'Particular',
            created_at: new Date().toISOString()
        };
        const carBuffer = await ImageGenerator.generateCarCard(carData, dniData);
        fs.writeFileSync('tarjeta_circulacion.png', carBuffer);
        console.log('Car Card saved.');
    } catch (e) {
        console.error('Car Card Error:', e);
    }
}

main().catch(console.error);
