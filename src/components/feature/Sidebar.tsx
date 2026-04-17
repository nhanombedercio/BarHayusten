import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { db } from '@/store/db';
import { useAuth } from '@/store/AuthContext';
import { roleLabels, roleColors } from '@/mocks/users';

const navItems = [
  { to: '/', icon: 'ri-dashboard-line', label: 'Dashboard', exact: true },
  { to: '/tables', icon: 'ri-restaurant-line', label: 'Mesas & Pedidos' },
  { to: '/pos', icon: 'ri-shopping-cart-line', label: 'Vendas POS' },
  { to: '/stock', icon: 'ri-archive-line', label: 'Stock' },
  { to: '/cash', icon: 'ri-safe-2-line', label: 'Caixa' },
  { to: '/clients', icon: 'ri-user-3-line', label: 'Clientes' },
  { to: '/debts', icon: 'ri-money-dollar-circle-line', label: 'Dívidas' },
  { to: '/reports', icon: 'ri-bar-chart-2-line', label: 'Relatórios' },
  { to: '/settings', icon: 'ri-settings-3-line', label: 'Configurações' },
];

export default function Sidebar() {
  const { currentUser, logout, setCurrentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchTargetId, setSwitchTargetId] = useState('');
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchError, setSwitchError] = useState('');

  const users = db.getUsers().filter(u => u.active);
  const debts = db.getDebts();
  const products = db.getProducts();

  const alertCount = products.filter(p => p.stock <= p.criticalStock && p.criticalStock > 0).length;
  const pendingDebtCount = debts.filter(d => d.status !== 'paid').length;

  const handleUserSelect = (userId: string) => {
    setSwitchTargetId(userId);
    setSwitchPassword('');
    setSwitchError('');
    setShowUserMenu(false);
    setShowSwitchModal(true);
  };

  const confirmSwitch = () => {
    const user = users.find(u => u.id === switchTargetId);
    if (!user) return;
    if (user.password !== switchPassword) {
      setSwitchError('Senha incorreta.');
      setSwitchPassword('');
      return;
    }
    setCurrentUser(user);
    setShowSwitchModal(false);
    setSwitchPassword('');
    setSwitchError('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!currentUser) return null;

  return (
    <aside className="w-56 flex flex-col h-screen sticky top-0 flex-shrink-0" style={{ background: '#0D1B2A' }}>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
              <rect x="4" y="8" width="12" height="36" rx="6" fill="#1E9FD4"/>
              <rect x="44" y="8" width="12" height="36" rx="6" fill="#00C8C8"/>
              <rect x="4" y="22" width="52" height="12" rx="6" fill="#1E9FD4"/>
              <rect x="22" y="46" width="10" height="10" rx="2" fill="#F5A623"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight tracking-wide">Hayusten</p>
            <p className="text-xs font-semibold" style={{ color: '#F5A623' }}>BarOne</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                isActive ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`
            }
            style={({ isActive }) => isActive ? { background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' } : {}}
          >
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <i className={item.icon}></i>
            </div>
            <span>{item.label}</span>
            {item.to === '/stock' && alertCount > 0 && (
              <span className="ml-auto text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0" style={{ background: '#F5A623' }}>
                {alertCount}
              </span>
            )}
            {item.to === '/debts' && pendingDebtCount > 0 && (
              <span className="ml-auto text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0" style={{ background: '#F5A623' }}>
                {pendingDebtCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Alerts Summary */}
      {(alertCount > 0 || pendingDebtCount > 0) && (
        <div className="mx-3 mb-3 rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {alertCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <i className="ri-error-warning-line text-xs" style={{ color: '#F5A623' }}></i>
              </div>
              <span className="text-gray-400 text-xs">{alertCount} alertas de stock</span>
            </div>
          )}
          {pendingDebtCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <i className="ri-time-line text-xs" style={{ color: '#F5A623' }}></i>
              </div>
              <span className="text-gray-400 text-xs">{pendingDebtCount} dívidas pendentes</span>
            </div>
          )}
        </div>
      )}

      {/* User Switcher */}
      <div className="px-3 pb-4 relative">
        <button
          onClick={() => setShowUserMenu(v => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <div className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
            <span className="text-white text-xs font-bold">{currentUser.name.slice(0, 1)}</span>
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-white text-xs font-semibold truncate">{currentUser.name}</p>
            <p className="text-gray-500 text-xs truncate">{roleLabels[currentUser.role]}</p>
          </div>
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <i className={showUserMenu ? 'ri-arrow-down-s-line text-gray-500 text-sm' : 'ri-arrow-up-s-line text-gray-500 text-sm'}></i>
          </div>
        </button>

        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-1 border border-white/10 rounded-xl overflow-hidden z-50" style={{ background: '#0D1B2A' }}>
            <p className="text-gray-500 text-xs px-3 py-2 border-b border-white/10 font-medium">Trocar utilizador</p>
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => u.id === currentUser.id ? setShowUserMenu(false) : handleUserSelect(u.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-all cursor-pointer ${currentUser.id === u.id ? 'bg-white/10' : ''}`}
              >
                <div className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                  <span className="text-white text-xs font-bold">{u.name.slice(0, 1)}</span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-xs font-medium truncate">{u.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleColors[u.role]}`}>
                    {roleLabels[u.role]}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-lock-line text-xs text-amber-400"></i>
                  </div>
                  {currentUser.id === u.id && (
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-check-line text-sm" style={{ color: '#F5A623' }}></i>
                    </div>
                  )}
                </div>
              </button>
            ))}
            <div className="border-t border-white/10">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/10 transition-all cursor-pointer text-red-400 hover:text-red-300">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  <i className="ri-logout-box-line text-sm"></i>
                </div>
                <span className="text-xs font-medium">Terminar Sessão</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Switch User Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-xl">
            <div className="text-center mb-5">
              <div className="w-14 h-14 flex items-center justify-center rounded-full mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                <i className="ri-shield-keyhole-line text-white text-2xl"></i>
              </div>
              <h3 className="text-gray-900 font-bold text-base">
                {users.find(u => u.id === switchTargetId)?.name}
              </h3>
              <p className="text-gray-400 text-xs mt-1">Introduza a senha para trocar de utilizador</p>
            </div>
            <div className="mb-4">
              <input
                type="password"
                value={switchPassword}
                onChange={e => { setSwitchPassword(e.target.value); setSwitchError(''); }}
                onKeyDown={e => e.key === 'Enter' && confirmSwitch()}
                autoFocus
                placeholder="Senha..."
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-center tracking-widest ${switchError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
              {switchError && (
                <p className="text-red-500 text-xs text-center mt-1.5 flex items-center justify-center gap-1">
                  <i className="ri-close-circle-line"></i> {switchError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowSwitchModal(false); setSwitchPassword(''); setSwitchError(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                Cancelar
              </button>
              <button onClick={confirmSwitch} disabled={!switchPassword}
                className="flex-1 py-2.5 text-white rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}>
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
