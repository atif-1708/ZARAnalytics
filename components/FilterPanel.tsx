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
      selectedMonth: '',
      timeframe: 'today'
    });
  };

  const handleTimeframeChange = (val: Filters['timeframe']) => {
    setFilters({
      ...filters,
      timeframe: val,
      dateRange: { start: '', end: '' }
    });
  };

  const handleDateChange = (field: 'start' | 'end', val: string) => {
    setFilters({
      ...filters,
      timeframe: 'custom_range',
      dateRange: {
        ...filters.dateRange,
        [field]: val
      }
    });
  };

  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 mb-6 sticky top-20 z-20">
      {/* Top Center Currency Exchange */}
      <div className="flex justify-center mb-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center bg-slate-50 p-1 rounded-2xl border border-slate-200 shadow-inner">
            <button 
              onClick={() => setCurrency('ZAR')} 
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${currency === 'ZAR' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              ZAR (R)
            </button>
            <button 
              onClick={() => setCurrency('PKR')} 
              className={`px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all ${currency === 'PKR' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Coins size={12} /> PKR (₨)
            </button>
            {currency === 'PKR' && (
              <button 
                onClick={onRefreshRate} 
                className={`p-2 text-slate-400 hover:text-teal-600 ${isFetchingRate ? 'animate-spin' : ''}`}
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
          {currency === 'PKR' && (
            <div className="text-[10px] font-black text-teal-600 uppercase tracking-widest animate-in fade-in slide-in-from-top-1">
              Current Rate: 1 ZAR = {exchangeRate.toFixed(2)} PKR
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center gap-6">
        {/* Header/Label */}
        <div className="flex items-center gap-2 text-slate-400">
          <Filter size={18} className="text-teal-500" />
          <span className="text-xs font-black uppercase tracking-widest">Filter Suite</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-1 items-end xl:items-center gap-4">
          
          {/* Business Selector */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5 ml-1">Location</label>
            <div className="relative">
              <Store size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={filters.businessId}
                onChange={(e) => setFilters({ ...filters, businessId: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all appearance-none cursor-pointer"
              >
                <option value="all">Global (All Units)</option>
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.location})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Timeframe Presets */}
          <div className="min-w-[160px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5 ml-1">Quick Presets</label>
            <div className="relative">
              <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={filters.timeframe}
                onChange={(e) => handleTimeframeChange(e.target.value as any)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all appearance-none cursor-pointer"
              >
                <option value="lifetime">Lifetime</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_month">This Month</option>
                <option value="select_month">Specific Month</option>
                <option value="custom_range" disabled>Custom Range (Selected)</option>
              </select>
            </div>
          </div>

          {/* Month Picker Overlay (Conditional) */}
          {filters.timeframe === 'select_month' && (
            <div className="min-w-[150px] animate-in slide-in-from-left-2 duration-200">
              <label className="block text-[10px] font-black text-teal-600 uppercase tracking-tighter mb-1.5 ml-1">Target Month</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-500" />
                <input 
                  type="month"
                  value={filters.selectedMonth}
                  onChange={(e) => setFilters({ ...filters, selectedMonth: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 bg-teal-50/50 border border-teal-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>
          )}

          {/* Separator for Large Screens */}
          <div className="hidden xl:block w-px h-10 bg-slate-200 mx-2" />

          {/* Dedicated Date Range Picker */}
          <div className="flex flex-col sm:flex-row items-end gap-3 flex-1 lg:col-span-2">
            <div className="flex-1 w-full">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5 ml-1">From Date</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  className={`w-full pl-10 pr-3 py-2.5 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all ${
                    filters.dateRange.start ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                />
              </div>
            </div>
            
            <div className="hidden sm:flex items-center pb-3 text-slate-300">
              <ArrowRight size={14} />
            </div>

            <div className="flex-1 w-full">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5 ml-1">To Date</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  className={`w-full pl-10 pr-3 py-2.5 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all ${
                    filters.dateRange.end ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Reset Action */}
          <div className="flex justify-end xl:ml-2">
            <button 
              onClick={handleReset}
              className="group flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
              title="Reset All Filters"
            >
              <RotateCcw size={18} className="group-hover:-rotate-90 transition-transform duration-300" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden xl:inline">Reset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};