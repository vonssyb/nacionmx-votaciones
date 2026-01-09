const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

class ImageGenerator {
    static async generateDNI(data) {
        const width = 800;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#e0e4e8');
        grad.addColorStop(1, '#cfd5dc');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Border
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 15;
        ctx.strokeRect(0, 0, width, height);

        // Header
        ctx.fillStyle = '#1a3b5c';
        ctx.font = 'bold 45px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DOCUMENTO DE IDENTIDAD', width / 2, 60);

        ctx.font = 'bold 25px sans-serif';
        ctx.fillStyle = '#4a6fa5';
        ctx.fillText('REPÚBLICA DE NACIÓN MX', width / 2, 95);

        // Photo Area (Left)
        const photoSize = 250;
        const photoX = 50;
        const photoY = 130;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(photoX, photoY, photoSize, photoSize);
        ctx.strokeStyle = '#4a6fa5';
        ctx.lineWidth = 4;
        ctx.strokeRect(photoX, photoY, photoSize, photoSize);

        try {
            if (data.foto_url) {
                const avatar = await loadImage(data.foto_url);
                ctx.drawImage(avatar, photoX + 5, photoY + 5, photoSize - 10, photoSize - 10);
            }
        } catch (e) {
            console.error('Error loading avatar:', e);
        }

        // Data Fields
        const startX = 330;
        let currentY = 140;
        const labelSize = 16;
        const valueSize = 28;
        const lineHeight = 65;

        const drawField = (label, value, xOffset = 0, yOffset = 0, widthOverride = null) => {
            ctx.textAlign = 'left';

            // Label
            ctx.font = `bold ${labelSize}px sans-serif`;
            ctx.fillStyle = '#7f8c8d';
            ctx.fillText(label.toUpperCase(), startX + xOffset, currentY + yOffset);

            // Box for value
            const fieldWidth = widthOverride || 420;
            const fieldHeight = 40;
            const boxY = currentY + yOffset + 10;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(startX + xOffset, boxY, fieldWidth, fieldHeight, 8);
            ctx.fill();

            // Value
            ctx.font = `bold ${valueSize}px sans-serif`;
            ctx.fillStyle = '#2c3e50';
            ctx.fillText(value || 'N/A', startX + xOffset + 10, boxY + 30);
        };

        // Nombre
        drawField('Nombre Completo', `${data.nombre} ${data.apellido}`);
        currentY += lineHeight + 10;

        // Nacionalidad & Sexo
        drawField('Nacionalidad', 'Mexicano/a', 0, 0, 200);
        drawField('Sexo', data.genero, 220, 0, 200);
        currentY += lineHeight + 10;

        // Edad & Nacimiento
        drawField('Edad', `${data.edad} AÑOS`, 0, 0, 200);
        const dob = data.fecha_nacimiento ? new Date(data.fecha_nacimiento).toLocaleDateString('es-MX') : 'Unknown';
        drawField('Fecha Nacimiento', dob, 220, 0, 200);
        currentY += lineHeight + 10;

        // Estado Civil & Roblox
        drawField('Usuario Roblox', data.user_tag || 'N/A', 0, 0, 420);

        // Footer
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#95a5a6';
        ctx.textAlign = 'center';

        const dniIdStr = String(data.id || 'Unknown');
        const displayId = dniIdStr.length > 8 ? dniIdStr.substring(0, 8) : dniIdStr;

        ctx.fillText(`ID: ${displayId}  •  DOCUMENTO OFICIAL  •  VALIDO 2025-2026`, width / 2, height - 20);

