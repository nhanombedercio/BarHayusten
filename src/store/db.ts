/**
 * Hayusten BarOne — Supabase Data Layer with in-memory cache
 * All writes go directly to Supabase. Cache is kept in sync.
 * Realtime subscriptions push updates to all connected clients.
 */

import { supabase } from '@/lib/supabaseClient';
import { Product, StockMovement, ProductStructureType } from '@/mocks/products';
import { BarSettings, Warehouse, UserPermission } from '@/mocks/settings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppUserDB {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier' | 'barman';
  avatar: string;
  active: boolean;
  password: string;
  permissions?: Partial<UserPermission>;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export interface Debt {
  id: string;
  clientId: string;
  clientName: string;
  tableId?: string;
  tableName?: string;
  items: { productId: string; productName: string; quantity: number; price: number }[];
  totalAmount: number;
  paidAmount: number;
  status: 'unpaid' | 'partial' | 'paid';
  createdAt: string;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
  operator: string;
  payments: DebtPayment[];
}

export interface DebtPayment {
  id: string;
  amount: number;
  method: 'cash' | 'card' | 'mobile' | 'transfer';
  paidAt: string;
  operator: string;
  notes?: string;
}

export interface SaleRecord {
  id: string;
  items: { id: string; name: string; price: number; qty: number }[];
  total: number;
  status: 'draft' | 'paid' | 'cancelled' | 'reversed';
  payMethod: 'cash' | 'card' | 'mobile' | 'transfer' | 'partial';
  tableId?: string;
  tableName?: string;
  clientId?: string;
  personName: string;
  operator: string;
  createdAt: string;
  paidAmount?: number;
  shiftId?: string;
}

export interface Table {
  id: string;
  name: string;
  number: number;
  capacity: number;
  status: 'free' | 'occupied' | 'reserved';
  clientName?: string;
  orders: TableOrder[];
}

export interface TableOrder {
  id: string;
  tableId: string;
  personName?: string;
  items: { productId: string; productName: string; quantity: number; price: number; personName?: string }[];
  total: number;
  paid: number;
  status: 'open' | 'paid' | 'pending';
  pendingReason?: string;
  pendingResponsible?: string;
  waiter: string;
  createdAt: string;
  closedAt?: string;
}

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
  dayClosureId?: string;
}

