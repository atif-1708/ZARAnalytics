
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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

export interface Filters {
  businessId: string;
  dateRange: {
    start: string;
    end: string;
  };
  timeframe: 'day' | 'month' | 'year' | 'lifetime';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
