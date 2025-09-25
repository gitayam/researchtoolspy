import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useEffect } from 'react';
import type { User, AuthTokens } from '@/types/auth';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (user: User, tokens: AuthTokens) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => boolean;
  clearAuth: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,

      // Actions
      login: async (user: User, tokens: AuthTokens) => {
        console.log('🔐 Auth Store: Login called with user:', user.username, 'role:', user.role);

        set({
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
        });

        console.log('✅ Auth Store: User logged in successfully');
      },

      logout: () => {
        console.log('🔐 Auth Store: Logout called');

        // Clear localStorage tokens (handled by persistence)
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
        });

        // Also clear API client tokens
        if (typeof window !== 'undefined') {
          localStorage.removeItem('omnicore_tokens');
        }

        console.log('✅ Auth Store: User logged out successfully');
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...userData };
          set({ user: updatedUser });
          console.log('✅ Auth Store: User data updated');
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      checkAuth: (): boolean => {
        const { user, tokens } = get();
        const isAuth = !!(user && tokens?.access_token);

        // Update state if it's out of sync
        if (isAuth !== get().isAuthenticated) {
          set({ isAuthenticated: isAuth });
        }

        console.log('🔍 Auth Store: Auth check result:', isAuth);
        return isAuth;
      },

      clearAuth: () => {
        console.log('🧹 Auth Store: Clearing all auth data');
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),

      // Only persist user and tokens, not loading states
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),

      // Rehydrate the auth state on load
      onRehydrateStorage: () => {
        console.log('🔄 Auth Store: Starting rehydration...');

        return (state, error) => {
          if (error) {
            console.error('❌ Auth Store: Rehydration error:', error);
            return;
          }

          if (state) {
            // Validate that we have both user and tokens
            const hasValidAuth = state.user && state.tokens?.access_token;

            if (hasValidAuth) {
              console.log('✅ Auth Store: Rehydrated with valid auth for user:', state.user.username);

              // Ensure isAuthenticated is set correctly
              state.isAuthenticated = true;
            } else {
              console.log('⚠️ Auth Store: Rehydrated with incomplete auth data, clearing...');
              state.user = null;
              state.tokens = null;
              state.isAuthenticated = false;
            }
          }

          console.log('🔄 Auth Store: Rehydration complete');
        };
      },
    }
  )
);

// Selectors for common auth checks
export const useAuth = () => {
  const { user, tokens, isAuthenticated, isLoading } = useAuthStore();
  return {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    hasRole: (role: string) => user?.role === role,
    hasAnyRole: (roles: string[]) => user?.role && roles.includes(user.role),
  };
};

export const useAuthActions = () => {
  const { login, logout, updateUser, setLoading, checkAuth, clearAuth } = useAuthStore();
  return {
    login,
    logout,
    updateUser,
    setLoading,
    checkAuth,
    clearAuth,
  };
};

// Helper hook for protected routes
export const useRequireAuth = () => {
  const { isAuthenticated, user } = useAuth();
  const { checkAuth } = useAuthActions();

  // Recheck auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return { isAuthenticated, user };
};

// Type exports for components
export type { AuthStore, AuthState, AuthActions };