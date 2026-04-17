/**
 * Hayusten BarOne — Backup & Restore Utility
 * Full data export/import via JSON file
 */

import { db } from '@/store/db';

export interface BackupManifest {
  version: string;
  createdAt: string;
  createdBy: string;
  recordCounts: Record<string, number>;
  data: Record<string, unknown>;
}

const BACKUP_HISTORY_KEY = 'barone_backup_history';
const CURRENT_VERSION = '1.0';

export interface BackupHistoryEntry {
  id: string;
  createdAt: string;
  createdBy: string;
  size: number;
  recordCounts: Record<string, number>;
  filename: string;
}

export function getBackupHistory(): BackupHistoryEntry[] {
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBackupHistory(entry: BackupHistoryEntry) {
  const history = getBackupHistory();
  const updated = [entry, ...history].slice(0, 20); // keep last 20
  localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(updated));
}

export function createBackup(operatorName: string): BackupManifest {
  const data = {
    users: db.getUsers(),
    products: db.getProducts(),
    movements: db.getMovements(),
    tables: db.getTables(),
    pendingOrders: db.getPendingOrders(),
    cashMovements: db.getCashMovements(),
    currentShift: db.getCurrentShift(),
    previousShifts: db.getPreviousShifts(),
    barSettings: db.getBarSettings(),
    warehouses: db.getWarehouses(),
    permissions: db.getPermissions(),
    clients: db.getClients(),
    debts: db.getDebts(),
    sales: db.getSales(),
  };

  const recordCounts: Record<string, number> = {};
  Object.entries(data).forEach(([key, val]) => {
    recordCounts[key] = Array.isArray(val) ? val.length : 1;
  });

  const manifest: BackupManifest = {
    version: CURRENT_VERSION,
    createdAt: new Date().toISOString(),
    createdBy: operatorName,
    recordCounts,
    data,
  };

  return manifest;
}

export function downloadBackup(operatorName: string): string {
  const manifest = createBackup(operatorName);
  const json = JSON.stringify(manifest, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const filename = `barone_backup_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.json`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  const entry: BackupHistoryEntry = {
    id: `bk${Date.now()}`,
    createdAt: manifest.createdAt,
    createdBy: operatorName,
    size: json.length,
    recordCounts: manifest.recordCounts,
    filename,
  };
  saveBackupHistory(entry);

  return filename;
}

export function restoreBackup(manifest: BackupManifest): { success: boolean; message: string } {
  try {
    if (!manifest.version || !manifest.data) {
      return { success: false, message: 'Ficheiro de backup inválido ou corrompido.' };
    }

    const d = manifest.data as Record<string, unknown>;

    if (d.users) db.setUsers(d.users as Parameters<typeof db.setUsers>[0]);
    if (d.products) db.setProducts(d.products as Parameters<typeof db.setProducts>[0]);
    if (d.movements) db.setMovements(d.movements as Parameters<typeof db.setMovements>[0]);
    if (d.tables) db.setTables(d.tables as Parameters<typeof db.setTables>[0]);
    if (d.pendingOrders) db.setPendingOrders(d.pendingOrders as Parameters<typeof db.setPendingOrders>[0]);
    if (d.cashMovements) db.setCashMovements(d.cashMovements as Parameters<typeof db.setCashMovements>[0]);
    if (d.currentShift) db.setCurrentShift(d.currentShift as Parameters<typeof db.setCurrentShift>[0]);
    if (d.previousShifts) db.setPreviousShifts(d.previousShifts as Parameters<typeof db.setPreviousShifts>[0]);
    if (d.barSettings) db.setBarSettings(d.barSettings as Parameters<typeof db.setBarSettings>[0]);
    if (d.warehouses) db.setWarehouses(d.warehouses as Parameters<typeof db.setWarehouses>[0]);
    if (d.permissions) db.setPermissions(d.permissions as Parameters<typeof db.setPermissions>[0]);
    if (d.clients) db.setClients(d.clients as Parameters<typeof db.setClients>[0]);
    if (d.debts) db.setDebts(d.debts as Parameters<typeof db.setDebts>[0]);
    if (d.sales) db.setSales(d.sales as Parameters<typeof db.setSales>[0]);

    return { success: true, message: `Backup restaurado com sucesso. ${Object.values(manifest.recordCounts).reduce((a, b) => a + b, 0)} registos recuperados.` };
  } catch (err) {
    return { success: false, message: `Erro ao restaurar: ${err instanceof Error ? err.message : 'Erro desconhecido'}` };
  }
}

export function parseBackupFile(file: File): Promise<BackupManifest> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const manifest = JSON.parse(e.target?.result as string) as BackupManifest;
        resolve(manifest);
      } catch {
        reject(new Error('Ficheiro JSON inválido'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler ficheiro'));
    reader.readAsText(file);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getStorageUsage(): { used: number; total: number; percentage: number } {
  let used = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) || '';
    if (key.startsWith('barone_')) {
      used += (localStorage.getItem(key) || '').length * 2; // UTF-16
    }
  }
  const total = 5 * 1024 * 1024; // ~5MB typical localStorage limit
  return { used, total, percentage: Math.min((used / total) * 100, 100) };
}
