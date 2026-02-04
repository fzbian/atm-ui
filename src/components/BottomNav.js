import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function BottomNav({
  onCreateMovement,
  onAddIncome,
  onAddExpense,
  onCashout,
  onCashoutBank,
  onHome,
  onReports,
  onMovements,
  onWallet,
  onGastos,
  onPedidos,
  active = "home"
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Helper for navigation defaults
  const navTo = (handler, path) => () => {
    if (handler) handler();
    else navigate(path);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      {/* Backdrop + Action sheet (siempre montados para animar salida) */}
      <div className={`pointer-events-none fixed inset-0 z-40 ${open ? 'pointer-events-auto' : ''}`} aria-hidden={!open}>
        {/* Backdrop */}
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 motion-safe:duration-300 ease-out ${open ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* Sheet container */}
        <div className="absolute inset-x-0 bottom-24 flex justify-center px-4">
          <div
            id="fab-sheet"
            className={`w-[min(480px,100%)] transform-gpu will-change-transform border border-[var(--border-color)] rounded-2xl shadow-2xl backdrop-blur-md bg-[var(--card-color)]/90 transition-all duration-200 motion-safe:duration-300 ease-out ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            role="dialog"
            aria-modal="true"
          >
            <div className="px-5 py-5 flex flex-col gap-3 items-center text-center">
              {/* Acción unificada: Realizar movimiento */}
              <button
                className="w-full max-w-sm flex items-center justify-center gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--background-color)] transition-colors duration-150 hover:bg-white/5 active:scale-[0.98]"
                onClick={() => {
                  if (onCreateMovement) {
                    onCreateMovement();
                  } else if (onAddIncome) {
                    onAddIncome();
                  } else if (onAddExpense) {
                    onAddExpense();
                  } else {
                    navigate('/new');
                  }
                  setOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[var(--primary-color)]">add_notes</span>
                <span className="text-base font-medium text-[var(--text-color)]">Realizar movimiento</span>
              </button>

              <div className="h-px bg-[var(--border-color)] my-1" />

              {/* Retirar efectivo en punto */}
              <button
                className="w-full max-w-sm flex items-center justify-center gap-3 p-4 rounded-xl border border-transparent bg-[#2563eb] text-white transition-colors duration-150 hover:brightness-110 active:scale-[0.98]"
                onClick={() => {
                  if (onCashout) onCashout();
                  else navigate('/cashout');
                  setOpen(false);
                }}
              >
                <span className="material-symbols-outlined !text-white">point_of_sale</span>
                <span className="text-base font-semibold">Retirar efectivo en punto</span>
              </button>

              {/* Retirar dinero de banco */}
              <button
                className="w-full max-w-sm flex items-center justify-center gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--background-color)] transition-colors duration-150 hover:bg-white/5 active:scale-[0.98]"
                onClick={() => {
                  if (onCashoutBank) onCashoutBank();
                  else navigate('/cashout-bank');
                  setOpen(false);
                }}
              >
                <span className="material-symbols-outlined">account_balance</span>
                <span className="text-base font-medium">Retirar dinero de banco</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Nav bar */}
      <nav className="relative overflow-visible border-t border-[var(--border-color)] bg-[var(--card-color)]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        {/* Usamos grid-cols-7 para acomodar los nuevos items */}
        <div className="h-16 grid grid-cols-7 items-center max-w-2xl mx-auto">

          <button
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${active === 'home' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary-color)] hover:text-[var(--primary-color)]'}`}
            onClick={navTo(onHome, '/dashboard')}
          >
            <span className="material-symbols-outlined text-2xl">home</span>
            {/* <span className="text-[9px] font-medium">Inicio</span> */}
          </button>

          <button
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${active === 'movs' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary-color)] hover:text-[var(--primary-color)]'}`}
            onClick={navTo(onMovements, '/movements')}
          >
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
          </button>

          <button
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${active === 'gastos' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary-color)] hover:text-[var(--primary-color)]'}`}
            onClick={navTo(onGastos, '/gastos')}
          >
            <span className="material-symbols-outlined text-2xl">receipt</span>
          </button>

          {/* FAB Center */}
          <div className="relative flex items-center justify-center -mt-6">
            <button
              className={`h-14 w-14 rounded-full bg-[var(--primary-color)] text-white shadow-lg ring-4 ring-[var(--card-color)] border border-white/10 flex items-center justify-center transform-gpu transition-all duration-200 ${open ? 'scale-100 rotate-45 bg-red-500' : 'hover:scale-105 active:scale-95'} z-10`}
              onClick={() => setOpen(!open)}
            >
              <span className="material-symbols-outlined !text-3xl">add</span>
            </button>
          </div>

          <button
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${active === 'pedidos' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary-color)] hover:text-[var(--primary-color)]'}`}
            onClick={navTo(onPedidos, '/pedidos')}
          >
            <span className="material-symbols-outlined text-2xl">shopping_cart</span>
          </button>

          <button
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${active === 'wallet' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary-color)] hover:text-[var(--primary-color)]'}`}
            onClick={navTo(onWallet, '/wallet')}
          >
            <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
          </button>

          <button
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${active === 'reports' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary-color)] hover:text-[var(--primary-color)]'}`}
            onClick={navTo(onReports, '/reports')}
          >
            <span className="material-symbols-outlined text-2xl">bar_chart</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
