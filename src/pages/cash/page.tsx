import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/feature/TopBar';
import { db, CashShift, CashMovement, DailyClosureRecord, SaleRecord, onCacheChange } from '@/store/db';
import Badge from '@/components/base/Badge';
import { useAuth } from '@/store/AuthContext';
import { exportShiftReportCSV, exportShiftReportPDF } from '@/utils/exportExcel';

type TabType = 'current' | 'open' | 'close' | 'daily' | 'history' | 'shift_report';

const DENOMINATIONS = [
  { value: 1000, label: '1000 MT' }, { value: 500, label: '500 MT' },
  { value: 200, label: '200 MT' }, { value: 100, label: '100 MT' },
  { value: 50, label: '50 MT' }, { value: 20, label: '20 MT' },
  { value: 10, label: '10 MT' }, { value: 5, label: '5 MT' },
  { value: 2, label: '2 MT' }, { value: 1, label: '1 MT' },
  { value: 0.5, label: '50 Ctvs' },
];

interface NoteCount { denomination: number; count: string; }

const payLabel = (m: string) =>
  ({ cash: 'Dinheiro', card: 'Cartão', mobile: 'Mobile Money', transfer: 'Transferência' }[m] || m);

export default function CashPage() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<TabType>('current');

  const [movements, setMovements] = useState<CashMovement[]>(() => db.getCashMovements());
  const [sales, setSales] = useState<SaleRecord[]>(() => db.getSales());
  const [allShifts, setAllShifts] = useState<CashShift[]>(() => {
    const cur = db.getCurrentShift();
    const prev = db.getPreviousShifts() as CashShift[];
    const curIsDefault = cur.id === 'shift1' && cur.openingBalance === 0 && cur.status === 'open';
    return curIsDefault && prev.length === 0 ? [] : [cur, ...prev].filter(s => s.id !== 'shift1' || !curIsDefault);
  });
  const [currentShift, setCurrentShiftState] = useState<CashShift | null>(() => {
    const s = db.getCurrentShift();
    return s.status === 'open' ? s : null;
  });
  const [dailyClosures, setDailyClosures] = useState<DailyClosureRecord[]>(() => db.getDailyClosures());
  const [pendingOrders, setPendingOrders] = useState(() => db.getPendingOrders());

  // Shift report state
  const [reportShiftId, setReportShiftId] = useState<string>('');

  const syncFromCache = useCallback(() => {
    setMovements(db.getCashMovements());
    setSales(db.getSales());
    const cur = db.getCurrentShift();
    const prev = db.getPreviousShifts() as CashShift[];
    setCurrentShiftState(cur.status === 'open' ? cur : null);
    setAllShifts([cur, ...prev].filter(s => s.status !== undefined));
    setDailyClosures(db.getDailyClosures());
    setPendingOrders(db.getPendingOrders());
  }, []);

  useEffect(() => {
    const unsub = onCacheChange(syncFromCache);
    return unsub;
  }, [syncFromCache]);

  // ── Open shift form ────────────────────────────────────────────────────────
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');
  const [openShiftLoading, setOpenShiftLoading] = useState(false);

  // ── Movement modal ─────────────────────────────────────────────────────────
  const [showMovModal, setShowMovModal] = useState(false);
  const [movForm, setMovForm] = useState({
    type: 'in' as 'in' | 'out', amount: '', description: '',
    paymentMethod: 'cash' as CashMovement['paymentMethod'], category: 'Venda',
  });

  // ── Close shift ────────────────────────────────────────────────────────────
  const [closeStep, setCloseStep] = useState<'summary' | 'notes' | 'confirm'>('summary');
  const [noteCounts, setNoteCounts] = useState<NoteCount[]>(DENOMINATIONS.map(d => ({ denomination: d.value, count: '' })));
  const [closeNotes, setCloseNotes] = useState('');
  const [shiftClosed, setShiftClosed] = useState(false);

  // ── Daily closure ──────────────────────────────────────────────────────────
  const [dailyNotes, setDailyNotes] = useState('');
  const [dailyDoneId, setDailyDoneId] = useState('');

  // ── Computed for current shift ─────────────────────────────────────────────
  const shiftMovements = currentShift
    ? movements.filter(m => m.shiftId === currentShift.id)
    : [];

  const totalIn = shiftMovements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const totalOut = shiftMovements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const balance = (currentShift?.openingBalance || 0) + totalIn - totalOut;

  const cashIn = shiftMovements.filter(m => m.type === 'in' && m.paymentMethod === 'cash').reduce((s, m) => s + m.amount, 0);
  const cardIn = shiftMovements.filter(m => m.type === 'in' && m.paymentMethod === 'card').reduce((s, m) => s + m.amount, 0);
  const mobileIn = shiftMovements.filter(m => m.type === 'in' && m.paymentMethod === 'mobile').reduce((s, m) => s + m.amount, 0);
  const transferIn = shiftMovements.filter(m => m.type === 'in' && m.paymentMethod === 'transfer').reduce((s, m) => s + m.amount, 0);

  const totalPendingDebt = pendingOrders.reduce((s, o) => s + (o.total - o.paid), 0);

  const noteTotal = noteCounts.reduce((sum, nc) => sum + nc.denomination * (parseFloat(nc.count) || 0), 0);
  const difference = noteTotal - balance;

  // ── Daily closure computed ─────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const todayShifts = allShifts.filter(s => s.openedAt.slice(0, 10) === today);
  const openTodayShifts = todayShifts.filter(s => s.status === 'open');
  const closedTodayShifts = todayShifts.filter(s => s.status === 'closed');
  const alreadyClosedToday = dailyClosures.some(dc => dc.date === today);
  const canCloseDay = closedTodayShifts.length > 0 && openTodayShifts.length === 0 && !alreadyClosedToday;

  const dailyTotalSales = closedTodayShifts.reduce((s, sh) => s + (sh.expectedBalance || 0) - sh.openingBalance, 0);
  const dailyTotalExpected = closedTodayShifts.reduce((s, sh) => s + (sh.expectedBalance || 0), 0);
  const dailyTotalCounted = closedTodayShifts.reduce((s, sh) => s + (sh.countedBalance || 0), 0);
  const dailyTotalDiff = dailyTotalCounted - dailyTotalExpected;

  // ── Shift report computed ──────────────────────────────────────────────────
  const reportShift = allShifts.find(s => s.id === reportShiftId) || null;
  const reportMovements = reportShiftId ? movements.filter(m => m.shiftId === reportShiftId) : [];
  const reportSales = reportShiftId ? sales.filter(s => s.shiftId === reportShiftId && s.status === 'paid') : [];
  const reportTotalIn = reportMovements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const reportTotalOut = reportMovements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const reportSalesTotal = reportSales.reduce((s, sale) => s + sale.total, 0);
  const reportBalance = (reportShift?.openingBalance || 0) + reportTotalIn - reportTotalOut;
  const reportCashIn = reportMovements.filter(m => m.type === 'in' && m.paymentMethod === 'cash').reduce((s, m) => s + m.amount, 0);
  const reportCardIn = reportMovements.filter(m => m.type === 'in' && m.paymentMethod === 'card').reduce((s, m) => s + m.amount, 0);
  const reportMobileIn = reportMovements.filter(m => m.type === 'in' && m.paymentMethod === 'mobile').reduce((s, m) => s + m.amount, 0);
  const reportTransferIn = reportMovements.filter(m => m.type === 'in' && m.paymentMethod === 'transfer').reduce((s, m) => s + m.amount, 0);
  const reportOutExpenses = reportMovements.filter(m => m.type === 'out' && m.category !== 'Venda').reduce((s, m) => s + m.amount, 0);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOpenShift = async () => {
    if (currentShift) return;
    setOpenShiftLoading(true);
    const newShift: CashShift = {
      id: `shift_${Date.now()}`,
      openedBy: currentUser?.name || 'Operador',
      openedAt: new Date().toISOString(),
      openingBalance: parseFloat(openingBalance || '0') || 0,
      status: 'open',
    };
    await db.setCurrentShift(newShift);
    setCurrentShiftState(newShift);
    setAllShifts(prev => [newShift, ...prev]);
    setOpeningBalance('');
    setOpeningNotes('');
    setOpenShiftLoading(false);
    setTab('current');
  };

  const handleAddMovement = async () => {
    if (!movForm.amount || !movForm.description || !currentShift) return;
    const amount = parseFloat(movForm.amount);
    // For 'out' movements, check if there's enough balance
    if (movForm.type === 'out' && amount > balance) {
      // Allow but warn — we still register it
    }
    const mv: CashMovement = {
      id: `cm${Date.now()}`,
      type: movForm.type,
      amount,
      description: movForm.description,
      paymentMethod: movForm.paymentMethod,
      category: movForm.category,
      createdAt: new Date().toISOString(),
      operator: currentUser?.name || 'Operador',
      shiftId: currentShift.id,
    };
    setMovements(prev => [mv, ...prev]);
    await db.addCashMovement(mv);
    setShowMovModal(false);
    setMovForm({ type: 'in', amount: '', description: '', paymentMethod: 'cash', category: 'Venda' });
  };

  const buildReportData = () => ({
    shift: {
      openedBy: currentShift?.openedBy || '',
      openedAt: currentShift?.openedAt || '',
      closedBy: currentUser?.name || 'Operador',
      closedAt: new Date().toISOString(),
      openingBalance: currentShift?.openingBalance || 0,
      expectedBalance: balance,
      countedBalance: noteTotal,
      difference,
      unpaidOrdersCount: pendingOrders.length,
      unpaidOrdersTotal: totalPendingDebt,
    },
    movements: shiftMovements,
    noteCounts: noteCounts.filter(nc => parseFloat(nc.count) > 0).map(nc => {
      const d = DENOMINATIONS.find(d => d.value === nc.denomination);
      return { denomination: nc.denomination, count: parseFloat(nc.count) || 0, label: d?.label || String(nc.denomination) };
    }),
    notes: closeNotes,
    totalIn, totalOut, cashIn, cardIn, mobileIn, transferIn,
  });

  const handleCloseShift = async () => {
    if (!currentShift) return;
    const closedShift: CashShift = {
      ...currentShift,
      closedAt: new Date().toISOString(),
      closedBy: currentUser?.name || 'Operador',
      expectedBalance: balance,
      countedBalance: noteTotal,
      difference,
      unpaidOrdersCount: pendingOrders.length,
      unpaidOrdersTotal: totalPendingDebt,
      status: 'closed',
    };
    await db.setCurrentShift(closedShift);
    const prev = db.getPreviousShifts() as CashShift[];
    await db.setPreviousShifts([closedShift, ...prev]);
    setCurrentShiftState(null);
    setAllShifts(prev2 => prev2.map(s => s.id === closedShift.id ? closedShift : s));
    setShiftClosed(true);
  };

  const handleDailyClosure = async () => {
    const dc: DailyClosureRecord = {
      id: `dc_${Date.now()}`,
      date: today,
      closedBy: currentUser?.name || 'Admin',
      closedAt: new Date().toISOString(),
      totalSales: dailyTotalSales,
      totalCash: closedTodayShifts.reduce((s, sh) => {
        const shMov = movements.filter(m => m.shiftId === sh.id && m.type === 'in' && m.paymentMethod === 'cash');
        return s + shMov.reduce((a, m) => a + m.amount, 0);
      }, 0),
      totalCard: closedTodayShifts.reduce((s, sh) => {
        const shMov = movements.filter(m => m.shiftId === sh.id && m.type === 'in' && m.paymentMethod === 'card');
        return s + shMov.reduce((a, m) => a + m.amount, 0);
      }, 0),
      totalMobile: closedTodayShifts.reduce((s, sh) => {
        const shMov = movements.filter(m => m.shiftId === sh.id && m.type === 'in' && m.paymentMethod === 'mobile');
        return s + shMov.reduce((a, m) => a + m.amount, 0);
      }, 0),
      totalTransfer: closedTodayShifts.reduce((s, sh) => {
        const shMov = movements.filter(m => m.shiftId === sh.id && m.type === 'in' && m.paymentMethod === 'transfer');
        return s + shMov.reduce((a, m) => a + m.amount, 0);
      }, 0),
      totalExpected: dailyTotalExpected,
      totalCounted: dailyTotalCounted,
      totalDifference: dailyTotalDiff,
      shiftCount: closedTodayShifts.length,
      operators: [...new Set(closedTodayShifts.map(s => s.openedBy))],
      shiftIds: closedTodayShifts.map(s => s.id),
      notes: dailyNotes,
      createdAt: new Date().toISOString(),
    };
    await db.upsertDailyClosure(dc);
    setDailyClosures(prev => [dc, ...prev]);
    setDailyDoneId(dc.id);
  };

  const updateNoteCount = (denomination: number, value: string) => {
    setNoteCounts(prev => prev.map(nc => nc.denomination === denomination ? { ...nc, count: value } : nc));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'current', label: 'Turno Atual', icon: 'ri-safe-2-line' },
    { key: 'shift_report', label: 'Relatório de Turno', icon: 'ri-bar-chart-2-line' },
    { key: 'open', label: 'Abrir Caixa', icon: 'ri-lock-unlock-line' },
    { key: 'close', label: 'Fechar Caixa', icon: 'ri-lock-line' },
    { key: 'daily', label: 'Fecho do Dia', icon: 'ri-calendar-check-line' },
    { key: 'history', label: 'Histórico', icon: 'ri-history-line' },
  ];

  return (
    <div className="flex flex-col flex-1">
      <TopBar
        title="Caixa & Turnos"
        subtitle={currentShift
          ? `Turno aberto às ${new Date(currentShift.openedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} por ${currentShift.openedBy}`
          : 'Nenhum turno aberto'}
        actions={
          currentShift ? (
            <button onClick={() => setShowMovModal(true)}
              className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
              <i className="ri-add-line"></i> Novo Movimento
            </button>
          ) : undefined
        }
      />
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-full p-1 w-fit mb-5 flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${tab === t.key ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${t.icon} text-sm`}></i>
              {t.label}
              {t.key === 'daily' && canCloseDay && (
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
              )}
            </button>
          ))}
        </div>

        {/* ── CURRENT SHIFT TAB ── */}
        {tab === 'current' && (
          <>
            {!currentShift ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <div className="w-16 h-16 flex items-center justify-center bg-gray-50 rounded-full mx-auto mb-4">
                  <i className="ri-lock-line text-gray-400 text-3xl"></i>
                </div>
                <h3 className="text-gray-700 font-semibold text-lg mb-2">Nenhum turno aberto</h3>
                <p className="text-gray-400 text-sm mb-4">Abra um turno de caixa para começar a registar movimentos.</p>
                <button onClick={() => setTab('open')}
                  className="inline-flex items-center gap-2 text-white text-sm font-medium px-5 py-2.5 rounded-xl cursor-pointer whitespace-nowrap hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                  <i className="ri-lock-unlock-line"></i> Abrir Caixa
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                  {[
                    { label: 'Saldo Atual', value: `MT ${balance.toFixed(2)}`, icon: 'ri-safe-2-line', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', color: 'text-gray-900' },
                    { label: 'Total Entradas', value: `MT ${totalIn.toFixed(2)}`, icon: 'ri-arrow-down-line', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', color: 'text-emerald-700' },
                    { label: 'Total Saídas', value: `MT ${totalOut.toFixed(2)}`, icon: 'ri-arrow-up-line', iconBg: 'bg-red-50', iconColor: 'text-red-500', color: 'text-red-700' },
                    { label: 'Contas Pendentes', value: `MT ${totalPendingDebt.toFixed(2)}`, icon: 'ri-time-line', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', color: 'text-amber-700' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 flex items-center justify-center ${s.iconBg} rounded-xl flex-shrink-0`}>
                        <i className={`${s.icon} ${s.iconColor} text-lg`}></i>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">{s.label}</p>
                        <p className={`font-bold text-lg ${s.color}`}>{s.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Dinheiro', value: cashIn, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                    { label: 'Cartão', value: cardIn, color: 'text-sky-700', bg: 'bg-sky-50' },
                    { label: 'Mobile Money', value: mobileIn, color: 'text-amber-700', bg: 'bg-amber-50' },
                    { label: 'Transferência', value: transferIn, color: 'text-gray-700', bg: 'bg-gray-50' },
                  ].map(m => (
                    <div key={m.label} className={`${m.bg} rounded-xl p-3 text-center`}>
                      <p className="text-gray-500 text-xs mb-1">{m.label}</p>
                      <p className={`font-bold ${m.color}`}>MT {m.value.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-gray-900 font-semibold text-sm">Movimentos do Turno</h3>
                    <span className="text-gray-400 text-xs">{shiftMovements.length} registos</span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Hora</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Descrição</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Categoria</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Método</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Operador</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftMovements.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">Sem movimentos neste turno</td></tr>
                      )}
                      {shiftMovements.map(m => (
                        <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 text-gray-500 text-sm">{new Date(m.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-3 text-gray-800 text-sm max-w-xs truncate">{m.description}</td>
                          <td className="px-4 py-3"><Badge label={m.category} variant="neutral" /></td>
                          <td className="px-4 py-3 text-gray-500 text-sm">{payLabel(m.paymentMethod)}</td>
                          <td className="px-4 py-3 text-gray-500 text-sm">{m.operator}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-bold text-sm ${m.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {m.type === 'in' ? '+' : '-'}MT {m.amount.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ── SHIFT REPORT TAB ── */}
        {tab === 'shift_report' && (
          <div className="space-y-5">
            {/* Shift selector */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-gray-900 font-semibold text-base mb-3 flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center"><i className="ri-bar-chart-2-line text-amber-500"></i></div>
                Relatório de Turno
              </h3>
              <div className="flex items-center gap-3">
                <select value={reportShiftId} onChange={e => setReportShiftId(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none">
                  <option value="">Selecionar turno...</option>
                  {allShifts.map(sh => (
                    <option key={sh.id} value={sh.id}>
                      {sh.openedBy} — {new Date(sh.openedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(sh.openedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      {sh.status === 'open' ? ' (aberto)' : ` → ${sh.closedAt ? new Date(sh.closedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : ''}`}
                    </option>
                  ))}
                </select>
                {currentShift && (
                  <button onClick={() => setReportShiftId(currentShift.id)}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg cursor-pointer whitespace-nowrap border"
                    style={{ borderColor: '#1E9FD4', color: '#1E9FD4' }}>
                    Turno Atual
                  </button>
                )}
              </div>
            </div>

            {reportShift && (
              <>
                {/* Shift info */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-gray-900 font-semibold">Turno de {reportShift.openedBy}</p>
                      <p className="text-gray-400 text-sm">
                        {new Date(reportShift.openedAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {reportShift.closedAt && ` → ${new Date(reportShift.closedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${reportShift.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {reportShift.status === 'open' ? 'Aberto' : 'Fechado'}
                    </span>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Saldo Abertura', value: `MT ${reportShift.openingBalance.toFixed(2)}`, icon: 'ri-safe-2-line', color: 'text-gray-900', bg: 'bg-gray-50' },
                      { label: 'Total Entradas', value: `MT ${reportTotalIn.toFixed(2)}`, icon: 'ri-arrow-down-line', color: 'text-emerald-700', bg: 'bg-emerald-50' },
                      { label: 'Total Saídas', value: `MT ${reportTotalOut.toFixed(2)}`, icon: 'ri-arrow-up-line', color: 'text-red-700', bg: 'bg-red-50' },
                      { label: 'Saldo Final', value: `MT ${reportBalance.toFixed(2)}`, icon: 'ri-money-dollar-circle-line', color: 'text-amber-700', bg: 'bg-amber-50' },
                    ].map(s => (
                      <div key={s.label} className={`${s.bg} rounded-xl p-3 flex items-center gap-3`}>
                        <div className="w-8 h-8 flex items-center justify-center">
                          <i className={`${s.icon} ${s.color} text-lg`}></i>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">{s.label}</p>
                          <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sales breakdown */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-gray-700 font-semibold text-sm mb-3 flex items-center gap-2">
                        <i className="ri-shopping-bag-line text-emerald-500"></i> Vendas do Turno
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-xs">Nº de vendas</span>
                          <span className="text-gray-900 font-semibold text-sm">{reportSales.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-xs">Total faturado</span>
                          <span className="text-emerald-600 font-bold text-sm">MT {reportSalesTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-xs">Dinheiro</span>
                          <span className="text-gray-700 font-semibold text-sm">MT {reportCashIn.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-xs">Cartão</span>
                          <span className="text-gray-700 font-semibold text-sm">MT {reportCardIn.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-xs">Mobile Money</span>
                          <span className="text-gray-700 font-semibold text-sm">MT {reportMobileIn.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-xs">Transferência</span>
                          <span className="text-gray-700 font-semibold text-sm">MT {reportTransferIn.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-gray-700 font-semibold text-sm mb-3 flex items-center gap-2">
                        <i className="ri-arrow-up-circle-line text-red-500"></i> Saídas do Turno
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-xs">Total saídas</span>
                          <span className="text-red-600 font-bold text-sm">MT {reportTotalOut.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 text-xs">Despesas/Compras</span>
                          <span className="text-gray-700 font-semibold text-sm">MT {reportOutExpenses.toFixed(2)}</span>
                        </div>
                        {reportShift.status === 'closed' && (
                          <>
                            <div className="border-t border-gray-200 pt-2 mt-2">
                              <div className="flex justify-between">
                                <span className="text-gray-500 text-xs">Saldo esperado</span>
                                <span className="text-gray-900 font-semibold text-sm">MT {(reportShift.expectedBalance || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500 text-xs">Saldo contado</span>
                                <span className="text-gray-900 font-semibold text-sm">MT {(reportShift.countedBalance || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500 text-xs">Diferença</span>
                                <span className={`font-bold text-sm ${(reportShift.difference || 0) === 0 ? 'text-emerald-600' : (reportShift.difference || 0) > 0 ? 'text-sky-600' : 'text-red-600'}`}>
                                  {(reportShift.difference || 0) >= 0 ? '+' : ''}MT {(reportShift.difference || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sales list */}
                {reportSales.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-gray-900 font-semibold text-sm">Vendas do Turno</h3>
                      <span className="text-gray-400 text-xs">{reportSales.length} vendas · MT {reportSalesTotal.toFixed(2)}</span>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-50 bg-gray-50/50">
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Hora</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Itens</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Cliente</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Método</th>
                          <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportSales.map(sale => (
                          <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3 text-gray-500 text-sm">{new Date(sale.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="px-4 py-3 text-gray-800 text-xs">{sale.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                            <td className="px-4 py-3 text-gray-600 text-sm">{sale.personName || '—'}</td>
                            <td className="px-4 py-3 text-gray-500 text-sm">
                              {{ cash: 'Dinheiro', card: 'Cartão', mobile: 'Mobile', transfer: 'Transf.', partial: 'Parcial' }[sale.payMethod] || sale.payMethod}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-sm text-emerald-600">MT {sale.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Movements list */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-gray-900 font-semibold text-sm">Todos os Movimentos</h3>
                    <span className="text-gray-400 text-xs">{reportMovements.length} registos</span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Hora</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Descrição</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Categoria</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Método</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportMovements.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">Sem movimentos neste turno</td></tr>
                      )}
                      {reportMovements.map(m => (
                        <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 text-gray-500 text-sm">{new Date(m.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-3 text-gray-800 text-sm max-w-xs truncate">{m.description}</td>
                          <td className="px-4 py-3"><Badge label={m.category} variant="neutral" /></td>
                          <td className="px-4 py-3 text-gray-500 text-sm">{payLabel(m.paymentMethod)}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-bold text-sm ${m.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {m.type === 'in' ? '+' : '-'}MT {m.amount.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!reportShift && (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <div className="w-14 h-14 flex items-center justify-center bg-gray-50 rounded-full mx-auto mb-4">
                  <i className="ri-bar-chart-2-line text-gray-300 text-3xl"></i>
                </div>
                <p className="text-gray-400 text-sm">Selecione um turno acima para ver o relatório detalhado.</p>
              </div>
            )}
          </div>
        )}

        {/* ── OPEN SHIFT TAB ── */}
        {tab === 'open' && (
          <div className="max-w-md">
            {currentShift ? (
              <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
                <div className="w-14 h-14 flex items-center justify-center bg-emerald-50 rounded-full mx-auto mb-4">
                  <i className="ri-check-line text-emerald-500 text-2xl"></i>
                </div>
                <h3 className="text-gray-900 font-bold text-lg mb-2">Caixa já está aberta</h3>
                <p className="text-gray-500 text-sm mb-1">Turno aberto por <strong>{currentShift.openedBy}</strong></p>
                <p className="text-gray-400 text-xs">
                  {new Date(currentShift.openedAt).toLocaleString('pt-PT')} · Fundo: MT {currentShift.openingBalance.toFixed(2)}
                </p>
                <button onClick={() => setTab('current')}
                  className="mt-4 inline-flex items-center gap-2 text-white text-sm font-medium px-5 py-2.5 rounded-xl cursor-pointer whitespace-nowrap hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                  Ver Turno Atual
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
                <div>
                  <h3 className="text-gray-900 font-semibold text-base mb-1">Abertura de Caixa</h3>
                  <p className="text-gray-400 text-sm">Registe o fundo de caixa inicial para começar o turno.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Operador</p>
                    <p className="text-gray-900 font-semibold text-sm">{currentUser?.name || 'Operador'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Data/Hora</p>
                    <p className="text-gray-900 font-semibold text-sm">{new Date().toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Fundo de Caixa Inicial (MT)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">MT</span>
                    <input type="number" min="0" step="0.01" value={openingBalance}
                      onChange={e => setOpeningBalance(e.target.value)}
                      placeholder="0.00" className="w-full border border-gray-200 rounded-lg pl-12 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                  </div>
                  <p className="text-gray-400 text-xs mt-1">Valor em dinheiro físico presente na caixa no início do turno.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Notas (opcional)</label>
                  <input value={openingNotes} onChange={e => setOpeningNotes(e.target.value)}
                    placeholder="Observações de abertura..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none" />
                </div>

                {todayShifts.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-amber-700 text-xs font-semibold mb-1">Turnos de hoje: {todayShifts.length}</p>
                    <div className="space-y-1">
                      {todayShifts.map(s => (
                        <div key={s.id} className="flex justify-between text-xs text-amber-700">
                          <span>{s.openedBy} — {new Date(s.openedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className={`font-medium ${s.status === 'open' ? 'text-emerald-600' : 'text-gray-500'}`}>
                            {s.status === 'open' ? 'Aberto' : 'Fechado'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleOpenShift} disabled={openShiftLoading}
                  className="w-full py-3 text-white rounded-xl font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60 hover:opacity-90 transition-all"
                  style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                  {openShiftLoading ? <><i className="ri-loader-4-line animate-spin mr-2"></i>A abrir...</> : <><i className="ri-lock-unlock-line mr-2"></i>Abrir Caixa</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── CLOSE SHIFT TAB ── */}
        {tab === 'close' && (
          <div className="max-w-2xl">
            {!currentShift ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <div className="w-14 h-14 flex items-center justify-center bg-gray-50 rounded-full mx-auto mb-4">
                  <i className="ri-lock-line text-gray-400 text-2xl"></i>
                </div>
                <h3 className="text-gray-700 font-semibold text-lg mb-2">Nenhum turno aberto</h3>
                <p className="text-gray-400 text-sm">Não há caixa aberta para fechar.</p>
              </div>
            ) : shiftClosed ? (
              <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
                <div className="w-16 h-16 flex items-center justify-center bg-emerald-50 rounded-full mx-auto mb-4">
                  <i className="ri-check-double-line text-emerald-500 text-3xl"></i>
                </div>
                <h3 className="text-gray-900 font-bold text-xl mb-2">Caixa Fechada com Sucesso</h3>
                <p className="text-gray-500 text-sm mb-4">O turno foi encerrado. Relatório guardado no histórico.</p>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-gray-500 text-xs">Saldo Esperado</p>
                    <p className="text-gray-900 font-bold">MT {balance.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-gray-500 text-xs">Contado</p>
                    <p className="text-gray-900 font-bold">MT {noteTotal.toFixed(2)}</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${difference === 0 ? 'bg-emerald-50' : difference > 0 ? 'bg-sky-50' : 'bg-red-50'}`}>
                    <p className="text-gray-500 text-xs">Diferença</p>
                    <p className={`font-bold ${difference === 0 ? 'text-emerald-600' : difference > 0 ? 'text-sky-600' : 'text-red-600'}`}>
                      {difference >= 0 ? '+' : ''}MT {difference.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => exportShiftReportPDF(buildReportData())}
                    className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap transition-all">
                    <i className="ri-printer-line"></i> Imprimir / PDF
                  </button>
                  <button onClick={() => exportShiftReportCSV(buildReportData())}
                    className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap transition-all">
                    <i className="ri-file-excel-2-line"></i> Exportar Excel
                  </button>
                  <button onClick={() => { setShiftClosed(false); setCloseStep('summary'); setNoteCounts(DENOMINATIONS.map(d => ({ denomination: d.value, count: '' }))); setCloseNotes(''); setTab('open'); }}
                    className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap transition-all">
                    <i className="ri-lock-unlock-line"></i> Abrir Novo Turno
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-2">
                  {(['summary', 'notes', 'confirm'] as const).map((step, idx) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition-all ${
                        closeStep === step ? 'bg-gray-900 text-white' :
                        (['summary', 'notes', 'confirm'].indexOf(closeStep) > idx) ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {(['summary', 'notes', 'confirm'].indexOf(closeStep) > idx) ? <i className="ri-check-line text-xs"></i> : idx + 1}
                      </div>
                      <span className={`text-xs font-medium ${closeStep === step ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step === 'summary' ? 'Resumo' : step === 'notes' ? 'Contagem' : 'Confirmar'}
                      </span>
                      {idx < 2 && <div className="w-8 h-px bg-gray-200 mx-1"></div>}
                    </div>
                  ))}
                </div>

                {closeStep === 'summary' && (
                  <>
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                      <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
                        <div className="w-6 h-6 flex items-center justify-center"><i className="ri-bar-chart-2-line text-amber-500"></i></div>
                        Resumo do Turno
                      </h3>
                      <div className="space-y-2">
                        {[
                          { label: 'Saldo de Abertura', value: `MT ${currentShift.openingBalance.toFixed(2)}`, color: 'text-gray-900' },
                          { label: 'Total Entradas', value: `+MT ${totalIn.toFixed(2)}`, color: 'text-emerald-600' },
                          { label: 'Total Saídas', value: `-MT ${totalOut.toFixed(2)}`, color: 'text-red-600' },
                        ].map(row => (
                          <div key={row.label} className="flex justify-between py-2 border-b border-gray-50">
                            <span className="text-gray-600 text-sm">{row.label}</span>
                            <span className={`font-semibold text-sm ${row.color}`}>{row.value}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-3 bg-gray-50 rounded-lg px-3 mt-2">
                          <span className="text-gray-800 font-bold text-sm">Saldo Esperado em Caixa</span>
                          <span className="text-gray-900 font-bold text-lg">MT {balance.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                      <h3 className="text-gray-900 font-semibold mb-3 text-sm">Vendas por Método de Pagamento</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Dinheiro', value: cashIn, icon: 'ri-money-dollar-circle-line', color: 'text-emerald-700', bg: 'bg-emerald-50' },
                          { label: 'Cartão', value: cardIn, icon: 'ri-bank-card-line', color: 'text-sky-700', bg: 'bg-sky-50' },
                          { label: 'Mobile Money', value: mobileIn, icon: 'ri-smartphone-line', color: 'text-amber-700', bg: 'bg-amber-50' },
                          { label: 'Transferência', value: transferIn, icon: 'ri-exchange-line', color: 'text-gray-700', bg: 'bg-gray-50' },
                        ].map(m => (
                          <div key={m.label} className={`${m.bg} rounded-xl p-3 flex items-center gap-3`}>
                            <div className="w-8 h-8 flex items-center justify-center">
                              <i className={`${m.icon} ${m.color} text-lg`}></i>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">{m.label}</p>
                              <p className={`font-bold text-sm ${m.color}`}>MT {m.value.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {pendingOrders.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-amber-800 font-semibold text-sm mb-1">
                          {pendingOrders.length} conta(s) pendente(s) — MT {totalPendingDebt.toFixed(2)} em dívida
                        </p>
                      </div>
                    )}
                    <button onClick={() => setCloseStep('notes')}
                      className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold cursor-pointer whitespace-nowrap transition-all">
                      Continuar para Contagem de Caixa
                    </button>
                  </>
                )}

                {closeStep === 'notes' && (
                  <>
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-900 font-semibold flex items-center gap-2">
                          <div className="w-6 h-6 flex items-center justify-center"><i className="ri-coins-line text-amber-500"></i></div>
                          Contagem de Notas e Moedas
                        </h3>
                        <button onClick={() => setNoteCounts(DENOMINATIONS.map(d => ({ denomination: d.value, count: '' })))}
                          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer flex items-center gap-1">
                          <i className="ri-refresh-line"></i> Limpar
                        </button>
                      </div>
                      <div className="space-y-2">
                        {DENOMINATIONS.map(d => {
                          const nc = noteCounts.find(n => n.denomination === d.value);
                          const count = parseFloat(nc?.count || '0') || 0;
                          const subtotal = d.value * count;
                          return (
                            <div key={d.value} className="flex items-center gap-3 py-2 border-b border-gray-50">
                              <div className="w-20 flex-shrink-0">
                                <span className="text-sm font-semibold text-gray-700">{d.label}</span>
                              </div>
                              <span className="text-gray-400 text-xs">×</span>
                              <input type="number" min="0" value={nc?.count || ''}
                                onChange={e => updateNoteCount(d.value, e.target.value)}
                                placeholder="0"
                                className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-amber-400" />
                              <span className="text-gray-400 text-xs">=</span>
                              <span className={`text-sm font-semibold ml-auto ${subtotal > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                MT {subtotal.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 bg-gray-50 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-700 font-semibold">Total Contado</span>
                          <span className="text-gray-900 font-bold text-xl">MT {noteTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600 text-sm">Saldo Esperado</span>
                          <span className="text-gray-700 font-semibold text-sm">MT {balance.toFixed(2)}</span>
                        </div>
                        <div className={`flex justify-between items-center pt-2 border-t border-gray-200 ${difference === 0 ? 'text-emerald-600' : difference > 0 ? 'text-sky-600' : 'text-red-600'}`}>
                          <span className="font-semibold text-sm">Diferença</span>
                          <span className="font-bold text-lg">{difference >= 0 ? '+' : ''}MT {difference.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Notas de Fecho (opcional)</label>
                      <textarea value={closeNotes} onChange={e => setCloseNotes(e.target.value)}
                        rows={2} maxLength={500}
                        placeholder="Observações sobre o fecho do turno..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setCloseStep('summary')}
                        className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                        Voltar
                      </button>
                      <button onClick={() => setCloseStep('confirm')}
                        className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold cursor-pointer whitespace-nowrap transition-all">
                        Continuar para Confirmação
                      </button>
                    </div>
                  </>
                )}

                {closeStep === 'confirm' && (
                  <>
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                      <h3 className="text-gray-900 font-semibold mb-4 flex items-center gap-2">
                        <div className="w-6 h-6 flex items-center justify-center"><i className="ri-file-check-line text-emerald-500"></i></div>
                        Confirmação de Fecho
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-gray-500 text-xs mb-1">Saldo Esperado</p>
                          <p className="text-gray-900 font-bold">MT {balance.toFixed(2)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-gray-500 text-xs mb-1">Total Contado</p>
                          <p className="text-gray-900 font-bold">MT {noteTotal.toFixed(2)}</p>
                        </div>
                        <div className={`rounded-xl p-3 text-center ${difference === 0 ? 'bg-emerald-50' : difference > 0 ? 'bg-sky-50' : 'bg-red-50'}`}>
                          <p className="text-gray-500 text-xs mb-1">Diferença</p>
                          <p className={`font-bold ${difference === 0 ? 'text-emerald-600' : difference > 0 ? 'text-sky-600' : 'text-red-600'}`}>
                            {difference >= 0 ? '+' : ''}MT {difference.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i className="ri-alert-line text-red-500 text-sm"></i>
                      </div>
                      <p className="text-red-700 text-xs">Ao confirmar, o turno será encerrado. Certifique-se que todos os dados estão corretos.</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setCloseStep('notes')}
                        className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                        Voltar
                      </button>
                      <button onClick={() => exportShiftReportPDF(buildReportData())}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                        <i className="ri-printer-line"></i> PDF
                      </button>
                      <button onClick={handleCloseShift}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold cursor-pointer whitespace-nowrap transition-all">
                        Fechar Caixa
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── DAILY CLOSURE TAB ── */}
        {tab === 'daily' && (
          <div className="max-w-2xl space-y-4">
            {dailyDoneId ? (
              <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
                <div className="w-16 h-16 flex items-center justify-center bg-emerald-50 rounded-full mx-auto mb-4">
                  <i className="ri-calendar-check-line text-emerald-500 text-3xl"></i>
                </div>
                <h3 className="text-gray-900 font-bold text-xl mb-2">Fecho do Dia Concluído!</h3>
                <p className="text-gray-500 text-sm">O dia foi encerrado com sucesso. Dados bloqueados para alteração.</p>
              </div>
            ) : alreadyClosedToday ? (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <div className="w-14 h-14 flex items-center justify-center bg-gray-50 rounded-full mx-auto mb-4">
                  <i className="ri-calendar-check-line text-gray-400 text-2xl"></i>
                </div>
                <h3 className="text-gray-700 font-semibold text-lg mb-2">Dia já fechado</h3>
                <p className="text-gray-400 text-sm">O fecho do dia de hoje já foi realizado.</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-gray-900 font-semibold text-base mb-1 flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center"><i className="ri-calendar-check-line text-amber-500"></i></div>
                    Fecho do Dia — {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </h3>
                  <p className="text-gray-400 text-sm">Consolida todos os turnos do dia num único relatório.</p>
                </div>

                {openTodayShifts.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className="ri-alert-line text-red-500"></i>
                    </div>
                    <div>
                      <p className="text-red-700 font-semibold text-sm">Não é possível fechar o dia</p>
                      <p className="text-red-600 text-xs mt-0.5">
                        Existem {openTodayShifts.length} turno(s) ainda aberto(s). Feche todos os turnos antes de realizar o fecho do dia.
                      </p>
                    </div>
                  </div>
                )}

                {closedTodayShifts.length === 0 && openTodayShifts.length === 0 && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                    <p className="text-gray-400 text-sm">Nenhum turno registado hoje.</p>
                  </div>
                )}

                {closedTodayShifts.length > 0 && (
                  <>
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                      <h4 className="text-gray-800 font-semibold text-sm mb-4">Resumo Consolidado do Dia</h4>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-gray-500 text-xs mb-1">Nº de Turnos</p>
                          <p className="text-gray-900 font-bold text-xl">{closedTodayShifts.length}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-gray-500 text-xs mb-1">Operadores</p>
                          <p className="text-gray-900 font-bold text-sm">{[...new Set(closedTodayShifts.map(s => s.openedBy))].join(', ')}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: 'Total Esperado', value: `MT ${dailyTotalExpected.toFixed(2)}`, color: 'text-gray-900' },
                          { label: 'Total Contado', value: `MT ${dailyTotalCounted.toFixed(2)}`, color: 'text-gray-900' },
                          { label: 'Diferença Total', value: `${dailyTotalDiff >= 0 ? '+' : ''}MT ${dailyTotalDiff.toFixed(2)}`, color: dailyTotalDiff === 0 ? 'text-emerald-600' : dailyTotalDiff > 0 ? 'text-sky-600' : 'text-red-600' },
                        ].map(row => (
                          <div key={row.label} className="flex justify-between py-2 border-b border-gray-50">
                            <span className="text-gray-600 text-sm">{row.label}</span>
                            <span className={`font-semibold text-sm ${row.color}`}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                      <h4 className="text-gray-800 font-semibold text-sm mb-3">Turnos do Dia</h4>
                      <div className="space-y-2">
                        {closedTodayShifts.map((s, idx) => (
                          <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                            <div>
                              <p className="text-gray-700 text-sm font-medium">Turno {idx + 1} — {s.openedBy}</p>
                              <p className="text-gray-400 text-xs">
                                {new Date(s.openedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                {s.closedAt && ` → ${new Date(s.closedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-gray-900 text-sm font-semibold">MT {(s.expectedBalance || 0).toFixed(2)}</p>
                              <p className={`text-xs font-medium ${(s.difference || 0) === 0 ? 'text-emerald-600' : (s.difference || 0) > 0 ? 'text-sky-600' : 'text-red-600'}`}>
                                {(s.difference || 0) >= 0 ? '+' : ''}MT {(s.difference || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Notas do Fecho do Dia (opcional)</label>
                      <textarea value={dailyNotes} onChange={e => setDailyNotes(e.target.value)}
                        rows={2} maxLength={500}
                        placeholder="Observações gerais do dia..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                    </div>

                    <button onClick={handleDailyClosure} disabled={!canCloseDay}
                      className="w-full py-3 text-white rounded-xl font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 hover:opacity-90 transition-all"
                      style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                      <i className="ri-calendar-check-line mr-2"></i>
                      Confirmar Fecho do Dia
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="space-y-6">
            {dailyClosures.length > 0 && (
              <div>
                <h3 className="text-gray-700 font-semibold text-sm mb-3 flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center"><i className="ri-calendar-check-line text-amber-500"></i></div>
                  Fechos de Dia
                </h3>
                <div className="space-y-3">
                  {dailyClosures.map(dc => (
                    <div key={dc.id} className="bg-white rounded-xl border border-gray-100 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-gray-900 font-semibold text-sm">
                            {new Date(dc.date).toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                          <p className="text-gray-400 text-xs">{dc.shiftCount} turno(s) · {dc.operators.join(', ')} · Fechado por {dc.closedBy}</p>
                        </div>
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-medium">Fechado</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center bg-gray-50 rounded-xl p-3">
                          <p className="text-gray-500 text-xs mb-1">Esperado</p>
                          <p className="text-gray-900 font-bold">MT {dc.totalExpected.toFixed(2)}</p>
                        </div>
                        <div className="text-center bg-gray-50 rounded-xl p-3">
                          <p className="text-gray-500 text-xs mb-1">Contado</p>
                          <p className="text-gray-900 font-bold">MT {dc.totalCounted.toFixed(2)}</p>
                        </div>
                        <div className={`text-center rounded-xl p-3 ${dc.totalDifference === 0 ? 'bg-emerald-50' : dc.totalDifference > 0 ? 'bg-sky-50' : 'bg-red-50'}`}>
                          <p className="text-gray-500 text-xs mb-1">Diferença</p>
                          <p className={`font-bold ${dc.totalDifference === 0 ? 'text-emerald-600' : dc.totalDifference > 0 ? 'text-sky-600' : 'text-red-600'}`}>
                            {dc.totalDifference >= 0 ? '+' : ''}MT {dc.totalDifference.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center bg-gray-50 rounded-xl p-3">
                          <p className="text-gray-500 text-xs mb-1">Turnos</p>
                          <p className="text-gray-900 font-bold">{dc.shiftCount}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-gray-700 font-semibold text-sm mb-3 flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-history-line text-gray-500"></i></div>
                Turnos Individuais
              </h3>
              {allShifts.filter(s => s.status === 'closed').length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                  <p className="text-gray-400 text-sm">Sem turnos anteriores</p>
                </div>
              )}
              <div className="space-y-3">
                {allShifts.filter(s => s.status === 'closed').map(shift => {
                  const diff = shift.difference || 0;
                  const shiftSales = sales.filter(s => s.shiftId === shift.id && s.status === 'paid');
                  const shiftSalesTotal = shiftSales.reduce((s, sale) => s + sale.total, 0);
                  return (
                    <div key={shift.id} className="bg-white rounded-xl border border-gray-100 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-gray-900 font-semibold text-sm">
                            {new Date(shift.openedAt).toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {shift.openedBy} · {new Date(shift.openedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            {shift.closedAt && ` → ${new Date(shift.closedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`}
                            {shift.closedBy && ` · Fechado por ${shift.closedBy}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setReportShiftId(shift.id); setTab('shift_report'); }}
                            className="text-xs px-3 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-all"
                            style={{ borderColor: '#1E9FD4', color: '#1E9FD4' }}>
                            Ver Relatório
                          </button>
                          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">Fechado</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        <div className="text-center bg-gray-50 rounded-xl p-3">
                          <p className="text-gray-500 text-xs mb-1">Esperado</p>
                          <p className="text-gray-900 font-bold">MT {(shift.expectedBalance || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-center bg-gray-50 rounded-xl p-3">
                          <p className="text-gray-500 text-xs mb-1">Contado</p>
                          <p className="text-gray-900 font-bold">MT {(shift.countedBalance || 0).toFixed(2)}</p>
                        </div>
                        <div className={`text-center rounded-xl p-3 ${diff === 0 ? 'bg-emerald-50' : diff > 0 ? 'bg-sky-50' : 'bg-red-50'}`}>
                          <p className="text-gray-500 text-xs mb-1">Diferença</p>
                          <p className={`font-bold ${diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-sky-600' : 'text-red-600'}`}>
                            {diff >= 0 ? '+' : ''}MT {diff.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center bg-emerald-50 rounded-xl p-3">
                          <p className="text-gray-500 text-xs mb-1">Vendas</p>
                          <p className="text-emerald-600 font-bold">MT {shiftSalesTotal.toFixed(2)}</p>
                          <p className="text-emerald-500 text-xs">{shiftSales.length} vendas</p>
                        </div>
                        <div className="text-center bg-amber-50 rounded-xl p-3">
                          <p className="text-gray-500 text-xs mb-1">Não Pagas</p>
                          <p className="text-amber-600 font-bold">{shift.unpaidOrdersCount || 0}</p>
                          <p className="text-amber-500 text-xs">MT {(shift.unpaidOrdersTotal || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Movement Modal */}
      {showMovModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold">Novo Movimento</h3>
              <button onClick={() => setShowMovModal(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(['in', 'out'] as const).map(t => (
                  <button key={t} onClick={() => setMovForm(f => ({ ...f, type: t }))}
                    className={`py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-all ${movForm.type === t ? (t === 'in' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 text-gray-600'}`}>
                    {t === 'in' ? '+ Entrada' : '- Saída'}
                  </button>
                ))}
              </div>
              {movForm.type === 'out' && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className="ri-information-line text-amber-500 text-sm"></i>
                  </div>
                  <p className="text-amber-700 text-xs">Saldo atual: <strong>MT {balance.toFixed(2)}</strong> — a saída será subtraída do saldo da caixa.</p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Valor (MT)</label>
                <input type="number" value={movForm.amount} onChange={e => setMovForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Descrição</label>
                <input value={movForm.description} onChange={e => setMovForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Método</label>
                  <select value={movForm.paymentMethod} onChange={e => setMovForm(f => ({ ...f, paymentMethod: e.target.value as CashMovement['paymentMethod'] }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="cash">Dinheiro</option>
                    <option value="card">Cartão</option>
                    <option value="mobile">Mobile Money</option>
                    <option value="transfer">Transferência</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Categoria</label>
                  <select value={movForm.category} onChange={e => setMovForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    {['Venda', 'Despesa', 'Compra de Stock', 'Quebra', 'Operacional', 'Outro'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowMovModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={handleAddMovement} disabled={!movForm.amount || !movForm.description}
                className="flex-1 py-2.5 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                Registar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
