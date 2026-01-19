
import React, { useState, useEffect } from 'react';
import { Filter, Calendar, Store, RotateCcw } from 'lucide-react';
import { Business, Filters } from '../types';
import { storage } from '../services/mockStorage';

interface FilterPanelProps {
  filters: Filters;
  setFilters: (filters: Filters) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, setFilters }) => {
  // Use state to manage businesses fetched asynchronously
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
      timeframe: 'lifetime'
    });
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 sticky top-20 z-20">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400 mr-2">
          <Filter size={18} />
          <span className="text-sm font-semibold">Filters</span>
        </div>

        {/* Business Selector */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={filters.businessId}
              onChange={(e) => setFilters({ ...filters, businessId: e.target.value })}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all appearance-none cursor-pointer"
            >
              <option value="all">All Businesses</option>
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="min-w-[150px]">
          <select
            value={filters.timeframe}
            onChange={(e) => setFilters({ ...filters, timeframe: e.target.value as any })}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all appearance-none cursor-pointer"
          >
            <option value="day">Daily</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="lifetime">Lifetime</option>
          </select>
        </div>

        {/* Date Ranges */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, start: e.target.value }})}
              className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <span className="text-slate-400 font-bold text-xs">TO</span>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, end: e.target.value }})}
              className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <button 
          onClick={handleReset}
          className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
          title="Reset Filters"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
};
