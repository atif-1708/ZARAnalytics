
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, UserRole } from '../types';
import { supabase, isConfigured } from '../services/supabase';

interface AuthContextType extends AuthState {
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured()) {
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetchAndSetProfile(session.user, session.access_token);
        }
      } catch (e) {
        console.error("Session init failed", e);
      } finally {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await fetchAndSetProfile(session.user, session.access_token);
      } else {
        setAuth({ user: null, token: null, isAuthenticated: false });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAndSetProfile = async (sbUser: any, token: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      // Handle missing profile or "No rows found"
      if (error && (error.code === 'PGRST116' || error.message?.includes('No rows'))) {
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        const isFirstUser = !countError && count === 0;
        
        const newProfile = {
          id: sbUser.id,
          name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User',
          email: sbUser.email,
          role: isFirstUser ? UserRole.ADMIN : UserRole.USER
        };
        
        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();
          
        if (created) {
          setAuth({
            user: { id: created.id, name: created.name, email: created.email, role: created.role as UserRole },
            token,
            isAuthenticated: true
          });
          return;
        } else if (insertError) {
          console.error("Profile creation failed:", insertError.message);
        }
      }

      if (profile) {
        setAuth({
          user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role as UserRole },
          token,
          isAuthenticated: true
        });
      }
    } catch (err: any) {
      console.error("Profile sync error:", err?.message || String(err));
    }
  };

  const login = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      
      if (error) {
        return { success: false, error: String(error.message) };
      }
      
      if (data.session) {
        await fetchAndSetProfile(data.user, data.session.access_token);
        return { success: true };
      }
      
      return { success: false, error: "Authentication failed. No session returned." };
    } catch (err: any) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : "An internal error occurred during login.");
      return { success: false, error: String(errorMsg) };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAuth({ user: null, token: null, isAuthenticated: false });
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await fetchAndSetProfile(session.user, session.access_token);
  };

  if (!isConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
        <div className="max-w-md w-full space-y-8 bg-slate-800 p-10 rounded-3xl border border-slate-700 shadow-2xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/20 text-2xl font-bold">!</div>
            <h1 className="text-2xl font-bold mb-2">Configuration Required</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Supabase credentials are missing or invalid. Please update <code>services/supabase.ts</code>.
            </p>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl font-mono text-xs text-teal-400 border border-slate-700 text-center overflow-auto">
            Check SUPABASE_URL & ANON_KEY
          </div>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-teal-600 hover:bg-teal-50 rounded-xl font-bold transition-all">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold text-xs tracking-widest uppercase animate-pulse">Initializing Portal...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={{ ...auth, login, logout, refreshProfile }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
