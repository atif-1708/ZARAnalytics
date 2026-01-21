import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, AuthState, UserRole } from '../types';
import { supabase, isConfigured } from '../services/supabase';
import { LogOut, ShieldAlert, Loader2 } from 'lucide-react';

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
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const initHandled = useRef(false);

  const performEmergencyReset = (reason: string) => {
    // Only trigger nuclear reset if we are actually stuck and NOT showing a critical error UI
    if (criticalError) return;
    
    console.error("Auth Recovery Check:", reason);
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
      // Use a robust timeout for profile fetching
      const response = await withTimeout(
        supabase.from('profiles').select('*').eq('id', sbUser.id).single() as any,
        10000,
        { data: null, error: { message: 'Profile Fetch Timeout' } }
      ) as any;

      const { data: profile } = response;

      // Handle missing profile record without triggering a reload loop
      if (!profile) {
        setCriticalError("ACCESS_REVOKED");
        setAuth({ user: null, token: null, isAuthenticated: false });
        setIsInitializing(false);
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
      setCriticalError(null);
    } catch (err) {
      console.error("Profile fetch error:", err);
      setAuth({ user: null, token: null, isAuthenticated: false });
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (initHandled.current) return;
    initHandled.current = true;

    // Safety timeout increased to 20 seconds for ultra-resilience
    const safetyTimeout = setTimeout(() => {
      if (isInitializing && !criticalError) {
        performEmergencyReset("Auth initialization hung for more than 20 seconds.");
      }
    }, 20000);

    const checkAuth = async () => {
      if (!isConfigured()) {
        setIsInitializing(false);
        return;
      }

      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession() as any,
          8000,
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
        setCriticalError(null);
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
        15000,
        { data: { user: null, session: null }, error: { message: 'Login connection timed out.' } }
      ) as any;

      if (error) return { success: false, error: error.message };
      
      if (data.session) {
        await fetchProfile(data.user, data.session.access_token);
        return { success: true };
      }
      return { success: false, error: "Authentication failed." };
    } catch (err: any) {
      return { success: false, error: err.message || "An unexpected error occurred." };
    }
  };

  const logout = async () => {
    try {
      // Mark app as ready temporarily so the watchdog doesn't see the reload as a failure
      localStorage.setItem('zarlytics_app_ready_signal', 'true');
      await withTimeout(supabase.auth.signOut(), 3000, null);
    } finally {
      setAuth({ user: null, token: null, isAuthenticated: false });
      setCriticalError(null);
      // Hard clear everything to be 100% sure
      localStorage.clear();
      sessionStorage.clear();
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
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Syncing Business Core</p>
      </div>
    );
  }

  if (criticalError === "ACCESS_REVOKED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-rose-100 text-center space-y-6">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldAlert size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Access Revoked</h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Authenticated session detected, but no matching business profile was found in our database. 
              Contact your Administrator to verify your credentials.
            </p>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-rose-600 transition-all group"
          >
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            Clear Session & Sign Out
          </button>
        </div>
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