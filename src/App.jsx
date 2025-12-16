import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AuthCallback from './components/auth/AuthCallback';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        {/* Handle Root and Wildcard with AuthCallback to catch OAuth tokens */}
        <Route path="/" element={<AuthCallback />} />
        <Route path="*" element={<AuthCallback />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
