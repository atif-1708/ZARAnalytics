import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, AuthState, UserRole } from '../types';
import { supabase, isConfigured } from '../services/supabase';

interface AuthContextType extends AuthState {
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  isInitializing: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to wrap promises with a timeout
const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const initHandled = useRef(false);

  const fetchProfile = async (sbUser: any, token: string) => {
    try {
      // Use a timeout for the database query to prevent hanging
      const response = await withTimeout(
        supabase.from('profiles').select('*').eq('id', sbUser.id).single(),
        4000,
        { data: null, error: { message: 'Timeout' } }
      ) as any;

      const { data: profile, error } = response;

      if (error || !profile) {
        // Fallback for missing profile or timeout - allow app entry as basic user
        setAuth({
          user: { id: sbUser.id, name: sbUser.email?.split('@')[0] || 'User', email: sbUser.email, role: UserRole.USER },
          token,
          isAuthenticated: true
        });
      } else {
        setAuth({
          user: { id: profile.id, name: profile.name, email: sbUser.email, role: profile.role as UserRole },
          token,
          isAuthenticated: true
        });
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
      // Ensure we don't hang even on exception
      setAuth({
        user: { id: sbUser.id, name: sbUser.email?.split('@')[0] || 'User', email: sbUser.email, role: UserRole.USER },
        token,
        isAuthenticated: true
      });
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (initHandled.current) return;
    initHandled.current = true;

    // Hard 7-second fail-safe for the entire initialization process
    const safetyTimeout = setTimeout(() => {
      if (isInitializing) {
        console.warn("Auth initialization timed out. Forcing app entry.");
        setIsInitializing(false);
      }
    }, 7000);

    const checkAuth = async () => {
      if (!isConfigured()) {
        setIsInitializing(false);
        return;
      }

      try {
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          3000,
          { data: { session: null }, error: null }
        ) as any;

        if (session) {
          await fetchProfile(session.user, session.access_token);
        } else {
          setIsInitializing(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setIsInitializing(false);
      } finally {
        clearTimeout(safetyTimeout);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
        await fetchProfile(session.user, session.access_token);
      } else if (event === 'SIGNED_OUT') {
        setAuth({ user: null, token: null, isAuthenticated: false });
        setIsInitializing(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password: pass }),
        8000,
        { data: { user: null, session: null }, error: { message: 'Login request timed out. Please try again.' } }
      ) as any;

      if (error) return { success: false, error: error.message };
      
      if (data.session) {
        await fetchProfile(data.user, data.session.access_token);
        return { success: true };
      }
      return { success: false, error: "Authentication failed. No session returned." };
    } catch (err: any) {
      return { success: false, error: err.message || "A connection error occurred during login." };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setAuth({ user: null, token: null, isAuthenticated: false });
      window.location.reload();
    }
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await fetchProfile(session.user, session.access_token);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="relative mb-6">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-teal-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center font-black text-[8px] text-teal-600 uppercase">ZAR</div>
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Initialising Secure Portal</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, refreshProfile, isInitializing }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};