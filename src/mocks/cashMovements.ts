export interface CashMovement {
  id: string;
  type: 'in' | 'out';
  amount: number;
  description: string;
  paymentMethod: 'cash' | 'card' | 'mobile' | 'transfer';
  category: string;
  operator: string;
  shiftId: string;
  createdAt: string;
  orderId?: string;
}

export interface CashShift {
  id: string;
  openedBy: string;
  openedAt: string;
  openingBalance: number;
  closedAt?: string;
  closedBy?: string;
  expectedBalance?: number;
  countedBalance?: number;
  difference?: number;
  unpaidOrdersCount?: number;
  unpaidOrdersTotal?: number;
  status: 'open' | 'closed';
}

export const currentShift: CashShift = {
  id: 'shift1',
  openedBy: 'João Silva',
  openedAt: '2026-04-15T18:00:00',
  openingBalance: 150.0,
  status: 'open',
};

export const cashMovements: CashMovement[] = [
  { id: 'cm1', type: 'in', amount: 6.5, description: 'Venda Mesa 1 — Carlos', paymentMethod: 'cash', category: 'Venda', operator: 'João', shiftId: 'shift1', createdAt: '2026-04-15T20:20:00', orderId: 'o1' },
  { id: 'cm2', type: 'in', amount: 23.5, description: 'Venda Mesa 2 — Ana', paymentMethod: 'card', category: 'Venda', operator: 'Maria', shiftId: 'shift1', createdAt: '2026-04-15T20:30:00', orderId: 'o2a' },
  { id: 'cm3', type: 'in', amount: 12.0, description: 'Venda Mesa 5 — Sofia', paymentMethod: 'mobile', category: 'Venda', operator: 'João', shiftId: 'shift1', createdAt: '2026-04-15T20:45:00', orderId: 'o3' },
  { id: 'cm4', type: 'out', amount: 25.0, description: 'Compra gelo e limões', paymentMethod: 'cash', category: 'Despesa', operator: 'Admin', shiftId: 'shift1', createdAt: '2026-04-15T19:00:00' },
  { id: 'cm5', type: 'in', amount: 45.0, description: 'Venda POS — Balcão', paymentMethod: 'cash', category: 'Venda', operator: 'Ana', shiftId: 'shift1', createdAt: '2026-04-15T21:00:00' },
  { id: 'cm6', type: 'in', amount: 16.0, description: 'Venda Mesa 12 — Rui', paymentMethod: 'card', category: 'Venda', operator: 'Maria', shiftId: 'shift1', createdAt: '2026-04-15T21:15:00', orderId: 'o5' },
  { id: 'cm7', type: 'out', amount: 10.0, description: 'Troco fundo de caixa', paymentMethod: 'cash', category: 'Operacional', operator: 'João', shiftId: 'shift1', createdAt: '2026-04-15T18:30:00' },
  { id: 'cm8', type: 'in', amount: 13.0, description: 'Venda Mesa 8', paymentMethod: 'cash', category: 'Venda', operator: 'Ana', shiftId: 'shift1', createdAt: '2026-04-15T21:30:00', orderId: 'o4' },
  { id: 'cm9', type: 'in', amount: 28.0, description: 'Venda POS — Balcão', paymentMethod: 'transfer', category: 'Venda', operator: 'João', shiftId: 'shift1', createdAt: '2026-04-15T22:00:00' },
  { id: 'cm10', type: 'out', amount: 5.0, description: 'Quebra de copo', paymentMethod: 'cash', category: 'Quebra', operator: 'Maria', shiftId: 'shift1', createdAt: '2026-04-15T22:30:00' },
];

export const previousShifts: CashShift[] = [
  {
    id: 'shift0',
    openedBy: 'Maria Costa',
    openedAt: '2026-04-14T18:00:00',
    openingBalance: 100.0,
    closedAt: '2026-04-14T23:59:00',
    closedBy: 'Maria Costa',
    expectedBalance: 387.50,
    countedBalance: 382.00,
    difference: -5.50,
    unpaidOrdersCount: 1,
    unpaidOrdersTotal: 40.0,
    status: 'closed',
  },
  {
    id: 'shift_1',
    openedBy: 'João Silva',
    openedAt: '2026-04-13T18:00:00',
    openingBalance: 120.0,
    closedAt: '2026-04-13T23:59:00',
    closedBy: 'João Silva',
    expectedBalance: 445.00,
    countedBalance: 445.00,
    difference: 0,
    unpaidOrdersCount: 2,
    unpaidOrdersTotal: 74.0,
    status: 'closed',
  },
];
