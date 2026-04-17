import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/feature/TopBar';
import { categories, getStockAlert, Product, StockMovement, ProductStructureType } from '@/mocks/products';
import { db, onCacheChange, CashMovement } from '@/store/db';
import Badge from '@/components/base/Badge';
import ConfirmDeleteModal from '@/components/base/ConfirmDeleteModal';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuth } from '@/store/AuthContext';

type TabType = 'products' | 'purchase' | 'movements';

const structureLabels: Record<ProductStructureType, string> = {
  unit: 'Unitário',
  box_no_pack: 'Caixa s/ Embalagem',
  box_with_pack: 'Caixa c/ Embalagem',
};

const structureIcons: Record<ProductStructureType, string> = {
  unit: 'ri-box-1-line',
  box_no_pack: 'ri-archive-2-line',
  box_with_pack: 'ri-stack-line',
};

const structureDesc: Record<ProductStructureType, string> = {
  unit: 'Compra e venda por unidade',
  box_no_pack: 'Caixa com N unidades diretas',
  box_with_pack: 'Caixa com embalagens, cada uma com N unidades',
};

type PurchaseInputMode = 'box' | 'pack';

interface ProductForm {
  name: string;
  category: string;
  price: string;
  minStock: string;
  criticalStock: string;
  unit: string;
  warehouse: string;
  structureType: ProductStructureType;
  unitsPerPack: string;
  packsPerBox: string;
}

interface PurchaseForm {
  productId: string;
  inputMode: PurchaseInputMode;
  quantity: string;
  unitPrice: string;   // price per box or per pack (auto-fills totalCost)
  totalCost: string;
  warehouse: string;
  notes: string;
  debitFromCash: boolean; // whether to debit from current cash shift
}

const defaultProductForm = (): ProductForm => ({
  name: '', category: 'Cervejas', price: '', minStock: '', criticalStock: '',
  unit: 'un', warehouse: 'Armazém Principal',
  structureType: 'unit', unitsPerPack: '', packsPerBox: '',
});

const alertLabel: Record<string, string> = { ok: 'OK', low: 'Baixo', critical: 'Crítico', out: 'Esgotado' };
const alertBadge: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { ok: 'success', low: 'warning', critical: 'danger', out: 'danger' };
const movTypeLabel: Record<string, string> = { entry: 'Entrada', sale: 'Venda', waste: 'Quebra', offer: 'Oferta', transfer: 'Transferência', adjustment: 'Ajuste' };
const movTypeColor: Record<string, string> = { entry: 'text-emerald-600', sale: 'text-sky-600', waste: 'text-red-600', offer: 'text-amber-600', transfer: 'text-gray-600', adjustment: 'text-gray-600' };

function calcTotalUnits(p: Product | null, form: PurchaseForm): number {
  if (!p) return 0;
  const qty = parseInt(form.quantity || '0') || 0;
  if (p.structureType === 'unit') return qty;
  if (p.structureType === 'box_no_pack') return qty * (p.unitsPerPack || 1);
  // box_with_pack
  if (form.inputMode === 'box') return qty * (p.packsPerBox || 1) * (p.unitsPerPack || 1);
  return qty * (p.unitsPerPack || 1); // pack mode
}

