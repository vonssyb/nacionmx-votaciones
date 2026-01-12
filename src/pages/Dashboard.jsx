import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';

import LogList from './LogList';
import Rules from './Rules';
import LogForm from './LogForm';
import StaffHub from './StaffHub';
import Applications from './Applications';
import FinancePanel from './FinancePanel';
import RoleCancellation from './RoleCancellation';
import AdminPanel from './AdminPanel';

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

                <Route path="applications" element={<Applications />} />
                <Route path="bank" element={<FinancePanel />} />
                <Route path="cancellations" element={<RoleCancellation />} />
                <Route path="rules" element={<Rules />} />
                <Route path="admin" element={<AdminPanel />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
        </Routes>
    );
};

export default Dashboard;
