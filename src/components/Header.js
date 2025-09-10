import React, { useEffect, useState } from "react";
import { isAuthenticated, logout, isAdmin } from "../auth";
import { useNavigate } from "react-router-dom";
import { toggleTheme, getSavedTheme, getSystemPref } from "../theme";

export default function Header({ title, titleImage, titleImageClass }) {
  const navigate = useNavigate();
  const showLogout = isAuthenticated();
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Sincroniza estado con tema activo
    const t = getSavedTheme() || getSystemPref();
    setIsLight(t === 'light');
  }, []);

  const onToggleTheme = () => {
    const t = toggleTheme();
    setIsLight(t === 'light');
  };
  const onLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };
  return (
    <header className="grid grid-cols-3 items-center p-4 sticky top-0 bg-[var(--background-color)]/90 backdrop-blur-sm z-10 border-b border-[var(--border-color)]">
  <div className="flex items-center justify-start min-w-0" />
      <div className="flex items-center justify-center min-w-0">
        {titleImage ? (
          <img src={titleImage} alt={title || 'Logo'} className={`${titleImageClass || 'h-6'} object-contain`} />
        ) : (
          <h1 className="text-xl font-bold leading-tight text-center truncate">{title}</h1>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        {isAdmin() && (
          <div className="relative">
            <details className="group">
              <summary className="h-9 w-9 rounded-md border border-[var(--border-color)] hover:bg-white/5 text-[var(--text-secondary-color)] flex items-center justify-center list-none cursor-pointer select-none">
                <span className="material-symbols-outlined !text-base">settings</span>
              </summary>
              <div className="absolute right-0 mt-2 w-44 bg-[var(--card-color)] border border-[var(--border-color)] rounded-lg shadow-lg py-1 z-20">
                <button className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2" onClick={()=>navigate('/admin/users')}>
                  <span className="material-symbols-outlined !text-base">group</span>Usuarios
                </button>
                <button className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2" onClick={()=>navigate('/admin/categories')}>
                  <span className="material-symbols-outlined !text-base">category</span>Categorías
                </button>
              </div>
            </details>
          </div>
        )}
        <button
          aria-label={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
          title={isLight ? "Modo oscuro" : "Modo claro"}
          className="h-9 w-9 rounded-md border border-[var(--border-color)] hover:bg-white/5 text-[var(--text-secondary-color)] flex items-center justify-center"
          onClick={onToggleTheme}
        >
          <span className="material-symbols-outlined !text-base">{isLight ? 'dark_mode' : 'light_mode'}</span>
        </button>
        {showLogout ? (
          <button
            aria-label="Cerrar sesión"
            className="h-9 w-9 rounded-md border border-[var(--danger-color)] text-[var(--danger-color)] hover:bg-red-900/10 flex items-center justify-center"
            onClick={onLogout}
            title="Cerrar sesión"
          >
            <span className="material-symbols-outlined !text-base">logout</span>
          </button>
        ) : (
          <div className="w-6" />
        )}
      </div>
    </header>
  );
}
