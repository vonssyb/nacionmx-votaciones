const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Groq = require('groq-sdk');

// Sistema de rotación Groq (mismo que ticketMessageHandler)
const GROQ_KEYS = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4
].filter(Boolean);

let currentKeyIndex = 0;
let groqClient = null;

function initializeGroq() {
    if (GROQ_KEYS.length === 0) return null;
    groqClient = new Groq({ apiKey: GROQ_KEYS[currentKeyIndex] });
    return groqClient;
}

async function rotateGroqKey() {
    currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
    groqClient = new Groq({ apiKey: GROQ_KEYS[currentKeyIndex] });
    console.log(`🔄 Rotando a Groq API Key #${currentKeyIndex + 1}`);
}

groqClient = initializeGroq();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai-consultar')
        .setDescription('🤖 Consulta a la IA sobre un caso administrativo')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a analizar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('pregunta')
                .setDescription('Pregunta específica para la IA (ej: "¿debería aceptar la apelación?")')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('usuario');
        const question = interaction.options.getString('pregunta') || 'Analiza este caso y dame una recomendación';

        await interaction.deferReply({ ephemeral: true });

        try {
            const supabase = interaction.client.supabase;

            // 1. Obtener datos del ciudadano
            let citizenInfo = '';
            try {
                const { data: citizen } = await supabase
                    .from('citizens')
                    .select('name, dni, roblox_username, discord_id')
                    .eq('discord_id', targetUser.id)
                    .maybeSingle();

                if (citizen) {
                    citizenInfo = `\n👤 IDENTIDAD RP:\n- Nombre: ${citizen.name}\n- DNI: ${citizen.dni}\n- Roblox: ${citizen.roblox_username || 'No vinculado'}\n`;
                }
            } catch (err) {
                console.error('Error fetching citizen:', err);
            }

            // 2. Obtener historial de sanciones
            let sanctionsInfo = '';
            try {
                const sanctions = await interaction.client.services.sanctions.getUserSanctions(targetUser.id);
                if (sanctions && sanctions.length > 0) {
                    const formatted = sanctions.slice(0, 10).map(s =>
                        `- [${new Date(s.created_at).toLocaleDateString()}] ${s.type.toUpperCase()}: ${s.reason} (Staff: ${s.staff_name}, Estado: ${s.status})`
                    ).join('\n');
                    sanctionsInfo = `\n📜 HISTORIAL DE SANCIONES (${sanctions.length} total):\n${formatted}\n`;
                } else {
                    sanctionsInfo = '\n📜 HISTORIAL: Limpio (Sin sanciones)\n';
                }
            } catch (err) {
                console.error('Error fetching sanctions:', err);
                sanctionsInfo = '\n⚠️ No se pudo consultar historial de sanciones\n';
            }

            // 3. Obtener tickets previos
            let ticketsInfo = '';
            try {
                const { data: tickets } = await supabase
                    .from('tickets')
                    .select('category, created_at, closed_at')
                    .eq('user_id', targetUser.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (tickets && tickets.length > 0) {
                    const formatted = tickets.map(t =>
                        `- [${new Date(t.created_at).toLocaleDateString()}] ${t.category}${t.closed_at ? ' (Cerrado)' : ' (Activo)'}`
                    ).join('\n');
                    ticketsInfo = `\n🎫 TICKETS PREVIOS (${tickets.length}):\n${formatted}\n`;
                }
            } catch (err) {
                console.error('Error fetching tickets:', err);
            }

            // 4. Construir contexto para la IA
            const aiContext = `
ANÁLISIS ADMINISTRATIVO SOLICITADO POR STAFF

Usuario Discord: ${targetUser.tag} (${targetUser.id})
Miembro desde: ${interaction.guild.members.cache.get(targetUser.id)?.joinedAt?.toLocaleDateString() || 'Desconocido'}

${citizenInfo}
${sanctionsInfo}
${ticketsInfo}

PREGUNTA DEL STAFF:
${question}

INSTRUCCIONES PARA LA IA:
- Analiza el historial completo del usuario
- Considera patrones de comportamiento (reincidencia, mejora, gravedad)
- Evalúa si hay circunstancias atenuantes o agravantes
- Proporciona una RECOMENDACIÓN CLARA (Aceptar/Rechazar/Reducir)
- Justifica tu recomendación con datos específicos
- Menciona riesgos si aplica
- Sugiere acciones alternativas si corresponde

RESPONDE DE FORMA ESTRUCTURADA:
1. ANÁLISIS DEL CASO
2. RECOMENDACIÓN
3. JUSTIFICACIÓN
4. CONSIDERACIONES ADICIONALES
`;

            // 5. Consultar a la IA
            let attempts = 0;
            let aiResponse = null;

            while (attempts < GROQ_KEYS.length && !aiResponse) {
                try {
                    const chatCompletion = await groqClient.chat.completions.create({
                        messages: [
                            {
                                role: "system",
                                content: `Eres un asistente de IA especializado en análisis administrativo para staff de servidores de roleplay. Tu trabajo es analizar casos objetivamente y proporcionar recomendaciones basadas en datos, no en emociones. Debes ser justo pero estricto con las normas.`
                            },
                            {
                                role: "user",
                                content: aiContext
                            }
                        ],
                        model: "llama-3.3-70b-versatile",
                        temperature: 0.7,
                        max_tokens: 1500
                    });

                    aiResponse = chatCompletion.choices[0]?.message?.content;
                    break;
                } catch (error) {
                    if (error.status === 429) {
                        console.log(`⚠️ Groq Key #${currentKeyIndex + 1} agotada, rotando...`);
                        await rotateGroqKey();
                        attempts++;
                    } else {
                        throw error;
                    }
                }
            }

            if (!aiResponse) {
                throw new Error('Todas las API keys de Groq agotadas');
            }

            // 6. Crear embed con la respuesta
            const embed = new EmbedBuilder()
                .setTitle('🤖 Análisis de IA - Decisión Administrativa')
                .setDescription(`**Usuario:** ${targetUser}\n**Analizado por:** ${interaction.user}\n\n${aiResponse}`)
                .setColor(0x5865F2)
                .setFooter({ text: '⚠️ Esto es una recomendación. La decisión final es del staff.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en ai-consultar:', error);
            await interaction.editReply({
                content: `❌ Error al consultar IA: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