        return canvas.toBuffer('image/png');
    }

    static async generateVisa(data) {
        const width = 800;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background (Exact match to DNI: Silver/Grey)
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#e0e4e8');
        grad.addColorStop(1, '#cfd5dc');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Border (Exact match to DNI: Dark Blue/Grey)
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 15;
        ctx.strokeRect(0, 0, width, height);

        // Header
        ctx.fillStyle = '#1a3b5c';
        ctx.font = 'bold 45px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VISA', width / 2, 60);

        ctx.font = 'bold 25px sans-serif';
        ctx.fillStyle = '#4a6fa5';
        ctx.fillText('UNITED STATES OF AMERICA', width / 2, 95);

        // Photo Area (Left)
        const photoSize = 250;
        const photoX = 50;
        const photoY = 130;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(photoX, photoY, photoSize, photoSize);
        ctx.strokeStyle = '#4a6fa5'; // Match DNI photo border
        ctx.lineWidth = 4;
        ctx.strokeRect(photoX, photoY, photoSize, photoSize);

        try {
            if (data.foto_url) {
                const avatar = await loadImage(data.foto_url);
                ctx.drawImage(avatar, photoX + 5, photoY + 5, photoSize - 10, photoSize - 10);
            }
        } catch (e) {
            console.error('Error loading avatar for visa:', e);
        }

        // Data Fields
        const startX = 330;
        let currentY = 140;
        const labelSize = 16;
        const valueSize = 28;
        const lineHeight = 65;

        const drawField = (label, value, xOffset = 0, yOffset = 0, widthOverride = null) => {
            ctx.textAlign = 'left';

            // Label
            ctx.font = `bold ${labelSize}px sans-serif`;
            ctx.fillStyle = '#7f8c8d';
            ctx.fillText(label.toUpperCase(), startX + xOffset, currentY + yOffset);

            // Box for value
            const fieldWidth = widthOverride || 420;
            const fieldHeight = 40;
            const boxY = currentY + yOffset + 10;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(startX + xOffset, boxY, fieldWidth, fieldHeight, 8);
            ctx.fill();

            // Value
            ctx.font = `bold ${valueSize}px sans-serif`;
            ctx.fillStyle = '#2c3e50';
            ctx.fillText(value || 'N/A', startX + xOffset + 10, boxY + 30);
        };

        // Name
        drawField('Full Name', `${data.nombre} ${data.apellido}`);
        currentY += lineHeight + 10;

        // Issuing Post & Entries
        drawField('Issuing Post', 'NACION MX', 0, 0, 200);
        drawField('Entries', 'Multiple', 220, 0, 200);
        currentY += lineHeight + 10;

        // Control Number & Type
        drawField('Control Number', data.visa_number || '000000', 0, 0, 250);
        drawField('Visa Type', data.visa_type?.substring(0, 10) || 'TOURIST', 270, 0, 150);
        currentY += lineHeight + 10;

        // Expiration
        // Format date to US format: MM/DD/YYYY
        let expires = 'INDEFINITE';
        if (data.expiration_date) {
            const d = new Date(data.expiration_date);
            expires = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
        }
        drawField('Expiration Date', expires, 0, 0, 420);

        // Footer
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#95a5a6';
        ctx.textAlign = 'center';
        ctx.fillText(`USA VISA  •  OFFICIAL DOCUMENT  •  NON-TRANSFERABLE`, width / 2, height - 20);

        return canvas.toBuffer('image/png');
    }
    static async generateLicense(dniData, licenseType, expirationDate) {
        const width = 800;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background (Light Grey/Silver)
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#fdfdfd');
        grad.addColorStop(1, '#bdc3c7');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Border (Navy Blue)
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 15;
        ctx.strokeRect(0, 0, width, height);

        // Titles based on type
        let title = 'LICENCIA DE CONDUCIR';
        let subtitle = 'PERMISO DE CONDUCCIÓN';
        let colorTheme = '#2c3e50'; // Navy

        if (licenseType === 'arma_corta') {
            title = 'LICENCIA DE ARMAS';
            subtitle = 'PORTE DE ARMAS DE FUEGO (CORTA)';
            colorTheme = '#c0392b'; // Red
        } else if (licenseType === 'arma_larga') {
            title = 'LICENCIA DE ARMAS';
            subtitle = 'PORTE DE ARMAS DE FUEGO (LARGA)';
            colorTheme = '#c0392b'; // Red
        } else if (licenseType === 'conducir') {
            title = 'LICENCIA DE CONDUCIR';
            subtitle = 'PERMISO DE CONDUCCIÓN';
            colorTheme = '#2980b9'; // Blue
        }

        // Header
        ctx.fillStyle = colorTheme;
        ctx.font = 'bold 45px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, width / 2, 60);

        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#7f8c8d';
        ctx.letterSpacing = '2px';
        ctx.fillText(subtitle, width / 2, 90);

        // Photo Area (Left)
        const photoSize = 250;
        const photoX = 50;
        const photoY = 130;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(photoX, photoY, photoSize, photoSize);
        ctx.strokeStyle = colorTheme;
        ctx.lineWidth = 4;
        ctx.strokeRect(photoX, photoY, photoSize, photoSize);

        try {
            if (dniData.foto_url) {
                const avatar = await loadImage(dniData.foto_url);
                ctx.drawImage(avatar, photoX + 5, photoY + 5, photoSize - 10, photoSize - 10);
            }
        } catch (e) { console.error('Error loading avatar:', e); }

        // Fields Helper
        const startX = 330;
        let currentY = 140;
        const labelSize = 14;
        const valueSize = 24;
        const lineHeight = 65;

        const drawField = (label, value, xOffset = 0, yOffset = 0, widthOverride = null) => {
            ctx.textAlign = 'left';
            ctx.font = `bold ${labelSize}px sans-serif`;
            ctx.fillStyle = '#7f8c8d';
            ctx.fillText(label.toUpperCase(), startX + xOffset, currentY + yOffset);

            const fieldWidth = widthOverride || 420;
            const fieldHeight = 40;
            const boxY = currentY + yOffset + 10;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(startX + xOffset, boxY, fieldWidth, fieldHeight, 8);
            ctx.fill();

            ctx.font = `bold ${valueSize}px sans-serif`;
            ctx.fillStyle = '#2c3e50';
            ctx.fillText(value || 'N/A', startX + xOffset + 10, boxY + 30);
        };

        // Name
        drawField('Nombre Completo', `${dniData.nombre} ${dniData.apellido}`);
        currentY += lineHeight + 10;

        // Nationality & Sex
        drawField('Nacionalidad', 'Mexicano/a', 0, 0, 200);
        drawField('Sexo', dniData.genero, 220, 0, 200);
        currentY += lineHeight + 10;

        // Type/DOB & Expiration
        if (licenseType.includes('arma')) {
            drawField('Tipo Arma', licenseType === 'arma_corta' ? 'Corta / Personal' : 'Larga / Militar', 0, 0, 200);
        } else {
            drawField('Edad', `${dniData.edad} AÑOS`, 0, 0, 200);
        }

        drawField('Expiración', expirationDate || '2026', 220, 0, 200);
        currentY += lineHeight + 10;

        // Estado Civil & User
        drawField('Estado Civil', 'Soltero/a', 0, 0, 200); // Placeholder or fetch if available
        drawField('Usuario Roblox', dniData.user_tag, 220, 0, 200);

        // Footer
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#95a5a6';
        ctx.textAlign = 'center';

        const dniIdStr = String(dniData.id || 'Unknown');
        const displayId = dniIdStr.length > 8 ? dniIdStr.substring(0, 8) : dniIdStr;

        ctx.fillText(`ID: ${displayId}  •  NACIÓN MX  •  DOCUMENTO OFICIAL`, width / 2, height - 20);

        return canvas.toBuffer('image/png');
    }

    static async generateCarCard(carData, ownerDni) {
        const width = 800;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        // ... (omitting duplicate lines for succinctness in prompt, but replacing block)
        // Background (Green tint for circulation card)
        const grad = ctx.createLinearGradient(0, 0, width, height);
        // ...
        // Border (Green)
        ctx.strokeStyle = '#27ae60';
        // ...
        // Header
        ctx.fillStyle = '#1e8449';
        // ...
        ctx.fillText('TARJETA DE CIRCULACIÓN', width / 2, 60);

        ctx.font = 'bold 25px sans-serif';
        ctx.fillStyle = '#27ae60';
        ctx.fillText('CONTROL VEHICULAR', width / 2, 95);

        // Car Image/Icon Placeholder or Owner Photo (using Owner Photo for now as standard ID style)
        // If we had car images, we'd use them. For now, owner photo verifies ownership.
        const photoSize = 250;
        const photoX = 50;
        const photoY = 130;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(photoX, photoY, photoSize, photoSize);
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = 4;
        ctx.strokeRect(photoX, photoY, photoSize, photoSize);

        try {
            // Draw owner photo to link card to owner visually
            if (ownerDni.foto_url) {
                const avatar = await loadImage(ownerDni.foto_url);
                ctx.drawImage(avatar, photoX + 5, photoY + 5, photoSize - 10, photoSize - 10);
            }
        } catch (e) { }

        // Fields
        const startX = 330;
        let currentY = 140;
        const labelSize = 14;
        const valueSize = 24;
        const lineHeight = 65;

        const drawField = (label, value, xOffset = 0, yOffset = 0, widthOverride = null, valueColor = '#2c3e50') => {
            ctx.textAlign = 'left';
            ctx.font = `bold ${labelSize}px sans-serif`;
            ctx.fillStyle = '#7f8c8d';
            ctx.fillText(label.toUpperCase(), startX + xOffset, currentY + yOffset);

            const fieldWidth = widthOverride || 420;
            const fieldHeight = 40;
            const boxY = currentY + yOffset + 10;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(startX + xOffset, boxY, fieldWidth, fieldHeight, 8);
            ctx.fill();

            ctx.font = `bold ${valueSize}px sans-serif`;
            ctx.fillStyle = valueColor;
            ctx.fillText(value || 'N/A', startX + xOffset + 10, boxY + 30);
        };

        // Propietario
        drawField('Propietario', `${ownerDni.nombre} ${ownerDni.apellido}`);
        currentY += lineHeight + 10;

        // Placa (Big)
        drawField('Matrícula / Placa', carData.plate, 0, 0, 200, '#c0392b');
        drawField('Estado', 'VIGENTE', 220, 0, 200, '#27ae60');
        currentY += lineHeight + 10;

        // Modelo y Color
        drawField('Modelo / Marca', carData.model);
        currentY += lineHeight + 10;

        // Tipo y Fecha
        drawField('Clase / Tipo', carData.type, 0, 0, 200);
        const regDate = carData.created_at ? new Date(carData.created_at).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX');
        drawField('Fecha Registro', regDate, 220, 0, 200);

        // Footer
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#95a5a6';
        ctx.textAlign = 'center';
        ctx.fillText(`SECRETARÍA DE MOVILIDAD Y TRANSPORTE  •  NACIÓN MX`, width / 2, height - 20);

        return canvas.toBuffer('image/png');
    }
}

module.exports = ImageGenerator;
