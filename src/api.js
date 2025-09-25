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
  const isAbsolute = typeof path === 'string' && /^(?:https?:)?\/\//i.test(path);
  const p = typeof path === 'string' ? (path.startsWith('/') ? path : '/' + path) : String(path || '');
  // Rutas locales servidas por nuestro propio server (no deben usar apiBase remoto)
  const isLocalService = /^\/(usuarios|login|config\.json)(?:\/|$)/i.test(p);
  const shouldUseBase = base && !isAbsolute && !isLocalService;
  const url = shouldUseBase ? base.replace(/\/$/, '') + p : p;
  try {
    const opts = options || {};
    const headers = new Headers(opts.headers || {});
    if (!headers.has('accept')) headers.set('accept', 'application/json');
    return await fetch(url, { ...opts, headers });
  } catch (e) {
    // Fallback: si hay base remota y falla (CORS/red), reintenta contra mismo origen
    if (shouldUseBase && p) {
      const rel = p;
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
  const candidates = ['/health', '/api/caja?solo_caja=true', '/'];
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

// Obtiene solo el saldo de caja de forma ligera; devuelve número o null
export async function getSaldoCajaLight() {
  try {
    const res = await apiFetch('/api/caja?solo_caja=true');
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') return null;
    const n = Number(data.saldo_caja ?? data.saldo ?? data.total ?? data.saldo_actual);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
