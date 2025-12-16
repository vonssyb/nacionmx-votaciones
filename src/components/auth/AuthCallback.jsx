import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Loader } from 'lucide-react';

const AuthCallback = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const hash = window.location.hash;

        // If this is an OAuth Redirect (contains access_token)
        if (hash.includes('access_token') || hash.includes('error')) {
            console.log("AuthCallback: Detected OAuth hash, waiting for session...");

            // Supabase client automatically parses the hash when it loads.
            // We just need to wait for the state change or session availability.

            const checkAndRedirect = async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    console.log("AuthCallback: Session found, redirecting to dashboard.");
                    navigate('/dashboard', { replace: true });
                }
            };

            // Listen for the event (most reliable for OAuth redirect)
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                console.log(`AuthCallback: Auth Event ${event}`);
                if (event === 'SIGNED_IN' && session) {
                    navigate('/dashboard', { replace: true });
                } else if (event === 'SIGNED_OUT') {
                    // If failed or cancelled
                    navigate('/login', { replace: true });
                }
            });

            // Fallback check in case event fired before we listened
            checkAndRedirect();

            return () => subscription.unsubscribe();
        } else {
            // Normal 404 or Root access -> Go to Dashboard (which will redirect to Login if needed)
            console.log("AuthCallback: No tokens, redirecting to dashboard.");
            navigate('/dashboard', { replace: true });
        }
    }, [navigate]);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-dark)',
            color: 'var(--text-main)'
        }}>
            <Loader size={48} className="animate-spin" color="var(--primary)" />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Procesando credenciales...</p>
            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default AuthCallback;
