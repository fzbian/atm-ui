import React, { useEffect, useState } from "react";
import Header from "../components/Header";
// import Preloader from "../components/Preloader";
import ServerDown from "../components/ServerDown";
import BottomNav from "../components/BottomNav";
import { useNavigate } from "react-router-dom";
import { apiFetch, pingServer } from "../api";
import { formatCLP } from "../formatMoney";
import { getUsers, getSessionUsername } from "../auth";
import useTitle from "../useTitle";
import { formatDateTimeCO } from "../dateFormat";
import useTimeout from "../useTimeout";

export default function Dashboard() {
  const navigate = useNavigate();
  const [caja, setCaja] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movs, setMovs] = useState([]);
  const [loadingMovs, setLoadingMovs] = useState(true);
  const [errorMovs, setErrorMovs] = useState(null);
  const [catMap, setCatMap] = useState({});
  const [displayName, setDisplayName] = useState("");
  const [showSaldoTotal, setShowSaldoTotal] = useState(true);
  const [showCajaFuerte, setShowCajaFuerte] = useState(true);
  const [showLocales, setShowLocales] = useState(true);
  const [serverOk, setServerOk] = useState(null);
  const [checking, setChecking] = useState(true);
  const [nowCo, setNowCo] = useState(new Date());
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Buenas noches' : hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  useTitle("Dashboard · ATM Ricky Rich");

  const timedOutChecking = useTimeout(checking, 10000);
  const timedOutCaja = useTimeout(loading && serverOk === true, 10000);
  const timedOutMovs = useTimeout(loadingMovs && serverOk === true, 10000);

  // Formatea fecha como "08 SEPT" (mes abreviado en mayúsculas)
  const fmtDayMonthShort = (value) => {
    try {
      const d = new Date(value);
      if (isNaN(d)) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEPT','OCT','NOV','DIC'];
      const m = months[d.getMonth()] || '';
      return `${day} ${m}`;
    } catch {
      return '';
    }
  };

  const reloadCaja = async () => {
    setLoading(true);
    setError(null);
    try {
      const resCaja = await apiFetch("/api/caja");
      if (!resCaja.ok) throw new Error("Error al obtener saldo");
      const dataCaja = await resCaja.json();
      setCaja(dataCaja);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reloadMovs = async () => {
    setLoadingMovs(true);
    setErrorMovs(null);
    try {
      const resMovs = await apiFetch("/api/transacciones?limit=10");
      if (!resMovs.ok) throw new Error("Error al obtener movimientos");
      const dataMovs = await resMovs.json();
      const arr = Array.isArray(dataMovs) ? dataMovs : [];
      const sorted = arr.filter((m) => m && m.fecha).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setMovs(sorted);
    } catch (err) {
      setErrorMovs(err.message);
    } finally {
      setLoadingMovs(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Cargar displayName del usuario autenticado
        try {
          const username = getSessionUsername();
          if (username) {
            const users = await getUsers();
            if (cancelled) return;
            const u = users.find((x) => x.username === username);
            setDisplayName(u?.displayName || username || "");
          }
        } catch {}

        // Health check primero
        const ok = await pingServer();
        if (cancelled) return;
        setServerOk(ok);
        if (!ok) return;

        // Cargar caja
        try {
          const resCaja = await apiFetch("/api/caja");
          if (!resCaja.ok) throw new Error("Error al obtener saldo");
          const dataCaja = await resCaja.json();
          if (cancelled) return;
          setCaja(dataCaja);
          setLoading(false);
        } catch (err) {
          if (cancelled) return;
          setError(err.message);
          setLoading(false);
        }

        // Cargar últimos movimientos
        try {
          const resMovs = await apiFetch("/api/transacciones?limit=10");
          if (!resMovs.ok) throw new Error("Error al obtener movimientos");
          const dataMovs = await resMovs.json();
          if (cancelled) return;
          const arr = Array.isArray(dataMovs) ? dataMovs : [];
          const sorted = arr.filter((m) => m && m.fecha).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
          setMovs(sorted);
          setLoadingMovs(false);
        } catch (err) {
          if (cancelled) return;
          setErrorMovs(err.message);
          setLoadingMovs(false);
        }

        // Cargar categorías (no bloquea UI)
        try {
          const resCats = await apiFetch("/api/categorias");
          if (!resCats.ok) throw new Error("Error al obtener categorías");
          const dataCats = await resCats.json();
          if (cancelled) return;
          const arr = Array.isArray(dataCats) ? dataCats : [];
          const map = arr.reduce((acc, c) => {
            acc[c.id] = { nombre: c.nombre, tipo: c.tipo };
            return acc;
          }, {});
          setCatMap(map);
        } catch {}
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reloj en zona horaria de Colombia (sin segundos, actualiza cada minuto)
  useEffect(() => {
    const id = setInterval(() => setNowCo(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // Al volver al foco (ej. después de crear/editar) refrescar datos
  useEffect(() => {
    const onFocus = () => {
      if (serverOk) {
        reloadCaja();
        reloadMovs();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('atm:mutation', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('atm:mutation', onFocus);
      document.removeEventListener('visibilitychange', () => {});
    };
  }, [serverOk]);

  // Persistencia de visibilidad (localStorage por usuario)
  useEffect(() => {
    try {
      const uname = getSessionUsername() || "anon";
      const raw = localStorage.getItem(`dash_visibility_prefs_v1:${uname}`);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (typeof prefs.showSaldoTotal === 'boolean') setShowSaldoTotal(prefs.showSaldoTotal);
      if (typeof prefs.showCajaFuerte === 'boolean') setShowCajaFuerte(prefs.showCajaFuerte);
      if (typeof prefs.showLocales === 'boolean') setShowLocales(prefs.showLocales);
    } catch {
      // ignorar errores de parseo
    }
  }, []);

  useEffect(() => {
    try {
      const uname = getSessionUsername() || "anon";
      const data = {
        showSaldoTotal,
        showCajaFuerte,
        showLocales,
      };
      localStorage.setItem(`dash_visibility_prefs_v1:${uname}`, JSON.stringify(data));
    } catch {
      // almacenamiento puede fallar en modo privado
    }
  }, [showSaldoTotal, showCajaFuerte, showLocales]);

  if (timedOutChecking) {
    return (
      <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex flex-col">
        <Header title="ATM Ricky Rich" titleImage={process.env.PUBLIC_URL + '/large.png'} titleImageClass="h-12" />
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
          onCreateMovement={() => navigate('/new')}
          onCashout={() => navigate('/cashout')}
          onCashoutBank={() => navigate('/cashout-bank')}
          active="home"
        />
      </div>
    );
  }

  if (serverOk === false) {
    return (
      <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex flex-col">
        <Header title="ATM Ricky Rich" titleImage={process.env.PUBLIC_URL + '/large.png'} titleImageClass="h-12" />
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
          onCreateMovement={() => navigate('/new')}
          onCashout={() => navigate('/cashout')}
          onCashoutBank={() => navigate('/cashout-bank')}
          active="home"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex flex-col">
      <Header title="ATM Ricky Rich" titleImage={process.env.PUBLIC_URL + '/large.png'} titleImageClass="h-12" />
      <main className="flex-1 p-6 space-y-8 pb-[calc(env(safe-area-inset-bottom)+6rem)] view-enter view-enter-active">
        {/* Saludo según hora */}
        <section>
          <h2 className="text-2xl font-extrabold tracking-tight">{displayName ? `${greeting}, ${displayName}` : greeting}</h2>
          <p className="text-sm text-[var(--text-secondary-color)] mt-1">{
            nowCo.toLocaleString("es-CO", {
              timeZone: "America/Bogota",
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          }</p>
        </section>
        {/* Tarjeta principal: Saldo Total */}
        <section className="bg-[var(--primary-color)] text-white rounded-lg p-4 border border-[var(--border-color)] shadow">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined !text-3xl" aria-hidden>
                savings
              </span>
              Saldo Total
            </h2>
            <button
              type="button"
              onClick={() => setShowSaldoTotal(v => !v)}
              aria-label={showSaldoTotal ? 'Ocultar saldo total' : 'Mostrar saldo total'}
              className="p-2 rounded-lg hover:bg-white/10"
            >
              <span className="material-symbols-outlined">{showSaldoTotal ? 'visibility' : 'visibility_off'}</span>
            </button>
          </div>
          {loading || checking ? (
            timedOutCaja ? (
              <ServerDown onRetry={reloadCaja} />
            ) : (
              <div className="animate-pulse space-y-3">
                <div className="h-8 w-40 bg-white/10 rounded" />
                <div className="h-6 w-56 bg-white/10 rounded" />
              </div>
            )
          ) : error ? (
            <p className="text-red-200">{error}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-3xl font-bold">{showSaldoTotal ? `$${caja.saldo_total?.toLocaleString("es-CL")}` : '••••••'}</p>
              <p className="text-sm opacity-80">Última actualización: {formatDateTimeCO(caja.ultima_actualizacion)}</p>
            </div>
          )}
        </section>


        {/* Cajas: Efectivo y Cuenta bancaria */}
        <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)] shadow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined" aria-hidden>
                account_balance_wallet
              </span>
              Cajas
            </h2>
            <button
              type="button"
              onClick={() => setShowCajaFuerte(v => !v)}
              aria-label={showCajaFuerte ? 'Ocultar montos de cajas' : 'Mostrar montos de cajas'}
              className="p-2 rounded-lg hover:bg-white/5"
            >
              <span className="material-symbols-outlined">{showCajaFuerte ? 'visibility' : 'visibility_off'}</span>
            </button>
          </div>
          {loading || checking ? (
            timedOutCaja ? (
              <ServerDown onRetry={reloadCaja} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--dark-color)]/40 p-4">
                  <div className="h-5 w-24 bg-white/10 rounded mb-3" />
                  <div className="h-7 w-32 bg-white/10 rounded" />
                </div>
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--dark-color)]/40 p-4 hidden sm:block">
                  <div className="h-5 w-32 bg-white/10 rounded mb-3" />
                  <div className="h-7 w-28 bg-white/10 rounded" />
                </div>
              </div>
            )
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Efectivo (Caja 1) */}
                <div className="rounded-xl border border-green-500/30 bg-green-900/10 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[var(--success-color)]" aria-hidden>payments</span>
                      <h3 className="font-semibold">Efectivo</h3>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-green-500/30 bg-green-900/20 text-green-300/90">Caja 1</span>
                  </div>
                  <p className="text-2xl font-extrabold">
                    {showCajaFuerte ? formatCLP(caja.saldo_caja) : '••••••'}
                  </p>
                </div>

                {/* Cuenta bancaria (Caja 2) */}
                {typeof caja?.saldo_caja2 !== 'undefined' && (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-900/10 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sky-300" aria-hidden>account_balance</span>
                        <h3 className="font-semibold">Cuenta bancaria</h3>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-900/20 text-sky-300/90">Caja 2</span>
                    </div>
                    <p className="text-2xl font-extrabold">
                      {showCajaFuerte ? formatCLP(caja.saldo_caja2) : '••••••'}
                    </p>
                  </div>
                )}
              </div>
              {caja?.ultima_actualizacion && (
                <p className="mt-3 text-xs text-[var(--text-secondary-color)]">
                  Última actualización: {formatDateTimeCO(caja.ultima_actualizacion)}
                </p>
              )}
            </>
          )}
        </section>

        {/* Tarjeta de locales */}
        <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)] shadow">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined" aria-hidden>
                storefront
              </span>
              Locales
            </h2>
            <button
              type="button"
              onClick={() => setShowLocales(v => !v)}
              aria-label={showLocales ? 'Ocultar montos de locales' : 'Mostrar montos de locales'}
              className="p-2 rounded-lg hover:bg-white/5"
            >
              <span className="material-symbols-outlined">{showLocales ? 'visibility' : 'visibility_off'}</span>
            </button>
          </div>
          {loading || checking ? (
            timedOutCaja ? (
              <ServerDown onRetry={reloadCaja} />
            ) : (
              <div className="grid grid-cols-2 gap-2 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-[var(--dark-color)] rounded p-2 border border-[var(--border-color)]">
                    <div className="h-4 w-24 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-20 bg-white/10 rounded" />
                  </div>
                ))}
              </div>
            )
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : (
            <div>
              <ul className="grid grid-cols-2 gap-2 mb-2">
                {caja.locales && Object.entries(caja.locales).map(([nombre, monto]) => {
                  const nombreFormateado = nombre
                    .split('_')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');
                  return (
                    <li key={nombre} className="bg-[var(--dark-color)] rounded p-2 border border-[var(--border-color)] text-sm flex flex-col">
                      <span className="font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined !text-base" aria-hidden>
                          store
                        </span>
                        {nombreFormateado}
                      </span>
                      <span className="text-[var(--text-secondary-color)]">{showLocales ? `$${monto.toLocaleString("es-CL")}` : '••••••'}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 text-sm">
                <span className="font-medium">Total locales:</span> {showLocales ? `$${caja.total_locales?.toLocaleString("es-CL")}` : '••••••'}
              </div>
            </div>
          )}
        </section>
        
          {/* Movimientos (debajo de Locales) */}
          <section className="bg-[var(--card-color)] rounded-lg p-4 border border-[var(--border-color)] shadow">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined" aria-hidden>
                receipt_long
              </span>
              Movimientos
            </h2>
            {loadingMovs || checking ? (
              timedOutMovs ? (
                <ServerDown onRetry={reloadMovs} />
              ) : (
                <ul className="divide-y divide-[var(--border-color)] animate-pulse">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <li key={i} className="py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="h-10 w-10 rounded-full bg-white/10" />
                          <div className="space-y-2 w-full pr-2">
                            <div className="h-4 w-2/3 bg-white/10 rounded" />
                            <div className="h-3 w-1/3 bg-white/10 rounded" />
                          </div>
                        </div>
                      </div>
                      <div className="w-16 h-4 bg-white/10 rounded" />
                    </li>
                  ))}
                </ul>
              )
            ) : errorMovs ? (
              <p className="text-red-600">{errorMovs}</p>
            ) : movs.length === 0 ? (
              <p className="text-[var(--text-secondary-color)]">Sin movimientos recientes</p>
            ) : (
              <div>
                <ul className="divide-y divide-[var(--border-color)]">
                  {movs.map((m) => {
                    const tipo = catMap[m.categoria_id]?.tipo;
                    const tipoColor = tipo === 'INGRESO' ? 'text-[var(--success-color)]' : tipo === 'EGRESO' ? 'text-[var(--danger-color)]' : 'text-[var(--text-secondary-color)]';
                    const amt = typeof m.monto === 'number' ? m.monto.toLocaleString('es-CL') : m.monto;
                    return (
                      <li key={m.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-[var(--text-secondary-color)]">{m.fecha ? fmtDayMonthShort(m.fecha) : ''}</p>
                          <p className="font-medium line-clamp-2 break-anywhere pr-2">{m.descripcion}</p>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <p className={`font-semibold ${tipoColor}`}>{tipo === 'EGRESO' ? `-${amt}` : amt}</p>
                          {tipo && <p className={`text-[10px] ${tipoColor}`}>{tipo}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-[var(--text-secondary-color)] mt-2">Mostrando los últimos 10 movimientos.</p>
              </div>
            )}
          </section>
        
      </main>
      <BottomNav
        onHome={() => navigate('/dashboard')}
        onMovements={() => navigate('/movements')}
        onWallet={() => navigate('/wallet')}
  onReports={() => navigate('/reports')}
        onCreateMovement={() => navigate('/new')}
        onCashout={() => navigate('/cashout')}
          onCashoutBank={() => navigate('/cashout-bank')}
        active="home"
      />
    </div>
  );
}
