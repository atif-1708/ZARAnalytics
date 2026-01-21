
import React, { useState, useEffect } from 'react';
import { Filter, Calendar, Store, RotateCcw, Clock, ArrowRight, Coins, RefreshCw } from 'lucide-react';
import { Business, Filters } from '../types';
import { storage } from '../services/mockStorage';

interface FilterPanelProps {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  currency: 'ZAR' | 'PKR';
  setCurrency: (c: 'ZAR' | 'PKR') => void;
  exchangeRate: number;
  isFetchingRate: boolean;
  onRefreshRate: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ 
  filters, 
  setFilters, 
  currency, 
  setCurrency, 
  exchangeRate, 
  isFetchingRate, 
  onRefreshRate 
}) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const data = await storage.getBusinesses();
        setBusinesses(data);
      } catch (err) {
        console.error("Failed to load businesses in FilterPanel", err);
      }
    };
    fetchBusinesses();
  }, []);

  const handleReset = () => {
    setFilters({
      businessId: 'all',
      dateRange: { start: '', end: '' },
      selectedMonth: new Date().toISOString().slice(0, 7),
      timeframe: 'this_month'
    });
  };

  const handleTimeframeChange = (val: Filters['timeframe']) => {
    setFilters({
      ...filters,
      timeframe: val,
      dateRange: { start: '', end: '' }
    });
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 w-full xl:w-auto">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
        
        {/* Currency Toggle with Exchange Rate Display */}
        <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 shrink-0">
          <button 
            onClick={() => setCurrency('ZAR')} 
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${currency === 'ZAR' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}
          >
            ZAR
          </button>
          <button 
            onClick={() => setCurrency('PKR')} 
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black flex items-center gap-1 transition-all ${currency === 'PKR' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}
          >
            PKR
          </button>
          
          {currency === 'PKR' && (
            <div className="flex items-center gap-2 ml-2 pr-1 border-l border-slate-200 pl-2 animate-in fade-in slide-in-from-left-1">
              <span className="text-[9px] font-black text-slate-500 whitespace-nowrap">
                1 ZAR = {exchangeRate.toFixed(2)} PKR
              </span>
              <button 
                onClick={onRefreshRate} 
                className={`p-1 text-slate-400 hover:text-teal-600 transition-colors ${isFetchingRate ? 'animate-spin' : ''}`}
                title="Refresh Exchange Rate"
              >
                <RefreshCw size={11} />
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-slate-200 hidden md:block" />

        {/* Unit Selector - Updated to show Name (Location) */}
        <div className="relative min-w-[180px]">
          <Store size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={filters.businessId}
            onChange={(e) => setFilters({ ...filters, businessId: e.target.value })}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold focus:outline-none appearance-none cursor-pointer truncate"
          >
            <option value="all">Global (All Units)</option>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.location})
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <Clock size={10} className="rotate-90" />
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="relative min-w-[130px]">
          <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={filters.timeframe}
            onChange={(e) => handleTimeframeChange(e.target.value as any)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold focus:outline-none appearance-none cursor-pointer"
          >
            <option value="this_month">This Month</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="select_month">Specific Month</option>
            <option value="custom_range">Custom Range</option>
            <option value="lifetime">Lifetime</option>
          </select>
        </div>

        {/* Contextual Inputs */}
        {filters.timeframe === 'select_month' && (
          <div className="relative animate-in slide-in-from-left-2">
            <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500" />
            <input 
              type="month"
              value={filters.selectedMonth}
              onChange={(e) => setFilters({ ...filters, selectedMonth: e.target.value })}
              className="pl-9 pr-3 py-2 bg-teal-50/30 border border-teal-100 rounded-xl text-[11px] font-bold focus:outline-none"
            />
          </div>
        )}

        {filters.timeframe === 'custom_range' && (
          <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
            <input 
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})}
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold focus:outline-none"
            />
            <ArrowRight size={10} className="text-slate-300" />
            <input 
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})}
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold focus:outline-none"
            />
          </div>
        )}

        {/* Reset */}
        <button 
          onClick={handleReset}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all ml-auto md:ml-0"
          title="Reset Filters"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
};
