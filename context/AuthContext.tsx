
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, UserRole } from '../types';
import { supabase } from '../services/supabase';

interface AuthContextType extends AuthState {
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
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
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session) {
          await fetchProfile(session.user, session.access_token);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Auth Initialization Error:", err);
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await fetchProfile(session.user, session.access_token);
      } else {
        setAuth({ user: null, token: null, isAuthenticated: false });
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (supabaseUser: any, token: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      // Check for 'No rows found' error code PGRST116
      if (error && error.code === 'PGRST116') {
        console.warn("Profile missing. Creating a default self-healing profile record.");
        
        const newProfile = {
          id: supabaseUser.id,
          name: supabaseUser.email?.split('@')[0] || 'New User',
          email: supabaseUser.email,
          role: UserRole.USER // Default role for safety
        };

        const { data: createdData, error: createError } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();

        if (createdData && !createError) {
          setAuth({
            user: { id: createdData.id, name: createdData.name, email: createdData.email || '', role: createdData.role as UserRole },
            token,
            isAuthenticated: true
          });
        }
      } else if (data && !error) {
        setAuth({
          user: { id: data.id, name: data.name, email: data.email || '', role: data.role as UserRole },
          token,
          isAuthenticated: true
        });
      }
    } catch (err) {
      console.error("Profile Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      
      if (error) {
        let message = error.message;
        if (message.includes("Email not confirmed")) {
          message = "Your email is not confirmed. Please check your inbox or confirm the user in the Supabase dashboard.";
        } else if (message.includes("Invalid login credentials")) {
          message = "The email or password you entered is incorrect.";
        }
        return { success: false, error: message };
      }
      
      return { success: !!data.user };
    } catch (err: any) {
      return { success: false, error: err.message || "An unexpected error occurred during login." };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout Error:", err);
    } finally {
      setAuth({ user: null, token: null, isAuthenticated: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium animate-pulse text-sm">Initializing Secure Session...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
