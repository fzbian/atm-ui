import React, { useEffect, useMemo, useState } from 'react';
import { getSessionUsername, isAdmin } from '../auth';
import { loadUsers, createUser, updateUser, deleteUser } from '../usersApi';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // user or null for create
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  // Modo servidor: no se usan import/export locales

  useEffect(() => {
    (async () => {
      try {
        const users = await loadUsers();
        setList(users);
      } catch (e) {
        setError(e.message || 'Error al cargar usuarios');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const self = getSessionUsername();
  const canEdit = useMemo(() => (u) => u?.username !== self, [self]);

  const openCreate = () => {
    setEditing(null);
    setUsername('');
    setDisplayName('');
    setPin('');
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setUsername(u.username);
    setDisplayName(u.displayName || '');
    setPin('');
    setModalOpen(true);
  };

  const onDelete = async (u) => {
    if (!canEdit(u)) return;
    if (!window.confirm(`¿Eliminar usuario ${u.username}?`)) return;
    try {
      await deleteUser(u.username);
      setList(prev => prev.filter(x => x.username !== u.username));
    } catch (e) {
      window.alert(e.message || 'Error al eliminar');
    }
  };

  const onSave = async () => {
    if (!username || (!editing && list.some(u => u.username === username))) {
      return window.alert('Usuario inválido o ya existe');
    }
    if (!displayName) return window.alert('displayName requerido');
    if (!pin && !editing) return window.alert('PIN requerido');
    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.username, { username, displayName, pin: pin || undefined });
        setList(prev => prev.map(u => u.username === editing.username ? { ...u, username, displayName } : u));
      } else {
        await createUser({ username, displayName, pin });
        setList(prev => prev.concat({ username, displayName }));
      }
      setModalOpen(false);
    } catch (e) {
      window.alert(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const currentUser = self;

  return (
    <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex flex-col">
      <Header title="Usuarios" />
      <main className="flex-1 p-6 space-y-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] view-enter view-enter-active">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({length:5}).map((_,i)=>(
              <div key={i} className="h-12 rounded-lg bg-white/10" />
            ))}
          </div>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Gestión de usuarios</h2>
              <div className="flex items-center gap-2">
                {isAdmin() && (
                <button className="px-3 py-2 rounded-lg bg-[var(--primary-color)] text-white hover:opacity-90" onClick={openCreate}>
                  <span className="material-symbols-outlined align-middle mr-1">person_add</span>Nuevo
                </button>
                )}
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary-color)]">Persistencia: Servidor. Reglas: no puedes eliminarte a ti mismo y debe existir siempre al menos un usuario con rol dev.</p>
            <ul className="bg-[var(--card-color)] rounded-lg border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
              {list.map(u => (
                <li key={u.username} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{u.displayName || u.username}</p>
                    <p className="text-xs text-[var(--text-secondary-color)]">{u.username}{currentUser===u.username?' · tú':''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 rounded-lg border border-[var(--border-color)] hover:bg-white/5" onClick={()=>openEdit(u)} disabled={!canEdit(u)}>
                      <span className="material-symbols-outlined !text-base">edit</span>
                    </button>
                    <button className="px-2 py-1 rounded-lg border border-[var(--danger-color)] text-[var(--danger-color)] hover:bg-red-900/10" onClick={()=>onDelete(u)} disabled={!canEdit(u)}>
                      <span className="material-symbols-outlined !text-base">delete</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <BottomNav
        onHome={() => navigate('/dashboard')}
        onMovements={() => navigate('/movements')}
        onWallet={() => navigate('/wallet')}
        onReports={() => navigate('/reports')}
        onAddIncome={() => navigate('/new?tipo=INGRESO')}
        onAddExpense={() => navigate('/new?tipo=EGRESO')}
        onCashout={() => navigate('/cashout')}
        onCashoutBank={() => navigate('/cashout-bank')}
        active={null}
      />

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={()=>setModalOpen(false)}>
          <div className="w-full max-w-md bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-5" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold mb-3 flex items-center gap-2"><span className="material-symbols-outlined">{editing?'edit':'person_add'}</span>{editing?'Editar usuario':'Nuevo usuario'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Usuario</label>
                <input className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm" value={username} onChange={(e)=>setUsername(e.target.value)} disabled={!!editing} />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Nombre a mostrar</label>
                <input className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm" value={displayName} onChange={(e)=>setDisplayName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">PIN {editing?'(opcional para cambiar)':'(requerido)'}</label>
                <input type="password" inputMode="numeric" pattern="[0-9]*" className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm" value={pin} onChange={(e)=>setPin(e.target.value.replace(/\D/g,''))} />
              </div>
              <div className="text-xs text-[var(--text-secondary-color)]">Reglas: no puedes eliminarte a ti mismo. Si solo existe un usuario con rol dev, no puede eliminarse ni degradarse.</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary-color)] hover:bg-white/5" onClick={()=>setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className="flex-1 py-2 rounded-lg bg-[var(--primary-color)] text-white hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2" onClick={onSave} disabled={saving}>
                {saving && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
