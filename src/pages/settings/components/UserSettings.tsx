import { useState, useEffect, useCallback } from 'react';
import { db, AppUserDB, onCacheChange } from '@/store/db';
import { UserPermission } from '@/mocks/settings';
import { roleLabels, roleColors, UserRole } from '@/mocks/users';
import { useAuth } from '@/store/AuthContext';
import ConfirmDeleteModal from '@/components/base/ConfirmDeleteModal';

const permissionLabels: Record<keyof Omit<UserPermission, 'role'>, string> = {
  canManageStock: 'Gerir Stock',
  canManageUsers: 'Gerir Utilizadores',
  canCloseCash: 'Fechar Caixa',
  canViewReports: 'Ver Relatórios',
  canEditPrices: 'Editar Preços',
  canApplyDiscounts: 'Aplicar Descontos',
  canCancelOrders: 'Cancelar Pedidos',
  canManageSettings: 'Gerir Configurações',
};

const defaultPermsForRole = (role: UserRole): Omit<UserPermission, 'role'> => {
  if (role === 'admin') return { canManageStock: true, canManageUsers: true, canCloseCash: true, canViewReports: true, canEditPrices: true, canApplyDiscounts: true, canCancelOrders: true, canManageSettings: true };
  if (role === 'manager') return { canManageStock: true, canManageUsers: false, canCloseCash: true, canViewReports: true, canEditPrices: true, canApplyDiscounts: true, canCancelOrders: true, canManageSettings: false };
  if (role === 'cashier') return { canManageStock: false, canManageUsers: false, canCloseCash: true, canViewReports: false, canEditPrices: false, canApplyDiscounts: false, canCancelOrders: false, canManageSettings: false };
  return { canManageStock: true, canManageUsers: false, canCloseCash: false, canViewReports: false, canEditPrices: false, canApplyDiscounts: false, canCancelOrders: false, canManageSettings: false };
};

