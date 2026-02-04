import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '../components/Layout';
import DesktopOnlyGuard from '../components/DesktopOnlyGuard';
import PayrollWizard from '../components/PayrollWizard';
import { apiFetch } from '../api';
import { formatCLP } from '../formatMoney';
import { getSessionUsername } from '../auth';
import { useNotifications } from '../components/Notifications';
import { generatePaymentSlip } from '../utils/pdfGenerator';

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function Payroll() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [matrix, setMatrix] = useState({ users: [], payments: [], stats: {} });
    const [loading, setLoading] = useState(false);

    // Config state (kept for "Settings" button)
    const [config, setConfig] = useState(null);
    const [showConfig, setShowConfig] = useState(false);
    const [showEmployees, setShowEmployees] = useState(false);

    // Wizard State
    const [selectedPeriod, setSelectedPeriod] = useState(null); // { month: 0-11, period: 1|2 }
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    const currentUser = getSessionUsername();

    const initialWizardDates = useMemo(() => {
        if (!selectedPeriod) return null;
        const m = selectedPeriod.month;
        const y = year;
        if (selectedPeriod.period === 1) {
            return {
                start: new Date(Date.UTC(y, m, 1)).toISOString().split('T')[0],
                end: new Date(Date.UTC(y, m, 15)).toISOString().split('T')[0]
            };
        } else {
            return {
                start: new Date(Date.UTC(y, m, 16)).toISOString().split('T')[0],
                end: new Date(Date.UTC(y, m + 1, 0)).toISOString().split('T')[0]
            };
        }
    }, [selectedPeriod, year]);
    const loadMatrix = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/nomina/matrix?year=${year}`);
            if (res.ok) {
                const data = await res.json();
                setMatrix(data);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [year]);

    useEffect(() => {
        loadMatrix();
        loadConfig();
    }, [loadMatrix]);

    const loadConfig = async () => {
        try {
            const res = await apiFetch('/api/nomina/config');
            if (res.ok) setConfig(await res.json());
        } catch (e) { console.error(e); }
    };

    // Helper: Get payment status for a specific period
    const getPeriodStatus = (monthIndex, periodNum) => { // periodNum: 1 or 2
        // Find payments for this window
        // Month Index is 0-11. Backend stores Dates.
        // Needs robust matching.
        // Let's filter payments locally since we have them all.
        const targetMonth = monthIndex + 1;

        const paymentsInPeriod = matrix.payments.filter(p => {
            const d = new Date(p.period_start);
            // Check Year
            if (d.getUTCFullYear() !== year) return false;
            // Check Month
            if ((d.getUTCMonth() + 1) !== targetMonth) return false;
            // Check Period (Day <= 15 is 1, >15 is 2)
            const day = d.getUTCDate();
            const pNum = day <= 15 ? 1 : 2;
            return pNum === periodNum;
        });

        const activeUsersCount = matrix.users.length;
        const paidCount = paymentsInPeriod.length;

        if (paidCount === 0) return 'empty';
        if (paidCount >= activeUsersCount) return 'complete'; // All paid
        return 'partial'; // Some missing
    };

    const handleOpenPeriod = (monthIndex, periodNum) => {
        setSelectedPeriod({ month: monthIndex, period: periodNum });
    };

    const handlePaymentSuccess = async (data) => {
        /* 
           Simulate API call here or assume Wizard does it? 
           Wait, Wizard calls onConfirm which usually calls API.
           Existing Wizard logic: "onConfirm={handlePayment}"
           Let's reuse the logic from previous Payroll.js
        */
        try {
            const payload = {
                ...data,
                created_by: currentUser || 'Sistema',
            };
            const res = await apiFetch('/api/nomina/pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const payment = await res.json();
                setIsWizardOpen(false);
                loadMatrix(); // Refresh grid
                return payment;
            }
        } catch (e) { console.error(e); }
    };

    const handleDeletePayment = async (paymentId) => {
        if (!window.confirm("¿Estás seguro de eliminar este pago? Esta acción no se puede deshacer.")) return;

        try {
            const res = await apiFetch(`/api/nomina/payments/${paymentId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                // notify({ type: 'success', message: 'Pago eliminado' });
                loadMatrix();
            }
        } catch (e) { console.error(e); }
    };

    return (
        <Layout title="Centro de Nómina">
            <DesktopOnlyGuard>
                <div className="flex flex-col h-[calc(100vh-100px)]">
                    {/* Header Controls */}
                    <div className="flex justify-between items-center mb-6 px-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setYear(year - 1)} className="p-2 hover:bg-white/10 rounded-full"><span className="material-symbols-outlined">chevron_left</span></button>
                            <h1 className="text-3xl font-bold font-mono">{year}</h1>
                            <button onClick={() => setYear(year + 1)} className="p-2 hover:bg-white/10 rounded-full"><span className="material-symbols-outlined">chevron_right</span></button>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary-color)]">
                                <span className="w-3 h-3 rounded-full bg-[var(--success-color)]"></span> Completo
                                <span className="w-3 h-3 rounded-full bg-yellow-500"></span> Parcial
                                <span className="w-3 h-3 rounded-full bg-[var(--card-color)] border border-[var(--border-color)]"></span> Pendiente
                            </div>

                            <button
                                onClick={() => setShowEmployees(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--card-color)] border border-[var(--border-color)] rounded-lg hover:border-[var(--primary-color)] transition-colors"
                            >
                                <span className="material-symbols-outlined">groups</span>
                                Empleados
                            </button>

                            <button
                                onClick={() => setShowConfig(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--card-color)] border border-[var(--border-color)] rounded-lg hover:border-[var(--primary-color)] transition-colors"
                            >
                                <span className="material-symbols-outlined">settings</span>
                                Configuración
                            </button>
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div className="flex-1 overflow-auto px-4 pb-8">
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl h-[200px] animate-pulse">
                                        <div className="h-10 border-b border-white/5 bg-white/5"></div>
                                        <div className="p-4 space-y-4">
                                            <div className="h-16 rounded bg-white/5"></div>
                                            <div className="h-16 rounded bg-white/5"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {MONTHS.map((monthName, idx) => (
                                    <div key={idx} className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl overflow-hidden flex flex-col shadow-lg">
                                        <div className="bg-[#111] p-3 text-center font-bold border-b border-[var(--border-color)] flex justify-between items-center">
                                            <span className="opacity-30 font-mono text-s">{String(idx + 1).padStart(2, '0')}</span>
                                            <span className="text-lg">{monthName}</span>
                                            <span className="opacity-30 text-xs">{year}</span>
                                        </div>
                                        <div className="p-4 grid grid-cols-1 gap-3 bg-[var(--background-color)] flex-1">
                                            {/* Quincena 1 */}
                                            <PeriodCard
                                                label="1ra Quincena"
                                                status={getPeriodStatus(idx, 1)}
                                                onClick={() => handleOpenPeriod(idx, 1)}
                                            />
                                            {/* Quincena 2 */}
                                            <PeriodCard
                                                label="2da Quincena"
                                                status={getPeriodStatus(idx, 2)}
                                                onClick={() => handleOpenPeriod(idx, 2)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Period Detail Modal/Overlay */}
                    {selectedPeriod && (
                        <PeriodDetailOverlay
                            year={year}
                            monthIndex={selectedPeriod.month}
                            periodNum={selectedPeriod.period}
                            matrix={matrix}
                            onClose={() => setSelectedPeriod(null)}
                            onPay={(employee) => {
                                setSelectedEmployee(employee);
                                setIsWizardOpen(true);
                            }}
                            onDelete={handleDeletePayment}
                            config={config}
                        />
                    )}

                    {/* Default Wizard Configuration */}
                    {isWizardOpen && selectedEmployee && (
                        <PayrollWizard
                            isOpen={isWizardOpen}
                            onClose={() => setIsWizardOpen(false)}
                            employee={selectedEmployee}
                            config={config}
                            onConfirm={handlePaymentSuccess}
                            // Pre-fill dates based on selected period
                            initialDates={initialWizardDates}
                        />
                    )}

                    {/* Config Modal */}
                    {showConfig && config && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl p-6 max-w-lg w-full">
                                <h3 className="text-xl font-bold mb-4">Configuración Global</h3>
                                <ConfigForm config={config} onClose={() => setShowConfig(false)} onUpdate={() => { loadConfig(); }} />
                            </div>
                        </div>
                    )}

                    {/* Employee Manager Modal */}
                    {showEmployees && (
                        <EmployeeManager onClose={() => setShowEmployees(false)} />
                    )}

                </div>
            </DesktopOnlyGuard>
        </Layout>
    );
}

