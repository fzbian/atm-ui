import React from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import useTitle from '../useTitle';

export default function Pedidos() {
    useTitle('Pedidos · ATM Ricky Rich');
    const navigate = useNavigate();

    return (
        <Layout title="Pedidos">
            <div className="flex flex-col items-center justify-center text-center h-full">
                <div className="bg-[var(--card-color)] border border-[var(--border-color)] p-8 rounded-2xl max-w-sm w-full">
                    <span className="material-symbols-outlined text-6xl text-[var(--primary-color)] mb-4">shopping_cart</span>
                    <h2 className="text-xl font-bold mb-2">Pedidos</h2>
                    <p className="text-[var(--text-secondary-color)] mb-6">
                        Esta funcionalidad estará disponible próximamente.
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-3 rounded-xl bg-[var(--primary-color)] text-white font-semibold hover:opacity-90 transition-opacity"
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        </Layout>
    );
}
