import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/feature/TopBar';
import { db, Client, Debt } from '@/store/db';
import { onCacheChange } from '@/store/db';
import { useAuth } from '@/store/AuthContext';
import ConfirmDeleteModal from '@/components/base/ConfirmDeleteModal';

const payMethodLabels: Record<string, string> = {
  cash: 'Dinheiro', card: 'Cartão', mobile: 'Mobile Money', transfer: 'Transferência',
};

export default function ClientsPage() {
  const { isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');

  const syncFromCache = useCallback(() => {
    setClients(db.getClients());
    setDebts(db.getDebts());
  }, []);

  useEffect(() => {
    syncFromCache();
    const unsub = onCacheChange(syncFromCache);
    return unsub;
  }, [syncFromCache]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const openAdd = () => {
    setEditingClient(null);
    setForm({ name: '', phone: '', email: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setForm({ name: c.name, phone: c.phone, email: c.email || '', notes: c.notes || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    if (editingClient) {
      const updated: Client = { ...editingClient, ...form };
      setClients(prev => prev.map(c => c.id === editingClient.id ? updated : c));
      await db.upsertClient(updated);
    } else {
      const newClient: Client = {
        id: `c${Date.now()}`, ...form, createdAt: new Date().toISOString(),
      };
      setClients(prev => [newClient, ...prev]);
      await db.upsertClient(newClient);
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setClients(prev => prev.filter(c => c.id !== deleteTarget.id));
    await db.deleteClient(deleteTarget.id);
    setDeleteTarget(null);
    if (selectedClient?.id === deleteTarget.id) {
      setSelectedClient(null);
      setActiveTab('list');
    }
  };

  const openDetail = (c: Client) => {
    setSelectedClient(c);
    setActiveTab('detail');
  };

  const clientDebts = selectedClient ? debts.filter(d => d.clientId === selectedClient.id) : [];
  const totalOwed = clientDebts.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);
  const totalPaid = clientDebts.reduce((s, d) => s + d.paidAmount, 0);

  const debtStatusColors: Record<string, string> = {
    unpaid: 'bg-red-100 text-red-700',
    partial: 'bg-amber-100 text-amber-700',
    paid: 'bg-emerald-100 text-emerald-700',
  };
  const debtStatusLabels: Record<string, string> = {
    unpaid: 'Não Pago', partial: 'Parcial', paid: 'Pago',
  };

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Clientes"
        subtitle="Registo e histórico de clientes"
        actions={
          <button onClick={openAdd}
            className="flex items-center gap-1.5 text-white text-sm px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
            <i className="ri-user-add-line"></i> Novo Cliente
          </button>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Client List */}
        <div className={`${activeTab === 'detail' ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 border-r border-gray-100 bg-white`}>
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                <i className="ri-search-line text-gray-400 text-sm"></i>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar cliente..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cyan-400" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-300">
                <div className="w-12 h-12 flex items-center justify-center mx-auto mb-2">
                  <i className="ri-user-search-line text-4xl"></i>
                </div>
                <p className="text-sm">Nenhum cliente encontrado</p>
              </div>
            )}
            {filtered.map(c => {
              const cDebts = debts.filter(d => d.clientId === c.id);
              const owed = cDebts.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);
              return (
                <button key={c.id} onClick={() => openDetail(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-all cursor-pointer text-left ${selectedClient?.id === c.id ? 'bg-cyan-50 border-l-2 border-l-cyan-400' : ''}`}>
                  <div className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                    <span className="text-white text-sm font-bold">{c.name.slice(0, 1)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-gray-400 text-xs truncate">{c.phone}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {owed > 0 ? (
                      <span className="text-red-600 text-xs font-bold">MT {owed.toFixed(2)}</span>
                    ) : (
                      <span className="text-emerald-500 text-xs">
                        <i className="ri-check-line"></i>
                      </span>
                    )}
                    <p className="text-gray-300 text-xs">{cDebts.length} dívidas</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <p className="text-gray-400 text-xs text-center">{filtered.length} clientes registados</p>
          </div>
        </div>

        {/* Detail Panel */}
        {activeTab === 'detail' && selectedClient ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3">
              <button onClick={() => setActiveTab('list')} className="lg:hidden w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-arrow-left-line"></i>
              </button>
              <div className="w-12 h-12 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                <span className="text-white font-bold text-lg">{selectedClient.name.slice(0, 1)}</span>
              </div>
              <div className="flex-1">
                <h2 className="text-gray-900 font-bold text-lg">{selectedClient.name}</h2>
                <p className="text-gray-400 text-sm">{selectedClient.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(selectedClient)}
                  className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-all">
                  <i className="ri-pencil-line"></i>
                </button>
                {isAdmin && (
                  <button onClick={() => setDeleteTarget(selectedClient)}
                    className="w-9 h-9 flex items-center justify-center text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-all">
                    <i className="ri-delete-bin-line"></i>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">MT {totalOwed.toFixed(2)}</p>
                  <p className="text-gray-400 text-xs mt-1">Em dívida</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">MT {totalPaid.toFixed(2)}</p>
                  <p className="text-gray-400 text-xs mt-1">Total pago</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: '#1E9FD4' }}>{clientDebts.length}</p>
                  <p className="text-gray-400 text-xs mt-1">Registos</p>
                </div>
              </div>

              {/* Info */}
              {(selectedClient.email || selectedClient.notes) && (
                <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                  {selectedClient.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <i className="ri-mail-line text-gray-400"></i> {selectedClient.email}
                    </div>
                  )}
                  {selectedClient.notes && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <i className="ri-sticky-note-line text-gray-400 mt-0.5"></i>
                      <span>{selectedClient.notes}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Debts */}
              <div>
                <h3 className="text-gray-700 font-semibold text-sm mb-3">Histórico de Dívidas</h3>
                {clientDebts.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-300">
                    <div className="w-10 h-10 flex items-center justify-center mx-auto mb-2">
                      <i className="ri-checkbox-circle-line text-3xl text-emerald-300"></i>
                    </div>
                    <p className="text-sm text-gray-400">Sem dívidas registadas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clientDebts.map(d => (
                      <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-gray-700 text-sm font-semibold">{d.tableName || 'Sem mesa'}</p>
                            <p className="text-gray-400 text-xs">{new Date(d.createdAt).toLocaleDateString('pt-PT')} · {d.operator}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${debtStatusColors[d.status]}`}>
                            {debtStatusLabels[d.status]}
                          </span>
                        </div>
                        <div className="space-y-1 mb-3">
                          {d.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs text-gray-500">
                              <span>{item.quantity}x {item.productName}</span>
                              <span>MT {(item.quantity * item.price).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-gray-50 pt-2 flex justify-between items-center">
                          <div className="text-xs text-gray-500">
                            Pago: <span className="text-emerald-600 font-semibold">MT {d.paidAmount.toFixed(2)}</span>
                            {' · '}
                            Restante: <span className="text-red-600 font-semibold">MT {(d.totalAmount - d.paidAmount).toFixed(2)}</span>
                          </div>
                          <span className="text-gray-900 font-bold text-sm">MT {d.totalAmount.toFixed(2)}</span>
                        </div>
                        {d.notes && (
                          <p className="text-gray-400 text-xs mt-2 italic">&ldquo;{d.notes}&rdquo;</p>
                        )}
                        {d.payments.length > 0 && (
                          <div className="mt-3 border-t border-gray-50 pt-2">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Pagamentos:</p>
                            {d.payments.map(p => (
                              <div key={p.id} className="flex justify-between text-xs text-gray-400">
                                <span>{new Date(p.paidAt).toLocaleDateString('pt-PT')} · {payMethodLabels[p.method]}</span>
                                <span className="text-emerald-600 font-semibold">+MT {p.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center text-gray-200">
            <div className="text-center">
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <i className="ri-user-3-line text-5xl"></i>
              </div>
              <p className="text-gray-400 text-sm">Selecione um cliente para ver o detalhe</p>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400"
                  placeholder="Nome completo..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Contacto *</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400"
                  placeholder="+258 84 000 0000" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400"
                  placeholder="email@exemplo.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 resize-none"
                  rows={2} placeholder="Observações sobre o cliente..." maxLength={500} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name.trim() || !form.phone.trim()}
                className="flex-1 py-2.5 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                {editingClient ? 'Guardar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Eliminar cliente?"
          description={`Vai eliminar permanentemente o cliente "${deleteTarget.name}" e todo o seu histórico.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
