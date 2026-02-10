import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Loader } from 'lucide-react';

const AuthCallback = () => {
    const navigate = useNavigate();
    const [timeoutReached, setTimeoutReached] = React.useState(false);

    useEffect(() => {
        const hash = window.location.hash;

        // Safety timeout: 10 seconds
        const timer = setTimeout(() => {
            console.warn("AuthCallback: Timeout reached, forcing navigation.");
            setTimeoutReached(true);
        }, 10000);

        // If this is an OAuth Redirect (contains access_token)
        if (hash.includes('access_token') || hash.includes('error')) {
            console.log("AuthCallback: Detected OAuth hash, waiting for session...");

            // Supabase client automatically parses the hash when it loads.
            // We just need to wait for the state change or session availability.

            const checkAndRedirect = async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    console.log("AuthCallback: Session found, redirecting.");
                    const redirectUrl = sessionStorage.getItem('auth_redirect');
                    if (redirectUrl) {
                        sessionStorage.removeItem('auth_redirect');
                        navigate(redirectUrl, { replace: true });
                    } else {
                        navigate('/dashboard', { replace: true });
                    }
                }
            };

            // Listen for the event (most reliable for OAuth redirect)
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                console.log(`AuthCallback: Auth Event ${event}`);
                if (event === 'SIGNED_IN' && session) {
                    const redirectUrl = sessionStorage.getItem('auth_redirect');
                    if (redirectUrl) {
                        sessionStorage.removeItem('auth_redirect');
                        navigate(redirectUrl, { replace: true });
                    } else {
                        navigate('/dashboard', { replace: true });
                    }
                } else if (event === 'SIGNED_OUT') {
                    // ...
                    navigate('/login', { replace: true });
                }
            });

            // Fallback check in case event fired before we listened
            checkAndRedirect();

            return () => {
                subscription.unsubscribe();
                clearTimeout(timer);
            };
        } else {
            // Normal 404 or Root access -> Go to Dashboard (which will redirect to Login if needed)
            clearTimeout(timer);
            console.log("AuthCallback: No tokens, redirecting to dashboard.");
            navigate('/dashboard', { replace: true });
        }
    }, [navigate]);

    if (timeoutReached) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#111827',
                color: '#fff',
                fontFamily: 'system-ui, sans-serif'
            }}>
                <div style={{ padding: '2rem', background: '#1f2937', borderRadius: '1rem', border: '1px solid #374151', textAlign: 'center', maxWidth: '400px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#f87171' }}>Tiempo de espera agotado</h3>
                    <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
                        La verificación de credenciales está tardando demasiado. Esto puede deberse a problemas de conexión o seguridad (SSL) en tu red.
                    </p>
                    <button
                        onClick={() => navigate('/login', { replace: true })}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: '#D90F74',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Volver a Intentar
                    </button>
                    <button
                        onClick={() => navigate('/', { replace: true })}
                        style={{
                            display: 'block',
                            margin: '1rem auto 0',
                            background: 'transparent',
                            color: '#6b7280',
                            border: 'none',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                        }}
                    >
                        Ir al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-[#D90F74]/20 blur-xl rounded-full animate-pulse"></div>
                <img
                    src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png"
                    alt="INE Loading"
                    className="h-24 w-auto object-contain relative z-10 animate-bounce-slow"
                />
            </div>
            <div className="w-12 h-12 border-4 border-gray-700 border-t-[#D90F74] rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-bold text-white tracking-wider">SISTEMA ELECTORAL</h2>
            <p className="text-[#D90F74] text-sm font-medium mt-2 animate-pulse">Procesando credenciales...</p>
            <style>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(-5%); }
                    50% { transform: translateY(5%); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default AuthCallback;
