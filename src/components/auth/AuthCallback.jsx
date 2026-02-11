import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Loader } from 'lucide-react';

const AuthCallback = () => {
    const navigate = useNavigate();
    const [timeoutReached, setTimeoutReached] = React.useState(false);

    useEffect(() => {
        const hash = window.location.hash;

        // Safety timeout: 3 seconds to show manual exit
        const timer = setTimeout(() => {
            console.warn("AuthCallback: Slow connection detected, showing exit option.");
            setTimeoutReached(true);
        }, 3000);

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
                        navigate('/elecciones', { replace: true });
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
                        navigate('/elecciones', { replace: true });
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
            console.log("AuthCallback: No tokens, redirecting to elections.");
            navigate('/elecciones', { replace: true });
        }
    }, [navigate]);

    // Timeout handled in main return


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
            <p className="text-[#D90F74] text-sm font-medium mt-2 animate-pulse">Procesando credenciales (v2)...</p>

            {timeoutReached && (
                <div className="mt-8 animate-fade-in">
                    <button
                        onClick={() => navigate('/login', { replace: true })}
                        className="px-6 py-2 bg-[#D90F74] text-white rounded-full font-bold hover:bg-[#b00c5e] transition-colors shadow-lg"
                    >
                        Cancelar / Volver
                    </button>
                    <p className="text-gray-500 text-xs mt-2 text-center">Si esto tarda mucho, pulsa cancelar.</p>
                </div>
            )}

            <style>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(-5%); }
                    50% { transform: translateY(5%); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s infinite ease-in-out;
                }
                .animate-fade-in {
                    animation: fadeIn 0.5s ease-in;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default AuthCallback;
