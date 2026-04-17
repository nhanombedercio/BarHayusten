import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/feature/TopBar';
import { Table, TableOrder, OrderItem } from '@/mocks/tables';
import { db, Debt, DebtPayment } from '@/store/db';
import { onCacheChange } from '@/store/db';
import ConfirmDeleteModal from '@/components/base/ConfirmDeleteModal';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuth } from '@/store/AuthContext';

type TabType = 'tables' | 'pending';

export default function TablesPage() {
  const { isAdmin } = useCurrentUser();
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<TabType>('tables');

  const [tableList, setTableList] = useState<Table[]>(() => db.getTables());
  const [pendingList, setPendingList] = useState<TableOrder[]>(() => db.getPendingOrders());
  const [productList, setProductList] = useState(() => db.getProducts());

  // Sync with cache changes (realtime)
  const syncFromCache = useCallback(() => {
    setTableList(db.getTables());
    setPendingList(db.getPendingOrders());
    setProductList(db.getProducts());
  }, []);

  useEffect(() => {
    const unsub = onCacheChange(syncFromCache);
    return unsub;
  }, [syncFromCache]);

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showPayPendingModal, setShowPayPendingModal] = useState<TableOrder | null>(null);
  const [showEditTableModal, setShowEditTableModal] = useState<Table | null>(null);
  const [newItems, setNewItems] = useState<OrderItem[]>([]);
  const [newItemPerson, setNewItemPerson] = useState('');
  const [closeForm, setCloseForm] = useState({
    orderId: '',
    paymentMethod: 'cash',
    amountPaid: '',
    isPending: false,
    pendingReason: '',
    clientName: '',
    dueDate: '',
  });
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [searchProduct, setSearchProduct] = useState('');
  const [editTableForm, setEditTableForm] = useState({ name: '', clientName: '', capacity: 2 });
  const [deleteTableTarget, setDeleteTableTarget] = useState<Table | null>(null);
  const [deletePendingTarget, setDeletePendingTarget] = useState<TableOrder | null>(null);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [addTableForm, setAddTableForm] = useState({ name: '', clientName: '', capacity: 4 });
  const [debtSuccessMsg, setDebtSuccessMsg] = useState('');

  // Keep selectedTable in sync with tableList
  useEffect(() => {
    if (selectedTable) {
      const updated = tableList.find(t => t.id === selectedTable.id);
      if (updated) setSelectedTable(updated);
    }
  }, [tableList]);

  const occupied = tableList.filter(t => t.status === 'occupied').length;
  const free = tableList.filter(t => t.status === 'free').length;
  const reserved = tableList.filter(t => t.status === 'reserved').length;
  const totalPendingDebt = pendingList.reduce((s, o) => s + (o.total - o.paid), 0);

  const statusColor = (s: Table['status']) =>
    s === 'occupied' ? 'bg-red-50 border-red-200' : s === 'reserved' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';
  const statusDot = (s: Table['status']) =>
    s === 'occupied' ? 'bg-red-500' : s === 'reserved' ? 'bg-amber-500' : 'bg-emerald-500';
  const statusLabel = (s: Table['status']) =>
    s === 'occupied' ? 'Ocupada' : s === 'reserved' ? 'Reservada' : 'Livre';

  const filteredProducts = productList.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()));

  const addItem = (productId: string) => {
    const p = productList.find(pr => pr.id === productId);
    if (!p) return;
    setNewItems(prev => {
      const ex = prev.find(i => i.productId === productId && i.personName === newItemPerson);
      if (ex) return prev.map(i => (i.productId === productId && i.personName === newItemPerson) ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, price: p.price, personName: newItemPerson || undefined }];
    });
  };

  const removeItem = (productId: string, personName?: string) => {
    setNewItems(prev =>
      prev.map(i => (i.productId === productId && i.personName === personName) ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0)
    );
  };

  const saveOrder = async () => {
    if (!selectedTable || newItems.length === 0) return;
    const newOrder: TableOrder = {
      id: `o${Date.now()}`, tableId: selectedTable.id,
      personName: newItemPerson || undefined,
      items: newItems,
      total: newItems.reduce((s, i) => s + i.price * i.quantity, 0),
      paid: 0, status: 'open', createdAt: new Date().toISOString(), waiter: currentUser?.name || 'Operador',
    };
    // Update table status to occupied
    const updatedTable: Omit<Table, 'orders'> = {
      ...selectedTable, status: 'occupied',
    };
    // Upsert order and table
    await db.upsertOrder(newOrder);
    await db.upsertTable(updatedTable);
    // Update local state
    const updatedTables = tableList.map(t => {
      if (t.id !== selectedTable.id) return t;
      return { ...t, status: 'occupied' as const, orders: [...t.orders, newOrder] };
    });
    setTableList(updatedTables);
    const updated = updatedTables.find(t => t.id === selectedTable.id);
    if (updated) setSelectedTable(updated);
    setNewItems([]);
    setNewItemPerson('');
    setShowOrderModal(false);
  };

  const openCloseModal = (orderId: string) => {
    const order = selectedTable?.orders.find(o => o.id === orderId);
    if (!order) return;
    setCloseForm({
      orderId,
      paymentMethod: 'cash',
      amountPaid: order.total.toFixed(2),
      isPending: false,
      pendingReason: '',
      clientName: order.personName || selectedTable?.clientName || '',
      dueDate: '',
    });
    setShowCloseModal(true);
  };

  const confirmClose = async () => {
    if (!selectedTable) return;
    const order = selectedTable.orders.find(o => o.id === closeForm.orderId);
    if (!order) return;
    const paid = parseFloat(closeForm.amountPaid) || 0;
    const remaining = order.total - paid;
    const operatorName = currentUser?.name || 'Operador';

    if (closeForm.isPending && !closeForm.pendingReason.trim()) return;

    if (closeForm.isPending) {
      const pendingOrder: TableOrder = {
        ...order, paid, status: 'pending',
        pendingReason: closeForm.pendingReason,
        pendingResponsible: operatorName,
        closedAt: new Date().toISOString(),
      };
      await db.upsertOrder(pendingOrder);
      setPendingList(prev => [pendingOrder, ...prev]);
    }

    if (remaining > 0) {
      const debtPayments: DebtPayment[] = [];
      if (paid > 0) {
        debtPayments.push({
          id: `dp${Date.now()}`,
          amount: paid,
          method: closeForm.paymentMethod as DebtPayment['method'],
          paidAt: new Date().toISOString(),
          operator: operatorName,
          notes: 'Pagamento parcial ao fechar conta',
        });
      }
      const isUnpaid = paid <= 0;
      const isPartial = paid > 0 && paid < order.total;
      const newDebt: Debt = {
        id: `d${Date.now()}`,
        clientId: '',
        clientName: closeForm.clientName || order.personName || 'Cliente',
        tableId: selectedTable.id,
        tableName: selectedTable.name,
        items: order.items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          price: i.price,
        })),
        totalAmount: order.total,
        paidAmount: paid,
        status: isUnpaid ? 'unpaid' : isPartial ? 'partial' : 'paid',
        createdAt: new Date().toISOString(),
        dueDate: closeForm.dueDate || undefined,
        notes: closeForm.pendingReason || (isPartial ? 'Pagamento parcial ao fechar conta na mesa' : ''),
        operator: operatorName,
        payments: debtPayments,
      };
      await db.upsertDebt(newDebt);
      setDebtSuccessMsg(`Dívida de MT ${remaining.toFixed(2)} registada para "${newDebt.clientName}"`);
      setTimeout(() => setDebtSuccessMsg(''), 4000);
    }

    // Remove order from table
    const remainingOrders = selectedTable.orders.filter(o => o.id !== closeForm.orderId);
    const newStatus = remainingOrders.length === 0 ? 'free' as const : selectedTable.status;
    const updatedTableData: Omit<Table, 'orders'> = { ...selectedTable, status: newStatus };
    await db.upsertTable(updatedTableData);
    // Delete the closed order from DB (it's not pending, it's closed)
    if (!closeForm.isPending) {
      await db.deleteOrder(order.id);
    }

    const updatedTables = tableList.map(t => {
      if (t.id !== selectedTable.id) return t;
      return { ...t, status: newStatus, orders: remainingOrders };
    });
    setTableList(updatedTables);
    setShowCloseModal(false);
    const updated = updatedTables.find(t => t.id === selectedTable.id);
    setSelectedTable(updated || null);
  };

  const payPending = async () => {
    if (!showPayPendingModal) return;
    const amount = parseFloat(payAmount) || 0;
    const order = showPayPendingModal;
    const newPaid = order.paid + amount;
    if (newPaid >= order.total) {
      await db.deleteOrder(order.id);
      setPendingList(prev => prev.filter(o => o.id !== order.id));
    } else {
      const updated = { ...order, paid: newPaid };
      await db.upsertOrder(updated);
      setPendingList(prev => prev.map(o => o.id === order.id ? updated : o));
    }
    setShowPayPendingModal(null);
    setPayAmount('');
  };

  const openEditTable = (table: Table) => {
    setEditTableForm({ name: table.name, clientName: table.clientName || '', capacity: table.capacity });
    setShowEditTableModal(table);
  };

  const saveEditTable = async () => {
    if (!showEditTableModal) return;
    const updatedTable: Omit<Table, 'orders'> = {
      ...showEditTableModal,
      name: editTableForm.name,
      clientName: editTableForm.clientName || undefined,
      capacity: editTableForm.capacity,
    };
    await db.upsertTable(updatedTable);
    const updatedTables = tableList.map(t =>
      t.id === showEditTableModal.id
        ? { ...t, name: editTableForm.name, clientName: editTableForm.clientName || undefined, capacity: editTableForm.capacity }
        : t
    );
    setTableList(updatedTables);
    if (selectedTable?.id === showEditTableModal.id) {
      const updated = updatedTables.find(t => t.id === showEditTableModal.id);
      if (updated) setSelectedTable(updated);
    }
    setShowEditTableModal(null);
  };

  const changeTableStatus = async (tableId: string, status: Table['status']) => {
    const table = tableList.find(t => t.id === tableId);
    if (!table) return;
    await db.upsertTable({ ...table, status });
    const updatedTables = tableList.map(t => t.id === tableId ? { ...t, status } : t);
    setTableList(updatedTables);
    if (selectedTable?.id === tableId) {
      const updated = updatedTables.find(t => t.id === tableId);
      if (updated) setSelectedTable(updated);
    }
  };

  const groupByPerson = (items: OrderItem[]) => {
    const groups: Record<string, OrderItem[]> = {};
    items.forEach(item => {
      const key = item.personName || '__geral__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  };

  const handleDeleteTable = async () => {
    if (!deleteTableTarget) return;
    await db.deleteTable(deleteTableTarget.id);
    setTableList(prev => prev.filter(t => t.id !== deleteTableTarget.id));
    if (selectedTable?.id === deleteTableTarget.id) setSelectedTable(null);
    setDeleteTableTarget(null);
  };

  const handleDeletePending = async () => {
    if (!deletePendingTarget) return;
    await db.deleteOrder(deletePendingTarget.id);
    setPendingList(prev => prev.filter(o => o.id !== deletePendingTarget.id));
    setDeletePendingTarget(null);
  };

  const handleAddTable = async () => {
    if (!addTableForm.name.trim()) return;
    const newTable: Table = {
      id: `t${Date.now()}`,
      name: addTableForm.name.trim(),
      number: tableList.length + 1,
      capacity: addTableForm.capacity,
      status: 'free',
      orders: [],
      clientName: addTableForm.clientName.trim() || undefined,
    };
    await db.upsertTable(newTable);
    setTableList(prev => [...prev, newTable]);
    setShowAddTableModal(false);
    setAddTableForm({ name: '', clientName: '', capacity: 4 });
  };

  const closeOrder = selectedTable?.orders.find(o => o.id === closeForm.orderId);
  const closePaid = parseFloat(closeForm.amountPaid) || 0;
  const closeRemaining = closeOrder ? closeOrder.total - closePaid : 0;
  const isPartialPayment = closeOrder && closePaid > 0 && closePaid < closeOrder.total;
  const isNoPayment = closeOrder && closePaid <= 0;

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Mesas & Pedidos"
        subtitle="Gestão de mesas, pedidos e contas pendentes"
        actions={
          <button
            onClick={() => setShowAddTableModal(true)}
            className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}
          >
            <i className="ri-add-line"></i> Nova Mesa
          </button>
        }
      />

      {debtSuccessMsg && (
        <div className="mx-6 mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <i className="ri-check-double-line text-emerald-600"></i>
          </div>
          <span className="text-emerald-800 text-sm font-medium">{debtSuccessMsg} — visível na página de Dívidas</span>
        </div>
      )}

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex gap-1 bg-gray-100 rounded-full p-1 w-fit mb-5">
          {([['tables', 'Mesas'], ['pending', 'Contas Pendentes']] as [TabType, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${tab === key ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
              {key === 'pending' && pendingList.length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingList.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'tables' && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Ocupadas', value: occupied, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
                { label: 'Livres', value: free, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                { label: 'Reservadas', value: reserved, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-500 text-sm">{s.label}</p>
                </div>
              ))}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4 w-fit">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-shield-keyhole-line text-red-500 text-sm"></i></div>
                <span className="text-red-700 text-xs font-medium">Modo Admin — passe o rato sobre uma mesa para eliminar</span>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
              {tableList.map(table => (
                <div key={table.id} className="relative group">
                  <button onClick={() => setSelectedTable(table)}
                    className={`w-full border-2 rounded-xl p-3 text-left transition-all cursor-pointer hover:scale-105 ${statusColor(table.status)} ${selectedTable?.id === table.id ? 'ring-2 ring-amber-400' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700 font-bold text-sm truncate">{table.name}</span>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot(table.status)}`}></div>
                    </div>
                    {table.clientName && <p className="text-gray-500 text-xs truncate mb-0.5">{table.clientName}</p>}
                    <p className="text-gray-400 text-xs">{table.capacity} lug.</p>
                    <p className={`text-xs font-medium mt-1 ${table.status === 'occupied' ? 'text-red-600' : table.status === 'reserved' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {statusLabel(table.status)}
                    </p>
                    {table.orders.length > 0 && (
                      <p className="text-gray-700 text-xs font-bold mt-1">
                        MT {table.orders.reduce((s, o) => s + o.total, 0).toFixed(2)}
                      </p>
                    )}
                  </button>
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditTable(table)}
                      className="w-5 h-5 flex items-center justify-center bg-white/90 rounded-md cursor-pointer hover:bg-white">
                      <i className="ri-pencil-line text-gray-500 text-xs"></i>
                    </button>
                    {isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTableTarget(table); }}
                        className="w-5 h-5 flex items-center justify-center bg-red-50 rounded-md cursor-pointer hover:bg-red-100">
                        <i className="ri-delete-bin-line text-red-500 text-xs"></i>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedTable && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-gray-900 font-semibold">{selectedTable.name}</h3>
                    <p className="text-gray-400 text-xs">
                      {selectedTable.capacity} lugares · {statusLabel(selectedTable.status)}
                      {selectedTable.clientName && ` · ${selectedTable.clientName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={selectedTable.status} onChange={e => changeTableStatus(selectedTable.id, e.target.value as Table['status'])}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400 cursor-pointer">
                      <option value="free">Livre</option>
                      <option value="occupied">Ocupada</option>
                      <option value="reserved">Reservada</option>
                    </select>
                    <button onClick={() => { setNewItems([]); setNewItemPerson(''); setSearchProduct(''); setShowOrderModal(true); }}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap">
                      <i className="ri-add-line"></i> Novo Pedido
                    </button>
                  </div>
                </div>

                {selectedTable.orders.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">Mesa livre — sem pedidos ativos</p>
                ) : (
                  <div className="space-y-4">
                    {selectedTable.orders.map(order => {
                      const groups = groupByPerson(order.items);
                      const persons = Object.keys(groups);
                      const hasPersons = persons.some(p => p !== '__geral__');
                      return (
                        <div key={order.id} className="border border-gray-100 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-gray-800 font-semibold text-sm">{order.personName || 'Pedido'}</p>
                              <p className="text-gray-400 text-xs">
                                {new Date(order.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {order.waiter}
                              </p>
                            </div>
                            <button onClick={() => openCloseModal(order.id)}
                              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap">
                              <i className="ri-check-line"></i> Fechar Conta
                            </button>
                          </div>

                          {hasPersons ? (
                            <div className="space-y-3">
                              {persons.map(person => (
                                <div key={person}>
                                  <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                                    <i className="ri-user-line"></i>
                                    {person === '__geral__' ? 'Geral' : person}
                                  </p>
                                  <table className="w-full">
                                    <tbody>
                                      {groups[person].map(item => (
                                        <tr key={`${item.productId}-${person}`} className="border-b border-gray-50">
                                          <td className="py-1.5 text-sm text-gray-800">{item.productName}</td>
                                          <td className="py-1.5 text-sm text-gray-600 text-center w-10">{item.quantity}</td>
                                          <td className="py-1.5 text-sm font-semibold text-gray-900 text-right">MT {(item.price * item.quantity).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <p className="text-right text-xs text-gray-500 mt-1">
                                    Subtotal: MT {groups[person].reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <table className="w-full">
                              <tbody>
                                {order.items.map(item => (
                                  <tr key={item.productId} className="border-b border-gray-50">
                                    <td className="py-1.5 text-sm text-gray-800">{item.productName}</td>
                                    <td className="py-1.5 text-sm text-gray-600 text-center">{item.quantity}</td>
                                    <td className="py-1.5 text-sm font-semibold text-gray-900 text-right">MT {(item.price * item.quantity).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                            <span className="text-gray-500 text-sm">Total</span>
                            <span className="text-gray-900 font-bold text-lg">MT {order.total.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {selectedTable.orders.length > 1 && (
                      <div className="flex justify-between items-center bg-amber-50 rounded-xl px-4 py-3">
                        <span className="text-amber-800 font-semibold text-sm">Total da Mesa</span>
                        <span className="text-amber-800 font-bold text-xl">MT {selectedTable.orders.reduce((s, o) => s + o.total, 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'pending' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-gray-900 font-semibold">Contas Pendentes</h3>
                <p className="text-gray-500 text-sm">Total em dívida: <span className="text-red-600 font-bold">MT {totalPendingDebt.toFixed(2)}</span></p>
              </div>
            </div>
            {isAdmin && pendingList.length > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4 w-fit">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-shield-keyhole-line text-red-500 text-sm"></i></div>
                <span className="text-red-700 text-xs font-medium">Modo Admin — pode eliminar contas pendentes</span>
              </div>
            )}
            {pendingList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <div className="w-12 h-12 flex items-center justify-center bg-emerald-50 rounded-full mx-auto mb-3">
                  <i className="ri-check-double-line text-emerald-500 text-xl"></i>
                </div>
                <p className="text-gray-500 text-sm">Sem contas pendentes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingList.map(order => {
                  const remaining = order.total - order.paid;
                  return (
                    <div key={order.id} className="bg-white rounded-xl border border-amber-200 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-gray-900 font-semibold">{order.personName || 'Cliente'}</p>
                            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">Pendente</span>
                          </div>
                          <p className="text-gray-400 text-xs">
                            Fechado em {order.closedAt ? new Date(order.closedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            {' · '} Resp: {order.pendingResponsible}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setShowPayPendingModal(order); setPayAmount(remaining.toFixed(2)); setPayMethod('cash'); }}
                            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap">
                            <i className="ri-money-dollar-circle-line"></i> Receber Pagamento
                          </button>
                          {isAdmin && (
                            <button onClick={() => setDeletePendingTarget(order)}
                              className="w-8 h-8 flex items-center justify-center text-red-300 hover:text-red-600 cursor-pointer rounded-lg hover:bg-red-50 transition-all">
                              <i className="ri-delete-bin-line text-sm"></i>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3 mb-3">
                        <p className="text-amber-800 text-xs font-medium mb-0.5">Motivo do não pagamento:</p>
                        <p className="text-amber-700 text-sm">{order.pendingReason}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-gray-500 text-xs">Total</p>
                          <p className="text-gray-900 font-bold">MT {order.total.toFixed(2)}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2">
                          <p className="text-gray-500 text-xs">Pago</p>
                          <p className="text-emerald-700 font-bold">MT {order.paid.toFixed(2)}</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2">
                          <p className="text-gray-500 text-xs">Em Dívida</p>
                          <p className="text-red-700 font-bold">MT {remaining.toFixed(2)}</p>
                        </div>
                      </div>
                      <details className="mt-3">
                        <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-700">Ver itens do pedido</summary>
                        <div className="mt-2 space-y-1">
                          {order.items.map(item => (
                            <div key={item.productId} className="flex justify-between text-xs text-gray-600">
                              <span>{item.quantity}x {item.productName}</span>
                              <span>MT {(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Table Modal */}
      {showEditTableModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold">Editar Mesa</h3>
              <button onClick={() => setShowEditTableModal(null)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome da Mesa *</label>
                <input value={editTableForm.name} onChange={e => setEditTableForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                  placeholder="Ex: Mesa 1, VIP, Terraço..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do Cliente</label>
                <input value={editTableForm.clientName} onChange={e => setEditTableForm(f => ({ ...f, clientName: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                  placeholder="Nome do cliente ou grupo..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Capacidade (lugares)</label>
                <input type="number" min={1} max={50} value={editTableForm.capacity}
                  onChange={e => setEditTableForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowEditTableModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={saveEditTable} disabled={!editTableForm.name.trim()}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Order Modal */}
      {showOrderModal && selectedTable && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold">Novo Pedido — {selectedTable.name}</h3>
              <button onClick={() => setShowOrderModal(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="mb-3">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Associar a pessoa (opcional)</label>
              <input value={newItemPerson} onChange={e => setNewItemPerson(e.target.value)}
                placeholder="Nome da pessoa que pediu..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
            </div>
            <input value={searchProduct} onChange={e => setSearchProduct(e.target.value)}
              placeholder="Pesquisar produto..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-amber-400" />
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 mb-4">
                {filteredProducts.slice(0, 20).map(p => (
                  <button key={p.id} onClick={() => addItem(p.id)}
                    className="flex items-center justify-between bg-gray-50 hover:bg-amber-50 border border-gray-100 hover:border-amber-200 rounded-lg px-3 py-2 cursor-pointer transition-all">
                    <span className="text-gray-800 text-xs font-medium truncate">{p.name}</span>
                    <span className="text-amber-600 text-xs font-bold ml-2 flex-shrink-0">MT {p.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
              {newItems.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-gray-600 text-xs font-semibold mb-2">Itens selecionados:</p>
                  {newItems.map((item, idx) => (
                    <div key={`${item.productId}-${idx}`} className="flex items-center justify-between py-1.5">
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-800 text-sm">{item.productName}</span>
                        {item.personName && <span className="text-gray-400 text-xs ml-2">({item.personName})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeItem(item.productId, item.personName)} className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded cursor-pointer text-xs font-bold">-</button>
                        <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                        <button onClick={() => addItem(item.productId)} className="w-6 h-6 flex items-center justify-center bg-amber-100 rounded cursor-pointer text-xs font-bold text-amber-700">+</button>
                        <span className="text-gray-700 text-sm font-bold w-16 text-right">MT {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
                    <span className="text-gray-600 text-sm font-medium">Total</span>
                    <span className="text-amber-600 font-bold">MT {newItems.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowOrderModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={saveOrder} disabled={newItems.length === 0}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40">
                Confirmar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Order Modal */}
      {showCloseModal && selectedTable && closeOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold">Fechar Conta</h3>
              <button onClick={() => setShowCloseModal(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-gray-600 text-xs font-semibold mb-2">Resumo do Pedido</p>
              {closeOrder.items.map(item => (
                <div key={item.productId} className="flex justify-between text-xs text-gray-600 py-0.5">
                  <span>{item.quantity}x {item.productName}</span>
                  <span className="font-medium">MT {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-800 font-semibold text-sm">Total</span>
                <span className="text-gray-900 font-bold">MT {closeOrder.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do Cliente</label>
                <input value={closeForm.clientName} onChange={e => setCloseForm(f => ({ ...f, clientName: e.target.value }))}
                  placeholder="Nome do cliente..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Método de Pagamento</label>
                <select value={closeForm.paymentMethod} onChange={e => setCloseForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
                  <option value="cash">Dinheiro</option>
                  <option value="card">Cartão</option>
                  <option value="mobile">Mobile Money</option>
                  <option value="transfer">Transferência</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Valor Pago (MT)</label>
                <input type="number" value={closeForm.amountPaid}
                  onChange={e => setCloseForm(f => ({ ...f, amountPaid: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
              </div>
              {closeForm.amountPaid !== '' && (
                <div className={`rounded-xl p-3 ${closeRemaining <= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      {closeRemaining <= 0 ? 'Troco' : 'Valor em Dívida'}
                    </span>
                    <span className={`font-bold text-lg ${closeRemaining <= 0 ? 'text-emerald-600' : 'text-amber-700'}`}>
                      MT {Math.abs(closeRemaining).toFixed(2)}
                    </span>
                  </div>
                  {closeRemaining > 0 && (
                    <p className="text-amber-700 text-xs mt-1 flex items-center gap-1">
                      <i className="ri-information-line"></i>
                      Pagamento parcial — será registado como dívida automaticamente
                    </p>
                  )}
                </div>
              )}
              {(isPartialPayment || isNoPayment) && (
                <>
                  <div className="flex items-center gap-2 py-1">
                    <input type="checkbox" id="isPending" checked={closeForm.isPending}
                      onChange={e => setCloseForm(f => ({ ...f, isPending: e.target.checked }))}
                      className="w-4 h-4 accent-amber-500 cursor-pointer" />
                    <label htmlFor="isPending" className="text-sm text-gray-700 cursor-pointer">
                      Marcar como conta pendente (além da dívida)
                    </label>
                  </div>
                  {closeForm.isPending && (
                    <div>
                      <label className="text-xs font-medium text-red-600 mb-1 block">Motivo obrigatório *</label>
                      <textarea value={closeForm.pendingReason}
                        onChange={e => setCloseForm(f => ({ ...f, pendingReason: e.target.value }))}
                        rows={2} maxLength={500}
                        placeholder="Explique porque o cliente não pagou..."
                        className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none" />
                      <p className="text-gray-400 text-xs mt-0.5">{closeForm.pendingReason.length}/500</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Data de Vencimento da Dívida (opcional)</label>
                    <input type="date" value={closeForm.dueDate}
                      onChange={e => setCloseForm(f => ({ ...f, dueDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                  </div>
                </>
              )}
            </div>
            {closeRemaining > 0 && (
              <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-file-list-3-line text-red-500 text-sm"></i>
                </div>
                <p className="text-red-700 text-xs">
                  A dívida de <strong>MT {closeRemaining.toFixed(2)}</strong> será registada automaticamente na página de Dívidas para <strong>{closeForm.clientName || 'o cliente'}</strong>.
                </p>
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                Cancelar
              </button>
              <button onClick={confirmClose}
                disabled={closeForm.isPending && !closeForm.pendingReason.trim()}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                  closeRemaining > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}>
                {closeRemaining > 0 ? 'Fechar e Registar Dívida' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Pending Modal */}
      {showPayPendingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold">Receber Pagamento</h3>
              <button onClick={() => setShowPayPendingModal(null)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-gray-600 text-sm font-medium">{showPayPendingModal.personName}</p>
              <p className="text-gray-500 text-xs">Em dívida: <span className="text-red-600 font-bold">MT {(showPayPendingModal.total - showPayPendingModal.paid).toFixed(2)}</span></p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Valor a Receber (MT)</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Método</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
                  <option value="cash">Dinheiro</option>
                  <option value="card">Cartão</option>
                  <option value="mobile">Mobile Money</option>
                  <option value="transfer">Transferência</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPayPendingModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={payPending} disabled={!payAmount || parseFloat(payAmount) <= 0}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40">
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTableTarget && (
        <ConfirmDeleteModal
          title={`Eliminar mesa "${deleteTableTarget.name}"?`}
          description={`A mesa e todos os seus pedidos ativos (${deleteTableTarget.orders.length}) serão removidos permanentemente.`}
          onConfirm={handleDeleteTable}
          onCancel={() => setDeleteTableTarget(null)}
        />
      )}

      {deletePendingTarget && (
        <ConfirmDeleteModal
          title="Eliminar conta pendente?"
          description={`Vai eliminar a conta de ${deletePendingTarget.personName || 'Cliente'} com MT ${(deletePendingTarget.total - deletePendingTarget.paid).toFixed(2)} em dívida.`}
          onConfirm={handleDeletePending}
          onCancel={() => setDeletePendingTarget(null)}
        />
      )}

      {showAddTableModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold">Nova Mesa</h3>
              <button onClick={() => setShowAddTableModal(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome da Mesa *</label>
                <input value={addTableForm.name} onChange={e => setAddTableForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Mesa 13, VIP 2, Esplanada B..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do Cliente (opcional)</label>
                <input value={addTableForm.clientName} onChange={e => setAddTableForm(f => ({ ...f, clientName: e.target.value }))}
                  placeholder="Nome do cliente ou grupo..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Capacidade (lugares)</label>
                <input type="number" min={1} max={50} value={addTableForm.capacity}
                  onChange={e => setAddTableForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddTableModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                Cancelar
              </button>
              <button onClick={handleAddTable} disabled={!addTableForm.name.trim()}
                className="flex-1 py-2.5 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                Criar Mesa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