function PeriodCard({ label, status, onClick }) {
    let borderColor = "border-[var(--border-color)]";
    let bgColor = "bg-[var(--card-color)]";
    let icon = "pending";
    let iconColor = "text-[var(--text-secondary-color)]";
    let statusText = "Pendiente";

    if (status === 'complete') {
        borderColor = "border-[var(--success-color)]";
        bgColor = "bg-green-500/10";
        icon = "check_circle";
        iconColor = "text-[var(--success-color)]";
        statusText = "Completo";
    } else if (status === 'partial') {
        borderColor = "border-yellow-500";
        bgColor = "bg-yellow-500/10";
        icon = "timelapse";
        iconColor = "text-yellow-500";
        statusText = "Parcial";
    }

    return (
        <div
            onClick={onClick}
            className={`
                flex flex-col justify-between p-3 rounded-lg border ${borderColor} ${bgColor} 
                cursor-pointer hover:brightness-110 active:scale-95 transition-all
                h-full min-h-[80px]
            `}
        >
            <div className="flex justify-between items-start">
                <span className="text-sm font-medium opacity-80">{label}</span>
                <span className={`material-symbols-outlined ${iconColor} text-lg`}>{icon}</span>
            </div>
            <div className={`text-xs font-bold ${iconColor}`}>
                {statusText}
            </div>
        </div>
    );
}

