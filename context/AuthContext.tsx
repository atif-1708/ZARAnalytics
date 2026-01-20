
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const profileFetchInProgress = useRef(false);

  const fetchAndSetProfile = async (sbUser: any, token: string) => {
    if (profileFetchInProgress.current) return;
    profileFetchInProgress.current = true;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      if (error) {
        // Handle case where auth user exists but profile record is missing
        if (error.code === 'PGRST116') {
          // Check if there are any profiles at all (empty database)
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

          if (count === 0) {
            // Auto-create initial admin profile if it's the very first user
            const newProfile = { id: sbUser.id, name: sbUser.email?.split('@')[0] || 'Admin', role: UserRole.ADMIN };
            const { data: created, error: createError } = await supabase.from('profiles').insert([newProfile]).select().single();
            if (created) {
              setAuth({
                user: { id: created.id, name: created.name, email: sbUser.email, role: created.role as UserRole },
                token,
                isAuthenticated: true
              });
              setIsInitializing(false);
              return;
            } else {
              console.error("Failed to create initial profile:", createError);
            }
          }
        }
        
        // If profile fetch fails but user exists, it's a data sync error
        console.warn("Auth sync issue: Profile record missing or inaccessible.");
        setAuth({ user: null, token: null, isAuthenticated: false });
      } else if (profile) {
        setAuth({
          user: { id: profile.id, name: profile.name, email: sbUser.email, role: profile.role as UserRole },
          token,
          isAuthenticated: true
        });
      }
    } catch (err) {
      console.error("Critical Auth Sync Error:", err);
      setInitError("Network timeout during profile synchronization.");
    } finally {
      profileFetchInProgress.current = false;
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (!isConfigured()) {
      setIsInitializing(false);
      return;
    }

    // Safety watchdog: If it takes more than 10 seconds, stop the spinner and show error
    const timer = setTimeout(() => {
      if (isInitializing) {
        setInitError("The session is taking longer than expected to load.");
      }
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await fetchAndSetProfile(session.user, session.access_token);
      } else {
        setAuth({ user: null, token: null, isAuthenticated: false });
        setIsInitializing(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return { success: false, error: error.message };
      if (data.session) {
        await fetchAndSetProfile(data.user, data.session.access_token);
        return { success: true };
      }
      return { success: false, error: "Authentication failed." };
    } catch (err: any) {
      return { success: false, error: err?.message || "Connection error." };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Sign out encountered an error:", e);
    } finally {
      localStorage.clear(); // Force clear local storage to fix "hangs"
      setAuth({ user: null, token: null, isAuthenticated: false });
      window.location.reload(); // Refresh to clean state
    }
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await fetchAndSetProfile(session.user, session.access_token);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-14 h-14 border-[3px] border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-6"></div>
        <p className="text-slate-600 font-bold tracking-tight mb-2 animate-pulse text-lg">ZARlytics is Loading...</p>
        <p className="text-slate-400 text-sm max-w-xs text-center leading-relaxed">Verifying secure encrypted connection to South African business cluster...</p>
        
        {initError && (
          <div className="mt-12 p-6 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 max-w-sm text-center animate-shake">
            <p className="text-slate-700 font-semibold mb-2">{initError}</p>
            <p className="text-slate-400 text-xs mb-6">Your session may have become corrupted in the browser cache.</p>
            <button 
              onClick={logout}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
            >
              Reset Session & Logout
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!isConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <div className="max-w-md w-full bg-slate-800 p-10 rounded-3xl border border-slate-700 shadow-2xl text-center">
           <h1 className="text-white text-2xl font-bold mb-4">Configuration Error</h1>
           <p className="text-slate-400 leading-relaxed">Environment variables missing. ZARlytics requires a valid Supabase URL and Anon Key to initialize.</p>
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
