
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { Business, DailySale, MonthlyExpense, User, UserRole, Reminder } from '../types';

const mapToDb = (obj: any) => {
  if (!obj) return null;
  const mapped: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    mapped[snakeKey] = obj[key];
  }
  return mapped;
};

const mapFromDb = (obj: any) => {
  if (!obj || typeof obj !== 'object') return null;
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
    try {
      const { data, error } = await supabase.from('businesses').select('*').order('name');
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Businesses):", err);
      return [];
    }
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
    try {
      // Improved sorting: by business date primarily, then by creation time for notification tracking
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Sales):", err);
      return [];
    }
  },
  saveSale: async (sale: Partial<DailySale>) => {
    const payload = mapToDb(sale);
    if (payload.id && !payload.id.includes('-') && payload.id.length < 20) delete payload.id;
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
    try {
      const { data, error } = await supabase.from('expenses').select('*').order('month', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Expenses):", err);
      return [];
    }
  },
  saveExpense: async (expense: Partial<MonthlyExpense>) => {
    const payload = mapToDb(expense);
    if (payload.id && !payload.id.includes('-') && payload.id.length < 20) delete payload.id;
    const operation = payload.id ? supabase.from('expenses').upsert(payload) : supabase.from('expenses').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },
  deleteExpense: async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getReminders: async (): Promise<Reminder[]> => {
    try {
      const { data, error } = await supabase.from('reminders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Reminders):", err);
      return [];
    }
  },
  saveReminder: async (reminder: Partial<Reminder>) => {
    const payload = mapToDb(reminder);
    const operation = payload.id ? supabase.from('reminders').upsert(payload) : supabase.from('reminders').insert(payload);
    const { data, error } = await operation.select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },
  deleteReminder: async (id: string) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('name');
      if (error) throw error;
      return (data || []).map(mapFromDb).filter(Boolean);
    } catch (err) {
      console.error("Storage Error (Users):", err);
      return [];
    }
  },
  
  createNewUser: async (userData: { name: string, email: string, role: UserRole, password?: string }) => {
    const backgroundSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await backgroundSupabase.auth.signUp({
      email: userData.email,
      password: userData.password || 'Temporary123!',
      options: { data: { full_name: userData.name } }
    });
    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("User creation failed.");
    const profilePayload = { id: authData.user.id, name: userData.name, role: userData.role };
    const { error: profileError } = await supabase.from('profiles').upsert(mapToDb(profilePayload));
    if (profileError) throw new Error(profileError.message);
    return authData.user;
  },

  saveProfile: async (profile: Partial<User>) => {
    const payload = mapToDb(profile);
    if (payload.email) delete payload.email;
    const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },

  deleteUser: async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
};
