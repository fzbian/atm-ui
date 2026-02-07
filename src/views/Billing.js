import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { apiFetch } from '../api';
import { formatCLP } from '../formatMoney';
import { useNotifications } from '../components/Notifications';

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const esMonths = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function Billing() {
    const { notify } = useNotifications();
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({}); // { "POS Name": { "January": 1000... } }
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const idx = new Date().getMonth();
        return esMonths[idx]; // e.g., "Febrero"
    });
    const [showAllMonths, setShowAllMonths] = useState(false);

    // Report State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportStep, setReportStep] = useState(1);
    const [expenses, setExpenses] = useState({}); // { monthKey: { POS: { gastosComunes, nomina, servicioTotal, arriendo } } }
    const [configByPos, setConfigByPos] = useState({}); // { pos: { arriendo, internet, ... } }
    const [reportLoading, setReportLoading] = useState(false);
    const [commonModalPos, setCommonModalPos] = useState(null);
    const [commonList, setCommonList] = useState([]); // [{id,motivo,monto,fecha,included,source}]
    const [newCommon, setNewCommon] = useState({ motivo: '', monto: '' });

    // Service Config Modal State
    const [serviceModalPos, setServiceModalPos] = useState(null);
    const [serviceForm, setServiceForm] = useState({
        internet: 0, internet_aplica: true,
        luz: 0, luz_aplica: true,
        gas: 0, gas_aplica: true,
        agua: 0, agua_aplica: true,
    });

    const fetchBilling = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/odoo/billing?year=${year}`);
            if (res.ok) {
                const json = await res.json();
                setData(json || {});
            } else {
                const err = await res.json();
                notify({ type: 'error', message: err.error || 'Error cargando facturación' });
            }
        } catch (error) {
            console.error(error);
            notify({ type: 'error', message: 'Error de conexión' });
        } finally {
            setLoading(false);
        }
    }, [notify, year]);

    const monthNumber = useCallback(() => resolveMonthIndex(selectedMonth) + 1, [selectedMonth]);

    const loadCommonGastos = useCallback(async (pos) => {
        setReportLoading(true);
        try {
            const res = await apiFetch(`/api/billing/gastos?pos=${encodeURIComponent(pos)}&year=${year}&month=${monthNumber()}`);
            if (res.ok) {
                const list = await res.json();
                const mapped = list.map(g => ({
                    id: g.id || g.ID,
                    motivo: g.motivo || g.Motivo,
                    monto: g.monto || g.Monto,
                    fecha: g.fecha || g.Fecha,
                    included: true,
                    source: 'db',
                }));
                setCommonList(mapped);
            }
        } catch (e) {
            console.error(e);
            notify({ type: 'error', message: 'No se pudieron cargar los gastos comunes' });
        } finally {
            setReportLoading(false);
        }
    }, [year, monthNumber, notify]);

    const loadReportData = useCallback(async () => {
        setReportLoading(true);
        try {
            const [monthlyRes, cfgRes] = await Promise.all([
                apiFetch(`/api/billing/monthly?year=${year}&month=${monthNumber()}`),
                apiFetch(`/api/billing/configs`)
            ]);
            const mk = monthKey(selectedMonth);
            if (monthlyRes.ok) {
                const json = await monthlyRes.json();
                const expState = {};
                if (json.data) {
                    json.data.forEach(entry => {
                        if (!expState[mk]) expState[mk] = {};
                        expState[mk][entry.pos_name] = {
                            gastosComunes: entry.gastos_comunes || 0,
                            nomina: entry.nomina || 0,
                            margen: entry.margen || 0,
                        };
                    });
                }
                setExpenses(prev => ({ ...prev, ...expState }));
            }
            if (cfgRes.ok) {
                const cfgJson = await cfgRes.json();
                const cfgMap = {};
                cfgJson.forEach(cfg => {
                    cfgMap[cfg.pos_name] = cfg;
                });
                setConfigByPos(cfgMap);
            }
        } catch (err) {
            console.error(err);
            notify({ type: 'error', message: 'No se pudo cargar datos del informe' });
        } finally {
            setReportLoading(false);
        }
    }, [notify, selectedMonth, year, monthNumber]);

    const saveReportData = async () => {
        const mk = monthKey(selectedMonth);
        const entries = Object.entries(data).map(([pos]) => {
            const bucket = getExpenseBucket(selectedMonth, pos);
            return {
                pos_name: pos,
                nomina: bucket.nomina,
            };
        });
        const cfgEntries = Object.entries(configByPos).map(([pos, cfg]) => ({
            pos_name: pos,
            arriendo: cfg.arriendo || 0,
            internet: cfg.internet || 0,
            internet_aplica: !!cfg.internet_aplica,
            luz: cfg.luz || 0,
            luz_aplica: !!cfg.luz_aplica,
            gas: cfg.gas || 0,
            gas_aplica: !!cfg.gas_aplica,
            agua: cfg.agua || 0,
            agua_aplica: !!cfg.agua_aplica,
        }));
        try {
            setReportLoading(true);
            const [resMonthly, resCfg] = await Promise.all([
                apiFetch('/api/billing/monthly', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        year,
                        month: monthNumber(),
                        entries,
                    })
                }),
                apiFetch('/api/billing/configs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ entries: cfgEntries })
                })
            ]);
            if (!resMonthly.ok) {
                const err = await resMonthly.json();
                throw new Error(err.error || 'No se pudo guardar gastos');
            }
            if (!resCfg.ok) {
                const err = await resCfg.json();
                throw new Error(err.error || 'No se pudo guardar servicios/arriendo');
            }
            setReportStep(2);
            notify({ type: 'success', message: 'Datos guardados' });
        } catch (e) {
            console.error(e);
            notify({ type: 'error', message: e.message });
        } finally {
            setReportLoading(false);
        }
    };

    const applyCommonEdits = (pos, list) => {
        const mk = monthKey(selectedMonth);
        const total = list.filter(item => item.included !== false).reduce((sum, item) => sum + (Number(item.monto) || 0), 0);
        setExpenses(prev => ({
            ...prev,
            [mk]: {
                ...prev[mk],
                [pos]: {
                    ...prev[mk]?.[pos],
                    gastosComunes: total,
                }
            }
        }));
    };

    useEffect(() => {
        fetchBilling();
    }, [fetchBilling]);

    useEffect(() => {
        if (showReportModal) {
            loadReportData();
        }
    }, [showReportModal, loadReportData]);

    // Robust approach: get all keys from data values, unique them.
    const allKeys = new Set();
    Object.values(data).forEach(posData => {
        Object.keys(posData).forEach(k => allKeys.add(k));
    });

    // Attempt to map known months to Sort order
    const sortedColumns = Array.from(allKeys).sort((a, b) => {
        // Simple heuristic: check index in standard arrays
        const idxA = months.indexOf(a) !== -1 ? months.indexOf(a) : (esMonths.indexOf(a) !== -1 ? esMonths.indexOf(a) : 99);
        const idxB = months.indexOf(b) !== -1 ? months.indexOf(b) : (esMonths.indexOf(b) !== -1 ? esMonths.indexOf(b) : 99);
        return idxA - idxB;
    });

    const resolveMonthIndex = (label) => {
        const enIdx = months.findIndex(m => m.toLowerCase() === label.toLowerCase());
        if (enIdx !== -1) return enIdx;
        const esIdx = esMonths.findIndex(m => m.toLowerCase() === label.toLowerCase());
        return esIdx !== -1 ? esIdx : 99;
    };

    const monthLabelEs = (label) => {
        const idx = resolveMonthIndex(label);
        return idx !== 99 ? esMonths[idx] : label;
    };

    const monthKey = (label) => {
        const idx = resolveMonthIndex(label);
        return idx !== 99 ? months[idx] : label;
    };

    const getMonthValue = (posData, targetMonth) => {
        // Accept both EN/ES keys and ignore case
        const targetIdx = resolveMonthIndex(targetMonth);
        let val = 0;
        Object.entries(posData).forEach(([k, v]) => {
            if (resolveMonthIndex(k) === targetIdx) {
                val += v || 0;
            }
        });
        return val;
    };

    // Helper to get total for a row
    const getRowTotal = (posData) => {
        return Object.values(posData).reduce((sum, v) => sum + v, 0);
    };

    const grandTotal = Object.values(data).reduce((sum, posData) => sum + getRowTotal(posData), 0);
    const grandTotalSelectedMonth = Object.values(data).reduce((sum, posData) => sum + getMonthValue(posData, selectedMonth), 0);

    const getExpenseBucket = (month, pos) => {
        const mk = monthKey(month);
        return expenses[mk]?.[pos] || { gastosComunes: 0, servicioTotal: 0, nomina: 0, arriendo: 0 };
    };

    const updateNomina = (month, pos, value) => {
        const mk = monthKey(month);
        setExpenses(prev => ({
            ...prev,
            [mk]: {
                ...prev[mk],
                [pos]: {
                    ...prev[mk]?.[pos],
                    nomina: Number(value) || 0
                }
            }
        }));
    };

    return (
        <Layout title="Facturación por Punto de Venta">
            <div className="flex flex-col h-full space-y-6">

                {/* Header / Filter */}
                <div className="flex items-center justify-between bg-[var(--card-color)] p-4 rounded-2xl border border-[var(--border-color)] flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setYear(y => y - 1)}
                            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <span className="text-2xl font-bold font-mono text-[var(--primary-color)]">{year}</span>
                        <button
                            onClick={() => setYear(y => y + 1)}
                            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => { setShowReportModal(true); setReportStep(1); }}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary-color)] text-black rounded-xl transition-colors text-sm font-bold uppercase tracking-wider shadow-lg shadow-blue-500/30 hover:brightness-110"
                        >
                            <span className="material-symbols-outlined">summarize</span>
                            Generar informes
                        </button>
                        <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl">
                            <span className="material-symbols-outlined text-[var(--primary-color)]">calendar_month</span>
                            <select
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                                className="bg-transparent outline-none text-sm border-0"
                            >
                                {esMonths.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => setShowAllMonths(s => !s)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-sm font-bold uppercase tracking-wider"
                        >
                            <span className="material-symbols-outlined">{showAllMonths ? 'table_chart' : 'view_column'}</span>
                            {showAllMonths ? 'Ver mes actual' : 'Ver todos los meses'}
                        </button>
                        <button
                            onClick={fetchBilling}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-sm font-bold uppercase tracking-wider"
                        >
                            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span>
                            Actualizar
                        </button>
                    </div>
                </div>

                {/* Data Grid */}
                <div className="flex-1 overflow-auto bg-[var(--card-color)] rounded-3xl border border-[var(--border-color)] relative">
                    {loading && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--primary-color)] border-t-transparent"></div>
                        </div>
                    )}

                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="sticky top-0 left-0 z-20 bg-[var(--card-color)] p-4 text-left font-bold text-[var(--text-secondary-color)] uppercase tracking-wider text-xs border-b border-[var(--border-color)] min-w-[200px]">
                                    Punto de Venta
                                </th>
                                {showAllMonths ? (
                                    sortedColumns.map(col => (
                                        <th key={col} className="sticky top-0 bg-[var(--card-color)] p-4 text-right font-bold text-[var(--text-secondary-color)] uppercase tracking-wider text-xs border-b border-[var(--border-color)] min-w-[140px]">
                                            {monthLabelEs(col)}
                                        </th>
                                    ))
                                ) : (
                                    <th className="sticky top-0 bg-[var(--card-color)] p-4 text-right font-bold text-[var(--text-secondary-color)] uppercase tracking-wider text-xs border-b border-[var(--border-color)] min-w-[140px]">
                                        {monthLabelEs(selectedMonth)}
                                    </th>
                                )}
                                <th className="sticky top-0 right-0 z-20 bg-[var(--card-color)] p-4 text-right font-bold text-[var(--primary-color)] uppercase tracking-wider text-xs border-b border-[var(--border-color)] min-w-[150px]">
                                    Total Año
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                            {Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])).map(([pos, posData]) => {
                                const rowTotal = getRowTotal(posData);
                                return (
                                    <tr key={pos} className="hover:bg-white/5 transition-colors group">
                                        <td className="sticky left-0 bg-[var(--card-color)] group-hover:bg-[#1a1f2e] p-4 text-sm font-medium text-white border-r border-[var(--border-color)] truncate">
                                            {pos}
                                        </td>
                                        {showAllMonths ? (
                                            sortedColumns.map(col => (
                                                <td key={col} className="p-4 text-right text-sm font-mono text-[var(--text-secondary-color)]">
                                                    {posData[col] ? formatCLP(posData[col]) : '-'}
                                                </td>
                                            ))
                                        ) : (
                                            <td className="p-4 text-right text-sm font-mono text-white">
                                                {getMonthValue(posData, selectedMonth) ? formatCLP(getMonthValue(posData, selectedMonth)) : '-'}
                                            </td>
                                        )}
                                        <td className="sticky right-0 bg-[var(--card-color)] group-hover:bg-[#1a1f2e] p-4 text-right text-sm font-bold font-mono text-[var(--success-color)] border-l border-[var(--border-color)]">
                                            {formatCLP(rowTotal)}
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* Grand Total Row */}
                            <tr className="bg-white/5 font-bold">
                                <td className="sticky left-0 bg-[var(--card-color)] p-4 text-sm text-[var(--primary-color)] uppercase tracking-widest border-r border-[var(--border-color)]">
                                    Total Global
                                </td>
                                {showAllMonths ? (
                                    sortedColumns.map(col => {
                                        const colTotal = Object.values(data).reduce((sum, posData) => sum + (posData[col] || 0), 0);
                                        return (
                                            <td key={col} className="p-4 text-right text-sm font-mono text-white">
                                                {colTotal > 0 ? formatCLP(colTotal) : '-'}
                                            </td>
                                        );
                                    })
                                ) : (
                                    <td className="p-4 text-right text-sm font-mono text-white">
                                        {grandTotalSelectedMonth > 0 ? formatCLP(grandTotalSelectedMonth) : '-'}
                                    </td>
                                )}
                                <td className="sticky right-0 bg-[var(--card-color)] p-4 text-right text-base font-mono text-[var(--primary-color)] border-l border-[var(--border-color)]">
                                    {formatCLP(grandTotal)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Report Modal */}
                {showReportModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.3em] text-[var(--text-secondary-color)]">Informes mensuales</div>
                                    <h3 className="text-xl font-bold">Generar informes - {monthLabelEs(selectedMonth)} {year}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-lg text-xs">
                                        <span className="material-symbols-outlined text-[var(--primary-color)]">flag</span>
                                        Paso {reportStep} de 2
                                    </div>
                                    <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-4 space-y-4">
                                <div className="flex gap-2 text-xs uppercase tracking-[0.2em] font-bold">
                                    <span className={`px-3 py-1 rounded-full ${reportStep === 1 ? 'bg-[var(--primary-color)] text-black' : 'bg-white/10 text-[var(--text-secondary-color)]'}`}>1. Gastos</span>
                                    <span className={`px-3 py-1 rounded-full ${reportStep === 2 ? 'bg-[var(--primary-color)] text-black' : 'bg-white/10 text-[var(--text-secondary-color)]'}`}>2. Facturación y utilidad</span>
                                </div>

                                {reportStep === 1 && (
                                    <div className="space-y-3">
                                        <div className="text-sm text-[var(--text-secondary-color)]">Captura los gastos fijos por local en {monthLabelEs(selectedMonth)}. El margen se toma de Odoo automáticamente.</div>
                                        {reportLoading && <div className="text-xs text-[var(--text-secondary-color)]">Cargando datos guardados...</div>}
                                        <div className="overflow-auto rounded-2xl border border-[var(--border-color)]">
                                            <table className="min-w-full border-collapse">
                                                <thead className="bg-white/5 text-xs uppercase tracking-wider text-[var(--text-secondary-color)]">
                                                    <tr>
                                                        <th className="p-3 text-left">Local</th>
                                                        <th className="p-3 text-right">Gastos comunes (DB)</th>
                                                        <th className="p-3 text-right">Servicios (detallar)</th>
                                                        <th className="p-3 text-right">Nómina</th>
                                                        <th className="p-3 text-right">Arriendo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border-color)]">
                                                    {Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])).map(([pos]) => {
                                                        const bucket = getExpenseBucket(selectedMonth, pos);
                                                        const cfg = configByPos[pos] || {};
                                                        const servicioTotal =
                                                            (cfg.internet_aplica ? (cfg.internet || 0) : 0) +
                                                            (cfg.luz_aplica ? (cfg.luz || 0) : 0) +
                                                            (cfg.gas_aplica ? (cfg.gas || 0) : 0) +
                                                            (cfg.agua_aplica ? (cfg.agua || 0) : 0);
                                                        return (
                                                            <tr key={pos} className="hover:bg-white/5">
                                                                <td className="p-3 font-medium">{pos}</td>
                                                                <td className="p-3 text-right font-mono">
                                                                    <div className="flex items-center gap-2 justify-end">
                                                                        <span>{bucket.gastosComunes ? formatCLP(bucket.gastosComunes) : '-'}</span>
                                                                        <button
                                                                            onClick={() => { setCommonModalPos(pos); loadCommonGastos(pos); }}
                                                                            className="px-2 py-1 text-xs bg-white/10 hover:bg-white/15 rounded-lg"
                                                                        >Ver/Editar</button>
                                                                    </div>
                                                                </td>
                                                                <td className="p-2 text-right">
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                setServiceModalPos(pos);
                                                                                setServiceForm({
                                                                                    internet: cfg.internet || 0,
                                                                                    internet_aplica: !!cfg.internet_aplica,
                                                                                    luz: cfg.luz || 0,
                                                                                    luz_aplica: !!cfg.luz_aplica,
                                                                                    gas: cfg.gas || 0,
                                                                                    gas_aplica: !!cfg.gas_aplica,
                                                                                    agua: cfg.agua || 0,
                                                                                    agua_aplica: !!cfg.agua_aplica,
                                                                                });
                                                                            }}
                                                                            className="px-3 py-1 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-bold uppercase tracking-wide"
                                                                        >
                                                                            Configurar servicios
                                                                        </button>
                                                                        <div className="text-[10px] text-[var(--text-secondary-color)]">Total: {servicioTotal ? formatCLP(servicioTotal) : '-'}</div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-2 text-right">
                                                                    <input
                                                                        type="number"
                                                                        value={bucket.nomina}
                                                                        onChange={e => updateNomina(selectedMonth, pos, e.target.value)}
                                                                        className="w-28 text-right bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-2 py-1 font-mono text-sm"
                                                                        min="0"
                                                                    />
                                                                </td>
                                                                <td className="p-2 text-right">
                                                                    <input
                                                                        type="number"
                                                                        value={cfg.arriendo || 0}
                                                                        onChange={e => setConfigByPos(prev => ({ ...prev, [pos]: { ...cfg, arriendo: Number(e.target.value) || 0 } }))}
                                                                        className="w-28 text-right bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-2 py-1 font-mono text-sm"
                                                                        min="0"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {reportStep === 2 && (
                                    <div className="space-y-4">
                                        <div className="text-sm text-[var(--text-secondary-color)]">Resumen del mes seleccionado: venta, margen, gastos y utilidades por local.</div>
                                        <div className="overflow-auto rounded-2xl border border-[var(--border-color)]">
                                            <table className="min-w-full border-collapse">
                                                <thead className="bg-white/5 text-xs uppercase tracking-wider text-[var(--text-secondary-color)]">
                                                    <tr>
                                                        <th className="p-3 text-left">Local</th>
                                                        <th className="p-3 text-right">Venta mes</th>
                                                        <th className="p-3 text-right">Margen Odoo</th>
                                                        <th className="p-3 text-right">Total gastos</th>
                                                        <th className="p-3 text-right">Utilidad bruta</th>
                                                        <th className="p-3 text-right">Comisión 5%</th>
                                                        <th className="p-3 text-right">Utilidad neta</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border-color)]">
                                                    {Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])).map(([pos, posData]) => {
                                                        const venta = getMonthValue(posData, selectedMonth);
                                                        const cfg = configByPos[pos] || {};
                                                        const servicioTotal =
                                                            (cfg.internet_aplica ? (cfg.internet || 0) : 0) +
                                                            (cfg.luz_aplica ? (cfg.luz || 0) : 0) +
                                                            (cfg.gas_aplica ? (cfg.gas || 0) : 0) +
                                                            (cfg.agua_aplica ? (cfg.agua || 0) : 0);
                                                        const bucket = getExpenseBucket(selectedMonth, pos);
                                                        const margen = bucket.margen || 0;
                                                        const gastosTot = bucket.gastosComunes + servicioTotal + bucket.nomina + (cfg.arriendo || 0);
                                                        const utilidadBruta = margen - gastosTot;
                                                        const comision = Math.max(utilidadBruta * 0.05, 0);
                                                        const utilidadNeta = utilidadBruta - comision;
                                                        return (
                                                            <tr key={pos} className="hover:bg-white/5">
                                                                <td className="p-3 font-medium">{pos}</td>
                                                                <td className="p-3 text-right font-mono">{venta ? formatCLP(venta) : '-'}</td>
                                                                <td className="p-3 text-right font-mono text-blue-200">{margen ? formatCLP(margen) : '-'}</td>
                                                                <td className="p-3 text-right font-mono text-[var(--text-secondary-color)]">{gastosTot ? formatCLP(gastosTot) : '-'}</td>
                                                                <td className={`p-3 text-right font-mono ${utilidadBruta >= 0 ? 'text-[var(--success-color)]' : 'text-red-400'}`}>{utilidadBruta ? formatCLP(utilidadBruta) : '-'}</td>
                                                                <td className="p-3 text-right font-mono text-amber-300">{comision ? formatCLP(comision) : '-'}</td>
                                                                <td className={`p-3 text-right font-mono font-bold ${utilidadNeta >= 0 ? 'text-[var(--primary-color)]' : 'text-red-400'}`}>{utilidadNeta ? formatCLP(utilidadNeta) : '-'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-[var(--border-color)] flex justify-between">
                                <div className="text-xs text-[var(--text-secondary-color)]">Los datos se calculan solo con la sesión actual (no se guardan en backend).</div>
                                <div className="flex gap-2">
                                    {reportStep > 1 && (
                                        <button
                                            onClick={() => setReportStep(step => Math.max(1, step - 1))}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold"
                                        >
                                            Volver
                                        </button>
                                    )}
                                    {reportStep === 1 && (
                                        <button
                                            onClick={saveReportData}
                                            disabled={reportLoading}
                                            className="px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg font-bold hover:brightness-110 disabled:opacity-50"
                                        >
                                            {reportLoading ? 'Guardando...' : 'Confirmar gastos y continuar'}
                                        </button>
                                    )}
                                    {reportStep === 2 && (
                                        <button
                                            onClick={() => setShowReportModal(false)}
                                            className="px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg font-bold hover:brightness-110"
                                        >
                                            Listo
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Servicios Modal */}
                {serviceModalPos && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl">
                            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary-color)]">Servicios</div>
                                    <h3 className="text-lg font-bold">{serviceModalPos}</h3>
                                </div>
                                <button onClick={() => setServiceModalPos(null)} className="p-2 hover:bg-white/10 rounded-full">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-4 space-y-3">
                                {[
                                    { key: 'internet', label: 'Internet' },
                                    { key: 'luz', label: 'Luz' },
                                    { key: 'gas', label: 'Gas' },
                                    { key: 'agua', label: 'Agua' },
                                ].map(item => {
                                    const applyKey = `${item.key}_aplica`;
                                    return (
                                        <div key={item.key} className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold">{item.label}</div>
                                                <label className="text-[11px] text-[var(--text-secondary-color)] flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!serviceForm[applyKey]}
                                                        onChange={e => setServiceForm(prev => ({ ...prev, [applyKey]: e.target.checked }))}
                                                    />
                                                    Aplica
                                                </label>
                                            </div>
                                            <input
                                                type="number"
                                                value={serviceForm[item.key] || 0}
                                                onChange={e => setServiceForm(prev => ({ ...prev, [item.key]: Number(e.target.value) || 0 }))}
                                                className="w-28 text-right bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-2 py-1 font-mono text-sm"
                                                min="0"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="p-4 border-t border-[var(--border-color)] flex justify-end gap-2">
                                <button
                                    onClick={() => setServiceModalPos(null)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        setConfigByPos(prev => ({
                                            ...prev,
                                            [serviceModalPos]: {
                                                ...(prev[serviceModalPos] || {}),
                                                ...serviceForm,
                                            }
                                        }));
                                        setServiceModalPos(null);
                                    }}
                                    className="px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg font-bold hover:brightness-110"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Gastos comunes Modal */}
                {commonModalPos && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl w-full max-w-2xl shadow-2xl">
                            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary-color)]">Gastos comunes</div>
                                    <h3 className="text-lg font-bold">{commonModalPos} - {monthLabelEs(selectedMonth)} {year}</h3>
                                </div>
                                <button onClick={() => setCommonModalPos(null)} className="p-2 hover:bg-white/10 rounded-full">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-4 space-y-3 max-h-[60vh] overflow-auto">
                                {commonList.length === 0 && (
                                    <div className="text-sm text-[var(--text-secondary-color)]">No hay gastos registrados para este mes.</div>
                                )}
                                {commonList.map(item => (
                                    <div key={item.id} className="flex items-center justify-between gap-2 border border-[var(--border-color)] rounded-lg px-3 py-2">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={item.included !== false}
                                                onChange={e => setCommonList(prev => prev.map(it => it.id === item.id ? { ...it, included: e.target.checked } : it))}
                                            />
                                            <div>
                                                <div className="font-semibold">{item.motivo}</div>
                                                <div className="text-[11px] text-[var(--text-secondary-color)]">{item.fecha ? item.fecha.split('T')[0] : 'nuevo'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono">{formatCLP(item.monto)}</span>
                                            <button
                                                onClick={() => setCommonList(prev => prev.filter(it => it.id !== item.id))}
                                                className="p-1 text-red-400 hover:text-red-200"
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div className="border-t border-[var(--border-color)] pt-3">
                                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary-color)] mb-2">Agregar gasto manual</div>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            placeholder="Motivo"
                                            value={newCommon.motivo}
                                            onChange={e => setNewCommon(prev => ({ ...prev, motivo: e.target.value }))}
                                            className="flex-1 bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Monto"
                                            value={newCommon.monto}
                                            onChange={e => setNewCommon(prev => ({ ...prev, monto: e.target.value }))}
                                            className="w-32 bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-right"
                                        />
                                        <button
                                            onClick={() => {
                                                if (!newCommon.motivo || !newCommon.monto) return;
                                                (async () => {
                                                    try {
                                                        const res = await apiFetch('/api/billing/gastos', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                pos: commonModalPos,
                                                                year,
                                                                month: monthNumber(),
                                                                motivo: newCommon.motivo,
                                                                monto: Number(newCommon.monto) || 0
                                                            })
                                                        });
                                                        if (!res.ok) {
                                                            const err = await res.json();
                                                            throw new Error(err.error || 'No se pudo crear gasto');
                                                        }
                                                        const created = await res.json();
                                                        setCommonList(prev => [...prev, {
                                                            id: created.id || created.ID,
                                                            motivo: created.motivo || created.Motivo,
                                                            monto: created.monto || created.Monto,
                                                            fecha: created.fecha || created.Fecha,
                                                            included: true,
                                                            source: 'db'
                                                        }]);
                                                        setNewCommon({ motivo: '', monto: '' });
                                                    } catch (e) {
                                                        console.error(e);
                                                        notify({ type: 'error', message: e.message });
                                                    }
                                                })();
                                            }}
                                            className="px-3 py-2 bg-[var(--primary-color)] text-black rounded-lg font-bold"
                                        >
                                            Agregar
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t border-[var(--border-color)] flex justify-end gap-2">
                                <button
                                    onClick={() => setCommonModalPos(null)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm"
                                >
                                    Cancelar
                                </button>
                                        <button
                                    onClick={() => {
                                        applyCommonEdits(commonModalPos, commonList);
                                        setCommonModalPos(null);
                                    }}
                                    className="px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg font-bold hover:brightness-110"
                                >
                                    Usar en informe
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
