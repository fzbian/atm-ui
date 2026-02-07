import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./views/Dashboard";
import Movements from "./views/Movements";
import NewTransaction from "./views/NewTransaction";
import Wallet from "./views/Wallet";
import ClientInvoices from "./views/ClientInvoices";
import CreateInvoiceWizard from "./views/CreateInvoiceWizard";
import CreateAbonoWizard from "./views/CreateAbonoWizard";
import InvoiceAbonos from "./views/InvoiceAbonos";
import Reports from "./views/Reports";
import Login from './views/Login';
import { isAuthenticated, isAdmin } from './auth';
import AdminUsers from './views/AdminUsers';
import AdminRoles from './views/AdminRoles';
import AdminCategories from './views/AdminCategories';
import CashoutPOS from './views/CashoutPOS';
import BankWithdrawal from './views/BankWithdrawal';
import Gastos from './views/Gastos';
import Pedidos from './views/Pedidos';
import Payroll from './views/Payroll';
import Billing from './views/Billing';
import { RoleProvider, useRole } from './context/RoleContext';
import HomeFallback from './views/HomeFallback';

function DashboardRoute() {
  const { hasAccess, loading } = useRole();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[var(--background-color)] text-[var(--text-secondary-color)]">Cargando...</div>;
  return hasAccess('dashboard') ? <Dashboard /> : <HomeFallback />;
}

function App() {
  return (
    <RoleProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={<RequireAuth><DashboardRoute /></RequireAuth>} />
        <Route path="/movements" element={<RequireAuth><Movements /></RequireAuth>} />
        <Route path="/new" element={<RequireAuth><NewTransaction /></RequireAuth>} />
        <Route path="/wallet" element={<RequireAuth><Wallet /></RequireAuth>} />
        <Route path="/wallet/client/:id/invoices" element={<RequireAuth><ClientInvoices /></RequireAuth>} />
        <Route path="/wallet/client/:id/invoices/new" element={<RequireAuth><CreateInvoiceWizard /></RequireAuth>} />
        <Route path="/wallet/client/:id/abonos/new" element={<RequireAuth><CreateAbonoWizard /></RequireAuth>} />
        <Route path="/wallet/client/:clientId/invoices/:invoiceId/abonos" element={<RequireAuth><InvoiceAbonos /></RequireAuth>} />
        <Route path="/cashout" element={<RequireAuth><CashoutPOS /></RequireAuth>} />
        <Route path="/cashout-bank" element={<RequireAuth><BankWithdrawal /></RequireAuth>} />
        <Route path="/gastos" element={<RequireAuth><Gastos /></RequireAuth>} />
        <Route path="/pedidos" element={<RequireAuth><Pedidos /></RequireAuth>} />
        <Route path="/payroll" element={<RequireAuth><Payroll /></RequireAuth>} />
        <Route path="/billing" element={<RequireAuth><Billing /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />

        {/* Admin Routes */}
        <Route path="/admin/users" element={<RequireAuth><RequireAdmin><AdminUsers /></RequireAdmin></RequireAuth>} />
        <Route path="/admin/roles" element={<RequireAuth><RequireAdmin><AdminRoles /></RequireAdmin></RequireAuth>} />
        <Route path="/admin/categories" element={<RequireAuth><RequireAdmin><AdminCategories /></RequireAdmin></RequireAuth>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </RoleProvider>
  );
}

export default App;

function RequireAuth({ children }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function RequireAdmin({ children }) {
  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