export interface DailyClosureRecord {
  id: string;
  date: string;
  closedBy: string;
  closedAt: string;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalMobile: number;
  totalTransfer: number;
  totalExpected: number;
  totalCounted: number;
  totalDifference: number;
  shiftCount: number;
  operators: string[];
  shiftIds: string[];
  notes: string;
  createdAt: string;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface Cache {
  users: AppUserDB[];
  products: Product[];
  movements: StockMovement[];
  tables: Table[];
  pendingOrders: TableOrder[];
  cashMovements: CashMovement[];
  currentShift: CashShift | null;
  previousShifts: CashShift[];
  dailyClosures: DailyClosureRecord[];
  barSettings: BarSettings;
  warehouses: Warehouse[];
  clients: Client[];
  debts: Debt[];
  sales: SaleRecord[];
  loaded: boolean;
}

const defaultBarSettings: BarSettings = {
  name: 'Hayusten Bar', location: 'Maputo, Moçambique', currency: 'MZN',
  currencySymbol: 'MT', allowNegativeStock: false, allowDiscounts: true,
  maxDiscountPercent: 20, tableManagement: true, personManagement: true, requirePendingReason: true,
};

const defaultShift: CashShift = {
  id: 'shift1', openedBy: 'Admin', openedAt: new Date().toISOString(),
  openingBalance: 0, status: 'open',
};

const cache: Cache = {
  users: [], products: [], movements: [], tables: [], pendingOrders: [],
  cashMovements: [], currentShift: null, previousShifts: [], dailyClosures: [],
  barSettings: defaultBarSettings, warehouses: [], clients: [], debts: [], sales: [],
  loaded: false,
};

// ─── Realtime change listeners ────────────────────────────────────────────────

type ChangeListener = () => void;
const listeners: Set<ChangeListener> = new Set();

export function onCacheChange(fn: ChangeListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners() {
  listeners.forEach(fn => fn());
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapUser(row: Record<string, unknown>): AppUserDB {
  return {
    id: row.id as string, name: row.name as string,
    role: row.role as AppUserDB['role'], avatar: row.avatar as string,
    active: row.active as boolean, password: row.password as string,
    permissions: row.permissions as Partial<UserPermission> | undefined,
  };
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string, name: row.name as string, category: row.category as string,
    price: Number(row.price), cost: Number(row.cost), stock: Number(row.stock),
    minStock: Number(row.min_stock), criticalStock: Number(row.critical_stock),
    unit: row.unit as string, warehouse: row.warehouse as string,
    structureType: (row.structure_type as ProductStructureType) || 'unit',
    unitsPerPack: Number(row.units_per_pack) || 1,
    packsPerBox: Number(row.packs_per_box) || 1,
    isComposite: row.is_composite as boolean | undefined,
    ingredients: row.ingredients as Product['ingredients'],
  };
}

function mapDailyClosure(row: Record<string, unknown>): DailyClosureRecord {
  return {
    id: row.id as string,
    date: row.date as string,
    closedBy: row.closed_by as string,
    closedAt: row.closed_at as string,
    totalSales: Number(row.total_sales),
    totalCash: Number(row.total_cash),
    totalCard: Number(row.total_card),
    totalMobile: Number(row.total_mobile),
    totalTransfer: Number(row.total_transfer),
    totalExpected: Number(row.total_expected),
    totalCounted: Number(row.total_counted),
    totalDifference: Number(row.total_difference),
    shiftCount: Number(row.shift_count),
    operators: (row.operators as string[]) || [],
    shiftIds: (row.shift_ids as string[]) || [],
    notes: (row.notes as string) || '',
    createdAt: row.created_at as string,
  };
}

function mapOrder(row: Record<string, unknown>): TableOrder {
  return {
    id: row.id as string, tableId: row.table_id as string,
    personName: row.person_name as string | undefined,
    items: (row.items as TableOrder['items']) || [],
    total: Number(row.total), paid: Number(row.paid),
    status: row.status as TableOrder['status'],
    pendingReason: row.pending_reason as string | undefined,
    pendingResponsible: row.pending_responsible as string | undefined,
    waiter: row.waiter as string, createdAt: row.created_at as string,
    closedAt: row.closed_at as string | undefined,
  };
}

function mapTable(row: Record<string, unknown>, orders: TableOrder[]): Table {
  return {
    id: row.id as string, name: row.name as string, number: Number(row.number),
    capacity: Number(row.capacity), status: row.status as Table['status'],
    clientName: row.client_name as string | undefined,
    orders: orders.filter(o => o.tableId === (row.id as string) && o.status !== 'pending'),
  };
}

function mapCashMovement(row: Record<string, unknown>): CashMovement {
  return {
    id: row.id as string, type: row.type as CashMovement['type'],
    amount: Number(row.amount), description: row.description as string,
    paymentMethod: row.payment_method as CashMovement['paymentMethod'],
    category: row.category as string, operator: row.operator as string,
    shiftId: row.shift_id as string, createdAt: row.created_at as string,
    orderId: row.order_id as string | undefined,
  };
}

function mapShift(row: Record<string, unknown>): CashShift {
  return {
    id: row.id as string, openedBy: row.opened_by as string,
    openedAt: row.opened_at as string, openingBalance: Number(row.opening_balance),
    closedAt: row.closed_at as string | undefined, closedBy: row.closed_by as string | undefined,
    expectedBalance: row.expected_balance != null ? Number(row.expected_balance) : undefined,
    countedBalance: row.counted_balance != null ? Number(row.counted_balance) : undefined,
    difference: row.difference != null ? Number(row.difference) : undefined,
    unpaidOrdersCount: row.unpaid_orders_count != null ? Number(row.unpaid_orders_count) : undefined,
    unpaidOrdersTotal: row.unpaid_orders_total != null ? Number(row.unpaid_orders_total) : undefined,
    status: row.status as CashShift['status'],
  };
}

function mapClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string, name: row.name as string, phone: row.phone as string,
    email: row.email as string | undefined, notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapDebt(row: Record<string, unknown>): Debt {
  return {
    id: row.id as string, clientId: row.client_id as string,
    clientName: row.client_name as string,
    tableId: row.table_id as string | undefined, tableName: row.table_name as string | undefined,
    items: (row.items as Debt['items']) || [],
    totalAmount: Number(row.total_amount), paidAmount: Number(row.paid_amount),
    status: row.status as Debt['status'], createdAt: row.created_at as string,
    dueDate: row.due_date as string | undefined, paidAt: row.paid_at as string | undefined,
    notes: row.notes as string | undefined, operator: row.operator as string,
    payments: (row.payments as DebtPayment[]) || [],
  };
}

function mapSale(row: Record<string, unknown>): SaleRecord {
  return {
    id: row.id as string, items: (row.items as SaleRecord['items']) || [],
    total: Number(row.total), status: row.status as SaleRecord['status'],
    payMethod: row.pay_method as SaleRecord['payMethod'],
    tableId: row.table_id as string | undefined, tableName: row.table_name as string | undefined,
    clientId: row.client_id as string | undefined, personName: row.person_name as string,
    operator: row.operator as string, createdAt: row.created_at as string,
    paidAmount: row.paid_amount != null ? Number(row.paid_amount) : undefined,
    shiftId: row.shift_id as string | undefined,
  };
}

function mapBarSettings(row: Record<string, unknown>): BarSettings {
  return {
    name: row.name as string, location: row.location as string,
    currency: row.currency as string, currencySymbol: row.currency_symbol as string,
    allowNegativeStock: row.allow_negative_stock as boolean,
    allowDiscounts: row.allow_discounts as boolean,
    maxDiscountPercent: Number(row.max_discount_percent),
    tableManagement: row.table_management as boolean,
    personManagement: row.person_management as boolean,
    requirePendingReason: row.require_pending_reason as boolean,
  };
}

function mapWarehouse(row: Record<string, unknown>): Warehouse {
  return {
    id: row.id as string, name: row.name as string,
    description: row.description as string, active: row.active as boolean,
  };
}

function mapStockMovement(row: Record<string, unknown>): StockMovement {
  return {
    id: row.id as string, productId: row.product_id as string,
    productName: row.product_name as string, type: row.type as StockMovement['type'],
    quantity: Number(row.quantity),
    fromWarehouse: row.from_warehouse as string | undefined,
    toWarehouse: row.to_warehouse as string | undefined,
    reason: row.reason as string | undefined, operator: row.operator as string,
    createdAt: row.created_at as string,
  };
}

// ─── Load all data into cache ─────────────────────────────────────────────────

export async function loadAllData(): Promise<void> {
  const [
    { data: usersData },
    { data: productsData },
    { data: movementsData },
    { data: tablesData },
    { data: ordersData },
    { data: cashMovData },
    { data: shiftsData },
    { data: settingsData },
    { data: warehousesData },
    { data: clientsData },
    { data: debtsData },
    { data: salesData },
    { data: dailyClosuresData },
  ] = await Promise.all([
    supabase.from('app_users').select('*').order('created_at'),
    supabase.from('products').select('*').order('category').order('name'),
    supabase.from('stock_movements').select('*').order('created_at', { ascending: false }),
    supabase.from('tables').select('*').order('number'),
    supabase.from('table_orders').select('*').order('created_at'),
    supabase.from('cash_movements').select('*').order('created_at', { ascending: false }),
    supabase.from('cash_shifts').select('*').order('opened_at', { ascending: false }),
    supabase.from('bar_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('warehouses').select('*').order('name'),
    supabase.from('clients').select('*').order('name'),
    supabase.from('debts').select('*').order('created_at', { ascending: false }),
    supabase.from('sales').select('*').order('created_at', { ascending: false }),
    supabase.from('daily_closures').select('*').order('created_at', { ascending: false }),
  ]);

  const orders = (ordersData || []).map(r => mapOrder(r as Record<string, unknown>));

  cache.users = (usersData || []).map(r => mapUser(r as Record<string, unknown>));
  cache.products = (productsData || []).map(r => mapProduct(r as Record<string, unknown>));
  cache.movements = (movementsData || []).map(r => mapStockMovement(r as Record<string, unknown>));
  cache.tables = (tablesData || []).map(r => mapTable(r as Record<string, unknown>, orders));
  cache.pendingOrders = orders.filter(o => o.status === 'pending');
  cache.cashMovements = (cashMovData || []).map(r => mapCashMovement(r as Record<string, unknown>));
  const allShifts = (shiftsData || []).map(r => mapShift(r as Record<string, unknown>));
  cache.currentShift = allShifts.find(s => s.status === 'open') || null;
  cache.previousShifts = allShifts.filter(s => s.status === 'closed');
  cache.barSettings = settingsData ? mapBarSettings(settingsData as Record<string, unknown>) : defaultBarSettings;
  cache.warehouses = (warehousesData || []).map(r => mapWarehouse(r as Record<string, unknown>));
  cache.clients = (clientsData || []).map(r => mapClient(r as Record<string, unknown>));
  cache.debts = (debtsData || []).map(r => mapDebt(r as Record<string, unknown>));
  cache.sales = (salesData || []).map(r => mapSale(r as Record<string, unknown>));
  cache.dailyClosures = (dailyClosuresData || []).map(r => mapDailyClosure(r as Record<string, unknown>));
  cache.loaded = true;

  localStorage.setItem('barone_users_cache', JSON.stringify(cache.users));
  notifyListeners();
}

// ─── Realtime setup ───────────────────────────────────────────────────────────

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function setupRealtime(): () => void {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabase
    .channel('barone-realtime-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'table_orders' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_shifts' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouses' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bar_settings' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_closures' }, () => loadAllData())
    .subscribe();

  return () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export const db = {
  // ── Cache status ───────────────────────────────────────────────────────────
  isLoaded: () => cache.loaded,

  // ── Users ──────────────────────────────────────────────────────────────────
  getUsers: () => cache.users,
  getUsersSync: (): AppUserDB[] => {
    if (cache.users.length > 0) return cache.users;
    try {
      const cached = localStorage.getItem('barone_users_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  },
  upsertUser: async (u: AppUserDB): Promise<void> => {
    cache.users = cache.users.some(x => x.id === u.id)
      ? cache.users.map(x => x.id === u.id ? u : x)
      : [...cache.users, u];
    localStorage.setItem('barone_users_cache', JSON.stringify(cache.users));
    await supabase.from('app_users').upsert({
      id: u.id, name: u.name, role: u.role, avatar: u.avatar,
      active: u.active, password: u.password, permissions: u.permissions || null,
    });
    notifyListeners();
  },
  deleteUser: async (id: string): Promise<void> => {
    cache.users = cache.users.filter(u => u.id !== id);
    localStorage.setItem('barone_users_cache', JSON.stringify(cache.users));
    await supabase.from('app_users').delete().eq('id', id);
    notifyListeners();
  },
  // Legacy setUsers — upserts all, does NOT delete removed ones (use upsertUser/deleteUser instead)
  setUsers: async (users: AppUserDB[]): Promise<void> => {
    cache.users = users;
    localStorage.setItem('barone_users_cache', JSON.stringify(users));
    for (const u of users) {
      await supabase.from('app_users').upsert({
        id: u.id, name: u.name, role: u.role, avatar: u.avatar,
        active: u.active, password: u.password, permissions: u.permissions || null,
      });
    }
    notifyListeners();
  },

  // ── Products ───────────────────────────────────────────────────────────────
  getProducts: () => cache.products,
  upsertProduct: async (p: Product): Promise<void> => {
    cache.products = cache.products.some(x => x.id === p.id)
      ? cache.products.map(x => x.id === p.id ? p : x)
      : [...cache.products, p];
    await supabase.from('products').upsert({
      id: p.id, name: p.name, category: p.category, price: p.price, cost: p.cost,
      stock: p.stock, min_stock: p.minStock, critical_stock: p.criticalStock,
      unit: p.unit, warehouse: p.warehouse, is_composite: p.isComposite || false,
      ingredients: p.ingredients || [],
      structure_type: p.structureType || 'unit',
      units_per_pack: p.unitsPerPack || 1,
      packs_per_box: p.packsPerBox || 1,
      updated_at: new Date().toISOString(),
    });
    notifyListeners();
  },
  deleteProduct: async (id: string): Promise<void> => {
    cache.products = cache.products.filter(p => p.id !== id);
    await supabase.from('products').delete().eq('id', id);
    notifyListeners();
  },
  // Legacy setProducts — only upserts, does NOT delete removed ones
  setProducts: async (products: Product[]): Promise<void> => {
    cache.products = products;
    for (const p of products) {
      await supabase.from('products').upsert({
        id: p.id, name: p.name, category: p.category, price: p.price, cost: p.cost,
        stock: p.stock, min_stock: p.minStock, critical_stock: p.criticalStock,
        unit: p.unit, warehouse: p.warehouse, is_composite: p.isComposite || false,
        ingredients: p.ingredients || [],
        structure_type: p.structureType || 'unit',
        units_per_pack: p.unitsPerPack || 1,
        packs_per_box: p.packsPerBox || 1,
        updated_at: new Date().toISOString(),
      });
    }
    notifyListeners();
  },

  // ── Stock Movements ────────────────────────────────────────────────────────
  getMovements: () => cache.movements,
  addMovement: async (m: StockMovement): Promise<void> => {
    cache.movements = [m, ...cache.movements];
    await supabase.from('stock_movements').insert({
      id: m.id, product_id: m.productId, product_name: m.productName, type: m.type,
      quantity: m.quantity, from_warehouse: m.fromWarehouse || null,
      to_warehouse: m.toWarehouse || null, reason: m.reason || null,
      operator: m.operator, created_at: m.createdAt,
    });
    notifyListeners();
  },
  deleteMovement: async (id: string): Promise<void> => {
    cache.movements = cache.movements.filter(m => m.id !== id);
    await supabase.from('stock_movements').delete().eq('id', id);
    notifyListeners();
  },
  // Legacy setMovements — only upserts
  setMovements: async (movements: StockMovement[]): Promise<void> => {
    cache.movements = movements;
    for (const m of movements) {
      await supabase.from('stock_movements').upsert({
        id: m.id, product_id: m.productId, product_name: m.productName, type: m.type,
        quantity: m.quantity, from_warehouse: m.fromWarehouse || null,
        to_warehouse: m.toWarehouse || null, reason: m.reason || null,
        operator: m.operator, created_at: m.createdAt,
      });
    }
    notifyListeners();
  },

  // ── Tables ─────────────────────────────────────────────────────────────────
  getTables: () => cache.tables,
  upsertTable: async (t: Omit<Table, 'orders'>): Promise<void> => {
    const existing = cache.tables.find(x => x.id === t.id);
    const updated = { ...t, orders: existing?.orders || [] };
    cache.tables = cache.tables.some(x => x.id === t.id)
      ? cache.tables.map(x => x.id === t.id ? updated : x)
      : [...cache.tables, updated];
    await supabase.from('tables').upsert({
      id: t.id, name: t.name, number: t.number, capacity: t.capacity,
      status: t.status, client_name: t.clientName || null,
      updated_at: new Date().toISOString(),
    });
    notifyListeners();
  },
  deleteTable: async (id: string): Promise<void> => {
    cache.tables = cache.tables.filter(t => t.id !== id);
    await supabase.from('tables').delete().eq('id', id);
    await supabase.from('table_orders').delete().eq('table_id', id);
    notifyListeners();
  },
  // setTables: upserts all tables and their orders (used for bulk updates)
  setTables: async (tables: Table[]): Promise<void> => {
    cache.tables = tables;
    for (const t of tables) {
      await supabase.from('tables').upsert({
        id: t.id, name: t.name, number: t.number, capacity: t.capacity,
        status: t.status, client_name: t.clientName || null,
        updated_at: new Date().toISOString(),
      });
      for (const o of t.orders) {
        await supabase.from('table_orders').upsert({
          id: o.id, table_id: o.tableId, person_name: o.personName || null,
          items: o.items, total: o.total, paid: o.paid, status: o.status,
          pending_reason: o.pendingReason || null, pending_responsible: o.pendingResponsible || null,
          waiter: o.waiter, created_at: o.createdAt, closed_at: o.closedAt || null,
        });
      }
    }
    notifyListeners();
  },

  // ── Table Orders ───────────────────────────────────────────────────────────
  getPendingOrders: () => cache.pendingOrders,
  upsertOrder: async (o: TableOrder): Promise<void> => {
    if (o.status === 'pending') {
      cache.pendingOrders = cache.pendingOrders.some(x => x.id === o.id)
        ? cache.pendingOrders.map(x => x.id === o.id ? o : x)
        : [o, ...cache.pendingOrders];
    } else {
      cache.pendingOrders = cache.pendingOrders.filter(x => x.id !== o.id);
    }
    // Update in tables cache
    cache.tables = cache.tables.map(t => {
      if (t.id !== o.tableId) return t;
      const hasOrder = t.orders.some(x => x.id === o.id);
      const orders = hasOrder
        ? t.orders.map(x => x.id === o.id ? o : x)
        : [...t.orders, o];
      return { ...t, orders: orders.filter(x => x.status !== 'pending') };
    });
    await supabase.from('table_orders').upsert({
      id: o.id, table_id: o.tableId, person_name: o.personName || null,
      items: o.items, total: o.total, paid: o.paid, status: o.status,
      pending_reason: o.pendingReason || null, pending_responsible: o.pendingResponsible || null,
      waiter: o.waiter, created_at: o.createdAt, closed_at: o.closedAt || null,
    });
    notifyListeners();
  },
  deleteOrder: async (id: string): Promise<void> => {
    cache.pendingOrders = cache.pendingOrders.filter(o => o.id !== id);
    await supabase.from('table_orders').delete().eq('id', id);
    notifyListeners();
  },
  setPendingOrders: async (orders: TableOrder[]): Promise<void> => {
    cache.pendingOrders = orders;
    for (const o of orders) {
      await supabase.from('table_orders').upsert({
        id: o.id, table_id: o.tableId, person_name: o.personName || null,
        items: o.items, total: o.total, paid: o.paid, status: o.status,
        pending_reason: o.pendingReason || null, pending_responsible: o.pendingResponsible || null,
        waiter: o.waiter, created_at: o.createdAt, closed_at: o.closedAt || null,
      });
    }
    notifyListeners();
  },

  // ── Cash Movements ─────────────────────────────────────────────────────────
  getCashMovements: () => cache.cashMovements,
  addCashMovement: async (m: CashMovement): Promise<void> => {
    cache.cashMovements = [m, ...cache.cashMovements];
    await supabase.from('cash_movements').insert({
      id: m.id, type: m.type, amount: m.amount, description: m.description,
      payment_method: m.paymentMethod, category: m.category, operator: m.operator,
      shift_id: m.shiftId, order_id: m.orderId || null, created_at: m.createdAt,
    });
    notifyListeners();
  },
  setCashMovements: async (movements: CashMovement[]): Promise<void> => {
    cache.cashMovements = movements;
    for (const m of movements) {
      await supabase.from('cash_movements').upsert({
        id: m.id, type: m.type, amount: m.amount, description: m.description,
        payment_method: m.paymentMethod, category: m.category, operator: m.operator,
        shift_id: m.shiftId, order_id: m.orderId || null, created_at: m.createdAt,
      });
    }
    notifyListeners();
  },

  // ── Cash Shifts ────────────────────────────────────────────────────────────
  getCurrentShift: () => cache.currentShift || defaultShift,
  setCurrentShift: async (shift: CashShift): Promise<void> => {
    cache.currentShift = shift;
    await supabase.from('cash_shifts').upsert({
      id: shift.id, opened_by: shift.openedBy, opened_at: shift.openedAt,
      opening_balance: shift.openingBalance, closed_at: shift.closedAt || null,
      closed_by: shift.closedBy || null, expected_balance: shift.expectedBalance ?? null,
      counted_balance: shift.countedBalance ?? null, difference: shift.difference ?? null,
      unpaid_orders_count: shift.unpaidOrdersCount ?? null,
      unpaid_orders_total: shift.unpaidOrdersTotal ?? null, status: shift.status,
      day_closure_id: shift.dayClosureId || null,
    });
    notifyListeners();
  },
  getPreviousShifts: () => cache.previousShifts,
  setPreviousShifts: async (shifts: CashShift[]): Promise<void> => {
    cache.previousShifts = shifts;
    for (const s of shifts) {
      await supabase.from('cash_shifts').upsert({
        id: s.id, opened_by: s.openedBy, opened_at: s.openedAt,
        opening_balance: s.openingBalance, closed_at: s.closedAt || null,
        closed_by: s.closedBy || null, expected_balance: s.expectedBalance ?? null,
        counted_balance: s.countedBalance ?? null, difference: s.difference ?? null,
        unpaid_orders_count: s.unpaidOrdersCount ?? null,
        unpaid_orders_total: s.unpaidOrdersTotal ?? null, status: s.status,
        day_closure_id: s.dayClosureId || null,
      });
    }
    notifyListeners();
  },

  // ── Daily Closures ─────────────────────────────────────────────────────────
  getDailyClosures: () => cache.dailyClosures,
  upsertDailyClosure: async (dc: DailyClosureRecord): Promise<void> => {
    cache.dailyClosures = cache.dailyClosures.some(x => x.id === dc.id)
      ? cache.dailyClosures.map(x => x.id === dc.id ? dc : x)
      : [dc, ...cache.dailyClosures];
    await supabase.from('daily_closures').upsert({
      id: dc.id, date: dc.date, closed_by: dc.closedBy, closed_at: dc.closedAt,
      total_sales: dc.totalSales, total_cash: dc.totalCash, total_card: dc.totalCard,
      total_mobile: dc.totalMobile, total_transfer: dc.totalTransfer,
      total_expected: dc.totalExpected, total_counted: dc.totalCounted,
      total_difference: dc.totalDifference, shift_count: dc.shiftCount,
      operators: dc.operators, shift_ids: dc.shiftIds, notes: dc.notes,
      created_at: dc.createdAt,
    });
    notifyListeners();
  },

  // ── Bar Settings ───────────────────────────────────────────────────────────
  getBarSettings: () => cache.barSettings,
  setBarSettings: async (settings: BarSettings): Promise<void> => {
    cache.barSettings = settings;
    await supabase.from('bar_settings').upsert({
      id: 1, name: settings.name, location: settings.location,
      currency: settings.currency, currency_symbol: settings.currencySymbol,
      allow_negative_stock: settings.allowNegativeStock, allow_discounts: settings.allowDiscounts,
      max_discount_percent: settings.maxDiscountPercent, table_management: settings.tableManagement,
      person_management: settings.personManagement, require_pending_reason: settings.requirePendingReason,
      updated_at: new Date().toISOString(),
    });
    notifyListeners();
  },

  // ── Warehouses ─────────────────────────────────────────────────────────────
  getWarehouses: () => cache.warehouses,
  upsertWarehouse: async (w: Warehouse): Promise<void> => {
    cache.warehouses = cache.warehouses.some(x => x.id === w.id)
      ? cache.warehouses.map(x => x.id === w.id ? w : x)
      : [...cache.warehouses, w];
    await supabase.from('warehouses').upsert({
      id: w.id, name: w.name, description: w.description, active: w.active,
    });
    notifyListeners();
  },
  deleteWarehouse: async (id: string): Promise<void> => {
    cache.warehouses = cache.warehouses.filter(w => w.id !== id);
    await supabase.from('warehouses').delete().eq('id', id);
    notifyListeners();
  },
  setWarehouses: async (warehouses: Warehouse[]): Promise<void> => {
    cache.warehouses = warehouses;
    for (const w of warehouses) {
      await supabase.from('warehouses').upsert({
        id: w.id, name: w.name, description: w.description, active: w.active,
      });
    }
    notifyListeners();
  },

  // ── Clients ────────────────────────────────────────────────────────────────
  getClients: () => cache.clients,
  upsertClient: async (c: Client): Promise<void> => {
    cache.clients = cache.clients.some(x => x.id === c.id)
      ? cache.clients.map(x => x.id === c.id ? c : x)
      : [...cache.clients, c];
    await supabase.from('clients').upsert({
      id: c.id, name: c.name, phone: c.phone, email: c.email || '',
      notes: c.notes || '', created_at: c.createdAt,
    });
    notifyListeners();
  },
  deleteClient: async (id: string): Promise<void> => {
    cache.clients = cache.clients.filter(c => c.id !== id);
    await supabase.from('clients').delete().eq('id', id);
    notifyListeners();
  },
  setClients: async (clients: Client[]): Promise<void> => {
    cache.clients = clients;
    for (const c of clients) {
      await supabase.from('clients').upsert({
        id: c.id, name: c.name, phone: c.phone, email: c.email || '',
        notes: c.notes || '', created_at: c.createdAt,
      });
    }
    notifyListeners();
  },

  // ── Debts ──────────────────────────────────────────────────────────────────
  getDebts: () => cache.debts,
  upsertDebt: async (d: Debt): Promise<void> => {
    cache.debts = cache.debts.some(x => x.id === d.id)
      ? cache.debts.map(x => x.id === d.id ? d : x)
      : [d, ...cache.debts];
    await supabase.from('debts').upsert({
      id: d.id, client_id: d.clientId, client_name: d.clientName,
      table_id: d.tableId || null, table_name: d.tableName || null,
      items: d.items, total_amount: d.totalAmount, paid_amount: d.paidAmount,
      status: d.status, due_date: d.dueDate || null, paid_at: d.paidAt || null,
      notes: d.notes || '', operator: d.operator, payments: d.payments,
      created_at: d.createdAt,
    });
    notifyListeners();
  },
  deleteDebt: async (id: string): Promise<void> => {
    cache.debts = cache.debts.filter(d => d.id !== id);
    await supabase.from('debts').delete().eq('id', id);
    notifyListeners();
  },
  setDebts: async (debts: Debt[]): Promise<void> => {
    cache.debts = debts;
    for (const d of debts) {
      await supabase.from('debts').upsert({
        id: d.id, client_id: d.clientId, client_name: d.clientName,
        table_id: d.tableId || null, table_name: d.tableName || null,
        items: d.items, total_amount: d.totalAmount, paid_amount: d.paidAmount,
        status: d.status, due_date: d.dueDate || null, paid_at: d.paidAt || null,
        notes: d.notes || '', operator: d.operator, payments: d.payments,
        created_at: d.createdAt,
      });
    }
    notifyListeners();
  },

  // ── Sales ──────────────────────────────────────────────────────────────────
  getSales: () => cache.sales,
  addSale: async (s: SaleRecord): Promise<void> => {
    cache.sales = [s, ...cache.sales];
    await supabase.from('sales').insert({
      id: s.id, items: s.items, total: s.total, status: s.status,
      pay_method: s.payMethod, table_id: s.tableId || null, table_name: s.tableName || null,
      client_id: s.clientId || null, person_name: s.personName, operator: s.operator,
      paid_amount: s.paidAmount ?? null, created_at: s.createdAt,
      shift_id: s.shiftId || null,
    });
    notifyListeners();
  },
  setSales: async (sales: SaleRecord[]): Promise<void> => {
    cache.sales = sales;
    for (const s of sales) {
      await supabase.from('sales').upsert({
        id: s.id, items: s.items, total: s.total, status: s.status,
        pay_method: s.payMethod, table_id: s.tableId || null, table_name: s.tableName || null,
        client_id: s.clientId || null, person_name: s.personName, operator: s.operator,
        paid_amount: s.paidAmount ?? null, created_at: s.createdAt,
        shift_id: s.shiftId || null,
      });
    }
    notifyListeners();
  },
  deleteSale: async (id: string): Promise<void> => {
    cache.sales = cache.sales.filter(s => s.id !== id);
    await supabase.from('sales').delete().eq('id', id);
    notifyListeners();
  },

  // ── Reload from Supabase ───────────────────────────────────────────────────
  reload: loadAllData,

  // ── Reset ──────────────────────────────────────────────────────────────────
  resetAll: async (): Promise<void> => {
    await supabase.from('sales').delete().neq('id', '');
    await supabase.from('debts').delete().neq('id', '');
    await supabase.from('clients').delete().neq('id', '');
    await supabase.from('cash_movements').delete().neq('id', '');
    await supabase.from('cash_shifts').delete().neq('id', '');
    await supabase.from('table_orders').delete().neq('id', '');
    await supabase.from('tables').delete().neq('id', '');
    await supabase.from('stock_movements').delete().neq('id', '');
    await supabase.from('products').delete().neq('id', '');
    await supabase.from('warehouses').delete().neq('id', '');
    await supabase.from('app_users').delete().neq('id', 'u1');
    await supabase.from('bar_settings').upsert({
      id: 1, name: 'Hayusten BarOne', location: '', currency: 'MZN',
      currency_symbol: 'MT', allow_negative_stock: false, allow_discounts: true,
      max_discount_percent: 20, table_management: true, person_management: true, require_pending_reason: true,
    });
    const newShiftId = `shift_${Date.now()}`;
    await supabase.from('cash_shifts').insert({
      id: newShiftId, opened_by: 'Admin', opened_at: new Date().toISOString(),
      opening_balance: 0, status: 'open',
    });
    await loadAllData();
  },
};
