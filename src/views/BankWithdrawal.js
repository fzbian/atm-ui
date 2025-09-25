import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import useTitle from '../useTitle';
import { getSessionUsername, getUsers } from '../auth';
import { useNotifications } from '../components/Notifications';
import { formatCLP } from '../formatMoney';

export default function BankWithdrawal() {
  useTitle('Retirar dinero de banco · ATM Ricky Rich');
  const navigate = useNavigate();
  const { notify } = useNotifications();

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const uname = getSessionUsername();
        const list = await getUsers();
        const arr = Array.isArray(list) ? list : [];
        const me = arr.find(u => u.username === uname);
        setDisplayName(me?.displayName || uname || '');
      } catch {
        setDisplayName(getSessionUsername() || '');
      }
    })();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const n = Number(amount);
    if (!n || Number.isNaN(n) || n <= 0) return setError('Monto inválido');

    const usuario = displayName || getSessionUsername() || '';
  const body = { monto: n, usuario, Descripcion: 'Retiro de efectivo desde Cuenta bancaria' };

    try {
      setLoading(true);
      const r = await apiFetch('/api/cuenta/retiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        let msg = 'No se pudo completar el retiro';
        try { const d = await r.json(); if (d?.error) msg = d.error; } catch { msg = await r.text().catch(()=>msg) || msg; }
        notify({ type: 'error', title: 'Retiro fallido', message: msg });
        throw new Error(msg);
      }
      const data = await r.json().catch(() => null);
      notify({ type: 'success', title: 'Retiro realizado', message: data?.ingreso?.id ? `OK: Tx ${data.egreso?.id} y ${data.ingreso?.id} por ${formatCLP(n)}.` : `OK por ${formatCLP(n)}.` });
      navigate('/movements', { state: { reload: true } });
    } catch (e2) {
      setError(e2.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex flex-col">
      <Header title="Retirar dinero de banco" />
      <main className="flex-1 p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] view-enter view-enter-active">
        <form onSubmit={onSubmit} className="space-y-4 max-w-md mx-auto">
          <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)]">
            <h2 className="text-sm font-semibold text-[var(--text-secondary-color)] mb-3">Datos del retiro</h2>
            <div className="grid gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Monto</label>
                <div className="space-y-1">
                  <input type="number" min="1" step="1" className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" />
                  <p className="text-[11px] text-[var(--text-secondary-color)]">{Number(amount)>0 ? `Vista previa: ${formatCLP(amount)}` : 'Ingrese un monto mayor a 0'}</p>
                </div>
              </div>
            </div>
            {error && <p className="text-sm text-[var(--danger-color)] mt-3">{error}</p>}
            <button type="submit" disabled={loading} className="mt-4 w-full inline-flex justify-center items-center gap-2 px-4 py-3 rounded-lg bg-[var(--primary-color)] text-white font-semibold disabled:opacity-70">
              <span className="material-symbols-outlined !text-white">account_balance</span>
              {loading ? 'Procesando…' : 'Retirar dinero de banco'}
            </button>
          </section>
        </form>
      </main>
      <BottomNav
        onHome={() => navigate('/dashboard')}
        onMovements={() => navigate('/movements')}
        onWallet={() => navigate('/wallet')}
        onReports={() => navigate('/reports')}
        onAddIncome={() => navigate('/new?tipo=INGRESO')}
        onAddExpense={() => navigate('/new?tipo=EGRESO')}
        onCashout={() => navigate('/cashout')}
        onCashoutBank={() => {}}
        active={null}
      />
    </div>
  );
}
