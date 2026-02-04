import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { apiFetch } from '../api';
import useTitle from '../useTitle';
import { formatCLP } from '../formatMoney';
import { useNotifications } from '../components/Notifications';
import { useNavigate } from 'react-router-dom';

export default function Gastos() {
    useTitle('Gastos Operativos · ATM Ricky Rich');
    const navigate = useNavigate();
    const { notify } = useNotifications();

    const [loading, setLoading] = useState(true);
    const [gastos, setGastos] = useState([]);
    const [selectedLocal, setSelectedLocal] = useState('');
    const [modalImage, setModalImage] = useState(null);

    useEffect(() => {
        fetchGastos();
    }, []);

    const fetchGastos = async () => {
        try {
            setLoading(true);
            const r = await apiFetch('/api/gastos');
            if (!r.ok) throw new Error('Error cargando gastos');
            const data = await r.json();
            setGastos(data || []);
            // Auto-select first local if available
            if (data && data.length > 0 && !selectedLocal) {
                // Maybe don't auto select to show all? Or distinct list.
            }
        } catch (e) {
            console.error(e);
            notify({ type: 'error', message: 'No se pudieron cargar los gastos' });
        } finally {
            setLoading(false);
        }
    };

    const uniqueLocales = useMemo(() => {
        const s = new Set(gastos.map(g => g.local));
        return Array.from(s).sort();
    }, [gastos]);

    useEffect(() => {
        if (!selectedLocal && uniqueLocales.length > 0) {
            setSelectedLocal(uniqueLocales[0]);
        }
    }, [uniqueLocales, selectedLocal]);

    const filteredGastos = useMemo(() => {
        if (!selectedLocal) return [];
        return gastos.filter(g => g.local === selectedLocal);
    }, [gastos, selectedLocal]);

    return (
        <Layout title="Gastos Operativos">
            <div className="view-enter view-enter-active space-y-6">

                {loading ? (
                    <div className="flex justify-center p-8">
                        <span className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Locales Tabs */}
                        {uniqueLocales.length > 0 ? (
                            <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                                <div className="flex gap-2 min-w-max">
                                    {uniqueLocales.map(loc => (
                                        <button
                                            key={loc}
                                            onClick={() => setSelectedLocal(loc)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedLocal === loc
                                                ? 'bg-[var(--primary-color)] text-white shadow-lg shadow-[var(--primary-color)]/20'
                                                : 'bg-white/5 text-[var(--text-secondary-color)] border border-white/5 hover:bg-white/10'}`}
                                        >
                                            {loc}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-[var(--text-secondary-color)]">
                                <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">receipt_long</span>
                                No hay gastos registrados aún.
                            </div>
                        )}

                        {/* List */}
                        <div className="space-y-3">
                            {filteredGastos.map(g => (
                                <div key={g.id} className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl p-4 flex gap-4">
                                    {/* Image Thumbnail */}
                                    <button
                                        onClick={() => setModalImage(g.imagen_url)}
                                        className="w-20 h-20 shrink-0 bg-black/20 rounded-xl overflow-hidden relative group"
                                    >
                                        <img src={g.imagen_url} alt="Soporte" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 drop-shadow-md">visibility</span>
                                        </div>
                                    </button>

                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                        <div>
                                            <div className="flex justify-between items-start gap-2">
                                                <p className="font-semibold text-[var(--text-color)] text-sm truncate">{g.motivo}</p>
                                                <span className="text-[var(--danger-color)] font-bold text-sm">{formatCLP(g.monto)}</span>
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary-color)] mt-0.5">
                                                {new Date(g.fecha).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary-color)] bg-white/5 self-start px-2 py-1 rounded-md mt-2">
                                            <span className="material-symbols-outlined text-[10px]">person</span>
                                            {g.usuario}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>

            {/* Image Modal */}
            {modalImage && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalImage(null)}>
                    <button className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                    <img src={modalImage} alt="Soporte Full" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </Layout>
    );
}
