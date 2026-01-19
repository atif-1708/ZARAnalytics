
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

      // Handle missing profile record (Admin may have deleted the user)
      if (error && (error.code === 'PGRST116' || error.message?.includes('No rows'))) {
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        const isFirstUser = !countError && count === 0;
        
        // Only auto-create profile if it's the very first user (Initial Admin setup)
        if (isFirstUser) {
          const newProfile = {
            id: sbUser.id,
            name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'Member',
            role: UserRole.ADMIN
          };
          
          const { data: created } = await supabase
            .from('profiles')
            .insert([newProfile])
            .select()
            .single();
            
          if (created) {
            setAuth({
              user: { id: created.id, name: created.name, email: sbUser.email, role: created.role as UserRole },
              token,
              isAuthenticated: true
            });
            return;
          }
        } else {
          // If profile is missing and it's not the first user, they were likely deleted.
          // Force logout to prevent "hanging" stale sessions.
          console.warn("User profile not found. User may have been deleted by an administrator.");
          await supabase.auth.signOut();
          setAuth({ user: null, token: null, isAuthenticated: false });
          return;
        }
      }

      if (profile) {
        setAuth({
          user: { id: profile.id, name: profile.name, email: sbUser.email, role: profile.role as UserRole },
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
      if (error) return { success: false, error: String(error.message) };
      if (data.session) {
        await fetchAndSetProfile(data.user, data.session.access_token);
        return { success: true };
      }
      return { success: false, error: "Authentication failed." };
    } catch (err: any) {
      return { success: false, error: String(err?.message || err) };
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
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <div className="max-w-md w-full bg-slate-800 p-10 rounded-3xl border border-slate-700 shadow-2xl text-center">
           <h1 className="text-white text-2xl font-bold mb-4">Configuration Error</h1>
           <p className="text-slate-400">Please provide valid Supabase credentials.</p>
        </div>
      </div>
    );
  }

  if (loading) return null;

  return <AuthContext.Provider value={{ ...auth, login, logout, refreshProfile }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
