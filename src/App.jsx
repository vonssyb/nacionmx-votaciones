import { HashRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AuthCallback from './components/auth/AuthCallback';
import LandingPage from './pages/LandingPage';
import ApplyPage from './pages/ApplyPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/aplicar" element={<ApplyPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        {/* Auth Callback for specific cases if needed, but Landing handles auth state */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
