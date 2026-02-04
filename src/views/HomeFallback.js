import React from 'react';
import Layout from '../components/Layout';
import { getSessionUsername } from '../auth';

export default function HomeFallback() {
    const username = getSessionUsername();

    return (
        <Layout title="Bienvenido">
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 view-enter view-enter-active">

                <div className="w-24 h-24 bg-[var(--card-color)] rounded-full flex items-center justify-center border border-[var(--border-color)] shadow-xl mb-4">
                    <img
                        src="https://rrimg.chinatownlogistic.com/public/uploads/d55c740d031af3f7f42f7c87e6178df6.png"
                        alt="Logo"
                        className="w-16 h-16 object-contain opacity-80"
                    />
                </div>

                <h2 className="text-2xl font-bold text-[var(--text-color)]">
                    Hola, {username}
                </h2>

                <p className="max-w-md text-[var(--text-secondary-color)]">
                    Bienvenido al sistema ATM de RickyRich.
                    Selecciona una opción del menú para comenzar.
                </p>

                <div className="p-4 rounded-lg bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20 text-[var(--primary-color)] text-sm">
                    <p>Tu rol actual tiene acceso limitado al Dashboard.</p>
                </div>

            </div>
        </Layout>
    );
}
