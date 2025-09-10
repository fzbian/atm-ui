// Cliente API centralizado con base configurable desde /config.json
let apiBase; // undefined = no cargado, string = base URL ('' para relativa)

async function loadConfig() {
  if (apiBase !== undefined) return;
  try {
    const res = await fetch('/config.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('no config');
    const data = await res.json();
    apiBase = (data && typeof data.apiBase === 'string') ? data.apiBase : '';
  } catch {
    apiBase = '';
  }
}

export async function apiFetch(path, options) {
  await loadConfig();
  const base = apiBase || '';
  const url = base
    ? base.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path)
    : path;
  try {
    return await fetch(url, options);
  } catch (e) {
    // Fallback: si hay base remota y falla (CORS/red), reintenta contra mismo origen
    if (base && path) {
      const rel = path.startsWith('/') ? path : '/' + path;
      try {
        return await fetch(rel, options);
      } catch (_) {
        throw e;
      }
    }
    throw e;
  }
}

export function setApiBase(base) {
  apiBase = base || '';
}

export async function pingServer() {
  await loadConfig();
  const base = apiBase || '';
  const root = base ? base.replace(/\/$/, '') : '';
  const candidates = ['/health', '/api/caja', '/'];
  for (const p of candidates) {
    const url = root ? root + p : p;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) return true;
    } catch {
      // intenta siguiente
    }
  }
  return false;
}
