export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  password?: string;
}

export interface Business {
  id: string;
  name: string;
  location: string;
  createdAt: string;
}

export interface DailySale {
  id: string;
  businessId: string;
  date: string;
  salesAmount: number;
  profitPercentage: number;
  profitAmount: number; // Calculated: sales * (profit% / 100)
  createdAt: string;
}

export interface MonthlyExpense {
  id: string;
  businessId: string;
  month: string; // YYYY-MM
  amount: number;
  description: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  businessId: string;
  businessName: string;
  date: string;
  sentBy: string;
  sentByUserName: string;
  status: 'pending' | 'read';
  type: 'user_sent' | 'system_alert'; // Differentiate between user-triggered and auto-generated
  createdAt: string;
}

export interface Filters {
  businessId: string;
  dateRange: {
    start: string;
    end: string;
  };
  selectedMonth: string; // For YYYY-MM specific filtering
  timeframe: 'today' | 'yesterday' | 'this_month' | 'select_month' | 'custom_range' | 'lifetime';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'info' | 'success' | 'urgent';
  timestamp: string;
  link?: string;
  isRead: boolean;
  actionLabel?: string;
  businessId?: string;
}