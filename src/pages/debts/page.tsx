import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/feature/TopBar';
import { db, Debt, DebtPayment, Client } from '@/store/db';
import { onCacheChange } from '@/store/db';
import { useAuth } from '@/store/AuthContext';
import ConfirmDeleteModal from '@/components/base/ConfirmDeleteModal';
import { exportDebts } from '@/utils/exportExcel';

const statusColors: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
};
const statusLabels: Record<string, string> = {
  unpaid: 'Não Pago', partial: 'Parcial', paid: 'Pago',
};
const payMethodLabels: Record<string, string> = {
  cash: 'Dinheiro', card: 'Cartão', mobile: 'Mobile Money', transfer: 'Transferência',
};

export default function DebtsPage() {
  const { currentUser, isAdmin } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [search, setSearch] = useState('');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash' as 'cash' | 'card' | 'mobile' | 'transfer', notes: '' });
  const [paySuccess, setPaySuccess] = useState(false);

  const syncFromCache = useCallback(() => {
    setDebts(db.getDebts());
    setClients(db.getClients());
  }, []);

  useEffect(() => {
    syncFromCache();
    const unsub = onCacheChange(syncFromCache);
    return unsub;
  }, [syncFromCache]);

  const filtered = debts.filter(d => {
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    const matchSearch = d.clientName.toLowerCase().includes(search.toLowerCase()) ||
      (d.tableName || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalUnpaid = debts.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);
  const totalPaid = debts.reduce((s, d) => s + d.paidAmount, 0);
  const unpaidCount = debts.filter(d => d.status === 'unpaid').length;
  const partialCount = debts.filter(d => d.status === 'partial').length;

  const handlePayment = async () => {
    if (!selectedDebt || !payForm.amount) return;
    const amount = parseFloat(payForm.amount);
    if (amount <= 0) return;
    const remaining = selectedDebt.totalAmount - selectedDebt.paidAmount;
    const actualPaid = Math.min(amount, remaining);
    const newPaid = selectedDebt.paidAmount + actualPaid;
    const newStatus: Debt['status'] = newPaid >= selectedDebt.totalAmount ? 'paid' : 'partial';
    const newPayment: DebtPayment = {
      id: `dp${Date.now()}`,
      amount: actualPaid,
      method: payForm.method,
      paidAt: new Date().toISOString(),
      operator: currentUser?.name || 'Sistema',
      notes: payForm.notes,
    };
    const updatedDebt: Debt = {
      ...selectedDebt,
      paidAmount: newPaid,
      status: newStatus,
      payments: [...selectedDebt.payments, newPayment],
      paidAt: newStatus === 'paid' ? new Date().toISOString() : selectedDebt.paidAt,
    };
    setDebts(prev => prev.map(d => d.id === selectedDebt.id ? updatedDebt : d));
    await db.upsertDebt(updatedDebt);
    setSelectedDebt(updatedDebt);
    setPaySuccess(true);
    setTimeout(() => {
      setShowPayModal(false);
      setPaySuccess(false);
      setPayForm({ amount: '', method: 'cash', notes: '' });
    }, 1500);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDebts(prev => prev.filter(d => d.id !== deleteTarget.id));
    await db.deleteDebt(deleteTarget.id);
    if (selectedDebt?.id === deleteTarget.id) setSelectedDebt(null);
    setDeleteTarget(null);
  };

  const reloadDebts = async () => {
    await db.reload();
    syncFromCache();
  };

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'Desconhecido';

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Gestão de Dívidas"
        subtitle={`${debts.filter(d => d.status !== 'paid').length} dívidas ativas · Total: MT ${totalUnpaid.toFixed(2)}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={reloadDebts}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-xs border border-gray-200 rounded-lg px-3 py-1.5 cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-all">
              <i className="ri-refresh-line"></i> Atualizar
            </button>
            <button onClick={() => exportDebts(filtered)}
              className="flex items-center gap-1.5 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
              <i className="ri-file-excel-2-line"></i> Exportar Excel
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-5 overflow-y-auto flex-1">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total em Dívida', value: `MT ${totalUnpaid.toFixed(2)}`, color: 'text-red-600', icon: 'ri-file-warning-line', bg: 'bg-red-50', iconColor: 'text-red-500' },
            { label: 'Total Recebido', value: `MT ${totalPaid.toFixed(2)}`, color: 'text-emerald-600', icon: 'ri-check-double-line', bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
            { label: 'Não Pagas', value: String(unpaidCount), color: 'text-red-500', icon: 'ri-close-circle-line', bg: 'bg-red-50', iconColor: 'text-red-400' },
            { label: 'Pagamento Parcial', value: String(partialCount), color: 'text-amber-500', icon: 'ri-time-line', bg: 'bg-amber-50', iconColor: 'text-amber-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 flex items-center justify-center ${s.bg} rounded-xl flex-shrink-0`}>
                <i className={`${s.icon} ${s.iconColor} text-lg`}></i>
              </div>
              <div>
                <p className="text-gray-400 text-xs">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Info banner: debts from tables */}
        {debts.some(d => d.tableId) && (
          <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-lg px-4 py-2.5">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-restaurant-line text-sky-500 text-sm"></i>
            </div>
            <p className="text-sky-700 text-xs">
              Algumas dívidas foram criadas automaticamente ao fechar contas nas Mesas com pagamento parcial.
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
              <i className="ri-search-line text-gray-400 text-sm"></i>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por cliente ou mesa..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cyan-400" />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['all', 'unpaid', 'partial', 'paid'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-all ${filterStatus === s ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {s === 'all' ? 'Todas' : statusLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-gray-900 font-semibold text-sm">Dívidas</h3>
            <span className="text-gray-400 text-xs">{filtered.length} registos</span>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-300">
              <div className="w-12 h-12 flex items-center justify-center mx-auto mb-2">
                <i className="ri-checkbox-circle-line text-4xl text-emerald-300"></i>
              </div>
              <p className="text-sm text-gray-400">Nenhuma dívida encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Cliente</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Mesa</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Data</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Vencimento</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Estado</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Total</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Pago</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Restante</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const remaining = d.totalAmount - d.paidAmount;
                    const isOverdue = d.dueDate && new Date(d.dueDate) < new Date() && d.status !== 'paid';
                    return (
                      <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-gray-800 text-sm font-semibold">{d.clientName}</p>
                          <p className="text-gray-400 text-xs">{d.operator}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{d.tableName || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleDateString('pt-PT')}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {d.dueDate ? (
                            <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                              {isOverdue && <i className="ri-alarm-warning-line mr-1"></i>}
                              {new Date(d.dueDate).toLocaleDateString('pt-PT')}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[d.status]}`}>
                            {statusLabels[d.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-bold text-sm">MT {d.totalAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-semibold text-sm">MT {d.paidAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-bold text-sm">MT {remaining.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setSelectedDebt(d)}
                              className="text-xs cursor-pointer border rounded-lg px-2 py-1 whitespace-nowrap transition-all hover:opacity-80"
                              style={{ borderColor: '#1E9FD4', color: '#1E9FD4' }}>
                              Detalhes
                            </button>
                            {d.status !== 'paid' && (
                              <button onClick={() => { setSelectedDebt(d); setShowPayModal(true); }}
                                className="text-xs text-white cursor-pointer rounded-lg px-2 py-1 whitespace-nowrap hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                                Receber
                              </button>
                            )}
                            {isAdmin && (
                              <button onClick={() => setDeleteTarget(d)}
                                className="w-7 h-7 flex items-center justify-center text-red-300 hover:text-red-600 cursor-pointer rounded-md hover:bg-red-50 transition-all">
                                <i className="ri-delete-bin-line text-sm"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedDebt && !showPayModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-gray-900 font-bold text-base">{selectedDebt.clientName}</h3>
                <p className="text-gray-400 text-xs">{selectedDebt.tableName || 'Sem mesa'} · {new Date(selectedDebt.createdAt).toLocaleDateString('pt-PT')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[selectedDebt.status]}`}>
                  {statusLabels[selectedDebt.status]}
                </span>
                <button onClick={() => setSelectedDebt(null)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                  <i className="ri-close-line"></i>
                </button>
              </div>
            </div>

            <div className="space-y-1 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Consumo</p>
              {selectedDebt.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm text-gray-600 py-1 border-b border-gray-50">
                  <span>{item.quantity}x {item.productName}</span>
                  <span className="font-medium">MT {(item.quantity * item.price).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-2">
                <span>Total</span>
                <span>MT {selectedDebt.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Total</p>
                <p className="font-bold text-gray-900">MT {selectedDebt.totalAmount.toFixed(2)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Pago</p>
                <p className="font-bold text-emerald-600">MT {selectedDebt.paidAmount.toFixed(2)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">Restante</p>
                <p className="font-bold text-red-600">MT {(selectedDebt.totalAmount - selectedDebt.paidAmount).toFixed(2)}</p>
              </div>
            </div>

            {selectedDebt.notes && (
              <div className="bg-amber-50 rounded-lg p-3 mb-4">
                <p className="text-amber-700 text-xs italic">&ldquo;{selectedDebt.notes}&rdquo;</p>
              </div>
            )}

            {selectedDebt.payments.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Histórico de Pagamentos</p>
                <div className="space-y-2">
                  {selectedDebt.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs text-gray-700 font-medium">{payMethodLabels[p.method]}</p>
                        <p className="text-xs text-gray-400">{new Date(p.paidAt).toLocaleDateString('pt-PT')} · {p.operator}</p>
                        {p.notes && <p className="text-xs text-gray-400 italic">{p.notes}</p>}
                      </div>
                      <span className="text-emerald-600 font-bold text-sm">+MT {p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setSelectedDebt(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Fechar</button>
              {selectedDebt.status !== 'paid' && (
                <button onClick={() => setShowPayModal(true)}
                  className="flex-1 py-2.5 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                  Registar Pagamento
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && selectedDebt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            {paySuccess ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 flex items-center justify-center bg-emerald-100 rounded-full mx-auto mb-3">
                  <i className="ri-check-line text-emerald-600 text-2xl"></i>
                </div>
                <p className="text-gray-900 font-semibold">Pagamento Registado!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-900 font-semibold">Registar Pagamento</h3>
                  <button onClick={() => setShowPayModal(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                    <i className="ri-close-line"></i>
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-sm font-semibold text-gray-700">{selectedDebt.clientName}</p>
                  <p className="text-xs text-gray-400">Restante: <span className="text-red-600 font-bold">MT {(selectedDebt.totalAmount - selectedDebt.paidAmount).toFixed(2)}</span></p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Valor a receber (MZN) *</label>
                    <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400"
                      placeholder="0.00" max={selectedDebt.totalAmount - selectedDebt.paidAmount} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Método de Pagamento</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['cash', 'card', 'mobile', 'transfer'] as const).map(m => (
                        <button key={m} onClick={() => setPayForm(f => ({ ...f, method: m }))}
                          className={`py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all ${payForm.method === m ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          style={payForm.method === m ? { background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' } : {}}>
                          {payMethodLabels[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Notas</label>
                    <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400"
                      placeholder="Observações..." />
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowPayModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Cancelar</button>
                  <button onClick={handlePayment} disabled={!payForm.amount || parseFloat(payForm.amount) <= 0}
                    className="flex-1 py-2.5 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                    Confirmar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Eliminar dívida?"
          description={`Vai eliminar permanentemente a dívida de "${deleteTarget.clientName}" (MT ${deleteTarget.totalAmount.toFixed(2)}).`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
