import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/feature/TopBar';
import { db, SaleRecord, CashShift } from '@/store/db';
import { onCacheChange } from '@/store/db';
import { categories } from '@/mocks/products';
import ConfirmDeleteModal from '@/components/base/ConfirmDeleteModal';
import { useAuth } from '@/store/AuthContext';
import { exportSales } from '@/utils/exportExcel';
import { Product } from '@/mocks/products';

type PayMethod = 'cash' | 'card' | 'mobile' | 'transfer' | 'partial';

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

const statusLabels: Record<string, string> = {
  draft: 'Rascunho', paid: 'Paga', cancelled: 'Cancelada', reversed: 'Estornada',
};
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700', reversed: 'bg-amber-100 text-amber-700',
};
const payMethodLabels: Record<PayMethod, string> = {
  cash: 'Dinheiro', card: 'Cartão', mobile: 'Mobile Money', transfer: 'Transferência', partial: 'Pagamento Parcial',
};

export default function POSPage() {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState<Product[]>(db.getProducts());
  const [tables, setTables] = useState(db.getTables());
  const [clients, setClients] = useState(db.getClients());
  const [allShifts, setAllShifts] = useState<CashShift[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCat, setSelectedCat] = useState('Todos');
  const [search, setSearch] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [partialAmount, setPartialAmount] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [personName, setPersonName] = useState('');
  const [paid, setPaid] = useState(false);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [deleteSaleTarget, setDeleteSaleTarget] = useState<SaleRecord | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<SaleRecord | null>(null);
  const [showReverseModal, setShowReverseModal] = useState<SaleRecord | null>(null);
  const [validationError, setValidationError] = useState('');
  const [currentShift, setCurrentShift] = useState(db.getCurrentShift());
  // History filters
  const [historyShiftFilter, setHistoryShiftFilter] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');

  const syncFromCache = useCallback(() => {
    setSales(db.getSales());
    setAllProducts(db.getProducts());
    setTables(db.getTables());
    setClients(db.getClients());
    setCurrentShift(db.getCurrentShift());
    const cur = db.getCurrentShift();
    const prev = db.getPreviousShifts() as CashShift[];
    const combined = [cur, ...prev].filter(s => s.id !== 'shift1' || s.openingBalance > 0 || prev.length > 0);
    setAllShifts(combined);
  }, []);

  useEffect(() => {
    syncFromCache();
    const unsub = onCacheChange(syncFromCache);
    return unsub;
  }, [syncFromCache]);

  const isShiftOpen = currentShift && currentShift.status === 'open';

  const filtered = allProducts.filter(p => {
    const matchCat = selectedCat === 'Todos' || p.category === selectedCat;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const addToCart = (p: Product) => {
    if (p.stock <= 0) return; // block out-of-stock
    setCart(prev => {
      const existing = prev.find(c => c.id === p.id);
      if (existing) {
        // Don't exceed available stock
        const product = allProducts.find(pr => pr.id === p.id);
        const maxQty = product?.stock ?? 999;
        if (existing.qty >= maxQty) return prev;
        return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.id !== id) return c;
        const product = allProducts.find(p => p.id === id);
        const maxQty = product?.stock ?? 999;
        const newQty = Math.max(0, Math.min(c.qty + delta, maxQty));
        return { ...c, qty: newQty };
      }).filter(c => c.qty > 0);
    });
  };

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const change = parseFloat(cashReceived || '0') - total;
  const partialPaid = parseFloat(partialAmount || '0');
  const remaining = total - partialPaid;

  const handleOpenPay = () => {
    if (!isShiftOpen) { setValidationError('Não há caixa aberta. Abra um turno na página de Caixa antes de vender.'); return; }
    if (!selectedTable) { setValidationError('Selecione uma mesa antes de pagar.'); return; }
    if (!personName.trim() && !selectedClientId) { setValidationError('Indique o nome do cliente ou selecione um cliente registado.'); return; }
    // Validate stock
    for (const item of cart) {
      const product = allProducts.find(p => p.id === item.id);
      if (product && product.stock < item.qty) {
        setValidationError(`Stock insuficiente para "${item.name}". Disponível: ${product.stock}, pedido: ${item.qty}.`);
        return;
      }
    }
    setValidationError('');
    setShowPayModal(true);
  };

  const handleFinish = async () => {
    const tableName = tables.find(t => t.id === selectedTable)?.name || '';
    const clientName = selectedClientId ? clients.find(c => c.id === selectedClientId)?.name || personName : personName;
    const newSale: SaleRecord = {
      id: `s${Date.now()}`,
      items: [...cart],
      total,
      status: 'paid',
      payMethod,
      tableId: selectedTable || undefined,
      tableName: tableName || undefined,
      clientId: selectedClientId || undefined,
      personName: clientName,
      operator: currentUser?.name || 'Sistema',
      createdAt: new Date().toISOString(),
      paidAmount: payMethod === 'cash' ? parseFloat(cashReceived) : payMethod === 'partial' ? partialPaid : total,
      shiftId: currentShift?.id,
    };
    await db.addSale(newSale);

    // Subtract stock for each sold item
    for (const item of cart) {
      const product = allProducts.find(p => p.id === item.id);
      if (product) {
        const updatedProduct = { ...product, stock: Math.max(0, product.stock - item.qty) };
        await db.upsertProduct(updatedProduct);
        // Register stock movement for sale
        await db.addMovement({
          id: `sm_sale_${Date.now()}_${item.id}`,
          productId: item.id,
          productName: item.name,
          type: 'sale',
          quantity: item.qty,
          reason: `Venda — ${newSale.id}`,
          operator: currentUser?.name || 'Sistema',
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Register cash movement for this sale
    if (isShiftOpen && currentShift) {
      const amountPaid = payMethod === 'partial' ? partialPaid : total;
      const mov = {
        id: `cm${Date.now()}`,
        type: 'in' as const,
        amount: amountPaid,
        description: `Venda — ${cart.map(i => `${i.qty}x ${i.name}`).join(', ')}`,
        paymentMethod: payMethod === 'partial' ? 'cash' as const : payMethod as 'cash' | 'card' | 'mobile' | 'transfer',
        category: 'Venda',
        operator: currentUser?.name || 'Sistema',
        shiftId: currentShift.id,
        orderId: newSale.id,
        createdAt: new Date().toISOString(),
      };
      await db.addCashMovement(mov);
    }

    setPaid(true);
    setTimeout(() => {
      setCart([]);
      setShowPayModal(false);
      setPaid(false);
      setCashReceived('');
      setPartialAmount('');
      setSelectedTable('');
      setSelectedClientId('');
      setPersonName('');
    }, 1800);
  };

  const saveDraft = async () => {
    if (!selectedTable) { setValidationError('Selecione uma mesa para guardar rascunho.'); return; }
    const tableName = tables.find(t => t.id === selectedTable)?.name || '';
    const draft: SaleRecord = {
      id: `s${Date.now()}`,
      items: [...cart],
      total,
      status: 'draft',
      payMethod: 'cash',
      tableId: selectedTable || undefined,
      tableName: tableName || undefined,
      clientId: selectedClientId || undefined,
      personName: personName,
      operator: currentUser?.name || 'Sistema',
      createdAt: new Date().toISOString(),
      shiftId: currentShift?.id,
    };
    await db.addSale(draft);
    setCart([]);
    setSelectedTable('');
    setSelectedClientId('');
    setPersonName('');
    setValidationError('');
  };

  const cancelSale = async (sale: SaleRecord) => {
    const updated = sales.map(s => s.id === sale.id ? { ...s, status: 'cancelled' as const } : s);
    setSales(updated);
    await db.setSales(updated);
    setShowCancelModal(null);
  };

  const reverseSale = async (sale: SaleRecord) => {
    const updated = sales.map(s => s.id === sale.id ? { ...s, status: 'reversed' as const } : s);
    setSales(updated);
    await db.setSales(updated);
    setShowReverseModal(null);
  };

  const resumeDraft = async (sale: SaleRecord) => {
    setCart(sale.items);
    setSelectedTable(sale.tableId || '');
    setSelectedClientId(sale.clientId || '');
    setPersonName(sale.personName || '');
    await db.deleteSale(sale.id);
    setActiveTab('pos');
  };

  const handleDeleteSale = async () => {
    if (!deleteSaleTarget) return;
    await db.deleteSale(deleteSaleTarget.id);
    setDeleteSaleTarget(null);
  };

  const handleExport = () => {
    exportSales(sales.map(s => ({
      createdAt: s.createdAt,
      personName: s.personName,
      tableName: s.tableName,
      total: s.total,
      payMethod: s.payMethod,
      status: s.status,
      operator: s.operator,
    })));
  };

  // Filtered history
  const filteredSales = sales.filter(s => {
    const matchShift = historyShiftFilter === 'all' || s.shiftId === historyShiftFilter;
    const matchStatus = historyStatusFilter === 'all' || s.status === historyStatusFilter;
    return matchShift && matchStatus;
  });

  // Shift stats for history
  const shiftSalesTotal = filteredSales.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.total, 0);
  const shiftSalesCount = filteredSales.filter(s => s.status === 'paid').length;

  // Shifts with sales (for filter dropdown)
  const shiftsWithSales = allShifts.filter(sh =>
    sales.some(s => s.shiftId === sh.id)
  );

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Vendas POS"
        subtitle="Ponto de venda"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'history' && (
              <button onClick={handleExport}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-all"
                style={{ borderColor: '#1E9FD4', color: '#1E9FD4' }}>
                <i className="ri-download-2-line"></i> Excel
              </button>
            )}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['pos', 'history'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-all ${activeTab === t ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t === 'pos' ? 'Venda' : 'Histórico'}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {activeTab === 'pos' && (
        <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
          {/* Products */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {/* No shift warning */}
            {!isShiftOpen && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
                <div className="w-8 h-8 flex items-center justify-center bg-red-100 rounded-lg flex-shrink-0">
                  <i className="ri-lock-line text-red-600 text-base"></i>
                </div>
                <div className="flex-1">
                  <p className="text-red-800 text-sm font-semibold">Caixa fechada — vendas bloqueadas</p>
                  <p className="text-red-600 text-xs">Abra um turno na página de <strong>Caixa</strong> para poder realizar vendas.</p>
                </div>
                <button onClick={() => navigate('/cash')} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white whitespace-nowrap cursor-pointer" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                  Ir para Caixa
                </button>
              </div>
            )}
            {isShiftOpen && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-checkbox-circle-line text-emerald-500 text-sm"></i>
                </div>
                <span className="text-emerald-700 text-xs font-medium">Turno aberto — {currentShift?.openedBy} · desde {new Date(currentShift?.openedAt || '').toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-search-line text-gray-400 text-sm"></i>
                </div>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cyan-400" />
              </div>
            </div>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {['Todos', ...categories].map(cat => (
                <button key={cat} onClick={() => setSelectedCat(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${selectedCat === cat ? 'text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}
                  style={selectedCat === cat ? { background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' } : {}}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {filtered.map(p => {
                  const isOutOfStock = p.stock <= 0;
                  const cartItem = cart.find(c => c.id === p.id);
                  const atMax = cartItem && cartItem.qty >= p.stock;
                  return (
                    <button key={p.id} onClick={() => addToCart(p)}
                      disabled={isOutOfStock}
                      className={`bg-white border rounded-xl p-3 text-left transition-all cursor-pointer group relative ${isOutOfStock ? 'opacity-50 cursor-not-allowed border-red-100' : 'border-gray-100 hover:border-gray-300'}`}>
                      {isOutOfStock && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                          Esgotado
                        </div>
                      )}
                      {atMax && !isOutOfStock && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                          Máx
                        </div>
                      )}
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-2" style={{ background: 'rgba(30,159,212,0.08)' }}>
                        <i className="ri-goblet-line text-base" style={{ color: '#1E9FD4' }}></i>
                      </div>
                      <p className="text-gray-800 text-xs font-semibold leading-tight mb-1">{p.name}</p>
                      <p className="text-gray-400 text-xs">{p.category}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-sm font-bold" style={{ color: '#1E9FD4' }}>MZN {p.price.toFixed(2)}</p>
                        <span className={`text-xs font-medium ${p.stock <= 5 ? 'text-amber-500' : 'text-gray-400'}`}>
                          {p.stock} un
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cart */}
          <div className="w-80 bg-white border-l border-gray-100 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-gray-900 font-semibold text-sm">Carrinho</h3>
              <p className="text-gray-400 text-xs">{cart.length} itens</p>
            </div>

            {/* Association */}
            <div className="px-4 py-3 border-b border-gray-100 space-y-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                  Mesa <span className="text-red-500">*</span>
                </label>
                <select value={selectedTable} onChange={e => { setSelectedTable(e.target.value); setValidationError(''); }}
                  className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-400 ${!selectedTable && validationError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
                  <option value="">Selecionar mesa...</option>
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.status === 'occupied' ? 'Ocupada' : t.status === 'reserved' ? 'Reservada' : 'Livre'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                  Cliente <span className="text-red-500">*</span>
                </label>
                <select value={selectedClientId} onChange={e => { setSelectedClientId(e.target.value); if (e.target.value) setPersonName(''); setValidationError(''); }}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-400 mb-1">
                  <option value="">Selecionar cliente registado...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {!selectedClientId && (
                  <input value={personName} onChange={e => { setPersonName(e.target.value); setValidationError(''); }}
                    placeholder="Ou escreva o nome do cliente..."
                    className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-400 ${!personName && !selectedClientId && validationError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
                )}
              </div>
              {validationError && (
                <p className="text-red-500 text-xs flex items-center gap-1">
                  <i className="ri-error-warning-line"></i> {validationError}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {cart.length === 0 && (
                <div className="text-center py-10 text-gray-300">
                  <div className="w-12 h-12 flex items-center justify-center mx-auto mb-2">
                    <i className="ri-shopping-cart-2-line text-4xl"></i>
                  </div>
                  <p className="text-sm">Carrinho vazio</p>
                </div>
              )}
              {cart.map(item => {
                const product = allProducts.find(p => p.id === item.id);
                const maxQty = product?.stock ?? 999;
                return (
                  <div key={item.id} className="flex items-center gap-2 py-2 border-b border-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 text-xs font-medium truncate">{item.name}</p>
                      <p className="text-gray-400 text-xs">MT {item.price.toFixed(2)} / un · stock: {maxQty}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-md hover:bg-gray-200 cursor-pointer text-gray-600 text-xs font-bold">-</button>
                      <span className="text-gray-900 text-sm font-semibold w-5 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} disabled={item.qty >= maxQty}
                        className="w-6 h-6 flex items-center justify-center rounded-md cursor-pointer text-xs font-bold disabled:opacity-40"
                        style={{ background: 'rgba(30,159,212,0.1)', color: '#1E9FD4' }}>+</button>
                    </div>
                    <span className="text-gray-900 text-xs font-bold w-14 text-right">MT {(item.price * item.qty).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-4 border-t border-gray-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Total</span>
                <span className="text-gray-900 font-bold text-xl">MZN {total.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button onClick={() => setCart([])} disabled={cart.length === 0}
                  className="py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap disabled:opacity-40">
                  Limpar
                </button>
                <button onClick={saveDraft} disabled={cart.length === 0 || !isShiftOpen}
                  className="py-2 border rounded-lg text-xs cursor-pointer whitespace-nowrap disabled:opacity-40"
                  style={{ borderColor: '#1E9FD4', color: '#1E9FD4' }}>
                  Rascunho
                </button>
                <button onClick={handleOpenPay} disabled={cart.length === 0 || !isShiftOpen}
                  className="py-2 text-white rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                  Pagar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Turno:</label>
              <select value={historyShiftFilter} onChange={e => setHistoryShiftFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none min-w-[180px]">
                <option value="all">Todos os turnos</option>
                {shiftsWithSales.map(sh => (
                  <option key={sh.id} value={sh.id}>
                    {sh.openedBy} — {new Date(sh.openedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} {new Date(sh.openedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    {sh.status === 'open' ? ' (aberto)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Estado:</label>
              <select value={historyStatusFilter} onChange={e => setHistoryStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none">
                <option value="all">Todos</option>
                <option value="paid">Pagas</option>
                <option value="draft">Rascunhos</option>
                <option value="cancelled">Canceladas</option>
                <option value="reversed">Estornadas</option>
              </select>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 ml-auto">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-shield-keyhole-line text-red-500 text-sm"></i></div>
                <span className="text-red-700 text-xs font-medium">Modo Admin</span>
              </div>
            )}
          </div>

          {/* Shift summary bar */}
          {historyShiftFilter !== 'all' && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Vendas Pagas', value: shiftSalesCount, suffix: 'vendas', color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Total Faturado', value: `MZN ${shiftSalesTotal.toFixed(2)}`, suffix: '', color: 'text-gray-900', bg: 'bg-gray-50' },
                { label: 'Turno', value: allShifts.find(s => s.id === historyShiftFilter)?.openedBy || '—', suffix: '', color: 'text-gray-700', bg: 'bg-gray-50' },
              ].map(stat => (
                <div key={stat.label} className={`${stat.bg} rounded-xl p-3 text-center`}>
                  <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                  <p className={`font-bold text-sm ${stat.color}`}>{stat.value} {stat.suffix}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-gray-900 font-semibold text-sm">Histórico de Vendas</h3>
              <span className="text-gray-400 text-xs">{filteredSales.length} registos</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Hora</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Itens</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Mesa / Cliente</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Método</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Estado</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Turno</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Total</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">Nenhuma venda encontrada</td></tr>
                  )}
                  {filteredSales.map(sale => {
                    const shift = allShifts.find(s => s.id === sale.shiftId);
                    return (
                      <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 text-gray-600 text-sm whitespace-nowrap">
                          {new Date(sale.createdAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800 text-xs">{sale.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">
                          {sale.tableName && <span className="text-gray-700 font-medium">{sale.tableName}</span>}
                          {sale.personName && <span className="text-gray-500 text-xs block">{sale.personName}</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{payMethodLabels[sale.payMethod as PayMethod]}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[sale.status]}`}>
                            {statusLabels[sale.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {shift ? (
                            <span className="text-gray-500 text-xs">{shift.openedBy} · {new Date(shift.openedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-sm" style={{ color: '#F5A623' }}>MT {sale.total.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {sale.status === 'draft' && (
                              <button onClick={() => resumeDraft(sale)}
                                className="text-xs cursor-pointer border border-amber-200 text-amber-600 rounded-lg px-2 py-1 whitespace-nowrap">
                                Retomar
                              </button>
                            )}
                            {sale.status === 'paid' && (
                              <button onClick={() => setShowReverseModal(sale)}
                                className="text-xs text-amber-600 cursor-pointer border border-amber-200 rounded-lg px-2 py-1 whitespace-nowrap">
                                Estornar
                              </button>
                            )}
                            {(sale.status === 'draft' || sale.status === 'paid') && (
                              <button onClick={() => setShowCancelModal(sale)}
                                className="text-xs text-red-600 cursor-pointer border border-red-200 rounded-lg px-2 py-1 whitespace-nowrap">
                                Cancelar
                              </button>
                            )}
                            {isAdmin && (
                              <button onClick={() => setDeleteSaleTarget(sale)}
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
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            {paid ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 flex items-center justify-center bg-emerald-100 rounded-full mx-auto mb-3">
                  <i className="ri-check-line text-emerald-600 text-2xl"></i>
                </div>
                <p className="text-gray-900 font-semibold text-lg">Pagamento Concluído!</p>
                {payMethod === 'cash' && change > 0 && <p className="text-gray-500 text-sm mt-1">Troco: MT {change.toFixed(2)}</p>}
                {payMethod === 'partial' && <p className="text-amber-600 text-sm mt-1">Restante: MT {Math.max(0, remaining).toFixed(2)}</p>}
                <p className="text-gray-400 text-xs mt-2">Stock atualizado automaticamente</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-900 font-semibold">Pagamento</h3>
                  <button onClick={() => setShowPayModal(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                    <i className="ri-close-line"></i>
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">Total</span>
                    <span className="text-gray-900 font-bold text-xl">MT {total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Mesa: {tables.find(t => t.id === selectedTable)?.name}</span>
                    <span>Cliente: {selectedClientId ? clients.find(c => c.id === selectedClientId)?.name : personName}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {(['cash', 'card', 'mobile', 'transfer', 'partial'] as PayMethod[]).map(m => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className={`py-2.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${payMethod === m ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      style={payMethod === m ? { background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' } : {}}>
                      <i className={m === 'cash' ? 'ri-money-dollar-circle-line' : m === 'card' ? 'ri-bank-card-line' : m === 'mobile' ? 'ri-smartphone-line' : m === 'transfer' ? 'ri-exchange-dollar-line' : 'ri-split-cells-horizontal'}></i>
                      {payMethodLabels[m]}
                    </button>
                  ))}
                </div>
                {payMethod === 'cash' && (
                  <div className="mb-4">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Valor recebido (MT)</label>
                    <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400" placeholder="0.00" />
                    {parseFloat(cashReceived) >= total && (
                      <p className="text-emerald-600 text-sm mt-1 font-medium">Troco: MT {change.toFixed(2)}</p>
                    )}
                  </div>
                )}
                {payMethod === 'partial' && (
                  <div className="mb-4 space-y-2">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Valor a pagar agora (MT)</label>
                    <input type="number" value={partialAmount} onChange={e => setPartialAmount(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400" placeholder="0.00" />
                    {partialPaid > 0 && (
                      <p className="text-amber-600 text-sm font-medium">Restante ficará pendente: MT {Math.max(0, remaining).toFixed(2)}</p>
                    )}
                  </div>
                )}
                <button onClick={handleFinish}
                  disabled={(payMethod === 'cash' && parseFloat(cashReceived || '0') < total) || (payMethod === 'partial' && partialPaid <= 0)}
                  className="w-full py-3 text-white rounded-lg font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                  Confirmar Pagamento
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="text-gray-900 font-semibold mb-2">Cancelar Venda</h3>
            <p className="text-gray-500 text-sm mb-5">Tem a certeza que quer cancelar esta venda de MT {showCancelModal.total.toFixed(2)}?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Não</button>
              <button onClick={() => cancelSale(showCancelModal)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap">Cancelar Venda</button>
            </div>
          </div>
        </div>
      )}

      {showReverseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h3 className="text-gray-900 font-semibold mb-2">Estornar Venda</h3>
            <p className="text-gray-500 text-sm mb-5">Confirma o estorno da venda de MT {showReverseModal.total.toFixed(2)}?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowReverseModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Não</button>
              <button onClick={() => reverseSale(showReverseModal)} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap">Confirmar Estorno</button>
            </div>
          </div>
        </div>
      )}

      {deleteSaleTarget && (
        <ConfirmDeleteModal
          title="Eliminar registo de venda?"
          description={`Vai eliminar permanentemente a venda de MT ${deleteSaleTarget.total.toFixed(2)}.`}
          onConfirm={handleDeleteSale}
          onCancel={() => setDeleteSaleTarget(null)}
        />
      )}
    </div>
  );
}
