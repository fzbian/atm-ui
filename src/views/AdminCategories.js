import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../categoriesApi';
import { isAdmin } from '../auth';

export default function AdminCategories() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('INGRESO');
  const [saving, setSaving] = useState(false);

  const canDelete = isAdmin();

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listCategories();
      setItems(data);
    } catch (e) {
      setError(e.message || 'Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const openCreate = () => {
    setEditing(null);
    setNombre('');
    setTipo('INGRESO');
    setModalOpen(true);
  };
  const openEdit = (it) => {
    setEditing(it);
    setNombre(it.nombre || '');
    setTipo(it.tipo || 'INGRESO');
    setModalOpen(true);
  };
  const onDelete = async (it) => {
    if (!canDelete) return;
    if (!window.confirm(`¿Eliminar categoría "${it.nombre}"?`)) return;
    try {
      await deleteCategory(it.id);
      reload();
    } catch (e) {
      window.alert(e.message || 'Error al eliminar');
    }
  };
  const onSave = async () => {
    const nombreClean = (nombre || '').trim();
    if (!nombreClean || !tipo) return window.alert('Nombre y tipo requeridos');
    if (tipo !== 'INGRESO' && tipo !== 'EGRESO') return window.alert('Tipo inválido');
    setSaving(true);
    try {
      if (editing) {
        const patch = { nombre: nombreClean, tipo };
        const noChanges = (editing.nombre === patch.nombre) && (editing.tipo === patch.tipo);
        if (noChanges) {
          setModalOpen(false);
        } else {
          await updateCategory(editing.id, patch);
          setModalOpen(false);
        }
      } else {
        await createCategory({ nombre: nombreClean, tipo });
        setModalOpen(false);
      }
      reload();
    } catch (e) {
      window.alert(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background-color)] text-[var(--text-color)] flex flex-col">
      <Header title="Categorías" />
      <main className="flex-1 p-6 space-y-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] view-enter view-enter-active">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({length:5}).map((_,i)=>(
              <div key={i} className="h-12 rounded-lg bg-white/10" />
            ))}
          </div>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Gestión de categorías</h2>
              <button className="px-3 py-2 rounded-lg bg-[var(--primary-color)] text-white hover:opacity-90" onClick={openCreate}>
                <span className="material-symbols-outlined align-middle mr-1">add_circle</span>Nueva
              </button>
            </div>
            <ul className="bg-[var(--card-color)] rounded-lg border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
              {items.map(it => (
                <li key={it.id} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{it.nombre}</p>
                    <p className={`text-xs ${it.tipo==='INGRESO'?'text-[var(--success-color)]':'text-[var(--danger-color)]'}`}>{it.tipo}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 rounded-lg border border-[var(--border-color)] hover:bg-white/5" onClick={()=>openEdit(it)}>
                      <span className="material-symbols-outlined !text-base">edit</span>
                    </button>
                    <button className="px-2 py-1 rounded-lg border border-[var(--danger-color)] text-[var(--danger-color)] hover:bg-red-900/10" onClick={()=>onDelete(it)} disabled={!canDelete}>
                      <span className="material-symbols-outlined !text-base">delete</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <BottomNav
        onHome={() => navigate('/dashboard')}
        onMovements={() => navigate('/movements')}
        onWallet={() => navigate('/wallet')}
        onReports={() => navigate('/reports')}
        onAddIncome={() => navigate('/new?tipo=INGRESO')}
        onAddExpense={() => navigate('/new?tipo=EGRESO')}
        active={null}
      />

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={()=>setModalOpen(false)}>
          <div className="w-full max-w-md bg-[var(--card-color)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-5" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold mb-3 flex items-center gap-2"><span className="material-symbols-outlined">{editing?'edit':'add_circle'}</span>{editing?'Editar categoría':'Nueva categoría'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Nombre</label>
                <input className="w-full bg-[var(--dark-color)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm" value={nombre} onChange={(e)=>setNombre(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary-color)] mb-1">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {['INGRESO','EGRESO'].map(t => (
                    <button key={t} type="button" className={`flex items-center justify-center gap-2 p-2 rounded-lg border ${tipo===t? (t==='EGRESO'? 'border-[var(--danger-color)] bg-red-900/20 text-[var(--danger-color)]' : 'border-[var(--success-color)] bg-green-900/20 text-[var(--success-color)]') : 'border-[var(--border-color)] text-[var(--text-secondary-color)] hover:bg-white/5'}`} onClick={()=>setTipo(t)}>
                      <span className="material-symbols-outlined">{t==='EGRESO'?'arrow_downward':'arrow_upward'}</span>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary-color)] hover:bg-white/5" onClick={()=>setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className="flex-1 py-2 rounded-lg bg-[var(--primary-color)] text-white hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2" onClick={onSave} disabled={saving}>
                {saving && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
