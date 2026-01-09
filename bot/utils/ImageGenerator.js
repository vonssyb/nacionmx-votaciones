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
        drawField('Usuario Roblox', data.user_tag || 'Unknown', 0, 0, 420);

        // Footer
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#95a5a6';
        ctx.textAlign = 'center';
        ctx.fillText(`ID: ${data.id?.substring(0, 8) || 'Unknown'}  •  DOCUMENTO OFICIAL  •  VALIDO 2025-2026`, width / 2, height - 20);

        return canvas.toBuffer('image/png');
    }

    static async generateVisa(data) {
        const width = 800;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Helper to draw image cover (preserve aspect ratio)
        const drawImageCover = (img, x, y, w, h) => {
            const imgRatio = img.width / img.height;
            const targetRatio = w / h;
            let sx, sy, sw, sh;

            if (targetRatio > imgRatio) {
                sw = img.width;
                sh = img.width / targetRatio;
                sx = 0;
                sy = (img.height - sh) / 2;
            } else {
                sw = img.height * targetRatio;
                sh = img.height;
                sx = (img.width - sw) / 2;
                sy = 0;
            }
            ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        };

        // Background - Use a clean official document style
        // Light grey/blueish background
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#f0f4f8');
        grad.addColorStop(1, '#d9e2ec');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Header Band (Top)
        ctx.fillStyle = '#1a3b5c';
        ctx.fillRect(0, 0, width, 80);

        // Header Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('UNITED STATES OF AMERICA', width / 2, 50);

        // Subheader
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#a0aec0';
        ctx.letterSpacing = '5px'; // Spacer
        ctx.fillText('VISA / VISA', width / 2, 72);

        // Layout
        // Photo left, Fields right
        const photoX = 50;
        const photoY = 110;
        const photoW = 200;
        const photoH = 260;

        // Photo Border
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(photoX - 5, photoY - 5, photoW + 10, photoH + 10);
        ctx.strokeStyle = '#cbd5e0';
        ctx.lineWidth = 1;
        ctx.strokeRect(photoX - 5, photoY - 5, photoW + 10, photoH + 10);

        // Draw Photo
        try {
            if (data.foto_url) {
                const avatar = await loadImage(data.foto_url);
                drawImageCover(avatar, photoX, photoY, photoW, photoH);
            } else {
                // Placeholder
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(photoX, photoY, photoW, photoH);
            }
        } catch (e) {
            console.error('Error loading avatar for visa:', e);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(photoX, photoY, photoW, photoH);
        }

        // Fields Setup
        const startX = 290;
        let currentY = 130;
        const col1 = startX;
        const col2 = startX + 250;

        const drawLabel = (text, x, y) => {
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#718096';
            ctx.textAlign = 'left';
            ctx.fillText(text.toUpperCase(), x, y);
        };

        const drawValue = (text, x, y, highlight = false, color = '#2d3748') => {
            ctx.font = 'bold 22px monospace';
            ctx.fillStyle = highlight ? '#c53030' : color; // Red if highlight
            ctx.textAlign = 'left';
            ctx.fillText(text?.toUpperCase() || '', x, y + 25);
        };

        // Row 1: Issuing Post & Control Num
        drawLabel('Issuing Post', col1, currentY);
        drawValue('USCIS / NACION MX', col1, currentY);

        drawLabel('Control Number', col2, currentY);
        drawValue(data.visa_number || '00000000', col2, currentY);

        currentY += 60;

        // Row 2: Surname
        drawLabel('Surname', col1, currentY);
        drawValue(data.apellido || 'UNKNOWN', col1, currentY);
        currentY += 60;

        // Row 3: Given Name
        drawLabel('Given Name', col1, currentY);
        drawValue(data.nombre || 'UNKNOWN', col1, currentY);
        currentY += 60;

        // Row 4: Type, Class, Entries
        drawLabel('Visa Type', col1, currentY);
        drawValue('R', col1, currentY);

        drawLabel('Class', col1 + 80, currentY);
        drawValue(data.visa_type?.substring(0, 4) || 'VISA', col1 + 80, currentY);

        drawLabel('Entries', col1 + 180, currentY);
        drawValue('M', col1 + 180, currentY);
        currentY += 60;

        // Row 5: Dates
        // Issue Date (Fake it if missing)
        const issued = data.issued_date ? new Date(data.issued_date) : new Date();
        drawLabel('Issue Date', col1, currentY);
        drawValue(issued.toLocaleDateString('en-GB').toUpperCase(), col1, currentY);

        drawLabel('Expiration Date', col2, currentY);
        const expires = data.expiration_date ? new Date(data.expiration_date).toLocaleDateString('en-GB').toUpperCase() : 'INDEFINITE';
        drawValue(expires, col2, currentY, true); // Highlight expiration

        // MRZ Zone
        const mrzY = height - 50;
        ctx.fillStyle = '#ffffff';
        // MRZ Background band (usually white)
        ctx.fillRect(0, height - 70, width, 70);

        ctx.font = '24px monospace';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';

        const surname = (data.apellido || 'UNKNOWN').replace(/[^a-zA-Z]/g, '').padEnd(5, '<').substring(0, 5).toUpperCase();
        const givenname = (data.nombre || 'UNKNOWN').replace(/[^a-zA-Z]/g, '').padEnd(5, '<').substring(0, 5).toUpperCase();
        const visaNum = (data.visa_number || '00000').replace(/[^a-zA-Z0-9]/g, '').padEnd(9, '<').substring(0, 9);
        const country = 'USA';

        // V<USA...
        const line1 = `V<${country}${surname}<<${givenname}<<<<<<<<<<<<<<<<<`;
        const line2 = `${visaNum}0${country}9401014M3001018<<<<<<<<<`;

        ctx.fillText(line1, 40, mrzY);
        ctx.fillText(line2, 40, mrzY + 30);

        return canvas.toBuffer('image/png');
    }
}

module.exports = ImageGenerator;
