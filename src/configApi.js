import { apiFetch } from './api';

export async function getRoleConfigs() {
    const res = await apiFetch('/api/config/roles');
    if (!res.ok) throw new Error('Error cargando configuraciones');
    return res.json();
}

export async function saveRoleConfig(role, views) {
    const res = await apiFetch('/api/config/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, views: JSON.stringify(views) })
    });
    if (!res.ok) throw new Error('Error guardando configuración');
    return res.json();
}
