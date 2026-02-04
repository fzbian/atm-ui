import React, { useEffect, useMemo, useState } from 'react';
import { getSessionUsername, isAdmin } from '../auth';
import { loadUsers, updateUser, syncUsers } from '../usersApi';
import { getRoleConfigs } from '../configApi';
import Layout from '../components/Layout';

export default function AdminUsers() {
  const [list, setList] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // user or null for create
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [users, rolesData] = await Promise.all([
          loadUsers(),
          getRoleConfigs()
        ]);
        setList(users);

        // Extract roles from config
        // RoleConfig: { role: string, views: string }
        const roles = rolesData.map(r => r.role);
        // Ensure we at least have the basic ones if DB is empty or just show what's there
        setAvailableRoles(roles.length > 0 ? roles : ['user']);

      } catch (e) {
        setError(e.message || 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const self = getSessionUsername();
  const canEdit = useMemo(() => (u) => u?.username !== self, [self]);

  const handleSync = async () => {
    if (!window.confirm('¿Sincronizar usuarios con Odoo? Esto puede actualizar nombres y pines.')) return;
    setSyncing(true);
    try {
      const res = await syncUsers();
      alert(res.message || 'Sincronización completa');
      const users = await loadUsers();
      setList(users);
    } catch (e) {
      alert(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const openEdit = (u) => {
    setEditing(u);
    setUsername(u.username);
    setName(u.name || '');
    setRole(u.role || 'user');
    setModalOpen(true);
  };

  const onSave = async () => {
    if (!editing) return; // No creation allowed
    setSaving(true);
    try {
      // Only role update is allowed logically, but we send what's needed
      await updateUser(editing.username, { role });
      setList(prev => prev.map(u => u.username === editing.username ? { ...u, role } : u));
      setModalOpen(false);
    } catch (e) {
      window.alert(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Usuarios">
      <div className="space-y-4 view-enter view-enter-active">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
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
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-3 py-2 rounded-lg bg-[var(--card-color)] border border-[var(--border-color)] hover:bg-white/5 flex items-center gap-2 text-sm"
                >
                  <span className={`material-symbols-outlined ${syncing ? 'animate-spin' : ''}`}>sync</span>
                  {syncing ? '...' : 'Sincronizar'}
                </button>
                {isAdmin() && (
                  <span className="text-xs text-[var(--text-secondary-color)] hidden sm:inline">Gestión Odoo</span>
                )}
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary-color)]">Usuarios sincronizados desde Odoo. Solo se puede editar el rol.</p>
            <ul className="bg-[var(--card-color)] rounded-lg border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
              {list.map(u => (
                <li key={u.username} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{u.name || u.username}</p>
                    <p className="text-xs text-[var(--text-secondary-color)]">{u.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10">{u.role}</span>
                    <button className="px-2 py-1 rounded-lg border border-[var(--border-color)] hover:bg-white/5" onClick={() => openEdit(u)} disabled={!canEdit(u)}>
                      <span className="material-symbols-outlined !text-base">edit</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-3 flex items-center gap-2"><span className="material-symbols-outlined">edit</span>Editar usuario</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Usuario</label>
                <input className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm opacity-60" value={username} disabled />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Nombre</label>
                <input className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm opacity-60" value={name || ''} disabled />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Rol</label>
                <select className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
                  {availableRoles.map(r => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                  {/* Fallback for current role if not in list (e.g. dev) */}
                  {!availableRoles.includes(role) && <option value={role}>{role}</option>}
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary-color)] hover:bg-white/5" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className="flex-1 py-2 rounded-lg bg-[var(--primary-color)] text-white hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2" onClick={onSave} disabled={saving}>
                {saving && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
