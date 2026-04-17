import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, AppUserDB, loadAllData, setupRealtime } from '@/store/db';

interface AuthContextType {
  currentUser: AppUserDB | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setCurrentUser: (user: AppUserDB) => void;
  refreshCurrentUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isLoggedIn: false,
  isAdmin: false,
  login: async () => false,
  logout: () => {},
  setCurrentUser: () => {},
  refreshCurrentUser: () => {},
});

const SESSION_KEY = 'barone_session_user_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<AppUserDB | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedId = sessionStorage.getItem(SESSION_KEY);
    let cleanupRealtime: (() => void) | null = null;

    loadAllData().then(() => {
      if (savedId) {
        const found = db.getUsers().find(u => u.id === savedId && u.active);
        if (found) setCurrentUserState(found);
      }
      setLoading(false);
      // Start realtime subscriptions after data is loaded
      cleanupRealtime = setupRealtime();
    }).catch(() => setLoading(false));

    return () => {
      if (cleanupRealtime) cleanupRealtime();
    };
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    // Reload fresh data from Supabase on login
    await loadAllData();
    const user = db.getUsers().find(
      u => u.name.toLowerCase() === username.trim().toLowerCase() && u.active
    );
    if (!user) return false;
    if (user.password !== password) return false;
    setCurrentUserState(user);
    sessionStorage.setItem(SESSION_KEY, user.id);
    return true;
  };

  const logout = () => {
    setCurrentUserState(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const setCurrentUser = (user: AppUserDB) => {
    setCurrentUserState(user);
    sessionStorage.setItem(SESSION_KEY, user.id);
  };

  const refreshCurrentUser = () => {
    if (!currentUser) return;
    const updated = db.getUsers().find(u => u.id === currentUser.id);
    if (updated) setCurrentUserState(updated);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 flex items-center justify-center">
              <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
                <rect x="4" y="8" width="12" height="36" rx="6" fill="#1E9FD4"/>
                <rect x="44" y="8" width="12" height="36" rx="6" fill="#00C8C8"/>
                <rect x="4" y="22" width="52" height="12" rx="6" fill="#1E9FD4"/>
                <rect x="22" y="46" width="10" height="10" rx="2" fill="#F5A623"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-xl leading-tight">Hayusten</p>
              <p className="font-semibold text-base" style={{ color: '#F5A623' }}>BarOne</p>
            </div>
          </div>
          <div className="w-8 h-8 flex items-center justify-center mx-auto mb-3">
            <i className="ri-loader-4-line text-2xl text-cyan-400 animate-spin"></i>
          </div>
          <p className="text-gray-400 text-sm">A sincronizar dados...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      currentUser,
      isLoggedIn: !!currentUser,
      isAdmin: currentUser?.role === 'admin',
      login,
      logout,
      setCurrentUser,
      refreshCurrentUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
