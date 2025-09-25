import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
// import Preloader from "../components/Preloader";
import ServerDown from "../components/ServerDown";
import BottomNav from "../components/BottomNav";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch, pingServer, getSaldoCajaLight } from "../api";
import useTitle from "../useTitle";
import useTimeout from "../useTimeout";
import { getSessionUsername, getUsers, isAuthenticated } from "../auth";
import { notifyMutation } from "../mutations";
import { useNotifications } from "../components/Notifications";
import { formatCLP } from "../formatMoney";

export default function NewTransaction() {
  useTitle("Nueva transacción · ATM Ricky Rich");
  const { notify } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  // Permite prefijar tipo via query: /new?tipo=INGRESO o EGRESO
  const presetTipo = new URLSearchParams(location.search).get("tipo");
  const [serverOk, setServerOk] = useState(null);
  const [checking, setChecking] = useState(true);

  const [tipo, setTipo] = useState(presetTipo === "EGRESO" ? "EGRESO" : "INGRESO");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [cajaId, setCajaId] = useState(1); // 1=Efectivo, 2=Cuenta bancaria

  const [cats, setCats] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [errorCats, setErrorCats] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [overlayTitle, setOverlayTitle] = useState("Completa el formulario");
  const [overlayKind, setOverlayKind] = useState("info"); // 'info' | 'insufficient'
  const [overlayData, setOverlayData] = useState(null); // { solicitado, saldo }
  const montoInputRef = useRef(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [usuarioDisplay, setUsuarioDisplay] = useState("");
  const timedOutChecking = useTimeout(checking, 10000);
  const timedOutCats = useTimeout(loadingCats && serverOk === true, 10000);

  // Server health check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await pingServer();
      if (cancelled) return;
      setServerOk(ok);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Cargar usuario actual (displayName) desde sesión + users.json
  useEffect(() => {
    const u = getSessionUsername();
    if (!u || !isAuthenticated()) {
      navigate("/login", { replace: true, state: { from: location } });
      return;
    }
    (async () => {
      try {
        const list = await getUsers();
        const found = (Array.isArray(list) ? list : []).find(x => x.username === u);
        setUsuarioDisplay(found?.displayName || found?.username || u);
      } catch {
        setUsuarioDisplay(u);
      }
    })();
  }, [navigate, location]);

  // Load categories after server is ok
  useEffect(() => {
    if (serverOk !== true) return;
    setLoadingCats(true);
    setErrorCats(null);
    let ignore = false;
    apiFetch("/api/categorias")
      .then((r) => {
        if (!r.ok) throw new Error("Error al obtener categorías");
        return r.json();
      })
      .then((data) => {
        if (ignore) return;
        const arr = Array.isArray(data) ? data : [];
        setCats(arr);
        setLoadingCats(false);
      })
      .catch((e) => {
        if (ignore) return;
        setErrorCats(e.message);
        setLoadingCats(false);
      });
    return () => { ignore = true; };
  }, [serverOk]);

  const filteredCats = useMemo(() => {
    const list = cats.filter((c) => c.tipo === tipo);
    // Orden alfabético por nombre
    return list.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [cats, tipo]);

  const canSubmit = descripcion.trim() && Number(monto) > 0 && categoriaId && Number(cajaId) > 0;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!canSubmit) {
      const missing = [];
      if (!descripcion.trim()) missing.push("Descripción");
      if (!(Number(monto) > 0)) missing.push("Monto (> 0)");
      if (!categoriaId) missing.push("Categoría");
      setOverlayTitle('Completa el formulario');
      setOverlayMessage(`Por favor completa: ${missing.join(', ')}.`);
      setOverlayOpen(true);
      return;
    }
    // Validación previa de saldo para EGRESO
    if (tipo === 'EGRESO') {
      try {
        // Validación preliminar usando saldos locales por caja; el backend hará validación final
        let saldo = null;
        try {
          const r = await apiFetch('/api/caja?solo_caja=true');
          if (r.ok) {
            const d = await r.json();
            const sel = Number(cajaId) === 2 ? (d?.saldo_caja2) : (d?.saldo_caja ?? d?.saldo);
            const n = Number(sel);
            saldo = Number.isFinite(n) ? n : null;
          }
        } catch {}
        const solicitado = Number(monto);
        if (Number.isFinite(solicitado) && Number.isFinite(saldo) && solicitado > saldo) {
          setOverlayKind('insufficient');
          setOverlayTitle('Saldo insuficiente');
          setOverlayData({ solicitado, saldo });
          setOverlayMessage('El monto solicitado supera el saldo disponible en caja.');
          setOverlayOpen(true);
          return; // no abrir confirmación
        }
      } catch (_) {
        // Si falla la validación previa, continuamos y el backend protegerá con 409
      }
    }
    // Abrir confirmación con resumen
    setConfirmOpen(true);
  };

  const formatMoney = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('es-CL') : String(v ?? '');
  };

  const performSubmit = async () => {
    setSubmitting(true);
    setErrorSubmit(null);
    setProgressOpen(true);
    try {
      const body = {
        categoria_id: Number(categoriaId),
        descripcion: descripcion.trim(),
        monto: Number(monto),
        caja_id: Number(cajaId),
        usuario: usuarioDisplay || getSessionUsername() || "",
      };
  const res = await apiFetch("/api/transacciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (res.status === 409 || res.status === 400) {
          // Saldo insuficiente u otra precondición del servidor
          let data = null;
          try { data = await res.json(); } catch (_) { /* ignore */ }
          const solicitado = data && Number.isFinite(Number(data.monto_solicitado)) ? Number(data.monto_solicitado) : Number(monto);
          const saldo = data && Number.isFinite(Number(data.saldo_actual)) ? Number(data.saldo_actual) : null;
          const baseMsg = (data && data.error) ? String(data.error) : (res.status===409 ? 'Saldo insuficiente en caja para realizar el egreso' : 'Solicitud inválida');
          // Mostrar overlay especial amigable
          setOverlayKind('insufficient');
          setOverlayTitle(res.status===409 ? 'Saldo insuficiente' : 'No se pudo crear');
          setOverlayData({ solicitado, saldo });
          setOverlayMessage(baseMsg);
          setProgressOpen(false);
          setOverlayOpen(true);
          setSubmitting(false);
          notify({ type: 'error', title: 'No se pudo crear', message: baseMsg });
          return; // no continuar
        }
        const txt = await res.text();
        throw new Error(txt || "Error al crear transacción");
      }
      notifyMutation();
  notify({ type: 'success', title: 'Transacción creada', message: `Se registró correctamente por ${formatCLP(monto)} en ${Number(cajaId)===1?'Efectivo':'Cuenta bancaria'}.` });
      navigate("/movements", { state: { toast: "Transacción creada con éxito", reload: true } });
    } catch (e) {
    setErrorSubmit(e.message);
      setProgressOpen(false);
  setOverlayKind('info');
  setOverlayTitle('Error al crear transacción');
  setOverlayMessage(e.message || 'Error al crear transacción');
  setOverlayOpen(true);
    notify({ type: 'error', title: 'Error al crear', message: e.message || 'Error al crear transacción' });
    } finally {
      setSubmitting(false);
    }
  };

  // Si se cambia el tipo, limpiar la categoría elegida
  useEffect(() => {
    setCategoriaId("");
  }, [tipo]);

  return (
    <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex flex-col">
      <Header title="Nueva transacción" />
      {timedOutChecking ? (
        <>
          <ServerDown onRetry={async () => {
            setChecking(true);
            const ok = await pingServer();
            setServerOk(ok);
            setChecking(false);
          }} />
          <BottomNav
            onHome={() => navigate('/dashboard')}
            onMovements={() => navigate('/movements')}
            onWallet={() => navigate('/wallet')}
            onReports={() => navigate('/reports')}
            onAddIncome={() => setTipo('INGRESO')}
            onAddExpense={() => setTipo('EGRESO')}
            onCashout={() => navigate('/cashout')}
            active="home"
          />
        </>
      ) : checking ? (
        <>
          <main className="flex-1 p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] view-enter view-enter-active space-y-4">
            <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)] animate-pulse">
              <div className="h-4 w-24 bg-white/10 rounded mb-3" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 bg-white/10 rounded" />
                <div className="h-10 bg-white/10 rounded" />
              </div>
            </section>
            <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)] animate-pulse">
              <div className="h-4 w-24 bg-white/10 rounded mb-3" />
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--dark-color)]">
                    <div className="h-4 w-1/3 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-2/3 bg-white/10 rounded" />
                  </div>
                ))}
              </div>
            </section>
            <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)] animate-pulse space-y-3">
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-10 bg-white/10 rounded" />
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-10 bg-white/10 rounded" />
            </section>
          </main>
          <BottomNav
            onHome={() => navigate('/dashboard')}
            onMovements={() => navigate('/movements')}
            onWallet={() => navigate('/wallet')}
            onReports={() => navigate('/reports')}
            onAddIncome={() => setTipo('INGRESO')}
            onAddExpense={() => setTipo('EGRESO')}
            onCashout={() => navigate('/cashout')}
            active="home"
          />
        </>
      ) : serverOk === false ? (
        <>
          <ServerDown onRetry={async () => {
            setChecking(true);
            const ok = await pingServer();
            setServerOk(ok);
            setChecking(false);
          }} />
          <BottomNav
            onHome={() => navigate('/dashboard')}
            onMovements={() => navigate('/movements')}
            onWallet={() => navigate('/wallet')}
            onReports={() => navigate('/reports')}
            onAddIncome={() => setTipo('INGRESO')}
            onAddExpense={() => setTipo('EGRESO')}
            onCashout={() => navigate('/cashout')}
            active="home"
          />
        </>
      ) : (
        <>
          <main className="flex-1 p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] view-enter view-enter-active">
            <form onSubmit={onSubmit} className="space-y-4">
          {/* Tipo de transacción */}
          <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)]">
            <h2 className="text-sm font-semibold text-[var(--text-secondary-color)] mb-3">Tipo</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                  tipo === "INGRESO"
                    ? "border-[var(--success-color)] bg-green-900/20 text-[var(--success-color)]"
                    : "border-[var(--border-color)] bg-transparent text-[var(--text-secondary-color)] hover:bg-white/5"
                }`}
                onClick={() => setTipo("INGRESO")}
              >
                <span className="material-symbols-outlined">arrow_upward</span>
                Ingreso
              </button>
              <button
                type="button"
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                  tipo === "EGRESO"
                    ? "border-[var(--danger-color)] bg-red-900/20 text-[var(--danger-color)]"
                    : "border-[var(--border-color)] bg-transparent text-[var(--text-secondary-color)] hover:bg-white/5"
                }`}
                onClick={() => setTipo("EGRESO")}
              >
                <span className="material-symbols-outlined">arrow_downward</span>
                Egreso
              </button>
            </div>
          </section>

          {/* Categoría */}
          <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)]">
            <h2 className="text-sm font-semibold text-[var(--text-secondary-color)] mb-3">Categoría</h2>
            {loadingCats ? (
              timedOutCats ? (
                <ServerDown onRetry={() => {
                  // reintentar categorias
                  if (serverOk === true) {
                    // trigger refetch simply by toggling state
                    setLoadingCats(true);
                    setErrorCats(null);
                    apiFetch("/api/categorias").then(r=>r.json()).then(arr=>{ setCats(Array.isArray(arr)?arr:[]); setLoadingCats(false); }).catch(e=>{ setErrorCats(e.message||'Error'); setLoadingCats(false); });
                  }
                }} />
              ) : (
                <div className="grid grid-cols-2 gap-2 animate-pulse">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--dark-color)]">
                      <div className="h-4 w-1/3 bg-white/10 rounded mb-2" />
                      <div className="h-3 w-2/3 bg-white/10 rounded" />
                    </div>
                  ))}
                </div>
              )
            ) : errorCats ? (
              <p className="text-red-500">{errorCats}</p>
            ) : filteredCats.length === 0 ? (
              <p className="text-[var(--text-secondary-color)]">No hay categorías para {tipo.toLowerCase()}.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredCats.map((c) => (
                  <label key={c.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    Number(categoriaId) === c.id
                      ? "border-[var(--primary-color)] bg-white/5"
                      : "border-[var(--border-color)] hover:bg-white/5"
                  }`}>
                    <input
                      type="radio"
                      name="categoria"
                      value={c.id}
                      checked={Number(categoriaId) === c.id}
                      onChange={() => setCategoriaId(String(c.id))}
                      className="sr-only"
                    />
                    <span className={`material-symbols-outlined ${c.tipo === 'INGRESO' ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>
                      {c.tipo === 'INGRESO' ? 'trending_up' : 'trending_down'}
                    </span>
                    <span className="text-sm">{c.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Caja */}
          <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)]">
            <h2 className="text-sm font-semibold text-[var(--text-secondary-color)] mb-3">Caja</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                Number(cajaId) === 1
                  ? 'border-[var(--primary-color)] bg-white/5'
                  : 'border-[var(--border-color)] hover:bg-white/5'
              }`}>
                <input type="radio" name="caja" value={1} className="sr-only" checked={Number(cajaId) === 1} onChange={() => setCajaId(1)} />
                <span className="material-symbols-outlined">account_balance_wallet</span>
                <span className="text-sm">Efectivo</span>
              </label>
              <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                Number(cajaId) === 2
                  ? 'border-[var(--primary-color)] bg-white/5'
                  : 'border-[var(--border-color)] hover:bg-white/5'
              }`}>
                <input type="radio" name="caja" value={2} className="sr-only" checked={Number(cajaId) === 2} onChange={() => setCajaId(2)} />
                <span className="material-symbols-outlined">account_balance</span>
                <span className="text-sm">Cuenta bancaria</span>
              </label>
            </div>
          </section>

          {/* Descripción y Monto */}
          <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)] space-y-3">
            <div>
              <label className="block text-sm text-[var(--text-secondary-color)] mb-1">Descripción</label>
              <div className="flex items-center gap-2 bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3">
                <span className="material-symbols-outlined text-[var(--text-secondary-color)]">subject</span>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. EFECTIVO BURBUJA"
                  className="flex-1 bg-transparent outline-none py-2 text-sm text-[var(--text-color)] placeholder:text-[var(--text-secondary-color)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary-color)] mb-1">Monto</label>
              <div className="flex items-center gap-2 bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3">
                <span className="material-symbols-outlined text-[var(--text-secondary-color)]">attach_money</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-transparent outline-none py-2 text-sm text-[var(--text-color)] placeholder:text-[var(--text-secondary-color)]"
                  ref={montoInputRef}
                />
              </div>
            </div>
          </section>

          {errorSubmit && (
            <p className="text-red-500 text-sm">{errorSubmit}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary-color)] hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 py-3 rounded-lg text-white font-medium flex items-center justify-center gap-2 ${
                submitting
                  ? 'bg-[color:rgba(255,255,255,0.2)] cursor-progress'
                  : !canSubmit
                    ? 'bg-[color:rgba(255,255,255,0.15)] cursor-not-allowed'
                    : tipo === 'EGRESO'
                      ? 'bg-[var(--danger-color)] hover:opacity-90'
                      : 'bg-[var(--success-color)] hover:opacity-90'
              }`}
              disabled={submitting}
            >
              {submitting && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />}
              {submitting ? 'Procesando...' : 'Continuar'}
            </button>
          </div>
            </form>
          </main>
          <BottomNav
            onHome={() => navigate('/dashboard')}
            onMovements={() => navigate('/movements')}
            onWallet={() => navigate('/wallet')}
            onReports={() => navigate('/reports')}
            onAddIncome={() => setTipo('INGRESO')}
            onAddExpense={() => setTipo('EGRESO')}
            active="home"
          />
        </>
      )}
      {/* Overlay de confirmación */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-md bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined">checklist</span>
              Confirmar transacción
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[var(--text-secondary-color)]">person</span>
                <div>
                  <p className="text-xs text-[var(--text-secondary-color)]">Usuario</p>
                  <p className="text-sm font-medium">{usuarioDisplay || '-'}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className={`material-symbols-outlined ${tipo === 'EGRESO' ? 'text-[var(--danger-color)]' : 'text-[var(--success-color)]'}`}>{tipo === 'EGRESO' ? 'arrow_downward' : 'arrow_upward'}</span>
                <div>
                  <p className="text-xs text-[var(--text-secondary-color)]">Tipo</p>
                  <p className="text-sm font-medium">{tipo}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[var(--text-secondary-color)]">category</span>
                <div>
                  <p className="text-xs text-[var(--text-secondary-color)]">Categoría</p>
                  <p className="text-sm font-medium">{(cats.find(c => c.id === Number(categoriaId)) || {}).nombre || `Cat #${categoriaId}`}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[var(--text-secondary-color)]">subject</span>
                <div>
                  <p className="text-xs text-[var(--text-secondary-color)]">Descripción</p>
                  <p className="text-sm font-medium break-words">{descripcion || '-'}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[var(--text-secondary-color)]">account_balance_wallet</span>
                <div>
                  <p className="text-xs text-[var(--text-secondary-color)]">Caja</p>
                  <p className="text-sm font-medium">{Number(cajaId) === 1 ? 'Efectivo' : Number(cajaId) === 2 ? 'Cuenta bancaria' : `Caja #${cajaId}`}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className={`material-symbols-outlined ${tipo === 'EGRESO' ? 'text-[var(--danger-color)]' : 'text-[var(--success-color)]'}`}>attach_money</span>
                <div>
                  <p className="text-xs text-[var(--text-secondary-color)]">Monto</p>
                  <p className={`text-sm font-semibold ${tipo === 'EGRESO' ? 'text-[var(--danger-color)]' : 'text-[var(--success-color)]'}`}>{tipo === 'EGRESO' ? `-${formatMoney(monto)}` : formatMoney(monto)}</p>
                </div>
              </li>
            </ul>
            <div className="mt-5 flex gap-3">
              <button className="flex-1 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary-color)] hover:bg-white/5" onClick={() => setConfirmOpen(false)}>
                Volver
              </button>
              <button className={`flex-1 py-2 rounded-lg text-white font-medium flex items-center justify-center gap-2 ${tipo === 'EGRESO' ? 'bg-[var(--danger-color)] hover:opacity-90' : 'bg-[var(--success-color)] hover:opacity-90'}`} onClick={performSubmit} disabled={submitting}>
                {submitting && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />}
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Overlay de progreso */}
      {progressOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-5 flex flex-col items-center">
            <div className="h-10 w-10 rounded-full border-4 border-white/20 border-t-white animate-spin mb-3" aria-hidden />
            <p className="text-sm">Procesando transacción...</p>
          </div>
        </div>
      )}
      {overlayOpen && overlayKind === 'info' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setOverlayOpen(false)}>
          <div className="w-full max-w-md bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-400 !text-3xl" aria-hidden>warning</span>
              <div className="flex-1">
        <h3 className="font-semibold mb-1">{overlayTitle || 'Aviso'}</h3>
        <p className="text-sm text-[var(--text-secondary-color)] whitespace-pre-line">{overlayMessage || 'Debes ingresar todos los campos requeridos antes de guardar.'}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-white/5" onClick={() => setOverlayOpen(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      {overlayOpen && overlayKind === 'insufficient' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setOverlayOpen(false)}>
          <div className="w-full max-w-md bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="shrink-0 h-12 w-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400">report</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{overlayTitle || 'Saldo insuficiente'}</h3>
                <p className="text-sm text-[var(--text-secondary-color)]">{overlayMessage || 'El monto solicitado supera el saldo disponible en caja.'}</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--dark-color)]">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary-color)]">
                      <span className="material-symbols-outlined !text-base text-[var(--danger-color)]">request_quote</span>
                      Solicitado
                    </div>
          <div className="mt-1 text-lg font-bold text-[var(--danger-color)] break-words">{formatCLP(overlayData?.solicitado ?? monto)}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--dark-color)]">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary-color)]">
                      <span className="material-symbols-outlined !text-base text-[var(--success-color)]">account_balance_wallet</span>
                      Saldo actual
                    </div>
          <div className="mt-1 text-lg font-bold text-[var(--success-color)] break-words">{formatCLP(overlayData?.saldo ?? 0)}</div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-[var(--text-secondary-color)]">
                  Sugerencia: ajusta el monto al saldo máximo disponible para continuar.
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                className="flex-1 py-2 rounded-lg bg-[var(--primary-color)] text-white hover:opacity-90 flex items-center justify-center gap-2"
                onClick={() => {
                  setOverlayOpen(false);
                  setTimeout(() => montoInputRef.current?.focus(), 50);
                }}
              >
                <span className="material-symbols-outlined">edit</span>
                Editar monto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
