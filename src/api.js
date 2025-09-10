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
  return fetch(url, options);
}

export function setApiBase(base) {
  apiBase = base || '';
}

export async function pingServer() {
  await loadConfig();
  const base = apiBase || '';
  const url = base ? base.replace(/\/$/, '') + '/health' : '/health';
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    return res.ok;
  } catch {
    return false;
  }
}
