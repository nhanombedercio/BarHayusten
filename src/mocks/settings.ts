export interface BarSettings {
  name: string;
  location: string;
  currency: string;
  currencySymbol: string;
  allowNegativeStock: boolean;
  allowDiscounts: boolean;
  maxDiscountPercent: number;
  tableManagement: boolean;
  personManagement: boolean;
  requirePendingReason: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface UserPermission {
  role: string;
  canManageStock: boolean;
  canManageUsers: boolean;
  canCloseCash: boolean;
  canViewReports: boolean;
  canEditPrices: boolean;
  canApplyDiscounts: boolean;
  canCancelOrders: boolean;
  canManageSettings: boolean;
}

export const barSettings: BarSettings = {
  name: 'Hayusten Bar',
  location: 'Maputo, Moçambique',
  currency: 'MZN',
  currencySymbol: 'MT',
  allowNegativeStock: false,
  allowDiscounts: true,
  maxDiscountPercent: 20,
  tableManagement: true,
  personManagement: true,
  requirePendingReason: true,
};

export const warehouses: Warehouse[] = [
  { id: 'w1', name: 'Armazém Principal', description: 'Stock principal do bar', active: true },
  { id: 'w2', name: 'Balcão', description: 'Stock de serviço imediato', active: true },
  { id: 'w3', name: 'Frigorífico', description: 'Produtos refrigerados', active: true },
  { id: 'w4', name: 'Adega', description: 'Vinhos e espirituosas', active: false },
];

export const userPermissions: UserPermission[] = [
  {
    role: 'admin',
    canManageStock: true, canManageUsers: true, canCloseCash: true,
    canViewReports: true, canEditPrices: true, canApplyDiscounts: true,
    canCancelOrders: true, canManageSettings: true,
  },
  {
    role: 'manager',
    canManageStock: true, canManageUsers: false, canCloseCash: true,
    canViewReports: true, canEditPrices: true, canApplyDiscounts: true,
    canCancelOrders: true, canManageSettings: false,
  },
  {
    role: 'cashier',
    canManageStock: false, canManageUsers: false, canCloseCash: true,
    canViewReports: false, canEditPrices: false, canApplyDiscounts: false,
    canCancelOrders: false, canManageSettings: false,
  },
  {
    role: 'barman',
    canManageStock: true, canManageUsers: false, canCloseCash: false,
    canViewReports: false, canEditPrices: false, canApplyDiscounts: false,
    canCancelOrders: false, canManageSettings: false,
  },
];
