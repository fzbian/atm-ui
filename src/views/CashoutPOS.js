import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import ServerDown from '../components/ServerDown';
import { useNavigate } from 'react-router-dom';
import { apiFetch, pingServer } from '../api';
import useTitle from '../useTitle';
import useTimeout from '../useTimeout';
import { formatCLP } from '../formatMoney';
import { getSessionUsername, getUsers } from '../auth';
import { useNotifications } from '../components/Notifications';

export default function CashoutPOS() {
  const navigate = useNavigate();
  useTitle('Retirar efectivo en punto · ATM Ricky Rich');
  const { notify } = useNotifications();

  const [checking, setChecking] = useState(true);
  const [serverOk, setServerOk] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [amount, setAmount] = useState('');
  const [posList, setPosList] = useState([]);
  const [posName, setPosName] = useState('');
  const [reason, setReason] = useState('');
  const [categoriaId, setCategoriaId] = useState('16'); // por defecto 16 = Efectivos Puntos de Venta

  useEffect(() => {
    (async () => {
      const ok = await pingServer();
      setServerOk(ok);
      setChecking(false);
      if (ok) {
        try {
          console.log('[CashoutPOS] Request GET POS', { path: '/api/odoo/pos', headers: { accept: 'application/json' } });
          const r = await apiFetch('/api/odoo/pos', { headers: { accept: 'application/json' } });
          console.log('[CashoutPOS] Response GET POS', { ok: r.ok, status: r.status, url: r.url, statusText: r.statusText });
          if (!r.ok) throw new Error(await r.text().catch(()=>'Error cargando puntos de venta'));
          const data = await r.json();
          console.log('[CashoutPOS] Data GET POS', { type: Array.isArray(data) ? 'array' : typeof data, size: Array.isArray(data) ? data.length : undefined, sample: Array.isArray(data) ? data.slice(0, 3) : data });
          const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
          setPosList(list);
          if (list.length && !posName) {
            const first = list[0];
            const initial = typeof first === 'string' ? first : (first?.pos_name || first?.name || first?.display_name || '');
            setPosName(initial);
          }
        } catch (e) {
          console.error(e);
          setError(e.message || 'No se pudo cargar puntos de venta');
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useTimeout(() => {
    if (serverOk === null && checking) setChecking(false);
  }, 4000, [serverOk, checking]);

  const currentUser = getSessionUsername();
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

    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) return setError('Monto inválido');
    if (!posName) return setError('Selecciona un punto de venta');

    const usuario = displayName || currentUser;

    try {
      setLoading(true);
      const payload = { amount: amt, category_name: 'RETIRADA', pos_name: posName, reason: reason || 'RETIRO', usuario };
      if (categoriaId) payload.categoria_id = Number(categoriaId);
      console.log('[CashoutPOS] Request POST cashout', { path: '/api/odoo/cashout', body: payload });
      const r = await apiFetch('/api/odoo/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('[CashoutPOS] Response POST cashout', { ok: r.ok, status: r.status, url: r.url, statusText: r.statusText });
      if (!r.ok) {
        let msg = 'No se pudo enviar la solicitud';
        try { const d = await r.json(); if (d?.error) msg = d.error; } catch { msg = await r.text().catch(()=>msg) || msg; }
        notify({ type: 'error', title: 'Cashout fallido', message: msg });
        throw new Error(msg);
      }
      // leer cuerpo para evaluar ok en payload
      let data = null;
      try { data = await r.json(); } catch {}
      if (data && data.ok === false) {
  const msg = data.message || `Cashout rechazado por validación${amount ? ` (${formatCLP(amount)})` : ''}`;
        notify({ type: 'error', title: 'Cashout rechazado', message: msg });
        setError(msg);
        return;
      }
      // éxito
  notify({ type: 'success', title: 'Cashout enviado', message: (data && data.message) ? String(data.message) : `Solicitud enviada (${formatCLP(amount)})` });
      navigate('/movements');
    } catch (e) {
      console.error('[CashoutPOS] Error POST cashout', e);
  setError(e.message || 'Error al solicitar retiro');
  if (!e.message) notify({ type: 'error', title: 'Cashout fallido', message: 'Error al solicitar retiro' });
    } finally {
      setLoading(false);
    }
  };

  if (serverOk === false) {
    return (
      <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex flex-col">
        <Header title="Retirar efectivo en punto" />
        <ServerDown onRetry={() => {
          setChecking(true);
          (async () => {
            const ok = await pingServer();
            setServerOk(ok);
            setChecking(false);
            if (ok) window.location.reload();
          })();
        }} />
        <BottomNav
          onHome={() => navigate('/dashboard')}
          onMovements={() => navigate('/movements')}
          onWallet={() => navigate('/wallet')}
          onReports={() => navigate('/reports')}
          onAddIncome={() => navigate('/new?tipo=INGRESO')}
          onAddExpense={() => navigate('/new?tipo=EGRESO')}
          onCashout={() => {}}
          active={null}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex flex-col">
      <Header title="Retirar efectivo en punto" />
      <main className="flex-1 p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] view-enter view-enter-active">
        <form onSubmit={onSubmit} className="space-y-4 max-w-md mx-auto">
          <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)]">
            <h2 className="text-sm font-semibold text-[var(--text-secondary-color)] mb-3">Datos de la solicitud</h2>
            <div className="grid gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Monto</label>
                <div className="space-y-1">
                  <input type="number" min="1" step="1" className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" />
                  <p className="text-[11px] text-[var(--text-secondary-color)]">{Number(amount)>0 ? `Vista previa: ${formatCLP(amount)}` : 'Ingrese un monto mayor a 0'}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Punto de venta</label>
                <select className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm" value={posName} onChange={e=>setPosName(e.target.value)}>
                  <option value="" disabled>Selecciona un punto</option>
                  {posList.map((p, idx) => {
                    const value = typeof p === 'string' ? p : (p?.pos_name || p?.name || p?.display_name || '');
                    const label = typeof p === 'string' ? p : (p?.display_name || p?.name || p?.pos_name || value);
                    return <option key={idx} value={value}>{label}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Motivo (opcional)</label>
                <input className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Retirada Nicxy" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Categoría</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${categoriaId==='16' ? 'border-[var(--primary-color)] bg-white/5' : 'border-[var(--border-color)] hover:bg-white/5'}`}>
                    <input type="radio" name="cat" value="16" className="sr-only" checked={categoriaId==='16'} onChange={()=>setCategoriaId('16')} />
                    <span className="material-symbols-outlined text-[var(--success-color)]">trending_up</span>
                    <div className="text-sm">
                      <div className="font-medium">Retirada de cajas</div>
                      <div className="text-[11px] text-[var(--text-secondary-color)]">Genera el retiro en el punto de venta y se hace el ingreso en el saldo EFECTIVO</div>
                    </div>
                  </label>
                  <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${categoriaId==='' ? 'border-[var(--primary-color)] bg-white/5' : 'border-[var(--border-color)] hover:bg-white/5'}`}>
                    <input type="radio" name="cat" value="" className="sr-only" checked={categoriaId===''} onChange={()=>setCategoriaId('')} />
                    <span className="material-symbols-outlined text-[var(--text-secondary-color)]">sell</span>
                    <div className="text-sm">
                      <div className="font-medium">Solo cashout en Odoo</div>
                      <div className="text-[11px] text-[var(--text-secondary-color)]">Hace una retirada simple, pensada para los gastos comunes</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="mt-4 w-full inline-flex justify-center items-center gap-2 px-4 py-3 rounded-lg bg-[#2563eb] text-white font-semibold disabled:opacity-70">
              <span className="material-symbols-outlined !text-white">point_of_sale</span>
              {loading ? 'Enviando…' : 'Solicitar retiro'}
            </button>
          </section>
        </form>
      </main>

      {/* Overlay de carga a pantalla completa */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl p-6 text-center shadow-xl">
            <div className="mx-auto h-12 w-12 rounded-full border-4 border-white/20 border-t-white animate-spin mb-4" aria-hidden />
            <h3 className="text-lg font-semibold mb-1">Procesando retirada…</h3>
            <p className="text-sm text-[var(--text-secondary-color)]">
              {Number(amount) > 0 ? `Monto: ${formatCLP(amount)}.` : ''} {posName ? `Punto: ${posName}.` : ''}
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary-color)]">No cierres esta ventana.</p>
          </div>
        </div>
      )}

      {/* Overlay de error */}
      {!!error && !loading && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 text-[var(--danger-color)] mb-3">
              <span className="material-symbols-outlined">error</span>
              <h3 className="text-lg font-semibold">No se pudo completar</h3>
            </div>
            <p className="text-sm">{error}</p>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setError('')} className="px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-white/5">Cerrar</button>
            </div>
          </div>
        </div>
      )}
      <BottomNav
        onHome={() => navigate('/dashboard')}
        onMovements={() => navigate('/movements')}
        onWallet={() => navigate('/wallet')}
        onReports={() => navigate('/reports')}
        onAddIncome={() => navigate('/new?tipo=INGRESO')}
        onAddExpense={() => navigate('/new?tipo=EGRESO')}
        onCashout={() => {}}
        active={null}
      />
    </div>
  );
}
