import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login, isAuthenticated, getUsers } from "../auth";
import useTitle from "../useTitle";
import useTimeout from "../useTimeout";
import ServerDown from "../components/ServerDown";

export default function Login() {
  const navigate = useNavigate();
  useTitle("Ingresar · ATM Ricky Rich");
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const location = useLocation();
  const timedOutUsers = useTimeout(loadingUsers, 10000);

  useEffect(() => {
    // Si ya autenticado, ir a dashboard
    if (isAuthenticated()) navigate('/dashboard', { replace: true });
    // Cargar lista de usuarios desde users.json
    (async () => {
      try {
        const list = await getUsers();
        setUsers(list);
        if (list.length > 0) setUsername(list[0].username);
      } catch (e) {
        setError('No se pudieron cargar los usuarios');
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, [navigate]);

  const reloadUsers = async () => {
    setError('');
    setLoadingUsers(true);
    try {
      const list = await getUsers();
      setUsers(list);
      if (list.length > 0) setUsername(list[0].username);
    } catch (e) {
      setError('No se pudieron cargar los usuarios');
    } finally {
      setLoadingUsers(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), pin.trim());
  const dest = location.state?.from?.pathname || '/dashboard';
  navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingUsers && timedOutUsers) {
    return (
      <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex items-center justify-center p-6">
        <ServerDown onRetry={reloadUsers} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-6">
        <div className="text-center mb-4">
          <img src={process.env.PUBLIC_URL + '/logo.png'} alt="ATM Ricky Rich" className="mx-auto h-14 w-14 object-contain mb-2" />
          <h1 className="text-xl font-bold">ATM Ricky Rich</h1>
          <p className="text-sm text-[var(--text-secondary-color)] mt-1">Ingresar</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Usuario</label>
            <div className="relative flex items-center gap-2 bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 hover:bg-white/5 focus-within:border-[var(--primary-color)] focus-within:ring-2 focus-within:ring-[var(--primary-color)] transition-colors">
              <span className="material-symbols-outlined text-[var(--text-secondary-color)]">person</span>
              {loadingUsers ? (
                <div className="flex-1 py-3 text-sm text-[var(--text-secondary-color)] animate-pulse">Cargando usuarios...</div>
              ) : (
                <>
                  <select
                    className="no-caret flex-1 bg-transparent outline-none py-3 pr-8 text-sm"
                    value={username}
                    onChange={(e)=>setUsername(e.target.value)}
                    aria-label="Seleccionar usuario"
                  >
                    {users.map(u => (
                      <option key={u.username} value={u.username} className="bg-[var(--card-color)] text-[var(--text-color)]">
                        {u.displayName || u.username}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 text-[var(--text-secondary-color)] pointer-events-none">expand_more</span>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary-color)] mb-1">PIN</label>
            <div className="flex items-center gap-2 bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3">
              <span className="material-symbols-outlined text-[var(--text-secondary-color)]">key</span>
              <input
                type="password"
                className="flex-1 bg-transparent outline-none py-2 text-sm"
                value={pin}
                onChange={(e)=> setPin(e.target.value.replace(/\D/g, '').slice(0,8))}
                placeholder="****"
                inputMode="numeric"
                autoComplete="current-password"
                aria-label="PIN (4 a 8 dígitos)"
              />
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-secondary-color)]">Ingresa 4 a 8 dígitos</p>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" className="w-full py-3 rounded-lg bg-[var(--primary-color)] text-white hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2" disabled={loading || loadingUsers || !username || pin.length < 4}>
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />}
            Entrar
          </button>
        </form>
        <div className="mt-4 text-center text-xs text-[var(--text-secondary-color)]">
          Los usuarios se crean únicamente por el administrador.
        </div>
      </div>
    </div>
  );
}
