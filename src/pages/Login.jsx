import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleDiscordLogin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                    redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
                    scopes: 'guilds guilds.members.read',
                    queryParams: { prompt: 'consent' }
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error("Error logging in with Discord:", error.message);
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <CheckCircle size={64} color="#D90F74" />
                    <h1 style={styles.title}>NACIÓN MX</h1>
                    <p style={styles.subtitle}>Portal Electoral</p>
                </div>

                <div style={styles.content}>
                    <p style={styles.description}>
                        Identifícate con tu cuenta de Discord para validar tu identidad y poder emitir tu voto de forma segura.
                    </p>

                    <button
                        onClick={handleDiscordLogin}
                        style={styles.discordButton}
                        disabled={loading}
                    >
                        {loading ? 'Redirigiendo...' : (
                            <>
                                <svg width="24" height="24" viewBox="0 0 127.14 96.36" fill="white" style={{ marginRight: '0.5rem' }}>
                                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.09,105.09,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.36-24.44-5-47.25-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                                </svg>
                                Iniciar Sesión con Discord
                            </>
                        )}
                    </button>


                </div>

                <div style={styles.footer}>
                    <small>Sistema de Votación Seguro - NACIÓN MX</small>
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)',
    },
    card: {
        background: 'var(--bg-card)',
        padding: '3rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #D90F74',
        width: '100%',
        maxWidth: '450px',
        boxShadow: '0 20px 50px rgba(217, 15, 116, 0.1)',
        backdropFilter: 'blur(10px)',
        textAlign: 'center',
    },
    header: {
        marginBottom: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
    },
    title: {
        fontSize: '2rem',
        fontWeight: '800',
        color: 'var(--text-main)',
        margin: 0,
        letterSpacing: '1px',
    },
    subtitle: {
        color: '#D90F74',
        textTransform: 'uppercase',
        letterSpacing: '3px',
        fontSize: '0.9rem',
        fontWeight: 'bold',
        margin: 0,
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    description: {
        color: 'var(--text-muted)',
        fontSize: '0.95rem',
        marginBottom: '1rem',
        lineHeight: '1.6',
    },
    discordButton: {
        background: '#5865F2', // Discord Brand Color
        color: '#fff',
        padding: '1rem',
        borderRadius: 'var(--radius)',
        fontSize: '1rem',
        fontWeight: '600',
        border: 'none',
        transition: 'var(--transition)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
    },
    footer: {
        marginTop: '2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)',
        paddingTop: '1.5rem',
        fontSize: '0.8rem',
        opacity: 0.7,
    }
};

export default Login;
