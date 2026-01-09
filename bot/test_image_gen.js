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

    console.log('Generating DNI...');
    const dniBuffer = await ImageGenerator.generateDNI(dniData);
    fs.writeFileSync('dni_sample.png', dniBuffer);
    console.log('DNI saved to dni_sample.png');

    // Dummy Data for Visa
    const visaData = {
        visa_type: 'turista',
        visa_number: 'USA-1234-2025',
        nombre_completo: 'Juan Perez',
        expiration_date: '2030-01-01',
        foto_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
    };

    console.log('Generating Visa...');
    const visaBuffer = await ImageGenerator.generateVisa(visaData);
    fs.writeFileSync('visa_sample.png', visaBuffer);
    console.log('Visa saved to visa_sample.png');
}

main().catch(console.error);
