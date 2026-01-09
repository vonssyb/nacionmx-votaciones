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

        // Background (Same gradient style as DNI but with Visa blueish tint)
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#f0f4f8');
        grad.addColorStop(1, '#dfe6ed'); // Slightly blue/grey
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Border (Visa Style Blue)
        ctx.strokeStyle = '#1a3b5c';
        ctx.lineWidth = 15;
        ctx.strokeRect(0, 0, width, height);

        // Header
        ctx.fillStyle = '#1a3b5c';
        ctx.font = 'bold 45px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('UNITED STATES OF AMERICA', width / 2, 60);

        ctx.font = 'bold 25px sans-serif';
        ctx.fillStyle = '#bf0a30'; // USA Red
        ctx.fillText('VISA / VISA', width / 2, 95);

        // Photo Area (Left)
        const photoSize = 250;
        const photoX = 50;
        const photoY = 130;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(photoX, photoY, photoSize, photoSize);
        ctx.strokeStyle = '#1a3b5c';
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
        drawField('Name', `${data.nombre} ${data.apellido}`);
        currentY += lineHeight + 10;

        // Issuing Post & Entries
        drawField('Issuing Post', 'NACION MX', 0, 0, 200);
        drawField('Entries', 'M', 220, 0, 200);
        currentY += lineHeight + 10;

        // Control Number & Type
        drawField('Control Number', data.visa_number || '000000', 0, 0, 250);
        drawField('Type', data.visa_type?.substring(0, 10) || 'VISA', 270, 0, 150);
        currentY += lineHeight + 10;

        // Expiration
        const expires = data.expiration_date ? new Date(data.expiration_date).toLocaleDateString('en-US').toUpperCase() : 'INDEFINITE';
        drawField('Expiration Date', expires, 0, 0, 420);

        // Footer
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#95a5a6';
        ctx.textAlign = 'center';
        ctx.fillText(`USA VISA  •  OFFICIAL DOCUMENT  •  NON-TRANSFERABLE`, width / 2, height - 20);

        return canvas.toBuffer('image/png');
    }
}

module.exports = ImageGenerator;
