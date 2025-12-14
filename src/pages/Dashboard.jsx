import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
// Placeholder components


import LogList from './LogList';
import Rules from './Rules';

import LogForm from './LogForm';
import StaffHub from './StaffHub';
import BoloBoard from './BoloBoard';
import Applications from './Applications';

import RoleGuard from '../components/auth/RoleGuard';
import ShiftPanel from './ShiftPanel';

const Dashboard = () => {
    return (
        <Routes>
            <Route element={
                <RoleGuard>
                    <MainLayout />
                </RoleGuard>
            }>
                <Route index element={<LogList />} />
                <Route path="shift" element={<ShiftPanel />} />
                <Route path="new" element={<LogForm />} />
                <Route path="staff" element={<StaffHub />} />
                <Route path="bolo" element={<BoloBoard />} />
                <Route path="applications" element={<Applications />} />
                <Route path="rules" element={<Rules />} />
                <Route path="admin" element={<div className="page-header"><h1 className="page-title">Panel Administrativo</h1></div>} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
        </Routes>
    );
};

export default Dashboard;
