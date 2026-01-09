const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// Register a default font if possible, or rely on system fonts
// For this environment, we'll try to use standard sans-serif if no file provided
// GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/Roboto-Regular.ttf'), 'Roboto');

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

        // Estado Civil (Default Soltero/a for now as not in DB usually?) & Roblox
        // We might not have Civil Status in DB, assume Soltero/a or omit if strict
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

        // Background (US Style Blue)
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#002868'); // Dark Blue
        grad.addColorStop(1, '#1a4e8a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Header
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 45px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('UNITED STATES OF AMERICA', width / 2, 60);

        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#bf0a30'; // Red
        ctx.fillText('VISA PROOF OF STATUS', width / 2, 100);

        // Watermark / Seal placeholder
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 150, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Fields
        ctx.textAlign = 'left';

        const drawField = (label, value, x, y, size = 30, color = '#ffffff') => {
            ctx.font = `bold 16px sans-serif`;
            ctx.fillStyle = '#aaaaaa';
            ctx.fillText(label.toUpperCase(), x, y);

            ctx.font = `bold ${size}px sans-serif`;
            ctx.fillStyle = color;
            ctx.fillText(value || '', x, y + 35);
        };

        const leftCol = 50;
        const rightCol = 450;
        let currentY = 160;

        drawField('Visa Class / Tipo', data.visa_type?.toUpperCase(), leftCol, currentY, 35, '#f1c40f');
        currentY += 80;

        drawField('Control Number / Número', data.visa_number, leftCol, currentY);
        currentY += 80;

        drawField('Beneficiary / Beneficiario', data.nombre_completo, leftCol, currentY);
        currentY += 80;

        drawField('Expiration / Vence', data.expiration_date ? new Date(data.expiration_date).toLocaleDateString() : 'PERMANENT', leftCol, currentY);

        // Right side (Photo placeholder or details)
        const photoSize = 200;
        const photoX = rightCol;
        const photoY = 150;

        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(photoX, photoY, photoSize, photoSize);
        ctx.strokeStyle = '#bf0a30';
        ctx.lineWidth = 5;
        ctx.strokeRect(photoX, photoY, photoSize, photoSize);

        try {
            if (data.foto_url) {
                const avatar = await loadImage(data.foto_url);
                ctx.drawImage(avatar, photoX + 5, photoY + 5, photoSize - 10, photoSize - 10);
            }
        } catch (e) {
            console.error('Error loading avatar for visa:', e);
        }

        // Footer
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        const machineCode = `V<USA${data.apellido?.substring(0, 5)}<<${data.nombre?.substring(0, 5)}<<<<<<<<<<<<<<\n${data.visa_number}<<<<<<<<<<<<<<<<<<<<<<<<<<`;

        // Simple machine readable imitation
        ctx.fillText(machineCode.split('\n')[0], width / 2, height - 55);
        ctx.fillText(machineCode.split('\n')[1], width / 2, height - 25);

        return canvas.toBuffer('image/png');
    }
}

module.exports = ImageGenerator;
