import { useState, useEffect, useCallback } from 'react';
import { Warehouse } from '@/mocks/settings';
import { db, onCacheChange } from '@/store/db';

export default function WarehouseSettings() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => db.getWarehouses());
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const syncFromCache = useCallback(() => {
    setWarehouses(db.getWarehouses());
  }, []);

  useEffect(() => {
    const unsub = onCacheChange(syncFromCache);
    return unsub;
  }, [syncFromCache]);

  const openAdd = () => {
    setEditingWarehouse(null);
    setForm({ name: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditingWarehouse(w);
    setForm({ name: w.name, description: w.description });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editingWarehouse) {
      const updated = { ...editingWarehouse, ...form };
      await db.upsertWarehouse(updated);
      setWarehouses(warehouses.map(w => w.id === editingWarehouse.id ? updated : w));
    } else {
      const newW: Warehouse = { id: `w${Date.now()}`, name: form.name, description: form.description, active: true };
      await db.upsertWarehouse(newW);
      setWarehouses([...warehouses, newW]);
    }
    setSaving(false);
    setShowModal(false);
  };

  const toggleActive = async (id: string) => {
    const updated = warehouses.map(w => w.id === id ? { ...w, active: !w.active } : w);
    const target = updated.find(w => w.id === id);
    if (target) await db.upsertWarehouse(target);
    setWarehouses(updated);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-gray-900 font-semibold text-base mb-1">Armazéns</h3>
          <p className="text-gray-500 text-sm">Gerir locais de armazenamento de stock</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap">
          <i className="ri-add-line"></i> Novo Armazém
        </button>
      </div>

      <div className="space-y-3">
        {warehouses.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <div className="w-10 h-10 flex items-center justify-center mx-auto mb-2">
              <i className="ri-archive-2-line text-3xl"></i>
            </div>
            <p className="text-sm">Nenhum armazém criado ainda.</p>
          </div>
        )}
        {warehouses.map(w => (
          <div key={w.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${w.active ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${w.active ? 'bg-amber-50' : 'bg-gray-100'}`}>
                <i className={`ri-store-2-line text-base ${w.active ? 'text-amber-600' : 'text-gray-400'}`}></i>
              </div>
              <div>
                <p className="text-gray-800 text-sm font-semibold">{w.name}</p>
                <p className="text-gray-400 text-xs">{w.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${w.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {w.active ? 'Ativo' : 'Inativo'}
              </span>
              <button onClick={() => openEdit(w)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-all">
                <i className="ri-pencil-line text-sm"></i>
              </button>
              <button onClick={() => toggleActive(w.id)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all ${w.active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                <i className={w.active ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'}></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold">{editingWarehouse ? 'Editar Armazém' : 'Novo Armazém'}</h3>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                  placeholder="Ex: Armazém Principal, Balcão..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Descrição</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                  placeholder="Descrição do armazém..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name.trim() || saving}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40">
                {saving ? <><i className="ri-loader-4-line animate-spin mr-1"></i>A guardar...</> : editingWarehouse ? 'Guardar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
