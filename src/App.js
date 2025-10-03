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
import AdminCategories from './views/AdminCategories';
import CashoutPOS from './views/CashoutPOS';
import BankWithdrawal from './views/BankWithdrawal';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/movements" element={<RequireAuth><Movements /></RequireAuth>} />
      <Route path="/new" element={<RequireAuth><NewTransaction /></RequireAuth>} />
  <Route path="/wallet/*" element={<RequireAuth><Wallet /></RequireAuth>} />
  <Route path="/wallet/client/:id/invoices" element={<RequireAuth><ClientInvoices /></RequireAuth>} />
  <Route path="/wallet/client/:id/invoices/new" element={<RequireAuth><CreateInvoiceWizard /></RequireAuth>} />
  <Route path="/wallet/client/:id/abonos/new" element={<RequireAuth><CreateAbonoWizard /></RequireAuth>} />
  <Route path="/wallet/client/:clientId/invoices/:invoiceId/abonos" element={<RequireAuth><InvoiceAbonos /></RequireAuth>} />
  <Route path="/cashout" element={<RequireAuth><CashoutPOS /></RequireAuth>} />
      <Route path="/cashout-bank" element={<RequireAuth><BankWithdrawal /></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth><RequireDev><AdminUsers /></RequireDev></RequireAuth>} />
      <Route path="/admin/categories" element={<RequireAuth><RequireDev><AdminCategories /></RequireDev></RequireAuth>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
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

function RequireDev({ children }) {
  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
