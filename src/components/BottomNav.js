import React, { useState } from "react";

export default function BottomNav({ onAddIncome, onAddExpense, onCashout, onCashoutBank, onHome, onReports, onMovements, onWallet, active = "home" }) {
  const [open, setOpen] = useState(false);

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
            <div className="px-5 py-5 flex flex-col gap-3">
              <button
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--background-color)] transition-colors duration-150 hover:bg-white/5 active:scale-[0.98]"
                onClick={() => {
                  onAddIncome && onAddIncome();
                  setOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[var(--success-color)]">arrow_upward</span>
                <span className="text-base font-medium text-[var(--text-color)]">Registrar Ingreso</span>
              </button>
              <button
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--background-color)] transition-colors duration-150 hover:bg-white/5 active:scale-[0.98]"
                onClick={() => {
                  onAddExpense && onAddExpense();
                  setOpen(false);
                }}
              >
                <span className="material-symbols-outlined text-[var(--danger-color)]">arrow_downward</span>
                <span className="text-base font-medium text-[var(--text-color)]">Registrar Egreso</span>
              </button>

              {/* Separador */}
              <div className="h-px bg-[var(--border-color)] my-1" />

              {/* Acción nueva: Retirar efectivo en punto */}
              <button
                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-transparent bg-[#2563eb] text-white transition-colors duration-150 hover:brightness-110 active:scale-[0.98]"
                onClick={() => {
                  onCashout && onCashout();
                  setOpen(false);
                }}
              >
                <span className="material-symbols-outlined !text-white">point_of_sale</span>
                <span className="text-base font-semibold">Retirar efectivo en punto</span>
              </button>

              {/* Acción nueva: Retirar dinero de banco */}
              <button
                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--background-color)] transition-colors duration-150 hover:bg-white/5 active:scale-[0.98]"
                onClick={() => {
                  onCashoutBank && onCashoutBank();
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
      <nav className="relative overflow-visible border-t border-[var(--border-color)] bg-[var(--card-color)]/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
    <div className="h-16 grid grid-cols-5 items-center">
          <button
      className={`flex items-center justify-center transition-colors ${active === 'home' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary-color)] hover:text-[var(--primary-color)]'}`}
      onClick={onHome}
      aria-label="Inicio"
      title="Inicio"
          >
      <span className="material-symbols-outlined">home</span>
          </button>

          <button
      className={`flex items-center justify-center ${active === 'movs' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary-color)] hover:text-[var(--primary-color)]'}`}
      onClick={onMovements}
      aria-label="Movimientos"
      title="Movimientos"
          >
            <span className="material-symbols-outlined">receipt_long</span>
          </button>

          {/* FAB */}
      <div className="relative flex items-center justify-center">
            <button
        className={`absolute -top-12 h-16 w-16 rounded-full bg-[var(--primary-color)] text-white shadow-2xl ring-4 ring-[var(--card-color)] border border-[color:rgba(255,255,255,0.15)] flex items-center justify-center transform-gpu transition-transform duration-200 ${open ? 'scale-100 rotate-45' : 'hover:scale-105 active:scale-95'} z-10`}
        onClick={() => setOpen(!open)}
              aria-label={open ? "Cerrar" : "Agregar"}
        aria-expanded={open}
        aria-controls="fab-sheet"
            >
        <span className="material-symbols-outlined !text-4xl">add</span>
            </button>
          </div>

          <button
            className={`flex items-center justify-center ${active === 'wallet' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary-color)] hover:text-[var(--primary-color)]'}`}
            onClick={onWallet}
            aria-label="Cartera"
            title="Cartera"
          >
            <span className="material-symbols-outlined">account_balance_wallet</span>
          </button>

          <button
            className={`flex items-center justify-center transition-colors ${active === 'reports' ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary-color)] hover:text-[var(--primary-color)]'}`}
            onClick={onReports}
            aria-label="Reportes"
            title="Reportes"
          >
            <span className="material-symbols-outlined">bar_chart</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
