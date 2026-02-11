import { HashRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AuthCallback from './components/auth/AuthCallback';
import LandingPage from './pages/LandingPage';
import ApplyPage from './pages/ApplyPage';
import Elections from './pages/Elections';
import ElectionsAdmin from './pages/admin/ElectionsAdmin';
import RoleGuard from './components/auth/RoleGuard';

function App() {
  // Check if we are in an OAuth redirect (access_token in hash) BEFORE the router takes over
  // Supabase puts the token in the hash, e.g. #access_token=...
  // HashRouter thinks this is a route. We need to intercept it.
  const hash = window.location.hash;
  if (hash && (hash.includes('access_token=') || hash.includes('error='))) {
    return (
      <HashRouter>
        <AuthCallback />
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<RoleGuard requireAuth={false}><Elections /></RoleGuard>} />
        <Route path="/inicio" element={<LandingPage />} />
        <Route path="/aplicar" element={<ApplyPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/votaciones" element={<RoleGuard key="elections-vote" requireAuth={false}><Elections /></RoleGuard>} />
        <Route path="/elecciones" element={<RoleGuard key="elections-public" requireAuth={false}><Elections /></RoleGuard>} />
        <Route path="/admin/elecciones" element={<RoleGuard key="elections-admin"><ElectionsAdmin /></RoleGuard>} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        {/* Auth Callback for specific cases if needed, but Landing handles auth state */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
