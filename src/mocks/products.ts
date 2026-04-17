export type ProductStructureType = 'unit' | 'box_no_pack' | 'box_with_pack';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  criticalStock: number;
  unit: string;
  warehouse: string;
  // Structure type for purchase logic
  structureType: ProductStructureType;
  unitsPerPack: number;   // units per pack (box_no_pack) or units per pack inside box (box_with_pack)
  packsPerBox: number;    // packs per box (box_with_pack only)
  isComposite?: boolean;
  ingredients?: { productId: string; quantity: number }[];
}

export type StockAlertLevel = 'ok' | 'low' | 'critical' | 'out';

export function getStockAlert(p: Product): StockAlertLevel {
  if (p.stock === 0) return 'out';
  if (p.criticalStock > 0 && p.stock <= p.criticalStock) return 'critical';
  if (p.minStock > 0 && p.stock <= p.minStock) return 'low';
  return 'ok';
}

export const categories = [
  'Cervejas',
  'Vinhos',
  'Spirits',
  'Cocktails',
  'Refrigerantes',
  'Sumos',
  'Petiscos',
  'Snacks',
];

export const warehouses = ['Armazém Principal', 'Balcão'];

const def = { structureType: 'unit' as const, unitsPerPack: 1, packsPerBox: 1 };

export const products: Product[] = [
  { id: 'p1', name: 'Super Bock', category: 'Cervejas', price: 1.5, cost: 0.6, stock: 144, minStock: 24, criticalStock: 12, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p2', name: 'Sagres', category: 'Cervejas', price: 1.5, cost: 0.6, stock: 96, minStock: 24, criticalStock: 12, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p3', name: 'Heineken', category: 'Cervejas', price: 2.0, cost: 0.9, stock: 8, minStock: 24, criticalStock: 10, unit: 'un', warehouse: 'Balcão', structureType: 'box_no_pack', unitsPerPack: 24, packsPerBox: 1 },
  { id: 'p4', name: 'Guinness', category: 'Cervejas', price: 3.5, cost: 1.5, stock: 4, minStock: 12, criticalStock: 6, unit: 'un', warehouse: 'Armazém Principal', ...def },
  { id: 'p5', name: 'Vinho Tinto Casa', category: 'Vinhos', price: 2.5, cost: 0.8, stock: 36, minStock: 12, criticalStock: 6, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p6', name: 'Vinho Verde', category: 'Vinhos', price: 2.0, cost: 0.7, stock: 24, minStock: 12, criticalStock: 6, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p7', name: 'Vinho Rosé', category: 'Vinhos', price: 2.5, cost: 0.9, stock: 3, minStock: 12, criticalStock: 5, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p8', name: 'Whisky Jack Daniel\'s', category: 'Spirits', price: 4.5, cost: 1.8, stock: 2, minStock: 6, criticalStock: 3, unit: 'dose', warehouse: 'Balcão', ...def },
  { id: 'p9', name: 'Vodka Absolut', category: 'Spirits', price: 4.0, cost: 1.5, stock: 18, minStock: 6, criticalStock: 3, unit: 'dose', warehouse: 'Balcão', ...def },
  { id: 'p10', name: 'Gin Tanqueray', category: 'Spirits', price: 5.0, cost: 2.0, stock: 9, minStock: 6, criticalStock: 3, unit: 'dose', warehouse: 'Balcão', ...def },
  { id: 'p11', name: 'Mojito', category: 'Cocktails', price: 7.0, cost: 2.5, stock: 50, minStock: 5, criticalStock: 2, unit: 'un', warehouse: 'Balcão', isComposite: true, ...def },
  { id: 'p12', name: 'Caipirinha', category: 'Cocktails', price: 7.0, cost: 2.5, stock: 50, minStock: 5, criticalStock: 2, unit: 'un', warehouse: 'Balcão', isComposite: true, ...def },
  { id: 'p13', name: 'Gin Tónico', category: 'Cocktails', price: 8.0, cost: 3.0, stock: 50, minStock: 5, criticalStock: 2, unit: 'un', warehouse: 'Balcão', isComposite: true, ...def },
  { id: 'p14', name: 'Coca-Cola', category: 'Refrigerantes', price: 2.0, cost: 0.7, stock: 48, minStock: 24, criticalStock: 12, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p15', name: 'Água s/ Gás', category: 'Refrigerantes', price: 1.0, cost: 0.3, stock: 60, minStock: 24, criticalStock: 12, unit: 'un', warehouse: 'Armazém Principal', ...def },
  { id: 'p16', name: 'Água c/ Gás', category: 'Refrigerantes', price: 1.5, cost: 0.4, stock: 0, minStock: 24, criticalStock: 12, unit: 'un', warehouse: 'Armazém Principal', ...def },
  { id: 'p17', name: 'Sumo Laranja Natural', category: 'Sumos', price: 3.5, cost: 1.0, stock: 20, minStock: 10, criticalStock: 5, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p18', name: 'Tosta Mista', category: 'Petiscos', price: 3.5, cost: 1.2, stock: 30, minStock: 10, criticalStock: 5, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p19', name: 'Francesinha', category: 'Petiscos', price: 9.5, cost: 3.5, stock: 15, minStock: 5, criticalStock: 2, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p20', name: 'Amendoins', category: 'Snacks', price: 1.5, cost: 0.4, stock: 2, minStock: 10, criticalStock: 5, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p21', name: 'Batatas Fritas', category: 'Snacks', price: 2.0, cost: 0.6, stock: 25, minStock: 10, criticalStock: 5, unit: 'un', warehouse: 'Balcão', ...def },
  { id: 'p22', name: 'Rum Bacardi', category: 'Spirits', price: 4.0, cost: 1.6, stock: 12, minStock: 6, criticalStock: 3, unit: 'dose', warehouse: 'Balcão', ...def },
];

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'entry' | 'sale' | 'waste' | 'offer' | 'transfer' | 'adjustment';
  quantity: number;
  fromWarehouse?: string;
  toWarehouse?: string;
  reason?: string;
  operator: string;
  createdAt: string;
}

export const stockMovements: StockMovement[] = [
  { id: 'sm1', productId: 'p1', productName: 'Super Bock', type: 'entry', quantity: 48, operator: 'Admin', createdAt: '2026-04-15T08:00:00', toWarehouse: 'Armazém Principal' },
  { id: 'sm2', productId: 'p3', productName: 'Heineken', type: 'sale', quantity: 16, operator: 'João', createdAt: '2026-04-15T14:30:00' },
  { id: 'sm3', productId: 'p7', productName: 'Vinho Rosé', type: 'waste', quantity: 2, reason: 'Garrafa partida', operator: 'Maria', createdAt: '2026-04-15T16:00:00' },
  { id: 'sm4', productId: 'p20', productName: 'Amendoins', type: 'sale', quantity: 8, operator: 'João', createdAt: '2026-04-15T19:00:00' },
  { id: 'sm5', productId: 'p16', productName: 'Água c/ Gás', type: 'sale', quantity: 4, operator: 'Ana', createdAt: '2026-04-15T20:00:00' },
  { id: 'sm6', productId: 'p8', productName: 'Whisky Jack Daniel\'s', type: 'offer', quantity: 1, reason: 'Oferta ao cliente VIP', operator: 'Admin', createdAt: '2026-04-15T21:00:00' },
  { id: 'sm7', productId: 'p1', productName: 'Super Bock', type: 'transfer', quantity: 24, fromWarehouse: 'Armazém Principal', toWarehouse: 'Balcão', operator: 'João', createdAt: '2026-04-15T17:00:00' },
];
