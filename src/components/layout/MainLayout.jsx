import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Shield, BookOpen, FileText, Settings, LogOut, Users, Skull, Clock, DollarSign } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useDiscordMember } from '../auth/RoleGuard'; // Import Context Hook
import './MainLayout.css';

const MainLayout = () => {
    const navigate = useNavigate();
    const memberData = useDiscordMember(); // Get data from RoleGuard

    const [profile, setProfile] = useState({
        username: 'Usuario',
        role: 'Miembro',
        avatar: null
    });

    useEffect(() => {
        // Calculate profile data from Context immediately
        if (memberData && memberData.user) {
            let username = memberData.nick || memberData.user.username; // Use nick or username

            let avatar = null;
            if (memberData.user.avatar) {
                avatar = `https://cdn.discordapp.com/avatars/${memberData.user.id}/${memberData.user.avatar}.png`;
            }

            let roleLabel = 'Miembro';
            const myRoles = memberData.roles || [];

            if (myRoles.includes('1412882240991658177')) roleLabel = 'Owner';
            else if (myRoles.includes('1449856794980516032')) roleLabel = 'Co-Owner';
            else if (myRoles.includes('1412882245735420006')) roleLabel = 'Junta Directiva';
            else if (myRoles.includes('1412882248411381872')) roleLabel = 'Administrador';
            else if (myRoles.includes('1412887079612059660')) roleLabel = 'Staff';
            else if (myRoles.includes('1412887167654690908')) roleLabel = 'Staff Ent.';

            setProfile({ username, role: roleLabel, avatar, debugRoles: myRoles });
        }
    }, [memberData]);

    const handleLogout = async () => {
        // Clear cache on logout
        sessionStorage.clear();
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <div className="layout-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <Shield size={32} color="var(--primary)" />
                    <span className="sidebar-title">NACIÓN MX</span>
                </div>

                <nav className="nav-links">
                    <NavLink to="/dashboard" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <FileText size={20} />
                        <span>Registros</span>
                    </NavLink>
                    <NavLink to="/dashboard/staff" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Users size={20} />
                        <span>Staff Hub</span>
                    </NavLink>
                    <NavLink to="/dashboard/cancellations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <LogOut size={20} />
                        <span>Cancelar Rol</span>
                    </NavLink>

                    <NavLink to="/dashboard/applications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <FileText size={20} />
                        <span>Solicitudes</span>
                    </NavLink>
                    <NavLink to="/dashboard/rules" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <BookOpen size={20} />
                        <span>Reglamento</span>
                    </NavLink>
                    <NavLink to="/dashboard/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings size={20} />
                        <span>Admin</span>
                    </NavLink>
                    <NavLink to="/dashboard/shift" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Clock size={20} />
                        <span>Fichar Turno</span>
                    </NavLink>
                    <NavLink to="/dashboard/bank" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <DollarSign size={20} />
                        <span>Banco</span>
                    </NavLink>
                </nav>

                <div className="user-profile">
                    {profile.avatar ? (
                        <img src={profile.avatar} alt="Profile" className="user-avatar" />
                    ) : (
                        <div className="user-avatar-placeholder">
                            {profile.username.charAt(0)}
                        </div>
                    )}
                    <div className="user-info">
                        <h4>{profile.username}</h4>
                        <span className="user-role-badge">{profile.role}</span>
                    </div>
                    <button onClick={handleLogout} className="nav-item logout-btn" title="Cerrar Sesión">
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
