import { useState, useMemo, useEffect } from 'react';
import TopBar from '@/components/feature/TopBar';
import { db } from '@/store/db';
import { exportSales, exportDebts, exportProducts, exportClients, exportMovements } from '@/utils/exportExcel';

type ReportTab = 'sales' | 'products' | 'operators' | 'debts' | 'cashflow' | 'profit';
type PeriodType = '7d' | '30d' | '90d' | 'all';

const PERIOD_DAYS: Record<PeriodType, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 9999 };

function getDateRange(period: PeriodType) {
  const now = new Date();
  const days = PERIOD_DAYS[period];
  const from = new Date(now.getTime() - days * 86400000);
  return from;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

function groupByDay(sales: ReturnType<typeof db.getSales>, from: Date) {
  const map: Record<string, { total: number; count: number; cash: number; card: number; mobile: number; transfer: number }> = {};
  sales.forEach(s => {
    const d = new Date(s.createdAt);
    if (d < from) return;
    const key = d.toISOString().slice(0, 10);
    if (!map[key]) map[key] = { total: 0, count: 0, cash: 0, card: 0, mobile: 0, transfer: 0 };
    map[key].total += s.total;
    map[key].count += 1;
    if (s.payMethod === 'cash') map[key].cash += s.total;
    else if (s.payMethod === 'card') map[key].card += s.total;
    else if (s.payMethod === 'mobile') map[key].mobile += s.total;
    else if (s.payMethod === 'transfer') map[key].transfer += s.total;
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('sales');
  const [period, setPeriod] = useState<PeriodType>('30d');
  const [filterOperator, setFilterOperator] = useState('all');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [sales, setSales] = useState(db.getSales());
  const [debts, setDebts] = useState(db.getDebts());
  const [products, setProducts] = useState(db.getProducts());
  const [clients, setClients] = useState(db.getClients());
  const [movements, setMovements] = useState(db.getMovements());
  const [cashMovements, setCashMovements] = useState(db.getCashMovements());
  const [users] = useState(db.getUsers());

  useEffect(() => {
    setSales(db.getSales());
    setDebts(db.getDebts());
    setProducts(db.getProducts());
    setClients(db.getClients());
    setMovements(db.getMovements());
    setCashMovements(db.getCashMovements());
  }, []);

  const fromDate = getDateRange(period);

  const filteredSales = useMemo(() =>
    sales.filter(s => {
      const inPeriod = new Date(s.createdAt) >= fromDate;
      const byOp = filterOperator === 'all' || s.operator === filterOperator;
      return inPeriod && byOp && s.status === 'paid';
    }),
    [sales, period, filterOperator]
  );

  // ── KPIs ──
  const totalRevenue = filteredSales.reduce((s, sale) => s + sale.total, 0);
  const totalTransactions = filteredSales.length;
  const avgTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const totalCash = filteredSales.filter(s => s.payMethod === 'cash').reduce((s, sale) => s + sale.total, 0);
  const totalCard = filteredSales.filter(s => s.payMethod === 'card').reduce((s, sale) => s + sale.total, 0);
  const totalMobile = filteredSales.filter(s => s.payMethod === 'mobile').reduce((s, sale) => s + sale.total, 0);
  const totalTransfer = filteredSales.filter(s => s.payMethod === 'transfer').reduce((s, sale) => s + sale.total, 0);

  // ── Daily chart data ──
  const dailyData = useMemo(() => groupByDay(filteredSales, fromDate), [filteredSales, period]);
  const maxDayTotal = Math.max(...dailyData.map(([, v]) => v.total), 1);

  // ── Product stats ──
  const productStats = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        if (!map[item.id]) map[item.id] = { name: item.name, qty: 0, revenue: 0 };
        map[item.id].qty += item.qty;
        map[item.id].revenue += item.price * item.qty;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  // ── Operator stats ──
  const operatorStats = useMemo(() => {
    const map: Record<string, { name: string; sales: number; revenue: number; avgTicket: number }> = {};
    filteredSales.forEach(s => {
      const op = s.operator || 'Desconhecido';
      if (!map[op]) map[op] = { name: op, sales: 0, revenue: 0, avgTicket: 0 };
      map[op].sales += 1;
      map[op].revenue += s.total;
    });
    Object.values(map).forEach(op => { op.avgTicket = op.sales > 0 ? op.revenue / op.sales : 0; });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  // ── Debt stats ──
  const activeDebts = debts.filter(d => d.status !== 'paid');
  const totalDebt = activeDebts.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);
  const overdueDebts = activeDebts.filter(d => d.dueDate && new Date(d.dueDate) < new Date());

  // ── Cash flow ──
  const cashIn = cashMovements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const cashOut = cashMovements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const shift = db.getCurrentShift();
  const cashBalance = shift.openingBalance + cashIn - cashOut;

  const cashByCategory = useMemo(() => {
    const map: Record<string, { in: number; out: number }> = {};
    cashMovements.forEach(m => {
      if (!map[m.category]) map[m.category] = { in: 0, out: 0 };
      if (m.type === 'in') map[m.category].in += m.amount;
      else map[m.category].out += m.amount;
    });
    return Object.entries(map).sort(([, a], [, b]) => (b.in + b.out) - (a.in + a.out));
  }, [cashMovements]);

  // ── Profit / Margin stats ──
  const profitStats = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number; cost: number; profit: number; margin: number }> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const product = products.find(p => p.id === item.id);
        const unitCost = product?.cost || 0;
        if (!map[item.id]) map[item.id] = { name: item.name, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0 };
        map[item.id].qty += item.qty;
        map[item.id].revenue += item.price * item.qty;
        map[item.id].cost += unitCost * item.qty;
      });
    });
    Object.values(map).forEach(p => {
      p.profit = p.revenue - p.cost;
      p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
    });
    return Object.values(map).sort((a, b) => b.profit - a.profit);
  }, [filteredSales, products]);

  const totalCost = profitStats.reduce((s, p) => s + p.cost, 0);
  const totalProfit = profitStats.reduce((s, p) => s + p.profit, 0);
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const productsWithCost = profitStats.filter(p => p.cost > 0);
  const productsNoCost = profitStats.filter(p => p.cost === 0);

  const handleExport = (type: string) => {
    setShowExportMenu(false);
    if (type === 'sales') exportSales(sales.map(s => ({ createdAt: s.createdAt, personName: s.personName, tableName: s.tableName, total: s.total, payMethod: s.payMethod, status: s.status, operator: s.operator })));
    if (type === 'debts') exportDebts(debts);
    if (type === 'products') exportProducts(products);
    if (type === 'clients') exportClients(clients);
    if (type === 'movements') exportMovements(movements);
  };

  const tabs: { key: ReportTab; label: string; icon: string }[] = [
    { key: 'sales', label: 'Vendas', icon: 'ri-bar-chart-2-line' },
    { key: 'products', label: 'Produtos', icon: 'ri-archive-line' },
    { key: 'operators', label: 'Operadores', icon: 'ri-user-3-line' },
    { key: 'debts', label: 'Dívidas', icon: 'ri-file-warning-line' },
    { key: 'cashflow', label: 'Fluxo de Caixa', icon: 'ri-money-dollar-circle-line' },
    { key: 'profit', label: 'Lucro/Margem', icon: 'ri-funds-line' },
  ];

  const periodLabels: Record<PeriodType, string> = { '7d': '7 Dias', '30d': '30 Dias', '90d': '90 Dias', 'all': 'Tudo' };

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Relatórios"
        subtitle="Análise de desempenho e controlo financeiro em tempo real"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setShowExportMenu(v => !v)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-all"
                style={{ borderColor: '#1E9FD4', color: '#1E9FD4' }}>
                <i className="ri-download-2-line"></i> Exportar
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl z-50 w-48 overflow-hidden">
                  {[
                    { key: 'sales', label: 'Vendas', icon: 'ri-shopping-cart-line' },
                    { key: 'debts', label: 'Dívidas', icon: 'ri-money-dollar-circle-line' },
                    { key: 'products', label: 'Produtos', icon: 'ri-archive-line' },
                    { key: 'clients', label: 'Clientes', icon: 'ri-user-3-line' },
                    { key: 'movements', label: 'Movimentos Stock', icon: 'ri-arrow-up-down-line' },
                  ].map(e => (
                    <button key={e.key} onClick={() => handleExport(e.key)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-all cursor-pointer text-left text-sm text-gray-700">
                      <i className={`${e.icon} text-gray-400`}></i> {e.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['7d', '30d', '90d', 'all'] as PeriodType[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-all ${period === p ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Receita Total', value: `MT ${totalRevenue.toFixed(2)}`, sub: `${totalTransactions} transações`, icon: 'ri-money-dollar-circle-line', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Ticket Médio', value: `MT ${avgTicket.toFixed(2)}`, sub: 'por transação', icon: 'ri-price-tag-3-line', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Total em Dívida', value: `MT ${totalDebt.toFixed(2)}`, sub: `${activeDebts.length} dívidas ativas`, icon: 'ri-file-warning-line', color: 'text-red-500', bg: 'bg-red-50' },
            { label: 'Saldo de Caixa', value: `MT ${cashBalance.toFixed(2)}`, sub: `Entradas: MT ${cashIn.toFixed(0)}`, icon: 'ri-safe-2-line', color: 'text-sky-600', bg: 'bg-sky-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 flex items-center justify-center ${s.bg} rounded-xl flex-shrink-0`}>
                <i className={`${s.icon} ${s.color} text-lg`}></i>
              </div>
              <div>
                <p className="text-gray-500 text-xs">{s.label}</p>
                <p className="text-gray-900 font-bold text-base">{s.value}</p>
                <p className="text-gray-400 text-xs">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${tab === t.key ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${t.icon} text-sm`}></i>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Operador:</label>
            <select value={filterOperator} onChange={e => setFilterOperator(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none bg-white">
              <option value="all">Todos</option>
              {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
          </div>
          {filterOperator !== 'all' && (
            <button onClick={() => setFilterOperator('all')}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer border border-gray-200 rounded-lg px-3 py-1.5 bg-white whitespace-nowrap">
              <i className="ri-close-line"></i> Limpar
            </button>
          )}
          <span className="text-gray-400 text-xs ml-auto">{filteredSales.length} vendas no período</span>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: LUCRO / MARGEM */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'profit' && (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Receita Total', value: `MT ${totalRevenue.toFixed(2)}`, sub: `${filteredSales.length} vendas`, icon: 'ri-money-dollar-circle-line', color: 'text-sky-600', bg: 'bg-sky-50' },
                { label: 'Custo Total', value: `MT ${totalCost.toFixed(2)}`, sub: 'custo das unidades vendidas', icon: 'ri-shopping-bag-3-line', color: 'text-red-500', bg: 'bg-red-50' },
                { label: 'Lucro Bruto', value: `MT ${totalProfit.toFixed(2)}`, sub: totalProfit >= 0 ? 'resultado positivo' : 'resultado negativo', icon: 'ri-funds-line', color: totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: totalProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
                { label: 'Margem Geral', value: `${overallMargin.toFixed(1)}%`, sub: productsNoCost.length > 0 ? `${productsNoCost.length} prod. sem custo` : 'todos com custo', icon: 'ri-percent-line', color: overallMargin >= 30 ? 'text-emerald-600' : overallMargin >= 10 ? 'text-amber-600' : 'text-red-500', bg: overallMargin >= 30 ? 'bg-emerald-50' : overallMargin >= 10 ? 'bg-amber-50' : 'bg-red-50' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center ${s.bg} rounded-xl flex-shrink-0`}>
                    <i className={`${s.icon} ${s.color} text-lg`}></i>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">{s.label}</p>
                    <p className={`font-bold text-base ${s.color}`}>{s.value}</p>
                    <p className="text-gray-400 text-xs">{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Margin visual bar */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-gray-900 font-semibold text-sm">Distribuição Receita vs Custo vs Lucro</h3>
                <span className="text-gray-400 text-xs">Período: {period === 'all' ? 'Todo o tempo' : period}</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Receita', value: totalRevenue, color: 'bg-sky-400', pct: 100 },
                  { label: 'Custo', value: totalCost, color: 'bg-red-400', pct: totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0 },
                  { label: 'Lucro', value: totalProfit, color: 'bg-emerald-400', pct: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0 },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-700 text-sm font-medium">{row.label}</span>
                      <span className="text-gray-600 text-sm font-bold">MT {row.value.toFixed(2)} <span className="text-gray-400 font-normal text-xs">({row.pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full ${row.color} transition-all`} style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning if products without cost */}
            {productsNoCost.length > 0 && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-alert-line text-amber-500 text-base"></i>
                </div>
                <div>
                  <p className="text-amber-800 text-sm font-semibold">Produtos sem custo unitário definido</p>
                  <p className="text-amber-700 text-xs mt-0.5">
                    {productsNoCost.map(p => p.name).join(', ')} — Registe uma compra para estes produtos para calcular o custo unitário automaticamente.
                  </p>
                </div>
              </div>
            )}

            {/* Product profit table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-gray-900 font-semibold text-sm">Lucro por Produto</h3>
                <span className="text-gray-400 text-xs">{profitStats.length} produtos vendidos</span>
              </div>
              {profitStats.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Sem vendas no período selecionado</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">#</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Produto</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Qtd Vendida</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Receita</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Custo Total</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Lucro Bruto</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Margem %</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitStats.map((p, i) => {
                        const hasCost = p.cost > 0;
                        const marginColor = !hasCost ? 'text-gray-400' : p.margin >= 30 ? 'text-emerald-600' : p.margin >= 10 ? 'text-amber-600' : 'text-red-600';
                        const profitColor = p.profit > 0 ? 'text-emerald-600' : p.profit < 0 ? 'text-red-600' : 'text-gray-400';
                        return (
                          <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3">
                              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${i < 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-800 text-sm font-medium">{p.name}</td>
                            <td className="px-4 py-3 text-gray-600 text-sm">{p.qty} un</td>
                            <td className="px-4 py-3 text-right text-sky-600 font-semibold text-sm">MT {p.revenue.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-red-500 text-sm">
                              {hasCost ? `MT ${p.cost.toFixed(2)}` : <span className="text-gray-300 italic text-xs">sem custo</span>}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold text-sm ${profitColor}`}>
                              {hasCost ? `MT ${p.profit.toFixed(2)}` : <span className="text-gray-300 italic text-xs">—</span>}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold text-sm ${marginColor}`}>
                              {hasCost ? `${p.margin.toFixed(1)}%` : <span className="text-gray-300 italic text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {!hasCost ? (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Sem custo</span>
                              ) : p.margin >= 30 ? (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Boa margem</span>
                              ) : p.margin >= 10 ? (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Margem baixa</span>
                              ) : (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Margem crítica</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={3} className="px-4 py-3 text-gray-900 font-bold text-sm">TOTAL</td>
                        <td className="px-4 py-3 text-right text-sky-600 font-bold text-sm">MT {totalRevenue.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-bold text-sm">MT {totalCost.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right font-bold text-sm ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>MT {totalProfit.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right font-bold text-sm ${overallMargin >= 30 ? 'text-emerald-600' : overallMargin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>{overallMargin.toFixed(1)}%</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Top margin products */}
            {productsWithCost.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-gray-900 font-semibold text-sm mb-4">Melhores Margens</h3>
                  <div className="space-y-3">
                    {[...productsWithCost].sort((a, b) => b.margin - a.margin).slice(0, 5).map((p, i) => (
                      <div key={p.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex-shrink-0">{i + 1}</span>
                            <span className="text-gray-700 text-sm font-medium truncate max-w-[160px]">{p.name}</span>
                          </div>
                          <span className="text-emerald-600 text-sm font-bold ml-2">{p.margin.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, p.margin)}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-gray-900 font-semibold text-sm mb-4">Maior Lucro Absoluto</h3>
                  <div className="space-y-3">
                    {[...productsWithCost].sort((a, b) => b.profit - a.profit).slice(0, 5).map((p, i) => {
                      const maxProfit = productsWithCost[0]?.profit || 1;
                      return (
                        <div key={p.name}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold bg-sky-100 text-sky-700 flex-shrink-0">{i + 1}</span>
                              <span className="text-gray-700 text-sm font-medium truncate max-w-[160px]">{p.name}</span>
                            </div>
                            <span className="text-sky-600 text-sm font-bold ml-2">MT {p.profit.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${(p.profit / maxProfit) * 100}%`, background: 'linear-gradient(90deg, #1E9FD4, #00C8C8)' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: VENDAS */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'sales' && (
          <div className="space-y-5">
            {/* Daily bar chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-gray-900 font-semibold text-sm">Vendas por Dia</h3>
                <span className="text-gray-400 text-xs">MT {totalRevenue.toFixed(2)} total</span>
              </div>
              {dailyData.length === 0 ? (
                <div className="text-center py-10 text-gray-300">
                  <i className="ri-bar-chart-2-line text-4xl"></i>
                  <p className="text-sm text-gray-400 mt-2">Sem vendas no período selecionado</p>
                </div>
              ) : (
                <div className="flex items-end gap-1.5 h-48 overflow-x-auto pb-2">
                  {dailyData.map(([date, val]) => {
                    const h = (val.total / maxDayTotal) * 100;
                    return (
                      <div key={date} className="flex-shrink-0 flex flex-col items-center gap-1 group cursor-pointer" style={{ minWidth: '36px' }}>
                        <span className="text-gray-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          MT {val.total.toFixed(0)}
                        </span>
                        <div className="w-full rounded-t-md transition-all hover:opacity-80"
                          style={{ height: `${Math.max(h, 4) * 1.8}px`, background: 'linear-gradient(180deg, #1E9FD4, #00C8C8)' }}></div>
                        <span className="text-gray-400 text-xs">{formatDate(date)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment method breakdown */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Dinheiro', value: totalCash, icon: 'ri-money-dollar-circle-line', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Cartão', value: totalCard, icon: 'ri-bank-card-line', color: 'text-sky-600', bg: 'bg-sky-50' },
                { label: 'Mobile Money', value: totalMobile, icon: 'ri-smartphone-line', color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Transferência', value: totalTransfer, icon: 'ri-exchange-dollar-line', color: 'text-gray-600', bg: 'bg-gray-50' },
              ].map(m => {
                const pct = totalRevenue > 0 ? (m.value / totalRevenue * 100) : 0;
                return (
                  <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 flex items-center justify-center ${m.bg} rounded-lg flex-shrink-0`}>
                        <i className={`${m.icon} ${m.color} text-base`}></i>
                      </div>
                      <p className="text-gray-600 text-sm font-medium">{m.label}</p>
                    </div>
                    <p className="text-gray-900 font-bold text-lg">MT {m.value.toFixed(2)}</p>
                    <div className="mt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-400 text-xs">% do total</span>
                        <span className="text-gray-600 text-xs font-medium">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #1E9FD4, #00C8C8)' }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sales table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-gray-900 font-semibold text-sm">Detalhe de Vendas</h3>
                <span className="text-gray-400 text-xs">{filteredSales.length} registos</span>
              </div>
              {filteredSales.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Sem vendas no período</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        {['Data/Hora', 'Cliente', 'Mesa', 'Operador', 'Método', 'Total'].map(h => (
                          <th key={h} className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${h === 'Total' ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.slice(0, 50).map(s => (
                        <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                            {new Date(s.createdAt).toLocaleDateString('pt-PT')} {new Date(s.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-gray-800 text-sm font-medium">{s.personName || '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-sm">{s.tableName || 'Balcão'}</td>
                          <td className="px-4 py-3 text-gray-500 text-sm">{s.operator}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{s.payMethod}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-amber-600 font-bold text-sm">MT {s.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredSales.length > 50 && (
                    <p className="text-center text-gray-400 text-xs py-3">Mostrando 50 de {filteredSales.length} registos. Exporte para ver todos.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: PRODUTOS */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'products' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Top products bar chart */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-gray-900 font-semibold text-sm mb-4">Top 10 Produtos por Receita</h3>
                {productStats.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
                ) : (
                  <div className="space-y-3">
                    {productStats.slice(0, 10).map((p, i) => {
                      const maxRev = productStats[0]?.revenue || 1;
                      const pct = (p.revenue / maxRev) * 100;
                      return (
                        <div key={p.name}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                              <span className="text-gray-700 text-sm font-medium truncate max-w-[160px]">{p.name}</span>
                            </div>
                            <span className="text-gray-500 text-xs whitespace-nowrap ml-2">{p.qty} un · MT {p.revenue.toFixed(0)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: i < 3 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #1E9FD4, #00C8C8)' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top products by quantity */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-gray-900 font-semibold text-sm mb-4">Top 10 Produtos por Quantidade</h3>
                {productStats.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
                ) : (
                  <div className="space-y-3">
                    {[...productStats].sort((a, b) => b.qty - a.qty).slice(0, 10).map((p, i) => {
                      const maxQty = [...productStats].sort((a, b) => b.qty - a.qty)[0]?.qty || 1;
                      const pct = (p.qty / maxQty) * 100;
                      return (
                        <div key={p.name}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${i < 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                              <span className="text-gray-700 text-sm font-medium truncate max-w-[160px]">{p.name}</span>
                            </div>
                            <span className="text-gray-500 text-xs whitespace-nowrap ml-2">{p.qty} unidades</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all bg-emerald-400" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Full product table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-gray-900 font-semibold text-sm">Todos os Produtos Vendidos</h3>
                <span className="text-gray-400 text-xs">{productStats.length} produtos</span>
              </div>
              {productStats.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Sem dados no período</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">#</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Produto</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Qtd Vendida</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Receita</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">% do Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productStats.map((p, i) => (
                        <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-800 text-sm font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{p.qty} un</td>
                          <td className="px-4 py-3 text-right text-amber-600 text-sm font-bold">MT {p.revenue.toFixed(2)}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${totalRevenue > 0 ? (p.revenue / totalRevenue * 100) : 0}%`, background: 'linear-gradient(90deg, #1E9FD4, #00C8C8)' }}></div>
                              </div>
                              <span className="text-gray-500 text-xs w-10 text-right">{totalRevenue > 0 ? (p.revenue / totalRevenue * 100).toFixed(1) : 0}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: OPERADORES */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'operators' && (
          <div className="space-y-5">
            {/* Operator cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {operatorStats.length === 0 ? (
                <div className="col-span-3 bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">Sem dados no período</div>
              ) : operatorStats.map((op, i) => {
                const pct = totalRevenue > 0 ? (op.revenue / totalRevenue * 100) : 0;
                const user = users.find(u => u.name === op.name);
                return (
                  <div key={op.name} className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 flex items-center justify-center rounded-full text-white font-bold text-sm flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                        {user?.avatar || op.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-gray-900 font-semibold text-sm">{op.name}</p>
                        <p className="text-gray-400 text-xs capitalize">{user?.role || 'operador'}</p>
                      </div>
                      {i === 0 && (
                        <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">Top</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Vendas</span>
                        <span className="text-gray-800 font-semibold text-sm">{op.sales}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Receita</span>
                        <span className="text-amber-600 font-bold text-sm">MT {op.revenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Ticket Médio</span>
                        <span className="text-gray-700 font-semibold text-sm">MT {op.avgTicket.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-400 text-xs">% das vendas totais</span>
                        <span className="text-gray-500 text-xs">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #1E9FD4, #00C8C8)' }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Operator comparison table */}
            {operatorStats.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="text-gray-900 font-semibold text-sm">Comparação de Desempenho</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/50">
                      {['Operador', 'Perfil', 'Nº Vendas', 'Receita Total', 'Ticket Médio', '% Total'].map(h => (
                        <th key={h} className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${['Receita Total', 'Ticket Médio', '% Total', 'Nº Vendas'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {operatorStats.map((op, i) => {
                      const user = users.find(u => u.name === op.name);
                      const pct = totalRevenue > 0 ? (op.revenue / totalRevenue * 100) : 0;
                      return (
                        <tr key={op.name} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {i === 0 && <i className="ri-trophy-line text-amber-500 text-sm"></i>}
                              <span className="text-gray-800 text-sm font-medium">{op.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm capitalize">{user?.role || '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-700 text-sm font-semibold">{op.sales}</td>
                          <td className="px-4 py-3 text-right text-amber-600 text-sm font-bold">MT {op.revenue.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-gray-700 text-sm">MT {op.avgTicket.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-gray-500 text-sm">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: DÍVIDAS */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'debts' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total em Dívida', value: `MT ${totalDebt.toFixed(2)}`, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
                { label: 'Dívidas Ativas', value: String(activeDebts.length), color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                { label: 'Vencidas', value: String(overdueDebts.length), color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
                { label: 'Total Recebido', value: `MT ${debts.reduce((s, d) => s + d.paidAmount, 0).toFixed(2)}`, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-500 text-sm mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Debt by status donut-like bars */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-gray-900 font-semibold text-sm mb-4">Distribuição por Estado</h3>
              <div className="space-y-3">
                {[
                  { label: 'Não Pago', count: debts.filter(d => d.status === 'unpaid').length, color: 'bg-red-500', textColor: 'text-red-600' },
                  { label: 'Pagamento Parcial', count: debts.filter(d => d.status === 'partial').length, color: 'bg-amber-500', textColor: 'text-amber-600' },
                  { label: 'Pago', count: debts.filter(d => d.status === 'paid').length, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
                ].map(s => {
                  const pct = debts.length > 0 ? (s.count / debts.length * 100) : 0;
                  return (
                    <div key={s.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-700 text-sm font-medium">{s.label}</span>
                        <span className={`text-sm font-bold ${s.textColor}`}>{s.count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full ${s.color}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Debts table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-gray-900 font-semibold text-sm">Dívidas Ativas</h3>
                <button onClick={() => exportDebts(activeDebts)}
                  className="text-xs cursor-pointer whitespace-nowrap hover:underline" style={{ color: '#1E9FD4' }}>
                  Exportar Excel
                </button>
              </div>
              {activeDebts.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-10 h-10 flex items-center justify-center bg-emerald-50 rounded-full mx-auto mb-2">
                    <i className="ri-check-double-line text-emerald-500 text-lg"></i>
                  </div>
                  <p className="text-gray-400 text-sm">Sem dívidas ativas</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        {['Cliente', 'Mesa', 'Data', 'Vencimento', 'Estado', 'Total', 'Pago', 'Restante'].map(h => (
                          <th key={h} className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${['Total', 'Pago', 'Restante'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeDebts.map(d => {
                        const remaining = d.totalAmount - d.paidAmount;
                        const isOverdue = d.dueDate && new Date(d.dueDate) < new Date();
                        return (
                          <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-gray-800 text-sm font-medium">{d.clientName}</td>
                            <td className="px-4 py-3 text-gray-500 text-sm">{d.tableName || '—'}</td>
                            <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString('pt-PT')}</td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              {d.dueDate ? (
                                <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                                  {isOverdue && <i className="ri-alarm-warning-line mr-1"></i>}
                                  {new Date(d.dueDate).toLocaleDateString('pt-PT')}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.status === 'unpaid' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                {d.status === 'unpaid' ? 'Não Pago' : 'Parcial'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900 font-bold text-sm">MT {d.totalAmount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-semibold text-sm">MT {d.paidAmount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-red-600 font-bold text-sm">MT {remaining.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: FLUXO DE CAIXA */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'cashflow' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Entradas', value: `MT ${cashIn.toFixed(2)}`, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                { label: 'Total Saídas', value: `MT ${cashOut.toFixed(2)}`, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
                { label: 'Saldo Atual', value: `MT ${cashBalance.toFixed(2)}`, color: 'text-gray-900', bg: 'bg-gray-50', border: 'border-gray-100' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-500 text-sm mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* By category */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-gray-900 font-semibold text-sm mb-4">Movimentos por Categoria</h3>
              <div className="space-y-3">
                {cashByCategory.map(([cat, vals]) => (
                  <div key={cat} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-700 text-sm font-medium">{cat}</span>
                    <div className="flex items-center gap-4">
                      {vals.in > 0 && <span className="text-emerald-600 text-sm font-semibold">+MT {vals.in.toFixed(2)}</span>}
                      {vals.out > 0 && <span className="text-red-600 text-sm font-semibold">-MT {vals.out.toFixed(2)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cash movements table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-gray-900 font-semibold text-sm">Todos os Movimentos</h3>
                <span className="text-gray-400 text-xs">{cashMovements.length} registos</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/50">
                      {['Hora', 'Descrição', 'Categoria', 'Método', 'Operador', 'Valor'].map(h => (
                        <th key={h} className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${h === 'Valor' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cashMovements.map(m => (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-gray-800 text-sm max-w-xs truncate">{m.description}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.category}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm capitalize">{m.paymentMethod}</td>
                        <td className="px-4 py-3 text-gray-500 text-sm">{m.operator}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold text-sm ${m.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {m.type === 'in' ? '+' : '-'}MT {m.amount.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td colSpan={5} className="px-4 py-3 text-gray-900 font-bold text-sm">SALDO LÍQUIDO</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold text-sm ${cashBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          MT {cashBalance.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
