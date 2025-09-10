import { getSessionUsername } from './auth';

// Users via local SQLite server (same origin proxy or different port)
async function req(path, options) {
  const res = await fetch(`/usuarios${path || ''}`, options);
  if (!res.ok) throw new Error(await res.text().catch(()=> res.statusText || 'error'));
  return res;
}

export async function loadUsers() {
  const res = await req('', { cache: 'no-cache' });
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Respuesta inválida de usuarios');
  return data;
}

export async function createUser(user) {
  if (!user?.username || !user?.displayName) throw new Error('Datos incompletos');
  const body = { username: user.username, displayName: user.displayName, pin: user.pin || null, role: user.role || 'user' };
  await req('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function updateUser(username, patch) {
  if (!username) throw new Error('Usuario requerido');
  const body = { ...patch };
  const actor = getSessionUsername();
  await req(`/${encodeURIComponent(username)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Actor-Username': actor || '' }, body: JSON.stringify(body) });
}

export async function deleteUser(username) {
  if (!username) throw new Error('Usuario requerido');
  const actor = getSessionUsername();
  await req(`/${encodeURIComponent(username)}`, { method: 'DELETE', headers: { 'X-Actor-Username': actor || '' } });
}
