
import { supabase } from './supabase';
import { Business, DailySale, MonthlyExpense, User, UserRole } from '../types';

export const storage = {
  // Businesses
  getBusinesses: async (): Promise<Business[]> => {
    const { data, error } = await supabase.from('businesses').select('*').order('name');
    if (error) throw error;
    return data || [];
  },
  saveBusiness: async (business: Partial<Business> | Partial<Business>[]) => {
    const { data, error } = await supabase.from('businesses').upsert(business).select();
    if (error) throw error;
    return data;
  },
  deleteBusiness: async (id: string) => {
    const { error } = await supabase.from('businesses').delete().eq('id', id);
    if (error) throw error;
  },

  // Sales
  getSales: async (): Promise<DailySale[]> => {
    const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  saveSale: async (sale: Partial<DailySale> | Partial<DailySale>[]) => {
    const { data, error } = await supabase.from('sales').upsert(sale).select();
    if (error) throw error;
    return data;
  },
  // Added plural alias for consistency with component calls
  saveSales: async (sales: Partial<DailySale>[]) => {
    return storage.saveSale(sales);
  },
  deleteSale: async (id: string) => {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) throw error;
  },

  // Expenses
  getExpenses: async (): Promise<MonthlyExpense[]> => {
    const { data, error } = await supabase.from('expenses').select('*').order('month', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  saveExpense: async (expense: Partial<MonthlyExpense> | Partial<MonthlyExpense>[]) => {
    const { data, error } = await supabase.from('expenses').upsert(expense).select();
    if (error) throw error;
    return data;
  },
  // Added plural alias for consistency with component calls
  saveExpenses: async (expenses: Partial<MonthlyExpense>[]) => {
    return storage.saveExpense(expenses);
  },
  deleteExpense: async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  },

  // Users (Managed via Supabase Profiles table)
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return data || [];
  },
  // Added saveUsers for managing profiles as used in components
  saveUsers: async (users: Partial<User>[]) => {
    const { data, error } = await supabase.from('profiles').upsert(users).select();
    if (error) throw error;
    return data;
  }
};