function PeriodDetailOverlay({ year, monthIndex, periodNum, matrix, onClose, onPay, onDelete, config }) {
    const periodLabel = periodNum === 1 ? "1ra Quincena (1-15)" : "2da Quincena (16-End)";
    const [uploadPaymentId, setUploadPaymentId] = useState(null);

    // Calculate who is paid
    const targetMonth = monthIndex + 1;
    const periodPayments = matrix.payments.filter(p => {
        const d = new Date(p.period_start);
        if (d.getUTCFullYear() !== year) return false;
        if ((d.getUTCMonth() + 1) !== targetMonth) return false;
        const day = d.getUTCDate();
        const pNum = day <= 15 ? 1 : 2;
        return pNum === periodNum;
    });

    const paymentByUserId = {};
    periodPayments.forEach(p => paymentByUserId[p.user_id] = p);

    return (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-md bg-[var(--card-color)] h-full border-l border-[var(--border-color)] p-6 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold">{MONTHS[monthIndex]} {year}</h2>
                        <div className="text-[var(--primary-color)] font-mono">{periodLabel}</div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                    {matrix.users.map(user => {
                        const payment = paymentByUserId[user.id];
                        const isPaid = !!payment;

                        return (
                            <div key={user.id} className={`p-4 rounded-xl border ${isPaid ? 'border-green-500/30 bg-green-500/5' : 'border-[var(--border-color)] bg-[var(--background-color)]'} flex flex-col gap-3 group transition-all`}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-bold flex items-center gap-2">
                                            {user.name || user.username}
                                            {isPaid && <span className="material-symbols-outlined text-[var(--success-color)] text-sm">verified</span>}
                                        </div>
                                        <div className="text-xs text-[var(--text-secondary-color)]">{user.role}</div>
                                    </div>

                                    <div>
                                        {isPaid ? (
                                            <div className="flex items-center gap-2">
                                                <div className="text-right mr-2">
                                                    <div className="font-bold text-[var(--success-color)]">{formatCLP(payment.total_paid)}</div>
                                                    <div className="text-[10px] text-green-400/70">Pagado</div>
                                                </div>
                                                <button
                                                    onClick={() => onDelete(payment.id)}
                                                    className="p-1.5 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                                    title="Eliminar Pago"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => onPay(user)}
                                                className="px-4 py-1.5 bg-[var(--primary-color)] text-white text-sm rounded-lg hover:bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                                            >
                                                Pagar
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Actions for Paid Items */}
                                {isPaid && (
                                    <div className="pt-3 border-t border-white/5 flex gap-2">
                                        <button
                                            onClick={() => generatePaymentSlip(payment, user, config)}
                                            className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-sm">download</span>
                                            PDF
                                        </button>

                                        {payment.is_signed ? (
                                            <a
                                                href={`${window.location.protocol}//${window.location.hostname}:8080${payment.signed_file}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-green-500/20 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-sm">inventory</span>
                                                Firmado
                                            </a>
                                        ) : (
                                            <button
                                                onClick={() => setUploadPaymentId(payment.id)}
                                                className="flex-1 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-500/20 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-sm">upload_file</span>
                                                Subir Firma
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="pt-6 border-t border-[var(--border-color)] mt-4">
                    <div className="flex justify-between text-sm text-[var(--text-secondary-color)]">
                        <span>Total Pagado</span>
                        <span className="text-white font-mono font-bold">
                            {formatCLP(periodPayments.reduce((acc, p) => acc + p.total_paid, 0))}
                        </span>
                    </div>
                </div>
            </div>

            {/* Upload Modal */}
            {uploadPaymentId && (
                <UploadContractModal
                    paymentId={uploadPaymentId}
                    onClose={() => setUploadPaymentId(null)}
                    onUploadSuccess={() => {
                        // We need to refresh the matrix to show the new signed status
                        // Since we don't have direct access to refreshMatrix here easily without prop drilling loadMatrix
                        // A simple reload of the page or just closing modal might leave old state.
                        // Ideally pass a triggerRefresh callback.
                        setUploadPaymentId(null);
                        // Hacky: Force window reload or use callback if provided.
                        // Let's rely on parent to pass refresh or we assume user re-opens.
                        // Better: We should pass onRefresh to this component.
                        if (onClose) onClose(); // Close overlay to force refresh next open? No.
                        // Let's assume onPay triggers refresh. We can reuse a callback.
                        window.location.reload(); // Simplest for now to ensure state sync
                    }}
                />
            )}
        </div>
    );
}

function ConfigForm({ config, onClose, onUpdate }) {
    const [formData, setFormData] = useState({ ...config });
    const [loading, setLoading] = useState(false);
    const [editingField, setEditingField] = useState(null); // 'auxilio', 'dominical', etc.
    const [tempValue, setTempValue] = useState('');

    const handleSaveField = async (field) => {
        setLoading(true);
        try {
            const val = ['company_name', 'nit'].includes(field) ? tempValue : Number(tempValue);
            const newConfig = { ...formData, [field]: val };
            const res = await apiFetch('/api/nomina/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });
            if (res.ok) {
                setFormData(newConfig);
                setEditingField(null);
                if (onUpdate) onUpdate(); // Refresh the list without closing if needed
            }
        } catch (e) { console.error('Error updating config', e); }
        finally { setLoading(false); }
    };

    const renderField = (label, field, icon, isCurrency = true) => {
        const isEditing = editingField === field;
        const value = formData[field];
        const isText = ['company_name', 'nit'].includes(field);

        return (
            <div className={`p-4 rounded-2xl border transition-all flex justify-between items-center group ${isEditing ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                <div className="flex flex-col flex-1">
                    <label className="text-[10px] uppercase font-bold text-[var(--text-secondary-color)] tracking-widest mb-1">{label}</label>
                    {isEditing ? (
                        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200 max-w-full">
                            <input
                                type={isText ? "text" : "number"}
                                step={isCurrency ? "1" : "0.1"}
                                value={tempValue}
                                onChange={e => setTempValue(e.target.value)}
                                className={`bg-[var(--dark-color)] border border-[var(--primary-color)] font-mono text-base px-2 py-1 rounded-lg outline-none shadow-lg ${isText ? 'w-full max-w-[200px]' : (isCurrency ? 'w-24' : 'w-16')}`}
                                autoFocus
                            />
                            {!isCurrency && !isText && <span className="text-xs font-bold">%</span>}
                            <button onClick={() => handleSaveField(field)} disabled={loading} className="bg-[var(--success-color)] text-black p-1 rounded-lg hover:brightness-110 active:scale-95 transition-all">
                                <span className="material-symbols-outlined text-xs font-bold">check</span>
                            </button>
                            <button onClick={() => setEditingField(null)} className="bg-white/10 text-white p-1 rounded-lg hover:bg-white/20 active:scale-95 transition-all">
                                <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                        </div>
                    ) : (
                        <div
                            className="flex items-center gap-2 cursor-pointer group/val"
                            onClick={() => { setEditingField(field); setTempValue(value || ''); }}
                        >
                            <span className={`font-mono text-xl font-bold tracking-tight ${isCurrency ? 'text-white' : (isText ? 'text-white uppercase' : 'text-blue-400')}`}>
                                {isText ? (value || 'SIN DEFINIR') : (isCurrency ? formatCLP(value) : `${value}%`)}
                            </span>
                            <span className="material-symbols-outlined text-sm text-[var(--primary-color)] opacity-0 group-hover/val:opacity-100 transition-opacity">edit</span>
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-xl transition-all ${isEditing ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-[var(--text-secondary-color)] opacity-50'}`}>
                    <span className="material-symbols-outlined text-xl">{icon}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {renderField('Nombre Empresa', 'company_name', 'business', false)}
            {renderField('NIT Empresa', 'nit', 'badge', false)}
            <div className="h-px bg-white/5 my-4" />
            {renderField('Auxilio Transporte', 'auxilio_transporte', 'local_shipping')}
            {renderField('Dominical Semestre 1 (Ene-Jun)', 'valor_dominical_s1', 'calendar_today')}
            {renderField('Dominical Semestre 2 (Jul-Dic)', 'valor_dominical_s2', 'calendar_today')}
            {renderField('Valor Hora Madrugón', 'valor_madrugon', 'wb_sunny')}
            {renderField('Porcentaje Salud', 'porcentaje_salud', 'ecg_heart', false)}
            {renderField('Porcentaje Pensión', 'porcentaje_pension', 'savings', false)}

            <button
                onClick={onClose}
                className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all"
            >
                Cerrar Configuración
            </button>
        </div>
    );
}

function EmployeeManager({ onClose }) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState({ id: null, field: null });
    const [editState, setEditState] = useState({ id: null, field: null, value: '' });

    const { notify } = useNotifications();

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/nomina/employees');
            if (res.ok) setEmployees(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const startEdit = (emp, field, value) => {
        setEditState({ id: emp.id, field, value });
    };

    const handleSave = async (empId, field) => {
        const { value } = editState;
        setSavingId({ id: empId, field });
        setEditState({ id: null, field: null, value: '' }); // Close input immediately

        try {
            // Optimistic update
            const oldEmployees = [...employees];
            setEmployees(prev => prev.map(e => {
                if (e.id === empId) {
                    if (field === 'base_salary') return { ...e, payroll: { ...e.payroll, base_salary: Number(value) } };
                    if (field === 'full_name') return { ...e, full_name: value };
                    if (field === 'cedula') return { ...e, cedula: value };
                }
                return e;
            }));

            const payload = {};
            if (field === 'base_salary') payload.base_salary = Number(value);
            if (field === 'full_name') payload.full_name = value;
            if (field === 'cedula') payload.cedula = value;

            const res = await apiFetch(`/api/nomina/employees/${empId}/salary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                // Revert on error
                setEmployees(oldEmployees);
                notify({ type: 'error', message: 'Error al actualizar' });
            }
        } catch (e) {
            console.error(e);
            notify({ type: 'error', message: 'Error de conexión' });
        } finally {
            setSavingId({ id: null, field: null });
        }
    };

    const EditableCell = ({ emp, field, value, type = "text", displayValue }) => {
        const isEditing = editState.id === emp.id && editState.field === field;
        const isSaving = savingId.id === emp.id && savingId.field === field;

        if (isEditing) {
            return (
                <input
                    type={type}
                    className="bg-[var(--dark-color)] border border-[var(--primary-color)] rounded p-1 w-full font-mono text-sm outline-none animate-in fade-in"
                    value={editState.value}
                    onChange={e => setEditState({ ...editState, value: e.target.value })}
                    onBlur={() => handleSave(emp.id, field)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleSave(emp.id, field);
                        if (e.key === 'Escape') setEditState({ id: null, field: null, value: '' });
                    }}
                    autoFocus
                />
            );
        }

        return (
            <div
                onClick={() => startEdit(emp, field, value)}
                className={`
                    cursor-pointer hover:bg-white/10 p-2 -m-2 rounded transition-colors flex items-center gap-2 group/cell
                    ${isSaving ? 'animate-pulse text-[var(--success-color)]' : ''}
                `}
            >
                <span className={`truncate ${!value && 'text-[var(--text-secondary-color)] italic'}`}>
                    {displayValue || value || 'Sin asignar'}
                </span>
                {!isSaving && <span className="material-symbols-outlined text-[10px] opacity-0 group-hover/cell:opacity-50">edit</span>}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl">
                <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[#111]">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined">groups</span>
                            Empleados
                        </h2>
                        <p className="text-xs text-[var(--text-secondary-color)] mt-1">
                            Click en cualquier campo para editar. Se guarda automáticamente al salir.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-0">
                    {loading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-white/5 rounded animate-pulse"></div>)}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-[var(--card-color)] z-10 shadow-sm">
                                <tr className="text-[var(--text-secondary-color)] text-xs uppercase tracking-wider border-b border-[var(--border-color)]">
                                    <th className="p-4 font-bold">Usuario</th>
                                    <th className="p-4 font-bold">Nombre Legal</th>
                                    <th className="p-4 font-bold">Cédula</th>
                                    <th className="p-4 font-bold text-right">Salario Base</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map(emp => (
                                    <tr key={emp.id} className="border-b border-[var(--border-color)] hover:bg-white/5 transition-colors group">
                                        <td className="p-4 font-bold text-white/70">
                                            {emp.name || emp.username}
                                            <div className="text-[10px] text-[var(--text-secondary-color)] font-normal">{emp.role}</div>
                                        </td>
                                        <td className="p-4">
                                            <EditableCell emp={emp} field="full_name" value={emp.full_name} />
                                        </td>
                                        <td className="p-4 font-mono text-sm">
                                            <EditableCell emp={emp} field="cedula" value={emp.cedula} />
                                        </td>
                                        <td className="p-4 text-right font-mono">
                                            <EditableCell
                                                emp={emp}
                                                field="base_salary"
                                                value={emp.payroll?.base_salary || 0}
                                                type="number"
                                                displayValue={formatCLP(emp.payroll?.base_salary || 0)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

function UploadContractModal({ paymentId, onClose, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const { notify } = useNotifications();

    const handleFileChange = (e) => {
        if (e.target.files[0]) setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await apiFetch(`/api/nomina/payments/${paymentId}/sign`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                notify({ type: 'success', message: 'Contrato firmado subido correctamente' });
                onUploadSuccess();
                onClose();
            } else {
                notify({ type: 'error', message: 'Error al subir contrato' });
            }
        } catch (e) {
            console.error(e);
            notify({ type: 'error', message: 'Error de conexión' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Subir Contrato Firmado</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:bg-white/5 transition-colors cursor-pointer relative">
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                            <span className="material-symbols-outlined text-3xl text-[var(--primary-color)]">upload_file</span>
                            <span className="text-sm font-medium">{file ? file.name : 'Click para seleccionar PDF'}</span>
                            {!file && <span className="text-xs text-[var(--text-secondary-color)]">Máximo 5MB</span>}
                        </div>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={!file || loading}
                        className="w-full py-2 bg-[var(--primary-color)] text-white rounded-lg font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? 'Subiendo...' : 'Subir y Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
