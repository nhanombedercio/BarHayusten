export type UserRole = 'admin' | 'manager' | 'cashier' | 'barman';

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  active: boolean;
}

export const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  cashier: 'Caixa',
  barman: 'Barman',
};

export const roleColors: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-amber-100 text-amber-700',
  cashier: 'bg-emerald-100 text-emerald-700',
  barman: 'bg-sky-100 text-sky-700',
};

export const appUsers: AppUser[] = [
  { id: 'u1', name: 'Admin', role: 'admin', avatar: 'A', active: true },
  { id: 'u2', name: 'João Silva', role: 'manager', avatar: 'J', active: true },
  { id: 'u3', name: 'Maria Costa', role: 'cashier', avatar: 'M', active: true },
  { id: 'u4', name: 'Ana Ferreira', role: 'barman', avatar: 'AF', active: true },
];