export default function StockPage() {
  const { isAdmin } = useCurrentUser();
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<TabType>('products');

  const [productList, setProductList] = useState<Product[]>(() => db.getProducts());
  const [movements, setMovements] = useState<StockMovement[]>(() => db.getMovements());
  const [warehouses, setWarehouses] = useState<string[]>(() => {
    const wh = db.getWarehouses().filter(w => w.active).map(w => w.name);
    return wh.length > 0 ? wh : ['Armazém Principal', 'Balcão'];
  });

  const syncFromCache = useCallback(() => {
    setProductList(db.getProducts());
    setMovements(db.getMovements());
    const wh = db.getWarehouses().filter(w => w.active).map(w => w.name);
    setWarehouses(wh.length > 0 ? wh : ['Armazém Principal', 'Balcão']);
    setCurrentShift(db.getCurrentShift());
  }, []);

  useEffect(() => {
    const unsub = onCacheChange(syncFromCache);
    return unsub;
  }, [syncFromCache]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterCat, setFilterCat] = useState('Todos');
  const [filterWarehouse, setFilterWarehouse] = useState('Todos');
  const [filterAlert, setFilterAlert] = useState('Todos');
  const [search, setSearch] = useState('');

  // ── Product modal ──────────────────────────────────────────────────────────
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(defaultProductForm());
  const [productFormError, setProductFormError] = useState('');

  // ── Purchase ───────────────────────────────────────────────────────────────
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>({
    productId: '', inputMode: 'box', quantity: '', unitPrice: '', totalCost: '', warehouse: 'Armazém Principal', notes: '', debitFromCash: false,
  });
  const [currentShift, setCurrentShift] = useState(() => db.getCurrentShift());
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);
  const [deleteMovementTarget, setDeleteMovementTarget] = useState<StockMovement | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────
  const alertCounts = {
    critical: productList.filter(p => getStockAlert(p) === 'critical').length,
    out: productList.filter(p => getStockAlert(p) === 'out').length,
    low: productList.filter(p => getStockAlert(p) === 'low').length,
  };

  const filtered = productList.filter(p => {
    const matchCat = filterCat === 'Todos' || p.category === filterCat;
    const matchWh = filterWarehouse === 'Todos' || p.warehouse === filterWarehouse;
    const matchAlert = filterAlert === 'Todos' || getStockAlert(p) === filterAlert;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchWh && matchAlert && matchSearch;
  });

  // ── Product form validation ────────────────────────────────────────────────
  const validateProductForm = (form: ProductForm, excludeId?: string): string => {
    if (!form.name.trim()) return 'Nome é obrigatório.';
    const duplicate = productList.find(p =>
      p.name.toLowerCase() === form.name.trim().toLowerCase() && p.id !== excludeId
    );
    if (duplicate) return `Já existe um produto com o nome "${form.name.trim()}".`;
    if (!form.price || parseFloat(form.price) <= 0) return 'Preço de venda é obrigatório.';
    if (form.structureType === 'box_no_pack' && (!form.unitsPerPack || parseInt(form.unitsPerPack) < 1))
      return 'Defina as unidades por caixa.';
    if (form.structureType === 'box_with_pack') {
      if (!form.packsPerBox || parseInt(form.packsPerBox) < 1) return 'Defina as embalagens por caixa.';
      if (!form.unitsPerPack || parseInt(form.unitsPerPack) < 1) return 'Defina as unidades por embalagem.';
    }
    return '';
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm(defaultProductForm());
    setProductFormError('');
    setShowProductModal(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name, category: p.category, price: String(p.price),
      minStock: String(p.minStock), criticalStock: String(p.criticalStock),
      unit: p.unit, warehouse: p.warehouse,
      structureType: p.structureType || 'unit',
      unitsPerPack: String(p.unitsPerPack || ''),
      packsPerBox: String(p.packsPerBox || ''),
    });
    setProductFormError('');
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    const err = validateProductForm(productForm, editingProduct?.id);
    if (err) { setProductFormError(err); return; }

    const saved: Product = {
      id: editingProduct?.id || `p${Date.now()}`,
      name: productForm.name.trim(),
      category: productForm.category,
      price: parseFloat(productForm.price),
      cost: editingProduct?.cost || 0,
      stock: editingProduct?.stock || 0,
      minStock: parseInt(productForm.minStock || '0') || 0,
      criticalStock: parseInt(productForm.criticalStock || '0') || 0,
      unit: productForm.unit,
      warehouse: productForm.warehouse,
      structureType: productForm.structureType,
      unitsPerPack: parseInt(productForm.unitsPerPack || '1') || 1,
      packsPerBox: parseInt(productForm.packsPerBox || '1') || 1,
    };

    setProductList(prev =>
      prev.some(p => p.id === saved.id) ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved]
    );
    await db.upsertProduct(saved);
    setShowProductModal(false);
  };

  // ── Purchase logic ─────────────────────────────────────────────────────────
  const selectedProduct = productList.find(p => p.id === purchaseForm.productId) || null;
  const totalUnits = calcTotalUnits(selectedProduct, purchaseForm);

  // Label for the unit price field (per box or per pack)
  const unitPriceLabel = (() => {
    if (!selectedProduct) return 'Valor por unidade';
    if (selectedProduct.structureType === 'unit') return 'Valor por unidade (MZN)';
    if (selectedProduct.structureType === 'box_no_pack') return 'Valor por caixa (MZN)';
    return purchaseForm.inputMode === 'box' ? 'Valor por caixa (MZN)' : 'Valor por embalagem (MZN)';
  })();

  // Auto-calculate totalCost from unitPrice × quantity
  const computedTotal = (() => {
    const qty = parseInt(purchaseForm.quantity || '0') || 0;
    const up = parseFloat(purchaseForm.unitPrice || '0') || 0;
    if (qty > 0 && up > 0) return (qty * up).toFixed(2);
    return purchaseForm.totalCost;
  })();

  const effectiveTotalCost = parseFloat(computedTotal || '0') || 0;
  const unitCost = totalUnits > 0 ? effectiveTotalCost / totalUnits : 0;
  const expectedRevenue = totalUnits * (selectedProduct?.price || 0);
  const expectedProfit = expectedRevenue - effectiveTotalCost;

  const isPurchaseValid = (): boolean => {
    if (!purchaseForm.productId || !purchaseForm.quantity) return false;
    const qty = parseInt(purchaseForm.quantity);
    if (isNaN(qty) || qty <= 0) return false;
    if (effectiveTotalCost <= 0) return false;
    return totalUnits > 0;
  };

  const handlePurchase = async () => {
    if (!isPurchaseValid() || !selectedProduct) return;
    const updatedProduct: Product = {
      ...selectedProduct,
      stock: selectedProduct.stock + totalUnits,
      cost: unitCost,
    };
    setProductList(prev => prev.map(p => p.id === selectedProduct.id ? updatedProduct : p));

    const inputLabel = selectedProduct.structureType === 'unit'
      ? `${purchaseForm.quantity} unidades`
      : selectedProduct.structureType === 'box_no_pack'
        ? `${purchaseForm.quantity} caixa(s) × ${selectedProduct.unitsPerPack} un`
        : purchaseForm.inputMode === 'box'
          ? `${purchaseForm.quantity} caixa(s) × ${selectedProduct.packsPerBox} emb × ${selectedProduct.unitsPerPack} un`
          : `${purchaseForm.quantity} embalagem(ns) × ${selectedProduct.unitsPerPack} un`;

    const mov: StockMovement = {
      id: `sm${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type: 'entry',
      quantity: totalUnits,
      toWarehouse: purchaseForm.warehouse,
      reason: purchaseForm.notes || `Compra: ${inputLabel} = ${totalUnits} un · Custo total: MZN ${effectiveTotalCost.toFixed(2)}`,
      operator: currentUser?.name || 'Admin',
      createdAt: new Date().toISOString(),
    };
    setMovements(prev => [mov, ...prev]);
    await db.upsertProduct(updatedProduct);
    await db.addMovement(mov);

    // Debit from cash shift if requested and shift is open
    if (purchaseForm.debitFromCash && currentShift && currentShift.status === 'open') {
      const cashMov: CashMovement = {
        id: `cm_purchase_${Date.now()}`,
        type: 'out',
        amount: effectiveTotalCost,
        description: `Compra de stock — ${selectedProduct.name} (${inputLabel})`,
        paymentMethod: 'cash',
        category: 'Compra de Stock',
        operator: currentUser?.name || 'Admin',
        shiftId: currentShift.id,
        createdAt: new Date().toISOString(),
      };
      await db.addCashMovement(cashMov);
    }

    setPurchaseSuccess(true);
    setTimeout(() => {
      setPurchaseSuccess(false);
      setPurchaseForm({ productId: '', inputMode: 'box', quantity: '', unitPrice: '', totalCost: '', warehouse: 'Armazém Principal', notes: '', debitFromCash: false });
    }, 2500);
  };

  const handleDeleteProduct = async () => {
    if (!deleteProductTarget) return;
    setProductList(prev => prev.filter(p => p.id !== deleteProductTarget.id));
    await db.deleteProduct(deleteProductTarget.id);
    setDeleteProductTarget(null);
  };

  const handleDeleteMovement = async () => {
    if (!deleteMovementTarget) return;
    setMovements(prev => prev.filter(m => m.id !== deleteMovementTarget.id));
    await db.deleteMovement(deleteMovementTarget.id);
    setDeleteMovementTarget(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Gestão de Stock"
        subtitle="Produtos, compras e movimentos"
        actions={
          <button onClick={openAddProduct}
            className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
            <i className="ri-add-line"></i> Novo Produto
          </button>
        }
      />
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Alerts */}
        {(alertCounts.out > 0 || alertCounts.critical > 0 || alertCounts.low > 0) && (
          <div className="flex flex-wrap gap-3 mb-4">
            {alertCounts.out > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-close-circle-line text-red-500 text-sm"></i></div>
                <span className="text-red-700 text-sm font-medium">{alertCounts.out} produto(s) esgotado(s)</span>
              </div>
            )}
            {alertCounts.critical > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-error-warning-line text-red-500 text-sm"></i></div>
                <span className="text-red-700 text-sm font-medium">{alertCounts.critical} stock crítico</span>
              </div>
            )}
            {alertCounts.low > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-alert-line text-amber-500 text-sm"></i></div>
                <span className="text-amber-700 text-sm font-medium">{alertCounts.low} stock baixo</span>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-full p-1 w-fit mb-5">
          {([['products', 'Produtos'], ['purchase', 'Registar Compra'], ['movements', 'Movimentos']] as [TabType, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${tab === key ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {tab === 'products' && (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto..."
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-48" />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                <option>Todos</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                <option>Todos</option>
                {warehouses.map(w => <option key={w}>{w}</option>)}
              </select>
              <select value={filterAlert} onChange={e => setFilterAlert(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                <option>Todos</option>
                <option value="out">Esgotado</option>
                <option value="critical">Crítico</option>
                <option value="low">Baixo</option>
                <option value="ok">OK</option>
              </select>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Produto', 'Categoria', 'Estrutura de Compra', 'Armazém', 'Stock', 'Mín/Crít', 'Preço Venda', 'Custo Unit.', 'Estado', ''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-10 text-gray-400 text-sm">Nenhum produto encontrado</td></tr>
                  )}
                  {filtered.map(p => {
                    const alert = getStockAlert(p);
                    const st = p.structureType || 'unit';
                    return (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-gray-900 text-sm font-medium">{p.name}</p>
                          <p className="text-gray-400 text-xs">{p.unit}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{p.category}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 flex items-center justify-center">
                              <i className={`${structureIcons[st]} text-gray-400 text-sm`}></i>
                            </div>
                            <div>
                              <p className="text-gray-700 text-xs font-medium">{structureLabels[st]}</p>
                              {st === 'box_no_pack' && <p className="text-gray-400 text-xs">{p.unitsPerPack} un/cx</p>}
                              {st === 'box_with_pack' && <p className="text-gray-400 text-xs">{p.packsPerBox} emb/cx · {p.unitsPerPack} un/emb</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm">{p.warehouse}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${alert === 'out' ? 'text-red-600' : alert === 'critical' ? 'text-red-500' : alert === 'low' ? 'text-amber-600' : 'text-gray-900'}`}>
                            {p.stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm">{p.minStock} / {p.criticalStock}</td>
                        <td className="px-4 py-3 text-gray-900 text-sm font-semibold">MZN {p.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-gray-500 text-sm">
                          {p.cost > 0 ? `MZN ${p.cost.toFixed(2)}` : <span className="text-gray-300 italic text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3"><Badge label={alertLabel[alert]} variant={alertBadge[alert]} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditProduct(p)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer rounded-md hover:bg-gray-100 transition-all">
                              <i className="ri-edit-line text-sm"></i>
                            </button>
                            {isAdmin && (
                              <button onClick={() => setDeleteProductTarget(p)} className="w-7 h-7 flex items-center justify-center text-red-300 hover:text-red-600 cursor-pointer rounded-md hover:bg-red-50 transition-all">
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
          </>
        )}

        {/* ── PURCHASE TAB ── */}
        {tab === 'purchase' && (
          <div className="max-w-2xl">
            {purchaseSuccess ? (
              <div className="bg-white rounded-xl border border-emerald-200 p-10 text-center">
                <div className="w-14 h-14 flex items-center justify-center bg-emerald-50 rounded-full mx-auto mb-4">
                  <i className="ri-check-double-line text-emerald-500 text-2xl"></i>
                </div>
                <h3 className="text-gray-900 font-bold text-lg mb-1">Compra Registada!</h3>
                <p className="text-gray-500 text-sm">Stock atualizado. Custo unitário recalculado automaticamente.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
                <div>
                  <h3 className="text-gray-900 font-semibold text-base mb-1">Registar Entrada de Stock</h3>
                  <p className="text-gray-400 text-sm">Selecione o produto — a estrutura de compra é carregada automaticamente. A venda é sempre por unidade.</p>
                </div>

                {/* Product selector */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Produto *</label>
                  <select value={purchaseForm.productId}
                    onChange={e => setPurchaseForm(f => ({ ...f, productId: e.target.value, quantity: '', unitPrice: '', totalCost: '' }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none">
                    <option value="">Selecionar produto...</option>
                    {productList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — Stock: {p.stock} {p.unit}</option>
                    ))}
                  </select>
                </div>

                {/* Product structure info */}
                {selectedProduct && (
                  <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(30,159,212,0.06)', border: '1px solid rgba(30,159,212,0.2)' }}>
                    <div className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                      <i className={`${structureIcons[selectedProduct.structureType || 'unit']} text-white text-base`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#1E9FD4' }}>
                        {structureLabels[selectedProduct.structureType || 'unit']}
                      </p>
                      <p className="text-gray-500 text-xs">{structureDesc[selectedProduct.structureType || 'unit']}</p>
                      {selectedProduct.structureType === 'box_no_pack' && (
                        <p className="text-gray-600 text-xs mt-1 font-medium">{selectedProduct.unitsPerPack} unidades por caixa</p>
                      )}
                      {selectedProduct.structureType === 'box_with_pack' && (
                        <p className="text-gray-600 text-xs mt-1 font-medium">
                          {selectedProduct.packsPerBox} embalagens/caixa · {selectedProduct.unitsPerPack} unidades/embalagem
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Input mode for box_with_pack */}
                {selectedProduct?.structureType === 'box_with_pack' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Comprar por</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['box', 'pack'] as PurchaseInputMode[]).map(mode => (
                        <button key={mode} onClick={() => setPurchaseForm(f => ({ ...f, inputMode: mode, quantity: '', unitPrice: '', totalCost: '' }))}
                          className={`py-2.5 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap transition-all border-2 flex items-center justify-center gap-2 ${purchaseForm.inputMode === mode ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                          style={purchaseForm.inputMode === mode ? { background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' } : {}}>
                          <i className={mode === 'box' ? 'ri-archive-2-line' : 'ri-stack-line'}></i>
                          {mode === 'box' ? 'Caixa' : 'Embalagem'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity + Unit Price */}
                {selectedProduct && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                          {selectedProduct.structureType === 'unit' ? 'Quantidade de Unidades *'
                            : selectedProduct.structureType === 'box_no_pack' ? 'Número de Caixas *'
                            : purchaseForm.inputMode === 'box' ? 'Número de Caixas *' : 'Número de Embalagens *'}
                        </label>
                        <input type="number" min="1" value={purchaseForm.quantity}
                          onChange={e => setPurchaseForm(f => ({ ...f, quantity: e.target.value }))}
                          placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">{unitPriceLabel} *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">MZN</span>
                          <input type="number" min="0" step="0.01" value={purchaseForm.unitPrice}
                            onChange={e => setPurchaseForm(f => ({ ...f, unitPrice: e.target.value, totalCost: '' }))}
                            placeholder="0.00" className="w-full border border-gray-200 rounded-lg pl-14 pr-3 py-2.5 text-sm focus:outline-none" />
                        </div>
                      </div>
                    </div>
                    {/* Total cost — auto-calculated or manual override */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block flex items-center gap-2">
                        Custo Total da Compra (MZN)
                        {purchaseForm.unitPrice && purchaseForm.quantity && (
                          <span className="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">calculado automaticamente</span>
                        )}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">MZN</span>
                        <input type="number" min="0" step="0.01"
                          value={purchaseForm.unitPrice && purchaseForm.quantity ? computedTotal : purchaseForm.totalCost}
                          onChange={e => setPurchaseForm(f => ({ ...f, totalCost: e.target.value, unitPrice: '' }))}
                          placeholder="0.00"
                          className={`w-full border rounded-lg pl-14 pr-3 py-2.5 text-sm focus:outline-none ${purchaseForm.unitPrice && purchaseForm.quantity ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold' : 'border-gray-200'}`} />
                      </div>
                      {selectedProduct.structureType !== 'unit' && (
                        <p className="text-gray-400 text-xs mt-1">
                          {purchaseForm.unitPrice && purchaseForm.quantity
                            ? `${purchaseForm.quantity} × MZN ${purchaseForm.unitPrice} = MZN ${computedTotal}`
                            : 'Preencha o valor por caixa/embalagem para calcular automaticamente, ou insira o total manualmente.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedProduct && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Destino (Armazém)</label>
                    <select value={purchaseForm.warehouse} onChange={e => setPurchaseForm(f => ({ ...f, warehouse: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none">
                      {warehouses.map(w => <option key={w}>{w}</option>)}
                    </select>
                  </div>
                )}

                {selectedProduct && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Notas (opcional)</label>
                    <input value={purchaseForm.notes} onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Fornecedor, referência, etc."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                  </div>
                )}

                {/* Summary */}
                {selectedProduct && totalUnits > 0 && effectiveTotalCost > 0 && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: 'linear-gradient(135deg, rgba(30,159,212,0.06), rgba(0,200,200,0.06))', border: '1px solid rgba(30,159,212,0.2)' }}>
                    <p className="text-sm font-semibold" style={{ color: '#1E9FD4' }}>Resumo da Compra</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Total de Unidades</p>
                        <p className="text-gray-900 font-bold text-lg">{totalUnits}</p>
                        <p className="text-gray-400 text-xs">{selectedProduct.unit}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Custo Unitário</p>
                        <p className="font-bold text-lg" style={{ color: '#1E9FD4' }}>MZN {unitCost.toFixed(2)}</p>
                        <p className="text-gray-400 text-xs">por unidade</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Preço de Venda</p>
                        <p className="text-emerald-600 font-bold text-lg">MZN {selectedProduct.price.toFixed(2)}</p>
                        <p className="text-gray-400 text-xs">por unidade</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Custo Total</p>
                        <p className="text-red-600 font-bold">MZN {effectiveTotalCost.toFixed(2)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-1">Receita Esperada</p>
                        <p className="text-emerald-600 font-bold">MZN {expectedRevenue.toFixed(2)}</p>
                      </div>
                      <div className={`rounded-lg p-3 ${expectedProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <p className="text-gray-400 text-xs mb-1">Lucro Esperado</p>
                        <p className={`font-bold ${expectedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          MZN {expectedProfit.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Margem por unidade</span>
                      <span className="font-bold text-emerald-600">
                        MZN {(selectedProduct.price - unitCost).toFixed(2)}
                        {selectedProduct.price > 0 ? ` (${(((selectedProduct.price - unitCost) / selectedProduct.price) * 100).toFixed(1)}%)` : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* Debit from cash option */}
                {selectedProduct && (
                  <div className={`rounded-xl p-4 border-2 transition-all cursor-pointer ${purchaseForm.debitFromCash ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}
                    onClick={() => setPurchaseForm(f => ({ ...f, debitFromCash: !f.debitFromCash }))}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 flex items-center justify-center rounded border-2 flex-shrink-0 transition-all ${purchaseForm.debitFromCash ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
                        {purchaseForm.debitFromCash && <i className="ri-check-line text-white text-xs"></i>}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-800 text-sm font-semibold">Debitar da Caixa</p>
                        <p className="text-gray-500 text-xs">
                          {currentShift && currentShift.status === 'open'
                            ? `Regista saída de MZN ${effectiveTotalCost > 0 ? effectiveTotalCost.toFixed(2) : '0.00'} no turno atual (${currentShift.openedBy})`
                            : 'Nenhum turno aberto — não é possível debitar da caixa'}
                        </p>
                      </div>
                      <div className="w-8 h-8 flex items-center justify-center">
                        <i className={`ri-safe-2-line text-lg ${purchaseForm.debitFromCash ? 'text-amber-500' : 'text-gray-300'}`}></i>
                      </div>
                    </div>
                    {purchaseForm.debitFromCash && (!currentShift || currentShift.status !== 'open') && (
                      <p className="text-red-600 text-xs mt-2 flex items-center gap-1">
                        <i className="ri-error-warning-line"></i> Abra um turno de caixa primeiro para poder debitar.
                      </p>
                    )}
                  </div>
                )}

                <button onClick={handlePurchase} disabled={!isPurchaseValid() || (purchaseForm.debitFromCash && (!currentShift || currentShift.status !== 'open'))}
                  className="w-full py-3 text-white rounded-xl font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                  {purchaseForm.debitFromCash ? `Confirmar Compra e Debitar MZN ${effectiveTotalCost.toFixed(2)} da Caixa` : 'Confirmar Entrada de Stock'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MOVEMENTS TAB ── */}
        {tab === 'movements' && (
          <>
            {isAdmin && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 w-fit">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-shield-keyhole-line text-red-500 text-sm"></i></div>
                <span className="text-red-700 text-xs font-medium">Modo Admin — pode eliminar movimentos</span>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Data/Hora', 'Produto', 'Tipo', 'Qtd', 'Detalhe', 'Operador', ...(isAdmin ? [''] : [])].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Sem movimentos registados</td></tr>
                  )}
                  {movements.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {new Date(m.createdAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-gray-900 text-sm font-medium">{m.productName}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${movTypeColor[m.type]}`}>{movTypeLabel[m.type]}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-900 text-sm font-bold">{m.quantity}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm max-w-xs truncate">
                        {m.reason || (m.fromWarehouse ? `${m.fromWarehouse} → ${m.toWarehouse}` : '—')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{m.operator}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <button onClick={() => setDeleteMovementTarget(m)}
                            className="w-7 h-7 flex items-center justify-center text-red-300 hover:text-red-600 cursor-pointer rounded-md hover:bg-red-50 transition-all">
                            <i className="ri-delete-bin-line text-sm"></i>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Product Modal (Add/Edit) ── */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-gray-900 font-semibold text-base">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
                <p className="text-gray-400 text-xs mt-0.5">
                  {editingProduct ? 'Edite as informações do produto. Para atualizar stock, use Registar Compra.' : 'Defina o produto e a sua estrutura de compra.'}
                </p>
              </div>
              <button onClick={() => setShowProductModal(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nome do Produto *</label>
                <input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Super Bock, Whisky..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
              </div>

              {/* Category + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Categoria</label>
                  <select value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none">
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Unidade de Venda</label>
                  <select value={productForm.unit} onChange={e => setProductForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none">
                    {['un', 'dose', 'L', 'ml', 'kg', 'g'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Price + Warehouse */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-emerald-600 mb-1.5 block">Preço de Venda (MZN) *</label>
                  <input type="number" min="0" step="0.01" value={productForm.price}
                    onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0.00" className="w-full border border-emerald-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Armazém</label>
                  <select value={productForm.warehouse} onChange={e => setProductForm(f => ({ ...f, warehouse: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none">
                    {warehouses.map(w => <option key={w}>{w}</option>)}
                  </select>
                </div>
              </div>

              {/* Min/Critical stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-amber-600 mb-1.5 block">Stock Mínimo</label>
                  <input type="number" min="0" value={productForm.minStock}
                    onChange={e => setProductForm(f => ({ ...f, minStock: e.target.value }))}
                    placeholder="0" className="w-full border border-amber-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-red-600 mb-1.5 block">Stock Crítico</label>
                  <input type="number" min="0" value={productForm.criticalStock}
                    onChange={e => setProductForm(f => ({ ...f, criticalStock: e.target.value }))}
                    placeholder="0" className="w-full border border-red-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                </div>
              </div>

              {/* Structure type */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Estrutura de Compra *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['unit', 'box_no_pack', 'box_with_pack'] as ProductStructureType[]).map(st => (
                    <button key={st} onClick={() => setProductForm(f => ({ ...f, structureType: st, unitsPerPack: '', packsPerBox: '' }))}
                      className={`py-3 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all border-2 flex flex-col items-center gap-1.5 ${productForm.structureType === st ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                      style={productForm.structureType === st ? { background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' } : {}}>
                      <i className={`${structureIcons[st]} text-base`}></i>
                      <span className="text-center leading-tight">{structureLabels[st]}</span>
                    </button>
                  ))}
                </div>
                <p className="text-gray-400 text-xs mt-1.5">{structureDesc[productForm.structureType]}</p>
              </div>

              {/* Structure fields */}
              {productForm.structureType === 'box_no_pack' && (
                <div>
                  <label className="text-xs font-semibold text-red-600 mb-1.5 block">Unidades por Caixa *</label>
                  <input type="number" min="1" value={productForm.unitsPerPack}
                    onChange={e => setProductForm(f => ({ ...f, unitsPerPack: e.target.value }))}
                    placeholder="Ex: 24" className="w-full border border-red-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                </div>
              )}

              {productForm.structureType === 'box_with_pack' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-red-600 mb-1.5 block">Embalagens por Caixa *</label>
                    <input type="number" min="1" value={productForm.packsPerBox}
                      onChange={e => setProductForm(f => ({ ...f, packsPerBox: e.target.value }))}
                      placeholder="Ex: 6" className="w-full border border-red-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-red-600 mb-1.5 block">Unidades por Embalagem *</label>
                    <input type="number" min="1" value={productForm.unitsPerPack}
                      onChange={e => setProductForm(f => ({ ...f, unitsPerPack: e.target.value }))}
                      placeholder="Ex: 4" className="w-full border border-red-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                  </div>
                </div>
              )}

              {editingProduct && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <p className="text-amber-700 text-xs">Para atualizar o custo unitário e o stock, use a aba <strong>Registar Compra</strong>.</p>
                </div>
              )}

              {productFormError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className="ri-error-warning-line text-red-500 text-sm"></i>
                  </div>
                  <p className="text-red-700 text-xs">{productFormError}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowProductModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                Cancelar
              </button>
              <button onClick={handleSaveProduct}
                className="flex-1 py-2.5 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                {editingProduct ? 'Guardar Alterações' : 'Criar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteProductTarget && (
        <ConfirmDeleteModal
          title={`Eliminar "${deleteProductTarget.name}"?`}
          description={`O produto e todo o seu histórico serão removidos permanentemente. Stock atual: ${deleteProductTarget.stock} ${deleteProductTarget.unit}.`}
          onConfirm={handleDeleteProduct}
          onCancel={() => setDeleteProductTarget(null)}
        />
      )}

      {deleteMovementTarget && (
        <ConfirmDeleteModal
          title="Eliminar movimento de stock?"
          description={`Vai eliminar o registo de ${movTypeLabel[deleteMovementTarget.type]} de ${deleteMovementTarget.quantity} ${deleteMovementTarget.productName}.`}
          onConfirm={handleDeleteMovement}
          onCancel={() => setDeleteMovementTarget(null)}
        />
      )}
    </div>
  );
}
