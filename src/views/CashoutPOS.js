import React, { useEffect, useMemo, useState } from 'react';
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
  const [loadingCaja, setLoadingCaja] = useState(false);
  const [cajaData, setCajaData] = useState(null);
  const [step, setStep] = useState(1);
  const [retiroTipo, setRetiroTipo] = useState(''); // 'caja' | 'cashout'

  const [amount, setAmount] = useState('');
  const [posName, setPosName] = useState('');
  const [reason, setReason] = useState('');
  const [categoriaId, setCategoriaId] = useState('');

  useEffect(() => {
    (async () => {
      const ok = await pingServer();
      setServerOk(ok);
      setChecking(false);
      if (ok) {
        try {
          setLoadingCaja(true);
          console.log('[CashoutPOS] Request GET caja', { path: '/api/caja' });
          const r = await apiFetch('/api/caja', { headers: { accept: 'application/json' } });
          console.log('[CashoutPOS] Response GET caja', { ok: r.ok, status: r.status, url: r.url, statusText: r.statusText });
          if (!r.ok) throw new Error(await r.text().catch(()=>'Error cargando caja'));
          const data = await r.json();
          console.log('[CashoutPOS] Data GET caja', data);
          setCajaData(data);
        } catch (e) {
          console.error(e);
          setError(e.message || 'No se pudo cargar caja');
        } finally {
          setLoadingCaja(false);
        }
      }
    })();
  }, []);

  useTimeout(() => {
    if (serverOk === null && checking) setChecking(false);
  }, 4000, [serverOk, checking]);

  const currentUser = getSessionUsername();
  const [displayName, setDisplayName] = useState('');

  const localesList = useMemo(() => {
    if (!cajaData?.locales) return [];
    return Object.entries(cajaData.locales).map(([key, info]) => {
      const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const estado = String(info?.estado_sesion || '').toLowerCase();
      const estadoLabel = estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : '—';
      const estadoBadge = estado === 'abierta'
        ? 'border-green-500/40 bg-green-500/10 text-green-200'
        : 'border-white/15 bg-white/5 text-white/70';
      return {
        value: label,
        label,
        saldo: Number(info?.saldo_en_caja) || 0,
        vendido: Number(info?.vendido) || 0,
        estado,
        estadoLabel,
        estadoBadge,
      };
    });
  }, [cajaData]);

  const selectedLocal = useMemo(() => localesList.find(l => l.value === posName), [localesList, posName]);

  const canStep2 = Boolean(retiroTipo);
  const canStep3 = canStep2 && !loadingCaja && posName;
  const canStep4 = canStep3 && Number(amount) > 0;
  const canStep5 = canStep4; // motivo opcional

  // UX: al cambiar de paso, lleva al inicio del formulario para evitar que el usuario quede scrolleado
  useEffect(() => {
    const el = document.getElementById('cashout-form-top');
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [step]);

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
    if (e?.preventDefault) e.preventDefault();
    if (loading) return;
    setError('');

    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) return setError('Monto inválido');
    if (!posName) return setError('Selecciona un punto de venta');
    if (!retiroTipo) return setError('Selecciona el tipo de retiro');

    const usuario = displayName || currentUser;

    try {
      setLoading(true);
      const payload = { amount: amt, category_name: 'RETIRADA', pos_name: posName, reason: reason || 'RETIRO', usuario };
      if (categoriaId !== '') payload.categoria_id = Number(categoriaId);
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
      <main className="flex-1 p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] view-enter view-enter-active">
        <div id="cashout-form-top" className="max-w-lg mx-auto space-y-4">
          <header className="space-y-1">
            <p className="text-xs text-[var(--text-secondary-color)]">Flujo guiado · 4 pasos</p>
            <h1 className="text-xl font-semibold">Retiro de efectivo</h1>
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary-color)]">
              <span className="material-symbols-outlined text-sm" aria-hidden>progress_activity</span>
              Paso {step} de 5
            </div>
            <div className="flex gap-1 mt-1">
              {[1,2,3,4,5].map(n => (
                <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-[var(--primary-color)]' : 'bg-white/10'}`}></span>
              ))}
            </div>
          </header>

          <section className="bg-[var(--card-color)] rounded-2xl p-4 border border-[var(--border-color)] space-y-4">
            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">1. Tipo de retiro</h3>
                  <span className="text-[11px] text-[var(--text-secondary-color)]">Selecciona una opción</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setRetiroTipo('caja'); setCategoriaId('16'); }}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 ${retiroTipo==='caja' ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10 shadow-[0_10px_30px_-18px_var(--primary-color)]' : 'border-[var(--border-color)] hover:bg-white/5'}`}
                  >
                    <span className="material-symbols-outlined text-[var(--success-color)]" aria-hidden>trending_up</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Retirada de caja</p>
                      <p className="text-[11px] text-[var(--text-secondary-color)]">Registra el retiro y lo pasa a efectivo interno.</p>
                    </div>
                    {retiroTipo==='caja' && <span className="material-symbols-outlined text-[var(--primary-color)]">check_circle</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRetiroTipo('cashout'); setCategoriaId(''); }}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 ${retiroTipo==='cashout' ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10 shadow-[0_10px_30px_-18px_var(--primary-color)]' : 'border-[var(--border-color)] hover:bg-white/5'}`}
                  >
                    <span className="material-symbols-outlined text-[var(--text-secondary-color)]" aria-hidden>sell</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Solo cashout</p>
                      <p className="text-[11px] text-[var(--text-secondary-color)]">Retiro rápido para gastos comunes.</p>
                    </div>
                    {retiroTipo==='cashout' && <span className="material-symbols-outlined text-[var(--primary-color)]">check_circle</span>}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">2. Punto de venta</h3>
                  <span className="text-[11px] text-[var(--text-secondary-color)]">Saldo y estado en vivo</span>
                </div>
                {loadingCaja ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-10 rounded-xl bg-white/5" />
                    <div className="h-10 rounded-xl bg-white/5" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ul className="flex flex-col gap-2">
                      {localesList.map((loc) => {
                        const disabled = loc.estado === 'cerrada';
                        const isSelected = posName === loc.value;
                        return (
                          <li key={loc.value}>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => { setPosName(loc.value); }}
                              className={`w-full p-3 rounded-xl border text-left flex flex-col gap-2 transition ${isSelected ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10 shadow-[0_10px_30px_-18px_var(--primary-color)]' : 'border-[var(--border-color)] hover:bg-white/5'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-base" aria-hidden>store</span>
                                  <span className="font-semibold text-sm">{loc.label}</span>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${loc.estadoBadge}`}>{loc.estadoLabel}</span>
                              </div>
                              <div className="text-[12px] text-[var(--text-secondary-color)]">
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 flex flex-col gap-1">
                                  <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm" aria-hidden>payments</span>En caja</span>
                                  <span className="font-semibold text-white/90 text-sm">{formatCLP(loc.saldo)}</span>
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {(!localesList || localesList.length === 0) && (
                      <p className="text-xs text-[var(--text-secondary-color)]">No hay locales disponibles.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">3. Monto</h3>
                  <span className="text-[11px] text-[var(--text-secondary-color)]">Ingresa el valor</span>
                </div>
                <div className="space-y-1">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm"
                    value={amount}
                    onChange={e=>setAmount(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-[11px] text-[var(--text-secondary-color)]">{Number(amount)>0 ? `Vista previa: ${formatCLP(amount)}` : 'Ingresa un monto mayor a 0'}</p>
                  {selectedLocal && selectedLocal.estado === 'abierta' && selectedLocal.saldo > 0 && Number(amount) > selectedLocal.saldo && (
                    <p className="text-[11px] text-[var(--danger-color)]">El monto excede lo disponible en este punto.</p>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">4. Motivo</h3>
                  <span className="text-[11px] text-[var(--text-secondary-color)]">Opcional</span>
                </div>
                <input
                  className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm"
                  value={reason}
                  onChange={e=>setReason(e.target.value)}
                  placeholder="Retirada para gastos"
                />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">5. Confirmación</h3>
                  <span className="text-[11px] text-[var(--text-secondary-color)]">Revisa antes de enviar</span>
                </div>
                <div className="space-y-1 text-sm bg-white/5 rounded-lg p-3">
                  <div className="flex justify-between gap-3"><span className="text-[var(--text-secondary-color)]">Tipo</span><span className="font-semibold">{retiroTipo === 'caja' ? 'Retirada de caja' : retiroTipo === 'cashout' ? 'Solo cashout' : '—'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[var(--text-secondary-color)]">Punto</span><span className="font-semibold">{posName || '—'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[var(--text-secondary-color)]">Monto</span><span className="font-semibold">{Number(amount)>0 ? formatCLP(amount) : '—'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[var(--text-secondary-color)]">Motivo</span><span className="font-semibold text-right break-anywhere">{reason || '—'}</span></div>
                </div>
                <button
                  type="button"
                  disabled={loading || !retiroTipo || !posName || !(Number(amount)>0)}
                  className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 rounded-lg bg-[#2563eb] text-white font-semibold disabled:opacity-60"
                  onClick={(e)=> { setStep(5); onSubmit(e); }}
                >
                  <span className="material-symbols-outlined !text-white">point_of_sale</span>
                  {loading ? 'Enviando…' : 'Solicitar retiro'}
                </button>
              </div>
            )}

            {/* Controles de navegación */}
            <div className="flex justify-between pt-2 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1 || loading}
                className="px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && canStep2) return setStep(2);
                  if (step === 2 && canStep3) return setStep(3);
                  if (step === 3 && canStep4) return setStep(4);
                  if (step === 4 && canStep5) return setStep(5);
                }}
                disabled={
                  (step === 1 && !canStep2) ||
                  (step === 2 && !canStep3) ||
                  (step === 3 && !canStep4) ||
                  (step === 4 && !canStep5) ||
                  step === 5 || loading
                }
                className="px-3 py-2 rounded-lg bg-[var(--primary-color)]/20 border border-[var(--primary-color)]/60 text-sm font-semibold text-[var(--primary-color)] disabled:opacity-40"
              >
                {step < 5 ? 'Continuar' : 'Continuar'}
              </button>
            </div>
          </section>
        </div>
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
        onCreateMovement={() => navigate('/new')}
        onCashout={() => {}}
        onCashoutBank={() => navigate('/cashout-bank')}
        active={null}
      />
    </div>
  );
}
