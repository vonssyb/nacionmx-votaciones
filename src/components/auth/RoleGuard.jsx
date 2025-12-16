import React, { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '../../services/supabase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Loader } from 'lucide-react';

// CONFIGURATION
const GUILD_ID = '1398525215134318713'; // Nacion MX

// Allowed Roles
const ALLOWED_ROLE_IDS = [
    '1412882240991658177', // Owner
    '1449856794980516032', // Co Owner
    '1412882245735420006', // Junta Directiva
    '1412882248411381872', // Administrador
    '1412887079612059660', // Staff
    '1412887167654690908'  // Staff en entrenamiento
];

// Context to share member data with children (MainLayout)
const DiscordContext = createContext(null);

export const useDiscordMember = () => useContext(DiscordContext);

const RoleGuard = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [error, setError] = useState(null);
    const [memberData, setMemberData] = useState(null); // Store fetched data
    const navigate = useNavigate();

    const loadingRef = React.useRef(loading);

    useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);

    useEffect(() => {
        let mounted = true;

        const checkSession = async (retries = 3) => {
            try {
                // 1. Get Initial Session
                const { data: { session }, error } = await supabase.auth.getSession();

                if (session) {
                    if (mounted) verifyDiscordRole(session);
                    return;
                }

                if (error) {
                    console.error("Session check error:", error);
                    // Don't throw immediately, try recovery
                }

                // Check if we are in an OAuth callback flow
                const hash = window.location.hash;
                const search = window.location.search;

                // Specific check for errors
                if (hash.includes('error') || search.includes('error')) {
                    console.warn("OAuth Error detected. Redirecting to login.");
                    if (mounted) {
                        setLoading(false);
                        navigate('/login');
                    }
                    return;
                }

                const isCallback = hash.includes('access_token') || search.includes('code');

                if (isCallback) {
                    // Valid callback, wait for auth listener
                    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                        if (event === 'SIGNED_IN' && session) {
                            if (mounted) verifyDiscordRole(session);
                        } else if (event === 'SIGNED_OUT') {
                            if (mounted) {
                                setLoading(false);
                                navigate('/login');
                            }
                        }
                    });
                    return () => subscription.unsubscribe();
                }

                // NO Session & NO Callback -> Grace Period / Retry
                // Sometimes Supabase takes a moment to load from LocalStorage
                if (retries > 0) {
                    console.log(`No session yet, retrying... (${retries} left)`);
                    setTimeout(() => {
                        if (mounted) checkSession(retries - 1);
                    }, 500); // Wait 500ms and retry
                    return;
                }

                // If retries exhausted and still no session:
                console.warn("No session and no callback detected (after retries). Redirecting to login.");
                console.warn("Debug URL:", window.location.href);
                if (mounted) {
                    setLoading(false);
                    navigate('/login');
                }

            } catch (err) {
                console.error("Critical Session Error:", err);
                if (mounted) {
                    setLoading(false);
                    navigate('/login');
                }
            }
        };

        checkSession();

        // Failsafe: If truly stuck (loading is still true in ref), force redirect
        const timeout = setTimeout(() => {
            if (mounted && loadingRef.current) {
                console.warn("RoleGuard timeout. Force redirecting to login.");
                setLoading(false);
                navigate('/login');
            }
        }, 6000);

        return () => {
            mounted = false;
            clearTimeout(timeout);
        };
    }, []);

    const verifyDiscordRole = async (session) => {
        const providerToken = session.provider_token;
        if (!providerToken) {
            console.warn("No provider token found. Re-login required.");
            await supabase.auth.signOut();
            navigate('/login');
            return;
        }

        try {
            // Check cache first to avoid 429 loops during dev
            const cacheKey = `discord_member_${session.user.id}`;
            const cached = sessionStorage.getItem(cacheKey);

            let data;

            if (cached) {
                console.log("Using cached Discord member data");
                data = JSON.parse(cached);
            } else {
                console.log("Fetching Discord member data from API...");
                const response = await fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, {
                    headers: {
                        Authorization: `Bearer ${providerToken}`
                    }
                });

                if (response.status === 404) {
                    throw new Error("No eres miembro del servidor de Discord de Nación MX.");
                }

                if (response.status === 429) {
                    throw new Error("Discord API Rate Limit. Por favor espera unos minutos antes de recargar.");
                }

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    console.error("Discord API Error:", response.status, errData);
                    throw new Error(`Error ${response.status}: ${errData.message || 'Error verificando roles'}`);
                }

                data = await response.json();
                // Cache for 5 minutes
                sessionStorage.setItem(cacheKey, JSON.stringify(data));
            }

            const userRoles = data.roles || []; // Array of role IDs

            console.log("DEBUG: Your Roles:", userRoles);
            console.log("DEBUG: Allowed Roles:", ALLOWED_ROLE_IDS);

            // Check if user has at least one allowed role
            const hasRole = userRoles.some(roleId => ALLOWED_ROLE_IDS.includes(roleId));

            if (hasRole) {
                console.log("DEBUG: Authorization Success!");
                setAuthorized(true);
                setMemberData(data); // Save for context
            } else {
                console.error("DEBUG: Authorization FAILED. Missing role.");
                throw new Error("No tienes los roles necesarios para acceder a este panel.");
            }

        } catch (err) {
            console.error(err);
            setError(err.message);
            setAuthorized(false);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={styles.center}>
                <Loader size={48} className="animate-spin" color="var(--primary)" />
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Verificando credenciales...</p>
                <style>{`
                    .animate-spin { animation: spin 1s linear infinite; }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.center}>
                <div style={styles.card}>
                    <ShieldAlert size={64} color="#e74c3c" />
                    <h1 style={styles.title}>Acceso Denegado</h1>
                    <p style={styles.message}>{error}</p>
                    <button onClick={() => { supabase.auth.signOut(); navigate('/login'); }} style={styles.button}>
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <DiscordContext.Provider value={memberData}>
            {authorized ? children : null}
        </DiscordContext.Provider>
    );
};

const styles = {
    center: {
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-dark)',
        color: 'var(--text-main)',
    },
    card: {
        background: 'var(--bg-card)',
        padding: '3rem',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        textAlign: 'center',
        maxWidth: '400px',
    },
    title: {
        margin: '1rem 0',
        fontSize: '1.5rem',
        color: '#e74c3c',
    },
    message: {
        color: 'var(--text-muted)',
        marginBottom: '2rem',
    },
    button: {
        background: 'var(--bg-card-hover)',
        color: 'var(--text-main)',
        border: '1px solid var(--border)',
        padding: '0.75rem 1.5rem',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
    }
};

export default RoleGuard;