export default function UserSettings() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<AppUserDB[]>(() => db.getUsers());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUserDB | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUserDB | null>(null);
  const [selectedUserPerms, setSelectedUserPerms] = useState<AppUserDB | null>(null);
  const [form, setForm] = useState({ name: '', role: 'barman' as UserRole, active: true, password: '1234' });
  const [showPassword, setShowPassword] = useState(false);

  const syncFromCache = useCallback(() => {
    setUsers(db.getUsers());
  }, []);

  useEffect(() => {
    const unsub = onCacheChange(syncFromCache);
    return unsub;
  }, [syncFromCache]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.password.trim()) return;
    setSaving(true);
    let updated: AppUserDB[];
    if (editingUser) {
      const updatedUser: AppUserDB = {
        ...editingUser,
        name: form.name,
        role: form.role,
        active: form.active,
        password: form.password,
        avatar: form.name.slice(0, 2).toUpperCase(),
      };
      await db.upsertUser(updatedUser);
      updated = users.map(u => u.id === editingUser.id ? updatedUser : u);
    } else {
      const newUser: AppUserDB = {
        id: `u${Date.now()}`,
        name: form.name,
        role: form.role,
        avatar: form.name.slice(0, 2).toUpperCase(),
        active: form.active,
        password: form.password,
        permissions: defaultPermsForRole(form.role),
      };
      await db.upsertUser(newUser);
      updated = [...users, newUser];
    }
    setUsers(updated);
    localStorage.setItem('barone_users_cache', JSON.stringify(updated));
    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await db.deleteUser(deleteTarget.id);
    const updated = users.filter(u => u.id !== deleteTarget.id);
    setUsers(updated);
    localStorage.setItem('barone_users_cache', JSON.stringify(updated));
    setDeleteTarget(null);
    if (selectedUserPerms?.id === deleteTarget.id) setSelectedUserPerms(null);
  };

  const toggleUserActive = async (id: string) => {
    const updated = users.map(u => u.id === id ? { ...u, active: !u.active } : u);
    const target = updated.find(u => u.id === id);
    if (target) await db.upsertUser(target);
    setUsers(updated);
    localStorage.setItem('barone_users_cache', JSON.stringify(updated));
  };

  const toggleUserPerm = async (userId: string, key: keyof Omit<UserPermission, 'role'>) => {
    const updated = users.map(u => {
      if (u.id !== userId) return u;
      const perms = u.permissions || defaultPermsForRole(u.role);
      return { ...u, permissions: { ...perms, [key]: !perms[key as keyof typeof perms] } };
    });
    const target = updated.find(u => u.id === userId);
    if (target) await db.upsertUser(target);
    setUsers(updated);
    localStorage.setItem('barone_users_cache', JSON.stringify(updated));
    setSelectedUserPerms(updated.find(u => u.id === userId) || null);
  };

  const getUserPerms = (u: AppUserDB): Omit<UserPermission, 'role'> => {
    return u.permissions || defaultPermsForRole(u.role);
  };

  const openAdd = () => {
    setEditingUser(null);
    setForm({ name: '', role: 'barman', active: true, password: '1234' });
    setShowModal(true);
  };

  const openEdit = (u: AppUserDB) => {
    setEditingUser(u);
    setForm({ name: u.name, role: u.role, active: u.active, password: u.password });
    setShowModal(true);
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="w-12 h-12 flex items-center justify-center mx-auto mb-2">
          <i className="ri-lock-line text-3xl"></i>
        </div>
        <p className="text-sm">Apenas o Administrador pode gerir utilizadores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-gray-900 font-semibold text-base mb-1">Utilizadores & Permissões</h3>
          <p className="text-gray-500 text-sm">Gerir contas, senhas e controlo de acesso individual</p>
        </div>
        {activeTab === 'users' && (
          <button onClick={openAdd}
            className="flex items-center gap-1.5 text-white text-sm px-4 py-2 rounded-lg cursor-pointer whitespace-nowrap hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
            <i className="ri-user-add-line"></i> Novo Utilizador
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['users', 'permissions'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer whitespace-nowrap transition-all ${activeTab === t ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'users' ? 'Utilizadores' : 'Permissões Individuais'}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${u.active ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                  <span className="text-white text-sm font-bold">{u.name.slice(0, 1)}</span>
                </div>
                <div>
                  <p className="text-gray-800 text-sm font-semibold">{u.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[u.role]}`}>
                      {roleLabels[u.role]}
                    </span>
                    <span className="text-gray-300 text-xs flex items-center gap-1">
                      <i className="ri-lock-line text-xs"></i>
                      <span className="font-mono">{u.password.replace(/./g, '•')}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {u.active ? 'Ativo' : 'Inativo'}
                </span>
                <button onClick={() => openEdit(u)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-all">
                  <i className="ri-pencil-line text-sm"></i>
                </button>
                {u.role !== 'admin' && (
                  <>
                    <button onClick={() => toggleUserActive(u.id)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all ${u.active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                      <i className={u.active ? 'ri-user-unfollow-line text-sm' : 'ri-user-follow-line text-sm'}></i>
                    </button>
                    <button onClick={() => setDeleteTarget(u)}
                      className="w-8 h-8 flex items-center justify-center text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-all">
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="flex gap-5">
          <div className="w-56 flex-shrink-0 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Selecionar Utilizador</p>
            {users.map(u => (
              <button key={u.id} onClick={() => setSelectedUserPerms(u)}
                className={`w-full flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${selectedUserPerms?.id === u.id ? 'border-cyan-400 bg-cyan-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                <div className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                  <span className="text-white text-xs font-bold">{u.name.slice(0, 1)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-gray-800 text-xs font-semibold truncate">{u.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleColors[u.role]}`}>
                    {roleLabels[u.role]}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1">
            {!selectedUserPerms ? (
              <div className="text-center py-12 text-gray-300">
                <div className="w-10 h-10 flex items-center justify-center mx-auto mb-2">
                  <i className="ri-user-settings-line text-3xl"></i>
                </div>
                <p className="text-sm text-gray-400">Selecione um utilizador para gerir as suas permissões</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                    <span className="text-white text-xs font-bold">{selectedUserPerms.name.slice(0, 1)}</span>
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">{selectedUserPerms.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleColors[selectedUserPerms.role]}`}>
                      {roleLabels[selectedUserPerms.role]}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {(Object.keys(permissionLabels) as (keyof Omit<UserPermission, 'role'>)[]).map(key => {
                    const perms = getUserPerms(selectedUserPerms);
                    const isEnabled = perms[key] as boolean;
                    const isAdminUser = selectedUserPerms.role === 'admin';
                    return (
                      <div key={key} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
                        <span className="text-gray-700 text-sm">{permissionLabels[key]}</span>
                        <button
                          onClick={() => !isAdminUser && toggleUserPerm(selectedUserPerms.id, key)}
                          disabled={isAdminUser}
                          className={`relative w-11 h-6 rounded-full transition-all cursor-pointer disabled:cursor-default ${isEnabled ? '' : 'bg-gray-200'}`}
                          style={isEnabled ? { background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' } : {}}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isEnabled ? 'left-5' : 'left-0.5'}`}></span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {selectedUserPerms.role === 'admin' && (
                  <p className="text-gray-400 text-xs px-5 py-3 border-t border-gray-50">* As permissões do Administrador não podem ser alteradas.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold">{editingUser ? 'Editar Utilizador' : 'Novo Utilizador'}</h3>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400"
                  placeholder="Nome completo..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Perfil</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400">
                  {(Object.entries(roleLabels) as [UserRole, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Senha *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:border-cyan-400"
                    placeholder="Senha de acesso..." />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 cursor-pointer">
                    <i className={showPassword ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'}></i>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 py-1">
                <input type="checkbox" id="userActive" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 cursor-pointer" />
                <label htmlFor="userActive" className="text-sm text-gray-700 cursor-pointer">Utilizador ativo</label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name.trim() || !form.password.trim() || saving}
                className="flex-1 py-2.5 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                {saving ? <><i className="ri-loader-4-line animate-spin mr-1"></i>A guardar...</> : editingUser ? 'Guardar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Eliminar utilizador?"
          description={`Vai eliminar permanentemente o utilizador "${deleteTarget.name}".`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
