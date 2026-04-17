import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/feature/TopBar';
import { db } from '@/store/db';
import { onCacheChange } from '@/store/db';
import { getStockAlert } from '@/mocks/products';
import { useAuth } from '@/store/AuthContext';
import { useNavigate } from 'react-router-dom';

interface DashStats {
  salesToday: number;
  salesCount: number;
  salesYesterday: number;
  tablesOccupied: number;
  tablesTotal: number;
  debtTotal: number;
  debtCount: number;
  cashBalance: number;
  cashIn: number;
  cashOut: number;
  stockAlerts: number;
  pendingOrders: number;
  pendingDebt: number;
}

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashStats | null>(null);
  const [recentDebts, setRecentDebts] = useState<ReturnType<typeof db.getDebts>>([]);
  const [recentSales, setRecentSales] = useState<ReturnType<typeof db.getSales>>([]);
  const [alertProducts, setAlertProducts] = useState<ReturnType<typeof db.getProducts>>([]);
  const [tables, setTables] = useState<ReturnType<typeof db.getTables>>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = useCallback(() => {
    const sales = db.getSales();
    const debts = db.getDebts();
    const products = db.getProducts();
    const tbls = db.getTables();
    const cashMovements = db.getCashMovements();
    const shift = db.getCurrentShift();
    const pendingOrders = db.getPendingOrders();

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const todaySales = sales.filter(s => new Date(s.createdAt).toDateString() === today && s.status === 'paid');
    const yesterdaySales = sales.filter(s => new Date(s.createdAt).toDateString() === yesterday && s.status === 'paid');

    const salesToday = todaySales.reduce((s, sale) => s + sale.total, 0);
    const salesYesterday = yesterdaySales.reduce((s, sale) => s + sale.total, 0);

    const totalIn = cashMovements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
    const totalOut = cashMovements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
    const cashBalance = shift.openingBalance + totalIn - totalOut;

    const activeDebts = debts.filter(d => d.status !== 'paid');
    const debtTotal = activeDebts.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);

    const pendingDebt = pendingOrders.reduce((s, o) => s + (o.total - o.paid), 0);

    const alerts = products.filter(p => getStockAlert(p) !== 'ok');

    setStats({
      salesToday,
      salesCount: todaySales.length,
      salesYesterday,
      tablesOccupied: tbls.filter(t => t.status === 'occupied').length,
      tablesTotal: tbls.length,
      debtTotal,
      debtCount: activeDebts.length,
      cashBalance,
      cashIn: totalIn,
      cashOut: totalOut,
      stockAlerts: alerts.length,
      pendingOrders: pendingOrders.length,
      pendingDebt,
    });

    setRecentDebts(debts.filter(d => d.status !== 'paid').slice(0, 5));
    setRecentSales(sales.filter(s => s.status === 'paid').slice(0, 6));
    setAlertProducts(alerts.slice(0, 5));
    setTables(tbls);
    setLastRefresh(new Date());
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await db.reload();
    loadData();
    setTimeout(() => setIsSyncing(false), 800);
  };

  useEffect(() => {
    loadData();
    // Auto-refresh from cache changes (realtime)
    const unsub = onCacheChange(loadData);
    // Also poll every 30s as fallback
    const interval = setInterval(loadData, 30000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [loadData]);

  if (!stats) return null;

  const trendPct = stats.salesYesterday > 0
    ? (((stats.salesToday - stats.salesYesterday) / stats.salesYesterday) * 100).toFixed(1)
    : '0.0';
  const trendPositive = parseFloat(trendPct) >= 0;

  const statusColor = (s: string) =>
    s === 'occupied' ? 'bg-red-100 text-red-700' : s === 'reserved' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  const statusLabel = (s: string) =>
    s === 'occupied' ? 'Ocupada' : s === 'reserved' ? 'Reservada' : 'Livre';

  const alertColor: Record<string, string> = {
    low: 'text-amber-600 bg-amber-50',
    critical: 'text-red-600 bg-red-50',
    out: 'text-red-700 bg-red-100',
  };
  const alertLabel: Record<string, string> = { low: 'Baixo', critical: 'Crítico', out: 'Esgotado' };

  const payLabel: Record<string, string> = {
    cash: 'Dinheiro', card: 'Cartão', mobile: 'Mobile', transfer: 'Transfer.', partial: 'Parcial',
  };

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Dashboard"
        subtitle={`Bem-vindo, ${currentUser?.name || 'Operador'} — ${new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}`}
        actions={
          <button onClick={handleManualSync}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-xs border border-gray-200 rounded-lg px-3 py-1.5 cursor-pointer whitespace-nowrap transition-all hover:bg-gray-50">
            <i className={`ri-refresh-line ${isSyncing ? 'animate-spin' : ''}`}></i>
            {isSyncing ? 'A sincronizar...' : `Sincronizar · ${lastRefresh.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`}
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Sales Today */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 flex items-center justify-center bg-amber-50 rounded-xl">
                <i className="ri-money-dollar-circle-line text-amber-600 text-lg"></i>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${trendPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {trendPositive ? <i className="ri-arrow-up-line text-xs"></i> : <i className="ri-arrow-down-line text-xs"></i>}
                {Math.abs(parseFloat(trendPct))}%
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">MT {stats.salesToday.toFixed(2)}</p>
            <p className="text-gray-400 text-xs mt-0.5">Vendas Hoje · {stats.salesCount} transações</p>
          </div>

          {/* Tables */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 flex items-center justify-center bg-emerald-50 rounded-xl">
                <i className="ri-restaurant-line text-emerald-600 text-lg"></i>
              </div>
              <span className="text-xs text-gray-400">{stats.tablesTotal} total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.tablesOccupied}</p>
            <p className="text-gray-400 text-xs mt-0.5">Mesas Ocupadas</p>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${stats.tablesTotal > 0 ? (stats.tablesOccupied / stats.tablesTotal) * 100 : 0}%` }}></div>
            </div>
          </div>

          {/* Debts */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 flex items-center justify-center bg-red-50 rounded-xl">
                <i className="ri-file-warning-line text-red-500 text-lg"></i>
              </div>
              <span className="text-xs text-gray-400">{stats.debtCount} dívidas</span>
            </div>
            <p className="text-2xl font-bold text-red-600">MT {stats.debtTotal.toFixed(2)}</p>
            <p className="text-gray-400 text-xs mt-0.5">Total em Dívida</p>
          </div>

          {/* Cash Balance */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 flex items-center justify-center bg-sky-50 rounded-xl">
                <i className="ri-safe-2-line text-sky-600 text-lg"></i>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-emerald-600 font-medium">+MT {stats.cashIn.toFixed(0)}</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">MT {stats.cashBalance.toFixed(2)}</p>
            <p className="text-gray-400 text-xs mt-0.5">Saldo de Caixa</p>
          </div>
        </div>

        {/* ── Second row: Tables grid + Recent Sales ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Tables overview */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold text-sm">Estado das Mesas</h3>
              <button onClick={() => navigate('/tables')}
                className="text-xs cursor-pointer whitespace-nowrap hover:underline" style={{ color: '#1E9FD4' }}>
                Ver todas
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Ocupadas', value: tables.filter(t => t.status === 'occupied').length, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Livres', value: tables.filter(t => t.status === 'free').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Reservadas', value: tables.filter(t => t.status === 'reserved').length, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-2 text-center`}>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-500 text-xs">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {tables.map(t => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                    <span className="text-gray-700 text-sm font-medium">{t.name}</span>
                  </div>
                  {t.orders.length > 0 && (
                    <span className="text-gray-900 text-xs font-bold">
                      MT {t.orders.reduce((s, o) => s + o.total, 0).toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Sales */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold text-sm">Vendas Recentes</h3>
              <button onClick={() => navigate('/pos')}
                className="text-xs cursor-pointer whitespace-nowrap hover:underline" style={{ color: '#1E9FD4' }}>
                Ver histórico
              </button>
            </div>
            {recentSales.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Sem vendas registadas hoje</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2">Hora</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2">Cliente</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2">Mesa</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2">Método</th>
                      <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2.5 text-gray-500 text-sm">
                          {new Date(s.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 text-gray-800 text-sm font-medium">{s.personName || '—'}</td>
                        <td className="py-2.5 text-gray-500 text-sm">{s.tableName || 'Balcão'}</td>
                        <td className="py-2.5">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {payLabel[s.payMethod] || s.payMethod}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-gray-900 font-bold text-sm">MT {s.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Third row: Debts + Stock Alerts + Cash Summary ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Active Debts */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold text-sm">Dívidas Ativas</h3>
              <button onClick={() => navigate('/debts')}
                className="text-xs cursor-pointer whitespace-nowrap hover:underline" style={{ color: '#1E9FD4' }}>
                Gerir dívidas
              </button>
            </div>
            {recentDebts.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-10 h-10 flex items-center justify-center bg-emerald-50 rounded-full mx-auto mb-2">
                  <i className="ri-check-double-line text-emerald-500 text-lg"></i>
                </div>
                <p className="text-gray-400 text-sm">Sem dívidas ativas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentDebts.map(d => {
                  const remaining = d.totalAmount - d.paidAmount;
                  const isOverdue = d.dueDate && new Date(d.dueDate) < new Date();
                  return (
                    <div key={d.id} className={`flex items-center justify-between py-2 border-b border-gray-50 ${isOverdue ? 'bg-red-50/50 -mx-1 px-1 rounded' : ''}`}>
                      <div>
                        <p className="text-gray-800 text-sm font-medium">{d.clientName}</p>
                        <p className="text-gray-400 text-xs">
                          {d.tableName || '—'}
                          {isOverdue && <span className="text-red-500 ml-1"><i className="ri-alarm-warning-line"></i> Vencida</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-red-600 font-bold text-sm">MT {remaining.toFixed(2)}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${d.status === 'unpaid' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                          {d.status === 'unpaid' ? 'Não Pago' : 'Parcial'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 flex justify-between">
                  <span className="text-gray-500 text-xs font-medium">Total em dívida</span>
                  <span className="text-red-600 font-bold text-sm">MT {stats.debtTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Stock Alerts */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold text-sm">Alertas de Stock</h3>
              <button onClick={() => navigate('/stock')}
                className="text-xs cursor-pointer whitespace-nowrap hover:underline" style={{ color: '#1E9FD4' }}>
                Ver stock
              </button>
            </div>
            {alertProducts.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-10 h-10 flex items-center justify-center bg-emerald-50 rounded-full mx-auto mb-2">
                  <i className="ri-checkbox-circle-line text-emerald-500 text-lg"></i>
                </div>
                <p className="text-gray-400 text-sm">Stock em bom estado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alertProducts.map(p => {
                  const level = getStockAlert(p);
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                      <div>
                        <p className="text-gray-800 text-sm font-medium">{p.name}</p>
                        <p className="text-gray-400 text-xs">{p.stock} {p.unit} restantes</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${alertColor[level]}`}>
                        {alertLabel[level]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cash Summary */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold text-sm">Resumo de Caixa</h3>
              <button onClick={() => navigate('/cash')}
                className="text-xs cursor-pointer whitespace-nowrap hover:underline" style={{ color: '#1E9FD4' }}>
                Ver caixa
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Saldo Atual', value: stats.cashBalance, color: 'text-gray-900', bg: 'bg-gray-50', bold: true },
                { label: 'Total Entradas', value: stats.cashIn, color: 'text-emerald-600', bg: 'bg-emerald-50', bold: false },
                { label: 'Total Saídas', value: stats.cashOut, color: 'text-red-600', bg: 'bg-red-50', bold: false },
                { label: 'Contas Pendentes', value: stats.pendingDebt, color: 'text-amber-600', bg: 'bg-amber-50', bold: false },
              ].map(row => (
                <div key={row.label} className={`${row.bg} rounded-xl px-3 py-2.5 flex items-center justify-between`}>
                  <span className="text-gray-600 text-sm">{row.label}</span>
                  <span className={`font-bold text-sm ${row.color}`}>MT {row.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-time-line"></i>
                </div>
                Atualizado às {lastRefresh.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Pending orders warning ── */}
        {stats.pendingOrders > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center bg-amber-100 rounded-xl flex-shrink-0">
                <i className="ri-alert-line text-amber-600 text-lg"></i>
              </div>
              <div>
                <p className="text-amber-800 font-semibold text-sm">
                  {stats.pendingOrders} conta(s) pendente(s) nas mesas
                </p>
                <p className="text-amber-600 text-xs">Total em dívida: MT {stats.pendingDebt.toFixed(2)}</p>
              </div>
            </div>
            <button onClick={() => navigate('/tables')}
              className="text-xs text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 cursor-pointer whitespace-nowrap hover:bg-amber-100 transition-all">
              Ver Mesas
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
