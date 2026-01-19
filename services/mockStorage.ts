
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { Business, DailySale, MonthlyExpense, User, UserRole } from '../types';

const mapToDb = (obj: any) => {
  const mapped: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    mapped[snakeKey] = obj[key];
  }
  return mapped;
};

const mapFromDb = (obj: any) => {
  if (!obj) return null;
  const mapped: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/([-_][a-z])/g, group =>
      group.toUpperCase().replace('-', '').replace('_', '')
    );
    mapped[camelKey] = obj[key];
  }
  return mapped;
};

export const storage = {
  getBusinesses: async (): Promise<Business[]> => {
    const { data, error } = await supabase.from('businesses').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  },
  saveBusiness: async (business: Partial<Business>) => {
    const payload = mapToDb(business);
    const operation = payload.id ? supabase.from('businesses').upsert(payload) : supabase.from('businesses').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },
  deleteBusiness: async (id: string) => {
    const { error } = await supabase.from('businesses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getSales: async (): Promise<DailySale[]> => {
    const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  },
  saveSale: async (sale: Partial<DailySale>) => {
    const payload = mapToDb(sale);
    // Ensure we don't send malformed IDs for new records
    if (payload.id && !payload.id.includes('-') && payload.id.length < 20) {
      delete payload.id;
    }
    const operation = payload.id ? supabase.from('sales').upsert(payload) : supabase.from('sales').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },
  deleteSale: async (id: string) => {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getExpenses: async (): Promise<MonthlyExpense[]> => {
    const { data, error } = await supabase.from('expenses').select('*').order('month', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  },
  saveExpense: async (expense: Partial<MonthlyExpense>) => {
    const payload = mapToDb(expense);
    if (payload.id && !payload.id.includes('-') && payload.id.length < 20) {
      delete payload.id;
    }
    const operation = payload.id ? supabase.from('expenses').upsert(payload) : supabase.from('expenses').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },
  deleteExpense: async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  },
  
  createNewUser: async (userData: { name: string, email: string, role: UserRole, password?: string }) => {
    const backgroundSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });

    const { data: authData, error: authError } = await backgroundSupabase.auth.signUp({
      email: userData.email,
      password: userData.password || 'Temporary123!',
      options: { data: { full_name: userData.name } }
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Failed to create auth user.");

    // IMPORTANT: Remove 'email' from profile payload as it doesn't exist in your profiles table
    const profilePayload = {
      id: authData.user.id,
      name: userData.name,
      role: userData.role
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(mapToDb(profilePayload));

    if (profileError) throw new Error(profileError.message);
    return authData.user;
  },

  saveProfile: async (profile: Partial<User>) => {
    const payload = mapToDb(profile);
    // Never try to write email to the profiles table
    if (payload.email) delete payload.email;
    
    const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  }
};
