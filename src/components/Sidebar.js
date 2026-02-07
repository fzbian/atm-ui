import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logout, isAdmin } from "../auth";
import { useRole } from "../context/RoleContext";

export default function Sidebar({ open, onClose }) {
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;
    const { hasAccess, reloadConfig } = useRole();

    const handleNav = (to) => {
        navigate(to);
        if (window.innerWidth < 1024) { // Only close on mobile
            onClose();
        }
    };

    const isActive = (p) => {
        if (p === '/dashboard' && path === '/') return true;
        if (path === p) return true;
        return path.startsWith(p + '/');
    };

    const menuItems = [
        { id: 'dashboard', label: "Inicio", icon: "home", path: "/dashboard" },
        { id: 'movements', label: "Movimientos", icon: "receipt_long", path: "/movements" },
        { id: 'gastos', label: "Gastos", icon: "receipt", path: "/gastos" },
        { id: 'pedidos', label: "Pedidos", icon: "shopping_cart", path: "/pedidos" },
        { id: 'wallet', label: "Cartera", icon: "account_balance_wallet", path: "/wallet" },
        { id: 'payroll', label: "Nómina", icon: "payments", path: "/payroll" },
        { id: 'billing', label: "Facturación", icon: "request_quote", path: "/billing" },
        { id: 'reports', label: "Reportes", icon: "bar_chart", path: "/reports" },
    ];

    const secondaryItems = [
        { id: 'cashout', label: "Retirar efectivo", icon: "point_of_sale", path: "/cashout" },
        { id: 'cashout-bank', label: "Retirar de banco", icon: "account_balance", path: "/cashout-bank" },
    ];

    const visibleMenu = menuItems.filter(i => hasAccess(i.id));
    const visibleSecondary = secondaryItems.filter(i => hasAccess(i.id));

    return (
        <>
            {/* Mobile Backdrop */}
            <div
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 lg:hidden ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sidebar Container */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-[var(--card-color)] border-r border-[var(--border-color)] transform transition-transform duration-300 ease-out lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex flex-col h-full">
                    {/* Logo / Header Area */}
                    <div className="h-16 flex items-center px-6 border-b border-[var(--border-color)]">
                        <img
                            src="https://rrimg.chinatownlogistic.com/public/uploads/d55c740d031af3f7f42f7c87e6178df6.png"
                            alt="RickyRich ATM"
                            className="h-12 object-contain"
                        />
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">

                        {/* Main Navigation */}
                        {visibleMenu.length > 0 && (
                            <nav className="space-y-1">
                                <p className="px-4 text-xs font-semibold text-[var(--text-secondary-color)] uppercase tracking-wider mb-2">Menu</p>
                                {visibleMenu.map((item) => (
                                    <button
                                        key={item.path}
                                        onClick={() => handleNav(item.path)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive(item.path)
                                            ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] font-medium'
                                            : 'text-[var(--text-secondary-color)] hover:bg-white/5 hover:text-[var(--text-color)]'
                                            }`}
                                    >
                                        <span className={`material-symbols-outlined ${isActive(item.path) ? 'fill-current' : ''}`}>{item.icon}</span>
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </nav>
                        )}

                        {/* Secondary Actions */}
                        {visibleSecondary.length > 0 && (
                            <nav className="space-y-1">
                                <p className="px-4 text-xs font-semibold text-[var(--text-secondary-color)] uppercase tracking-wider mb-2">Caja</p>
                                {visibleSecondary.map((item) => (
                                    <button
                                        key={item.path}
                                        onClick={() => handleNav(item.path)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive(item.path)
                                            ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] font-medium'
                                            : 'text-[var(--text-secondary-color)] hover:bg-white/5 hover:text-[var(--text-color)]'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </nav>
                        )}

                        {/* Admin / Configuration */}
                        {isAdmin() && (
                            <nav className="space-y-1">
                                <p className="px-4 text-xs font-semibold text-[var(--text-secondary-color)] uppercase tracking-wider mb-2">Configuración</p>
                                <button
                                    onClick={() => handleNav('/admin/users')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive('/admin/users')
                                        ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] font-medium'
                                        : 'text-[var(--text-secondary-color)] hover:bg-white/5 hover:text-[var(--text-color)]'
                                        }`}
                                >
                                    <span className="material-symbols-outlined">group</span>
                                    <span>Usuarios</span>
                                </button>
                                <button
                                    onClick={() => handleNav('/admin/roles')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive('/admin/roles')
                                        ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] font-medium'
                                        : 'text-[var(--text-secondary-color)] hover:bg-white/5 hover:text-[var(--text-color)]'
                                        }`}
                                >
                                    <span className="material-symbols-outlined">shield_person</span>
                                    <span>Roles</span>
                                </button>
                                <button
                                    onClick={() => handleNav('/admin/categories')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive('/admin/categories')
                                        ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] font-medium'
                                        : 'text-[var(--text-secondary-color)] hover:bg-white/5 hover:text-[var(--text-color)]'
                                        }`}
                                >
                                    <span className="material-symbols-outlined">category</span>
                                    <span>Categorías</span>
                                </button>
                            </nav>
                        )}
                    </div>

                    {/* Footer / User Info */}
                    <div className="p-4 border-t border-[var(--border-color)] bg-[var(--background-color)]/50">
                        <div className="px-4 mb-2">
                            <p className="text-sm font-semibold text-[var(--text-color)] truncate">
                                {(() => {
                                    try {
                                        const session = JSON.parse(localStorage.getItem('auth_session_v1'));
                                        return session?.displayName || session?.username || 'Usuario';
                                    } catch { return 'Usuario'; }
                                })()}
                            </p>
                            <p className="text-xs text-[var(--text-secondary-color)] truncate">
                                {(() => {
                                    try {
                                        const session = JSON.parse(localStorage.getItem('auth_session_v1'));
                                        return session?.role || '';
                                    } catch { return ''; }
                                })()}
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                logout();
                                await reloadConfig();
                                navigate('/login');
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[var(--text-secondary-color)] hover:text-[var(--danger-color)] hover:bg-red-500/10 transition-colors"
                        >
                            <span className="material-symbols-outlined">logout</span>
                            <span className="text-sm font-medium">Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
