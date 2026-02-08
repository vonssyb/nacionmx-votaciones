const { AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

class TranscriptService {
    constructor() {
        this.styles = `
            :root {
                --bg-primary: #313338;
                --bg-secondary: #2b2d31;
                --bg-tertiary: #1e1f22;
                --text-normal: #dbdee1;
                --text-muted: #949ba4;
                --brand: #5865f2;
                --brand-hover: #4752c4;
                --danger: #da373c;
                --success: #23a559;
                --warning: #f0b232;
                --border: #1e1f22;
            }

            body {
                background-color: var(--bg-primary);
                color: var(--text-normal);
                font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 0;
                font-size: 16px;
                line-height: 1.375rem;
            }

            .container {
                max-width: 100%;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                height: 100vh;
            }

            /* HEADER */
            .header {
                background-color: var(--bg-secondary);
                padding: 16px 24px;
                border-bottom: 1px solid var(--border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05);
                z-index: 100;
            }

            .header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .guild-icon {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                object-fit: cover;
            }

            .header-info h1 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #fff;
            }

            .header-info p {
                margin: 4px 0 0;
                font-size: 12px;
                color: var(--text-muted);
            }

            .header-meta {
                display: flex;
                gap: 16px;
                font-size: 14px;
                color: var(--text-muted);
            }

            .meta-item {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
            }

            .meta-label {
                font-size: 11px;
                text-transform: uppercase;
                font-weight: 700;
            }

            .meta-value {
                color: var(--text-normal);
                font-weight: 500;
            }

            /* TICKET INFO CARD */
            .ticket-info {
                background-color: var(--bg-tertiary);
                margin: 16px 24px;
                padding: 16px;
                border-radius: 8px;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                border: 1px solid var(--border);
            }

            .info-block h3 {
                margin: 0 0 8px;
                font-size: 12px;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .info-block p {
                margin: 0;
                font-size: 15px;
                color: #fff;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .rating-stars {
                color: #e6cc00; /* Goldish yellow */
            }

            /* CHAT AREA */
            .chat-log {
                flex: 1;
                overflow-y: auto;
                padding: 16px 24px;
                background-color: var(--bg-primary);
            }

            .message-group {
                margin-bottom: 16px; 
                display: flex;
                /* border-top: 1px solid transparent; */
            }
            
            .message-group:hover {
                background-color: rgba(4, 4, 5, 0.07);
            }

            .avatar-col {
                width: 50px;
                padding-top: 4px;
                flex-shrink: 0;
            }

            .user-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                cursor: pointer;
                transition: opacity 0.2s;
            }
            
            .user-avatar:hover {
                opacity: 0.8;
            }

            .message-content {
                flex: 1;
                max-width: 100%;
                overflow-wrap: break-word;
            }

            .message-header {
                display: flex;
                align-items: baseline;
                gap: 8px;
                margin-bottom: 4px;
            }

            .username {
                font-weight: 500;
                font-size: 16px;
                color: #fff;
                cursor: pointer;
            }
            
            .username:hover {
                text-decoration: underline;
            }
            
            .bot-tag {
                background-color: #5865F2;
                color: #fff;
                font-size: 10px;
                padding: 1px 4px;
                border-radius: 4px;
                vertical-align: middle;
            }

            .timestamp {
                font-size: 12px;
                color: var(--text-muted);
            }

            .message-body {
                font-size: 16px;
                color: var(--text-normal);
                white-space: pre-wrap;
            }
            
            .mention {
                background-color: rgba(88, 101, 242, 0.3);
                color: #dee0fc;
                padding: 0 2px;
                border-radius: 3px;
                cursor: pointer;
                transition: background-color 0.1s;
            }
            
            .mention:hover {
                background-color: rgba(88, 101, 242, 0.6);
            }

            /* ATTACHMENTS & EMBEDS */
            .attachment {
                margin-top: 8px;
                max-width: 500px;
                border-radius: 8px;
                overflow: hidden;
                border: 1px solid var(--bg-tertiary);
            }

            .attachment img {
                max-width: 100%;
                height: auto;
                display: block;
            }

            .embed {
                margin-top: 8px;
                background-color: var(--bg-secondary);
                border-left: 4px solid var(--border);
                border-radius: 4px;
                padding: 12px 16px;
                max-width: 520px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .embed-title {
                font-weight: 600;
                font-size: 16px;
                color: #fff;
            }

            .embed-desc {
                font-size: 14px;
                color: var(--text-normal);
            }
            
            .embed-field {
                margin-top: 4px;
            }
            
            .embed-field-name {
                font-weight: 600;
                font-size: 13px;
                color: var(--text-normal);
                margin-bottom: 2px;
            }
            
            .embed-field-value {
                font-size: 13px;
                color: var(--text-normal);
                white-space: pre-wrap;
            }
            
            .embed-footer {
                margin-top: 8px;
                font-size: 12px;
                color: var(--text-muted);
                display: flex;
                align-items: center;
                gap: 6px;
            }

            /* SYSTEM MESSAGES */
            .system-message {
                margin: 16px 0 16px 20px;
                display: flex;
                align-items: center;
                gap: 12px;
                color: var(--text-muted);
                font-size: 14px;
            }

            .system-icon {
                width: 18px;
                text-align: center;
            }
            
            /* SCROLLBAR */
            ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
                background-color: var(--bg-secondary);
            }
            
            ::-webkit-scrollbar-thumb {
                background-color: #1a1b1e;
                border-radius: 4px;
            }

            /* FOOTER */
            .footer {
                padding: 24px;
                text-align: center;
                color: var(--text-muted);
                font-size: 12px;
                background-color: var(--bg-secondary);
                border-top: 1px solid var(--border);
            }
            
            .logo-corner {
                position: fixed;
                bottom: 20px;
                right: 20px;
                opacity: 0.1;
                pointer-events: none;
                z-index: 0;
            }
            
            .deleted-msg {
                color: #fa777c;
                font-style: italic;
                font-size: 12px;
            }

        `;
    }

    async generate(channel, ticketData, options = {}) {
        const messages = await this.fetchMessages(channel);
        const guildIcon = channel.guild.iconURL({ extension: 'png', size: 128 });

        // Metadata formatting
        const claimedBy = ticketData.claimed_by ? `<@${ticketData.claimed_by}>` : 'Nadie';
        const ratingStars = ticketData.metadata?.rating ? '★'.repeat(ticketData.metadata.rating) : 'N/A';
        const openDate = ticketData.created_at ? new Date(ticketData.created_at).toLocaleString('es-MX') : 'Desconocido';
        const closeDate = new Date().toLocaleString('es-MX');

        let html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcript - ${channel.name}</title>
    <style>${this.styles}</style>
</head>
<body>
    <div class="container">
        <!-- HEADER -->
        <header class="header">
            <div class="header-left">
                ${guildIcon ? `<img src="${guildIcon}" alt="Server Icon" class="guild-icon">` : ''}
                <div class="header-info">
                    <h1>${channel.guild.name}</h1>
                    <p>Ticket #${channel.name}</p>
                </div>
            </div>
            <div class="header-meta">
                <div class="meta-item">
                    <span class="meta-label">ID Ticket</span>
                    <span class="meta-value">${ticketData.id || 'N/A'}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Estado</span>
                    <span class="meta-value">${ticketData.status || 'CLOSED'}</span>
                </div>
            </div>
        </header>

        <!-- TICKET INFO -->
        <section class="ticket-info">
            <div class="info-block">
                <h3>Solicitante</h3>
                <p>${ticketData.user_id ? `<@${ticketData.user_id}>` : 'Desconocido'}</p>
            </div>
            <div class="info-block">
                <h3>Atendido Por</h3>
                <p>${claimedBy}</p>
            </div>
            <div class="info-block">
                <h3>Apertura</h3>
                <p>${openDate}</p>
            </div>
            <div class="info-block">
                <h3>Cierre</h3>
                <p>${closeDate}</p>
            </div>
             <div class="info-block">
                <h3>Calificación</h3>
                <p class="rating-stars">${ratingStars}</p>
            </div>
             <div class="info-block" style="grid-column: span 2;">
                <h3>Razón de Cierre / Comentarios</h3>
                <p>${ticketData.metadata?.feedback_comments || ticketData.closure_reason || 'Sin comentarios'}</p>
            </div>
        </section>

        <!-- CHAT LOG -->
        <main class="chat-log">
`;

        // Process Messages
        // Reverse to show oldest first since fetchMessages returns newest first usually, 
        // but fetchMessages(limit: -1) logic might need care.
        // Assuming fetchMessages returns a Collection mapped by ID (ascending or descending).
        // Standard discord.js fetch is newest first. We need chronological order.
        const sortedMessages = Array.from(messages.values()).reverse();

        for (const msg of sortedMessages) {
            if (!msg.content && msg.embeds.length === 0 && msg.attachments.size === 0) continue;

            const avatarUrl = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
            const isBot = msg.author.bot;
            const timestamp = msg.createdAt.toLocaleString('es-MX');
            const content = this.formatContent(msg.content);

            html += `
            <div class="message-group">
                <div class="avatar-col">
                    <img src="${avatarUrl}" alt="${msg.author.username}" class="user-avatar">
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="username" style="color: ${msg.member?.displayHexColor !== '#000000' ? msg.member?.displayHexColor : '#fff'}">
                            ${msg.author.username}
                        </span>
                        ${isBot ? '<span class="bot-tag">BOT</span>' : ''}
                        <span class="timestamp">${timestamp}</span>
                    </div>
                    <div class="message-body">${content}</div>
                    
                    ${this.renderAttachments(msg)}
                    ${this.renderEmbeds(msg)}
                </div>
            </div>
            `;
        }

        html += `
        </main>
        
        <footer class="footer">
            Generado automáticamente por el sistema de Soportes de ${channel.guild.name} • ${new Date().getFullYear()}
            <br>
            El contenido de este archivo es confidencial y para uso administrativo.
        </footer>
        
        <!-- WATERMARK LOGO -->
        <div class="logo-corner">
             ${guildIcon ? `<img src="${guildIcon}" width="300">` : ''}
        </div>
    </div>
</body>
</html>
        `;

        const buffer = Buffer.from(html, 'utf-8');
        return new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.html` });
    }

    async fetchMessages(channel) {
        let messages = [];
        let lastId;

        try {
            while (true) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;

                const fetched = await channel.messages.fetch(options);
                if (fetched.size === 0) break;

                messages = messages.concat(Array.from(fetched.values()));
                lastId = fetched.last().id;

                if (messages.length >= 1000) break; // Safety limit
            }
        } catch (e) {
            console.error('[TranscriptService] Error fetching messages:', e);
        }

        return messages;
    }

    formatContent(content) {
        if (!content) return '';

        // Basic Markdown Replacements
        // Bold
        content = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        // Italic
        content = content.replace(/\*(.*?)\*/g, '<i>$1</i>');
        // Code Block
        content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        // Inline Code
        content = content.replace(/`(.*?)`/g, '<code>$1</code>');
        // Mentions (simplified)
        content = content.replace(/<@!?(\d+)>/g, '<span class="mention">@Usuario</span>');
        // Channels
        content = content.replace(/<#(\d+)>/g, '<span class="mention">#canal</span>');
        // Roles
        content = content.replace(/<@&(\d+)>/g, '<span class="mention">@Rol</span>');

        return content;
    }

    renderAttachments(msg) {
        if (msg.attachments.size === 0) return '';

        let html = '';
        msg.attachments.forEach(att => {
            const isImage = att.contentType?.startsWith('image/');
            if (isImage) {
                html += `<div class="attachment"><img src="${att.url}" alt="Adjunto"></div>`;
            } else {
                html += `<div class="attachment" style="padding:10px;"><a href="${att.url}" target="_blank" style="color:#00b0f4">📄 ${att.name}</a></div>`;
            }
        });
        return html;
    }

    renderEmbeds(msg) {
        if (msg.embeds.length === 0) return '';

        let html = '';
        msg.embeds.forEach(embed => {
            const color = embed.hexColor || '#2b2d31';

            let fieldsHtml = '';
            if (embed.fields) {
                embed.fields.forEach(f => {
                    fieldsHtml += `
                    <div class="embed-field" style="display: ${f.inline ? 'inline-block; width: 45%; vertical-align: top;' : 'block'}">
                        <div class="embed-field-name">${f.name}</div>
                        <div class="embed-field-value">${this.formatContent(f.value)}</div>
                    </div>
                   `;
                });
            }

            html += `
            <div class="embed" style="border-left-color: ${color}">
                ${embed.title ? `<div class="embed-title">${embed.title}</div>` : ''}
                ${embed.description ? `<div class="embed-desc">${this.formatContent(embed.description)}</div>` : ''}
                ${fieldsHtml}
                ${embed.footer ? `<div class="embed-footer">${embed.footer.text}</div>` : ''}
                ${embed.image ? `<div class="attachment"><img src="${embed.image.url}"></div>` : ''}
            </div>
           `;
        });
        return html;
    }
}

module.exports = new TranscriptService();
