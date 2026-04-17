// Deprecated: use useAuth() from @/store/AuthContext instead
// Kept for backward compatibility
import { useAuth } from '@/store/AuthContext';

export function useCurrentUser() {
  const { currentUser, isAdmin } = useAuth();
  return {
    currentUser,
    isAdmin,
    setCurrentUser: () => {},
  };
}
