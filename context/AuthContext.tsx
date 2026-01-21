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
const withTimeout = <T,>(promise: Promise<T> | any, timeoutMs: number, fallback: T): Promise<T> => {
  return Promise.race([
    Promise.resolve(promise),
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

  const performEmergencyReset = (reason: string) => {
    console.error("Auth Recovery Triggered:", reason);
    // Call the global recovery function defined in index.html
    if (typeof (window as any).performNuclearReset === 'function') {
      (window as any).performNuclearReset(reason);
    } else {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const fetchProfile = async (sbUser: any, token: string) => {
    try {
      // Fetch user profile with a slightly longer timeout for resilience
      const response = await withTimeout(
        supabase.from('profiles').select('*').eq('id', sbUser.id).single() as any,
        6000,
        { data: null, error: { message: 'Timeout' } }
      ) as any;

      const { data: profile } = response;

      // SECURITY & INTEGRITY CHECK:
      // If no profile is found, it means the user's DB entry is missing.
      // In a normal window, this often indicates a stale/corrupted Supabase session.
      if (!profile) {
        console.warn("Integrity Check Failed: Profile missing for authenticated user.");
        // Try one more time with a refresh or give up
        await withTimeout(supabase.auth.signOut(), 2000, null);
        performEmergencyReset("Authenticated session detected but no database profile found.");
        return;
      }

      setAuth({
        user: { 
          id: profile.id, 
          name: profile.name, 
          email: sbUser.email, 
          role: profile.role as UserRole 
        },
        token,
        isAuthenticated: true
      });
    } catch (err) {
      console.error("Profile fetch error:", err);
      // Fallback: Clear initialization but don't reset unless it's a critical loop
      setAuth({ user: null, token: null, isAuthenticated: false });
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (initHandled.current) return;
    initHandled.current = true;

    // Increased safety timeout to 8 seconds to allow for slow initial connections
    const safetyTimeout = setTimeout(() => {
      if (isInitializing) {
        performEmergencyReset("Auth initialization hung for more than 8 seconds.");
      }
    }, 8000);

    const checkAuth = async () => {
      if (!isConfigured()) {
        setIsInitializing(false);
        return;
      }

      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession() as any,
          4000,
          { data: { session: null }, error: null }
        ) as any;

        if (session && session.user) {
          await fetchProfile(session.user, session.access_token);
        } else {
          setIsInitializing(false);
        }
      } catch (err) {
        console.error("Auth session check failed:", err);
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

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password: pass }) as any,
        10000,
        { data: { user: null, session: null }, error: { message: 'Login connection timed out.' } }
      ) as any;

      if (error) return { success: false, error: error.message };
      
      if (data.session) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (!profile) {
          await supabase.auth.signOut();
          return { success: false, error: "Access denied. Your account profile record is missing." };
        }
        await fetchProfile(data.user, data.session.access_token);
        return { success: true };
      }
      return { success: false, error: "Authentication failed. Please check your credentials." };
    } catch (err: any) {
      return { success: false, error: err.message || "An unexpected error occurred during login." };
    }
  };

  const logout = async () => {
    try {
      await withTimeout(supabase.auth.signOut(), 2000, null);
    } finally {
      performEmergencyReset("User initiated logout and session clear.");
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
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Establishing Secure Connection</p>
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