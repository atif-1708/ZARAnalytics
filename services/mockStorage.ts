
import { supabase } from './supabase';
import { Business, DailySale, MonthlyExpense, User } from '../types';

// Helper to map camelCase (frontend) to snake_case (database)
const mapToDb = (obj: any) => {
  const mapped: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    mapped[snakeKey] = obj[key];
  }
  return mapped;
};

// Helper to map snake_case (database) to camelCase (frontend)
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
  // Businesses
  getBusinesses: async (): Promise<Business[]> => {
    const { data, error } = await supabase.from('businesses').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  },
  saveBusiness: async (business: Partial<Business>) => {
    const payload = mapToDb(business);
    const { data, error } = await supabase.from('businesses').upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },
  deleteBusiness: async (id: string) => {
    const { error } = await supabase.from('businesses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Sales
  getSales: async (): Promise<DailySale[]> => {
    const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  },
  saveSale: async (sale: Partial<DailySale>) => {
    const payload = mapToDb(sale);
    // Remove generated IDs if they aren't UUIDs to let DB handle it
    if (payload.id && !payload.id.includes('-')) delete payload.id;
    
    const { data, error } = await supabase.from('sales').upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },
  deleteSale: async (id: string) => {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Expenses
  getExpenses: async (): Promise<MonthlyExpense[]> => {
    const { data, error } = await supabase.from('expenses').select('*').order('month', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  },
  saveExpense: async (expense: Partial<MonthlyExpense>) => {
    const payload = mapToDb(expense);
    if (payload.id && !payload.id.includes('-')) delete payload.id;
    
    const { data, error } = await supabase.from('expenses').upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  },
  deleteExpense: async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Users/Profiles
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw new Error(error.message);
    return (data || []).map(mapFromDb);
  },
  saveProfile: async (profile: Partial<User>) => {
    const payload = mapToDb(profile);
    const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return mapFromDb(data);
  }
};
