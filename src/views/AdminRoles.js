import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { getRoleConfigs, saveRoleConfig } from '../configApi';
import { useRole } from '../context/RoleContext';

const AVAILABLE_VIEWS = [
    { id: 'dashboard', label: 'Inicio (Dashboard)' },
    { id: 'movements', label: 'Movimientos' },
    { id: 'gastos', label: 'Gastos' },
    { id: 'pedidos', label: 'Pedidos' },
    { id: 'wallet', label: 'Cartera' },
    { id: 'payroll', label: 'Nómina' },
    { id: 'reports', label: 'Reportes' },
    { id: 'cashout', label: 'Retirar Efectivo (Caja)' },
    { id: 'cashout-bank', label: 'Retirar Banco' },
    { id: 'admin/users', label: 'Admin Usuarios' },
    { id: 'admin/categories', label: 'Admin Categorías' },
];

const ROLES = [
    { id: 'user', label: 'Usuario (Cajero)' },
    { id: 'finance', label: 'Finanzas' },
    { id: 'admin', label: 'Administrador' }
];

export default function AdminRoles() {
    const { reloadConfig } = useRole();
    const [configs, setConfigs] = useState({}); // Map role -> [viewId, ...]
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedRole, setSelectedRole] = useState('user');

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const data = await getRoleConfigs();
            // Transform list to map
            const map = {};
            data.forEach(c => {
                try {
                    map[c.role] = JSON.parse(c.views);
                } catch (e) {
                    map[c.role] = [];
                }
            });
            setConfigs(map);
        } catch (e) {
            console.error(e);
            alert('Error cargando configuraciones');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (viewId) => {
        const current = configs[selectedRole] || [];
        const newViews = current.includes(viewId)
            ? current.filter(v => v !== viewId)
            : [...current, viewId];

        setConfigs(prev => ({ ...prev, [selectedRole]: newViews }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save current role config (or iterate all if needed, but per-role is simpler to reason)
            // Actually let's save the currently selected role
            await saveRoleConfig(selectedRole, configs[selectedRole] || []);
            alert('Configuración guardada correctamente');
            await reloadConfig(); // Refresh global app permissions
        } catch (e) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout title="Configuración de Roles">
            <div className="space-y-6 view-enter view-enter-active">

                {/* Role Selector */}
                <div className="flex gap-2 border-b border-[var(--border-color)] pb-4 overflow-x-auto">
                    {ROLES.map(role => (
                        <button
                            key={role.id}
                            onClick={() => setSelectedRole(role.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${selectedRole === role.id
                                ? 'bg-[var(--primary-color)] text-white'
                                : 'bg-[var(--card-color)] text-[var(--text-secondary-color)] hover:bg-white/5'
                                }`}
                        >
                            {role.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="p-8 text-center text-[var(--text-secondary-color)]">Cargando...</div>
                ) : (
                    <div className="bg-[var(--card-color)] rounded-xl border border-[var(--border-color)] p-6">
                        <h3 className="font-semibold mb-4">Permisos de Vistas para: {ROLES.find(r => r.id === selectedRole)?.label}</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {AVAILABLE_VIEWS.map(view => {
                                const isEnabled = (configs[selectedRole] || []).includes(view.id);
                                return (
                                    <label key={view.id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-color)] hover:bg-white/5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isEnabled}
                                            onChange={() => handleToggle(view.id)}
                                            className="w-5 h-5 rounded border-gray-600 bg-transparent text-[var(--primary-color)] focus:ring-0 focus:ring-offset-0"
                                        />
                                        <span className={isEnabled ? 'text-[var(--text-color)]' : 'text-[var(--text-secondary-color)]'}>
                                            {view.label}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
