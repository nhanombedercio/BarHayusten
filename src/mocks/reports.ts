export interface DailySales {
  date: string;
  total: number;
  transactions: number;
  cash: number;
  card: number;
  mobile: number;
  transfer: number;
}

export interface CategoryRevenue {
  category: string;
  revenue: number;
  percentage: number;
  quantity: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

export interface StockBreakage {
  id: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalLoss: number;
  reason: string;
  operator: string;
  shift: string;
  date: string;
}

export interface PendingAccountReport {
  id: string;
  personName: string;
  tableNumber: number;
  total: number;
  paid: number;
  remaining: number;
  pendingReason: string;
  responsible: string;
  openedAt: string;
  closedAt: string;
  daysOpen: number;
}

export const weeklySales: DailySales[] = [
  { date: '2026-04-09', total: 312.50, transactions: 48, cash: 180.0, card: 95.0, mobile: 37.5, transfer: 0 },
  { date: '2026-04-10', total: 287.00, transactions: 42, cash: 150.0, card: 87.0, mobile: 50.0, transfer: 0 },
  { date: '2026-04-11', total: 498.75, transactions: 71, cash: 220.0, card: 178.75, mobile: 100.0, transfer: 0 },
  { date: '2026-04-12', total: 521.00, transactions: 78, cash: 250.0, card: 171.0, mobile: 100.0, transfer: 0 },
  { date: '2026-04-13', total: 445.00, transactions: 65, cash: 200.0, card: 145.0, mobile: 80.0, transfer: 20.0 },
  { date: '2026-04-14', total: 387.50, transactions: 58, cash: 180.0, card: 127.5, mobile: 80.0, transfer: 0 },
  { date: '2026-04-15', total: 143.50, transactions: 22, cash: 92.5, card: 39.0, mobile: 12.0, transfer: 0 },
];

export const monthlySales: DailySales[] = [
  { date: '2026-03-16', total: 290.0, transactions: 44, cash: 140.0, card: 90.0, mobile: 60.0, transfer: 0 },
  { date: '2026-03-17', total: 310.0, transactions: 47, cash: 160.0, card: 100.0, mobile: 50.0, transfer: 0 },
  { date: '2026-03-18', total: 480.0, transactions: 68, cash: 210.0, card: 170.0, mobile: 100.0, transfer: 0 },
  { date: '2026-03-19', total: 510.0, transactions: 75, cash: 240.0, card: 170.0, mobile: 100.0, transfer: 0 },
  { date: '2026-03-20', total: 430.0, transactions: 62, cash: 190.0, card: 140.0, mobile: 80.0, transfer: 20.0 },
  { date: '2026-03-21', total: 370.0, transactions: 55, cash: 170.0, card: 120.0, mobile: 80.0, transfer: 0 },
  { date: '2026-03-22', total: 130.0, transactions: 20, cash: 80.0, card: 35.0, mobile: 15.0, transfer: 0 },
  { date: '2026-03-23', total: 295.0, transactions: 45, cash: 145.0, card: 95.0, mobile: 55.0, transfer: 0 },
  { date: '2026-03-24', total: 315.0, transactions: 48, cash: 155.0, card: 105.0, mobile: 55.0, transfer: 0 },
  { date: '2026-03-25', total: 490.0, transactions: 70, cash: 215.0, card: 175.0, mobile: 100.0, transfer: 0 },
  { date: '2026-03-26', total: 525.0, transactions: 79, cash: 255.0, card: 170.0, mobile: 100.0, transfer: 0 },
  { date: '2026-03-27', total: 450.0, transactions: 66, cash: 205.0, card: 145.0, mobile: 80.0, transfer: 20.0 },
  { date: '2026-03-28', total: 390.0, transactions: 59, cash: 185.0, card: 125.0, mobile: 80.0, transfer: 0 },
  { date: '2026-03-29', total: 145.0, transactions: 23, cash: 95.0, card: 38.0, mobile: 12.0, transfer: 0 },
  { date: '2026-03-30', total: 300.0, transactions: 46, cash: 150.0, card: 98.0, mobile: 52.0, transfer: 0 },
  { date: '2026-03-31', total: 320.0, transactions: 49, cash: 162.0, card: 108.0, mobile: 50.0, transfer: 0 },
  { date: '2026-04-01', total: 495.0, transactions: 72, cash: 222.0, card: 173.0, mobile: 100.0, transfer: 0 },
  { date: '2026-04-02', total: 530.0, transactions: 80, cash: 258.0, card: 172.0, mobile: 100.0, transfer: 0 },
  { date: '2026-04-03', total: 455.0, transactions: 67, cash: 208.0, card: 147.0, mobile: 80.0, transfer: 20.0 },
  { date: '2026-04-04', total: 395.0, transactions: 60, cash: 188.0, card: 127.0, mobile: 80.0, transfer: 0 },
  { date: '2026-04-05', total: 148.0, transactions: 24, cash: 96.0, card: 40.0, mobile: 12.0, transfer: 0 },
  { date: '2026-04-06', total: 305.0, transactions: 47, cash: 152.0, card: 100.0, mobile: 53.0, transfer: 0 },
  { date: '2026-04-07', total: 325.0, transactions: 50, cash: 165.0, card: 110.0, mobile: 50.0, transfer: 0 },
  { date: '2026-04-08', total: 500.0, transactions: 73, cash: 225.0, card: 175.0, mobile: 100.0, transfer: 0 },
  { date: '2026-04-09', total: 312.50, transactions: 48, cash: 180.0, card: 95.0, mobile: 37.5, transfer: 0 },
  { date: '2026-04-10', total: 287.00, transactions: 42, cash: 150.0, card: 87.0, mobile: 50.0, transfer: 0 },
  { date: '2026-04-11', total: 498.75, transactions: 71, cash: 220.0, card: 178.75, mobile: 100.0, transfer: 0 },
  { date: '2026-04-12', total: 521.00, transactions: 78, cash: 250.0, card: 171.0, mobile: 100.0, transfer: 0 },
  { date: '2026-04-13', total: 445.00, transactions: 65, cash: 200.0, card: 145.0, mobile: 80.0, transfer: 20.0 },
  { date: '2026-04-14', total: 387.50, transactions: 58, cash: 180.0, card: 127.5, mobile: 80.0, transfer: 0 },
];

export const categoryRevenue: CategoryRevenue[] = [
  { category: 'Cervejas', revenue: 312.0, percentage: 38, quantity: 208 },
  { category: 'Spirits', revenue: 198.5, percentage: 24, quantity: 44 },
  { category: 'Cocktails', revenue: 147.0, percentage: 18, quantity: 21 },
  { category: 'Vinhos', revenue: 82.5, percentage: 10, quantity: 33 },
  { category: 'Petiscos', revenue: 57.0, percentage: 7, quantity: 12 },
  { category: 'Refrigerantes', revenue: 24.5, percentage: 3, quantity: 24 },
];

export const topProducts: TopProduct[] = [
  { productId: 'p1', name: 'Super Bock', category: 'Cervejas', quantity: 124, revenue: 186.0 },
  { productId: 'p11', name: 'Mojito', category: 'Cocktails', quantity: 21, revenue: 147.0 },
  { productId: 'p9', name: 'Vodka Absolut', category: 'Spirits', quantity: 18, revenue: 72.0 },
  { productId: 'p19', name: 'Francesinha', category: 'Petiscos', quantity: 12, revenue: 114.0 },
  { productId: 'p5', name: 'Vinho Tinto Casa', category: 'Vinhos', quantity: 33, revenue: 82.5 },
  { productId: 'p14', name: 'Coca-Cola', category: 'Refrigerantes', quantity: 24, revenue: 48.0 },
  { productId: 'p10', name: 'Gin Tanqueray', category: 'Spirits', quantity: 14, revenue: 70.0 },
  { productId: 'p2', name: 'Sagres', category: 'Cervejas', quantity: 84, revenue: 126.0 },
];

export const stockBreakages: StockBreakage[] = [
  {
    id: 'br1', productId: 'p7', productName: 'Vinho Rosé', category: 'Vinhos',
    quantity: 2, unit: 'un', costPerUnit: 0.9, totalLoss: 1.8,
    reason: 'Garrafa partida durante serviço', operator: 'Maria Costa',
    shift: 'Turno 15/04 — Noite', date: '2026-04-15T16:00:00',
  },
  {
    id: 'br2', productId: 'p14', productName: 'Coca-Cola', category: 'Refrigerantes',
    quantity: 4, unit: 'un', costPerUnit: 0.7, totalLoss: 2.8,
    reason: 'Lata amassada — imprópria para venda', operator: 'João Silva',
    shift: 'Turno 14/04 — Noite', date: '2026-04-14T19:30:00',
  },
  {
    id: 'br3', productId: 'p8', productName: 'Whisky Jack Daniel\'s', category: 'Spirits',
    quantity: 1, unit: 'dose', costPerUnit: 1.8, totalLoss: 1.8,
    reason: 'Oferta ao cliente VIP — autorizado pelo Admin', operator: 'Admin',
    shift: 'Turno 15/04 — Noite', date: '2026-04-15T21:00:00',
  },
  {
    id: 'br4', productId: 'p1', productName: 'Super Bock', category: 'Cervejas',
    quantity: 6, unit: 'un', costPerUnit: 0.6, totalLoss: 3.6,
    reason: 'Cerveja quente — devolvida ao fornecedor', operator: 'João Silva',
    shift: 'Turno 13/04 — Tarde', date: '2026-04-13T15:00:00',
  },
  {
    id: 'br5', productId: 'p20', productName: 'Amendoins', category: 'Snacks',
    quantity: 3, unit: 'un', costPerUnit: 0.4, totalLoss: 1.2,
    reason: 'Prazo de validade expirado', operator: 'Ana Ferreira',
    shift: 'Turno 12/04 — Noite', date: '2026-04-12T22:00:00',
  },
  {
    id: 'br6', productId: 'p15', productName: 'Água s/ Gás', category: 'Refrigerantes',
    quantity: 8, unit: 'un', costPerUnit: 0.3, totalLoss: 2.4,
    reason: 'Garrafa com defeito — lote retirado', operator: 'Admin',
    shift: 'Turno 11/04 — Tarde', date: '2026-04-11T14:00:00',
  },
];

export const pendingAccountsReport: PendingAccountReport[] = [
  {
    id: 'pend1', personName: 'Miguel Ferreira', tableNumber: 3,
    total: 40.0, paid: 20.0, remaining: 20.0,
    pendingReason: 'Cliente saiu sem pagar o restante. Prometeu pagar amanhã.',
    responsible: 'João Silva', openedAt: '2026-04-14T21:30:00',
    closedAt: '2026-04-14T23:00:00', daysOpen: 1,
  },
  {
    id: 'pend2', personName: 'Grupo Empresa XYZ', tableNumber: 7,
    total: 52.0, paid: 0, remaining: 52.0,
    pendingReason: 'Empresa vai pagar por transferência bancária até sexta-feira.',
    responsible: 'Admin', openedAt: '2026-04-13T20:00:00',
    closedAt: '2026-04-13T23:30:00', daysOpen: 2,
  },
  {
    id: 'pend3', personName: 'Luís Santos', tableNumber: 1,
    total: 22.0, paid: 10.0, remaining: 12.0,
    pendingReason: 'Não tinha dinheiro suficiente. Pagamento parcial aceite.',
    responsible: 'Maria Costa', openedAt: '2026-04-12T22:00:00',
    closedAt: '2026-04-12T23:45:00', daysOpen: 3,
  },
];
