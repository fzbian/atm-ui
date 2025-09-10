import React from "react";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { useNavigate } from "react-router-dom";
import useTitle from "../useTitle";

export default function Wallet() {
  const navigate = useNavigate();
  useTitle("Cartera · ATM Ricky Rich");
  return (
    <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex flex-col">
      <Header title="Cartera" />
      <main className="flex-1 p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] view-enter view-enter-active flex items-center justify-center">
        <div className="text-center max-w-sm w-full bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl p-6">
          <span className="material-symbols-outlined !text-5xl text-[var(--text-secondary-color)]" aria-hidden>build</span>
          <h2 className="mt-3 text-lg font-semibold">Funcionalidad no implementada</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary-color)]">Estamos trabajando para habilitar esta sección pronto.</p>
        </div>
      </main>
      <BottomNav
        onHome={() => navigate('/dashboard')}
        onMovements={() => navigate('/movements')}
        onWallet={() => {}}
  onReports={() => navigate('/reports')}
        onAddIncome={() => navigate('/new?tipo=INGRESO')}
        onAddExpense={() => navigate('/new?tipo=EGRESO')}
        active="wallet"
      />
    </div>
  );
}
