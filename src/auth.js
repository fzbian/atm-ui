// Autenticación basada en usuarios del servidor local (SQLite via /usuarios)
import { apiFetch } from './api';

const SESSION_KEY = 'auth_session_v1';

// Nota: usamos PIN plano contra /login del servidor SQLite. Si migras a hash/salt, añade util de hash aquí.

let usersCache = null; // { users: Array<{ username, displayName?, salt?, pinHash?, pin? }> }

export async function getUsers(force = false) {
  if (usersCache && !force) return usersCache.users || [];
  const res = await apiFetch('/usuarios', { cache: 'no-cache' });
  if (!res.ok) throw new Error(await res.text().catch(()=> 'No se pudo cargar usuarios'));
  const data = await res.json();
  const users = Array.isArray(data) ? data : [];
  usersCache = { users };
  return users;
}

export async function login(username, pin) {
  if (!username || !pin) throw new Error('Usuario y PIN son requeridos');
  const res = await apiFetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, pin }) });
  if (!res.ok) throw new Error(await res.text().catch(()=> 'No se pudo iniciar sesión'));
  const data = await res.json();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username: data.username, ts: Date.now(), displayName: data.displayName, role: data.role }));
  return { username: data.username };
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function isAuthenticated() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    return !!s?.username;
  } catch {
    return false;
  }
}

export function getSessionUsername() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s?.username || null;
  } catch {
    return null;
  }
}

export function isAdmin() {
  try {
    const raw = localStorage.getItem('auth_session_v1');
    if (!raw) return false;
    const s = JSON.parse(raw);
    return s?.role === 'dev';
  } catch {
    return false;
  }
}

// Ya no existen overrides locales; todo proviene del servidor

export async function hashPinWithSalt(pin) {
  const salt = Math.random().toString(36).slice(2, 10);
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hash));
  const pinHash = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return { salt, pinHash };
}
