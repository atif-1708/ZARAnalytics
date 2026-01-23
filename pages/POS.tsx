
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Loader2, 
  Package, 
  ChevronRight,
  Store,
  CheckCircle,
  Hash,
  RefreshCw,
  AlertCircle,
  PackageSearch,
  Globe,
  Wallet,
  Building
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Product, Business, SaleItem, PaymentMethod, UserRole, DailySale } from '../types';
import { formatZAR } from '../utils/formatters';

export const POS: React.FC = () => {
  const { user, isSuspended } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Real-time reconciliation state
  const [todayTotals, setTodayTotals] = useState({ cash: 0, bank: 0 });

  const fetchTodayTotals = async (bizId: string) => {
    if (!bizId) return;
    try {
      const allSales = await storage.getSales();
      const todayStr = new Date().toISOString().split('T')[0];
      
      const bizSalesToday = allSales.filter(s => 
        s.businessId === bizId && 
        s.date.startsWith(todayStr)
      );

      const totals = bizSalesToday.reduce((acc, sale) => {
        if (sale.paymentMethod === PaymentMethod.CASH) acc.cash += sale.salesAmount;
        if (sale.paymentMethod === PaymentMethod.CARD) acc.bank += sale.salesAmount;
        return acc;
      }, { cash: 0, bank: 0 });

      setTodayTotals(totals);
    } catch (e) {
      console.error("Failed to fetch reconciliation totals", e);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const bData = await storage.getBusinesses();
      const filteredBiz = bData.filter(b => 
        user?.role === UserRole.SUPER_ADMIN || 
        user?.role === UserRole.ORG_ADMIN || 
        user?.role === UserRole.ADMIN ||
        user?.assignedBusinessIds?.includes(b.id)
      );
      setBusinesses(filteredBiz);
      
      if (filteredBiz.length > 0 && !selectedBusinessId) {
        setSelectedBusinessId(filteredBiz[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async (isManual = false) => {
    if (!selectedBusinessId) return;
    if (isManual) setIsRefreshing(true);
    
    try {
      const pData = await storage.getProducts(selectedBusinessId);
      setProducts(pData);
      // Also refresh totals whenever we refresh products
      await fetchTodayTotals(selectedBusinessId);
    } catch (e) { 
      console.error("POS: Failed to load products", e); 
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [user]);
  useEffect(() => { loadProducts(); }, [selectedBusinessId]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.sku.toLowerCase().includes(search.toLowerCase()) || 
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
    );
  }, [products, search]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, {
        productId: product.id,
        sku: product.sku,
        quantity: 1,
        priceAtSale: product.salePrice,
        costAtSale: product.costPrice
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.priceAtSale * item.quantity), 0);
  const cartCost = cart.reduce((acc, item) => acc + (item.costAtSale * item.quantity), 0);

  const handleCheckout = async (method: PaymentMethod) => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const biz = businesses.find(b => b.id === selectedBusinessId);
      await storage.saveSale({
        businessId: selectedBusinessId,
        date: new Date().toISOString(),
        salesAmount: cartTotal,
        profitPercentage: cartTotal > 0 ? ((cartTotal - cartCost) / cartTotal) * 100 : 0,
        profitAmount: cartTotal - cartCost,
        paymentMethod: method,
        items: cart,
        orgId: biz?.orgId
      });

      setSuccessMessage(`Checkout Complete (${formatZAR(cartTotal)})`);
      setCart([]);
      setIsCheckoutOpen(false);
      
      // Refresh state
      await loadProducts();
      await fetchTodayTotals(selectedBusinessId);
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      alert("Checkout failed: " + (e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-teal-600">
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Initializing Terminal...</p>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Left: Product Selection */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm text-left">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg"><Store size={20} /></div>
             <select 
               value={selectedBusinessId} 
               onChange={e => setSelectedBusinessId(e.target.value)} 
               className="bg-transparent font-black text-slate-800 text-sm outline-none cursor-pointer border-none focus:ring-0"
             >
               {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
             </select>
             <button 
               onClick={() => loadProducts(true)} 
               className={`p-2 rounded-lg hover:bg-slate-200 transition-colors ${isRefreshing ? 'animate-spin text-teal-600' : 'text-slate-400'}`}
               title="Refresh Inventory"
             >
               <RefreshCw size={16} />
             </button>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Scan SKU or Search..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => {
                const stock = product.currentStock ?? 0;
                const isOutOfStock = stock <= 0;
                
                return (
                  <button 
                    key={product.id} 
                    disabled={isOutOfStock} 
                    onClick={() => addToCart(product)} 
                    className={`flex flex-col text-left bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-teal-400 transition-all group relative ${isOutOfStock ? 'opacity-50' : 'active:scale-95'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-3">
                       <Hash size={12} className="text-slate-300" />
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{product.sku}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 line-clamp-2 mb-6 flex-1">{product.description || 'No Description'}</p>
                    <div className="mt-auto flex items-end justify-between">
                      <div className="text-xl font-black text-slate-900">{formatZAR(product.salePrice)}</div>
                      <div className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${stock < 10 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                         Stock: {stock}
                      </div>
                    </div>
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl text-center p-4">
                         <span className="bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg shadow-lg">Out of Stock</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
               <div className="w-20 h-20 bg-slate-100 text-slate-300 rounded-[2rem] flex items-center justify-center mb-6">
                 {search ? <PackageSearch size={40} /> : <Package size={40} />}
               </div>
               <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">
                 {search ? 'No Matches Found' : 'Inventory Empty'}
               </h4>
               <p className="text-sm font-medium text-slate-400 max-w-xs text-center">
                 {search 
                   ? `Adjust your search term or barcode for "${search}"` 
                   : "This business unit has no products registered in the Inventory system."}
               </p>
               {!search && (
                 <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 px-4 py-2 rounded-xl border border-teal-100">
                    Use Inventory Master to add products
                 </p>
               )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart & Checkout */}
      <div className="w-full lg:w-[400px] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden text-left">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} className="text-slate-400" />
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Active Sale</h3>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-[9px] font-black text-rose-500 uppercase hover:text-rose-700 tracking-widest">Clear All</button>
            )}
          </div>

          {/* Real-time End-of-Day Reconciliation Dashboard */}
          <div className="grid grid-cols-2 gap-2">
             <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 text-emerald-600">
                   <Wallet size={12} />
                   <span className="text-[8px] font-black uppercase tracking-widest">Cash In Hand</span>
                </div>
                <span className="text-sm font-black text-emerald-700">{formatZAR(todayTotals.cash)}</span>
             </div>
             <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 text-blue-600">
                   <Building size={12} />
                   <span className="text-[8px] font-black uppercase tracking-widest">Online / Bank</span>
                </div>
                <span className="text-sm font-black text-blue-700">{formatZAR(todayTotals.bank)}</span>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/20">
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-3 animate-in zoom-in slide-in-from-top-4">
              <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg"><CheckCircle size={18} /></div>
              <span>{successMessage}</span>
            </div>
          )}
          
          {cart.map(item => (
            <div key={item.productId} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group shadow-sm">
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{item.sku}</h4>
                <div className="text-xs font-black text-teal-600">{formatZAR(item.priceAtSale * item.quantity)}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="p-1.5 hover:text-rose-500 transition-colors"><Minus size={14} /></button>
                  <span className="w-8 text-center text-xs font-black text-slate-800">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="p-1.5 hover:text-teal-500 transition-colors"><Plus size={14} /></button>
                </div>
                <button onClick={() => removeFromCart(item.productId)} className="p-2 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}

          {cart.length === 0 && !successMessage && (
            <div className="py-20 text-center text-slate-300">
               <ShoppingCart size={48} className="mx-auto mb-4 opacity-5" />
               <p className="text-[10px] font-black uppercase tracking-widest">Terminal Idle</p>
               <p className="text-[9px] font-bold uppercase mt-2 text-slate-400">Select items to begin</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-900 border-t border-slate-800 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Total</span>
            <span className="text-3xl font-black text-white tracking-tighter">{formatZAR(cartTotal)}</span>
          </div>
          <button 
            disabled={cart.length === 0 || isSuspended || isProcessing} 
            onClick={() => setIsCheckoutOpen(true)} 
            className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-teal-500 shadow-xl disabled:opacity-50 disabled:bg-slate-700 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
          >
            {isSuspended ? (
              <>
                <AlertCircle size={18} />
                <span>Subscription Expired</span>
              </>
            ) : (
              <>
                Confirm Payment <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !isProcessing && setIsCheckoutOpen(false)} />
          <div className="bg-white rounded-[3rem] w-full max-w-md p-12 relative shadow-2xl text-center">
             <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
               <CreditCard size={40} />
             </div>
             <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter uppercase">Finalize Sale</h3>
             <p className="text-sm font-bold text-slate-500 mb-10">Total Due: <span className="text-teal-600 font-black">{formatZAR(cartTotal)}</span></p>
             
             <div className="grid grid-cols-2 gap-4">
                <button 
                  disabled={isProcessing} 
                  onClick={() => handleCheckout(PaymentMethod.CASH)} 
                  className="flex flex-col items-center gap-3 p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] hover:border-emerald-500 hover:bg-emerald-50/30 transition-all group active:scale-95"
                >
                   <Banknote size={32} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                   <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-emerald-700">Cash in Hand</span>
                </button>
                <button 
                  disabled={isProcessing} 
                  onClick={() => handleCheckout(PaymentMethod.CARD)} 
                  className="flex flex-col items-center gap-3 p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] hover:border-blue-500 hover:bg-blue-50/30 transition-all group active:scale-95"
                >
                   <Globe size={32} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                   <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-blue-700">Online / Bank</span>
                </button>
             </div>

             <button 
               disabled={isProcessing}
               onClick={() => setIsCheckoutOpen(false)} 
               className="mt-10 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors disabled:opacity-30"
             >
               Discard Current Session
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
