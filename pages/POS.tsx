
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
  PackageSearch,
  Globe,
  Wallet,
  Building,
  Layers,
  Tag,
  Coins,
  Receipt,
  X,
  Calendar,
  Clock,
  AlertCircle
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Product, Business, SaleItem, PaymentMethod, UserRole } from '../types';
import { formatZAR, getLocalISOString } from '../utils/formatters';

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
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Checkout & Calculator State
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  
  const [todayTotals, setTodayTotals] = useState({ cash: 0, bank: 0 });

  // Live Clock Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getLocalDayKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const fetchTodayTotals = async (bizId: string) => {
    if (!bizId) return;
    try {
      const allSales = await storage.getSales();
      
      const todayKey = getLocalDayKey(new Date());
      
      const bizSalesToday = allSales.filter(s => {
        // Use createdAt if available as it is more reliable than potentially truncated user date
        const saleDate = s.createdAt ? new Date(s.createdAt) : new Date(s.date);
        const saleKey = getLocalDayKey(saleDate);
        return s.businessId === bizId && saleKey === todayKey;
      });

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
    if ((product.currentStock ?? 0) <= 0) return;
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
        description: product.description,
        quantity: 1,
        priceAtSale: product.salePrice,
        costAtSale: product.costPrice,
        discount: 0
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

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, discount: Math.max(0, discount) };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  // Calculations
  const cartSubtotal = cart.reduce((acc, item) => acc + (item.priceAtSale * item.quantity), 0);
  const totalDiscount = cart.reduce((acc, item) => acc + (item.discount || 0), 0);
  const cartCost = cart.reduce((acc, item) => acc + (item.costAtSale * item.quantity), 0);
  const finalTotal = Math.max(0, cartSubtotal - totalDiscount);
  
  const cashReceivedVal = parseFloat(receivedAmount) || 0;
  const changeDue = Math.max(0, cashReceivedVal - finalTotal);

  const handleCheckout = async () => {
    if (cart.length === 0 || !selectedMethod || isProcessing) return;
    
    // For cash, validate received amount
    if (selectedMethod === PaymentMethod.CASH && cashReceivedVal < finalTotal) {
      alert("Amount received is less than the total due. Please enter correct cash amount.");
      return;
    }

    setIsProcessing(true);
    try {
      const biz = businesses.find(b => b.id === selectedBusinessId);
      
      // Capture SYSTEM TIME in ISO format.
      // This ensures time is recorded exactly as it is on the device/server in UTC.
      const timestamp = new Date().toISOString();

      await storage.saveSale({
        businessId: selectedBusinessId,
        date: timestamp, 
        salesAmount: finalTotal,
        profitPercentage: finalTotal > 0 ? ((finalTotal - cartCost) / finalTotal) * 100 : 0,
        profitAmount: finalTotal - cartCost,
        paymentMethod: selectedMethod,
        items: cart,
        orgId: biz?.orgId
      });

      setSuccessMessage(`Sale Completed: ${formatZAR(finalTotal)}`);
      setCart([]);
      setReceivedAmount('');
      setSelectedMethod(null);
      setIsCheckoutOpen(false);
      
      await loadProducts();
      await fetchTodayTotals(selectedBusinessId);
      
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (e) {
      alert("Checkout failed: " + (e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddDenomination = (val: number) => {
    setReceivedAmount((prev) => (parseFloat(prev || '0') + val).toString());
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
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Filter by SKU or description..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-inner" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          <div className="min-w-full">
            <div className="sticky top-0 z-10 grid grid-cols-12 gap-4 px-8 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
               <div className="col-span-3">SKU / ID</div>
               <div className="col-span-5">Product Details</div>
               <div className="col-span-2 text-right">Unit Price</div>
               <div className="col-span-2 text-right">Availability</div>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {filteredProducts.map(product => {
                  const stock = product.currentStock ?? 0;
                  const isOutOfStock = stock <= 0;
                  
                  return (
                    <button 
                      key={product.id} 
                      disabled={isOutOfStock}
                      onClick={() => addToCart(product)} 
                      className={`w-full grid grid-cols-12 gap-4 items-center px-8 py-4 text-left transition-all group ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50/50' : 'hover:bg-teal-50/40'}`}
                    >
                      <div className="col-span-3">
                         <div className="flex items-center gap-2">
                           <div className={`p-1.5 rounded-lg border transition-colors ${isOutOfStock ? 'bg-slate-100 text-slate-300 border-slate-200' : 'bg-white text-teal-600 border-teal-100 group-hover:bg-teal-600 group-hover:text-white'}`}>
                              <Hash size={14} />
                           </div>
                           <span className="font-mono text-xs font-black text-slate-800 tracking-tight">{product.sku}</span>
                         </div>
                      </div>
                      <div className="col-span-5 overflow-hidden">
                         <p className="text-sm font-bold text-slate-700 truncate">{product.description || 'No Description Available'}</p>
                         <div className="flex items-center gap-2 mt-0.5">
                            <Layers size={10} className="text-slate-300" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Standard Inventory Unit</span>
                         </div>
                      </div>
                      <div className="col-span-2 text-right">
                         <span className="text-sm font-black text-slate-900">{formatZAR(product.salePrice)}</span>
                      </div>
                      <div className="col-span-2 flex flex-col items-end">
                         <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                           isOutOfStock ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white'
                         }`}>
                           {isOutOfStock ? 'Stock Out' : `${stock} In Stock`}
                         </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                 <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-[2.5rem] flex items-center justify-center mb-6">
                   {search ? <PackageSearch size={40} /> : <Package size={40} />}
                 </div>
                 <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">No Matches</h4>
                 <p className="text-xs font-medium text-slate-400">Adjust your search term or barcode</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Digital Basket (High Density View) */}
      <div className="w-full lg:w-[460px] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden text-left">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-slate-400" />
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Digital Basket</h3>
            </div>
            {cart.length > 0 && (
              <button onClick={() => {setCart([]);}} className="text-[9px] font-black text-rose-500 uppercase hover:text-rose-700 tracking-widest">Clear Session</button>
            )}
          </div>

          {/* Live Clock & Date */}
          <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {currentTime.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-900">
              <Clock size={14} className="text-teal-600" />
              <span className="text-sm font-black font-mono tracking-tight">
                {currentTime.toLocaleTimeString('en-ZA', { hour12: false })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
             <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3 flex flex-col">
                <div className="flex items-center gap-1.5 mb-0.5 text-emerald-600">
                   <Wallet size={10} />
                   <span className="text-[8px] font-black uppercase tracking-widest">Today's Cash</span>
                </div>
                <span className="text-sm font-black text-emerald-700">{formatZAR(todayTotals.cash)}</span>
             </div>
             <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3 flex flex-col">
                <div className="flex items-center gap-1.5 mb-0.5 text-blue-600">
                   <Building size={10} />
                   <span className="text-[8px] font-black uppercase tracking-widest">Online / Bank</span>
                </div>
                <span className="text-sm font-black text-blue-700">{formatZAR(todayTotals.bank)}</span>
             </div>
          </div>
        </div>

        {/* High Density Item List */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30">
          {successMessage && (
            <div className="m-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-3 animate-in zoom-in slide-in-from-top-4">
              <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg"><CheckCircle size={18} /></div>
              <span>{successMessage}</span>
            </div>
          )}
          
          <div className="divide-y divide-slate-100">
            {cart.map(item => {
              const itemSubtotal = item.priceAtSale * item.quantity;
              const itemDiscount = item.discount || 0;
              const itemFinal = Math.max(0, itemSubtotal - itemDiscount);

              return (
                <div key={item.productId} className="p-3 bg-white group hover:bg-teal-50/30 transition-all flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <Hash size={12} className="text-slate-300" />
                      <div className="flex flex-col min-w-0">
                        <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate leading-none mb-0.5">{item.sku}</h4>
                        <p className="text-[10px] text-slate-400 font-medium truncate leading-none">{item.description || 'No description'}</p>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.productId)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    {/* Quantity Controls */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 text-slate-400 hover:text-rose-500"><Minus size={12} /></button>
                      <span className="w-6 text-center text-[11px] font-black text-slate-800">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 text-slate-400 hover:text-teal-500"><Plus size={12} /></button>
                    </div>

                    {/* Per-Item Discount Input */}
                    <div className="flex-1 max-w-[110px]">
                      <div className="relative group/input">
                        <Tag className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={10} />
                        <input 
                          type="number"
                          placeholder="Disc. ZAR"
                          className="w-full pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300"
                          value={item.discount || ''}
                          onChange={(e) => updateItemDiscount(item.productId, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="text-right flex flex-col items-end min-w-[70px]">
                      {itemDiscount > 0 && (
                        <span className="text-[8px] font-bold text-slate-400 line-through decoration-slate-300 leading-tight">
                          {formatZAR(itemSubtotal)}
                        </span>
                      )}
                      <span className={`text-[11px] font-black leading-none ${itemDiscount > 0 ? 'text-indigo-600' : 'text-teal-600'}`}>
                        {formatZAR(itemFinal)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {cart.length === 0 && !successMessage && (
            <div className="py-24 text-center text-slate-300 flex flex-col items-center">
               <div className="w-16 h-16 bg-white rounded-full border border-slate-100 shadow-sm flex items-center justify-center mb-4 opacity-50">
                  <ShoppingCart size={24} className="opacity-20" />
               </div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add products to basket</p>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-5 bg-slate-900 border-t border-slate-800 space-y-4 shadow-2xl">
          <div className="space-y-1 px-1">
             <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Subtotal</span>
                <span className="text-xs font-black text-slate-300">{formatZAR(cartSubtotal)}</span>
             </div>
             {totalDiscount > 0 && (
               <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Total Savings</span>
                  <span className="text-xs font-black text-indigo-400">-{formatZAR(totalDiscount)}</span>
               </div>
             )}
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Grand Total</span>
            <span className="text-3xl font-black text-teal-400 tracking-tighter">{formatZAR(finalTotal)}</span>
          </div>
          
          <button 
            disabled={cart.length === 0 || isSuspended || isProcessing} 
            onClick={() => {
              setReceivedAmount('');
              setSelectedMethod(null);
              setIsCheckoutOpen(true);
            }} 
            className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-teal-500 shadow-xl disabled:opacity-50 disabled:bg-slate-700 flex items-center justify-center gap-3 transition-all active:scale-[0.98] border border-white/10"
          >
            {isSuspended ? (
              <>
                <AlertCircle size={18} />
                <span>Registry Locked</span>
              </>
            ) : (
              <>
                Checkout Transaction <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Checkout Modal (Cash Desk Interface) */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => !isProcessing && setIsCheckoutOpen(false)} />
          <div className="bg-white rounded-[3rem] w-full max-w-4xl p-10 relative shadow-2xl border border-slate-100 flex flex-col md:flex-row gap-10">
             
             {/* Left: Summary & Method Selection */}
             <div className="md:w-1/3 space-y-6">
                <div className="text-left space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Summary</p>
                   <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Checkout</h3>
                </div>
                
                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 space-y-4">
                   <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Subtotal</span>
                      <span className="text-sm font-black text-slate-800">{formatZAR(cartSubtotal)}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Discount</span>
                      <span className="text-sm font-black text-rose-600">-{formatZAR(totalDiscount)}</span>
                   </div>
                   <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-sm font-black text-slate-900 uppercase">Total Due</span>
                      <span className="text-2xl font-black text-teal-600">{formatZAR(finalTotal)}</span>
                   </div>
                </div>

                <div className="space-y-2">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Select Payment Channel</p>
                   <button 
                     onClick={() => setSelectedMethod(PaymentMethod.CASH)} 
                     className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all active:scale-95 text-left ${selectedMethod === PaymentMethod.CASH ? 'border-emerald-500 bg-emerald-50' : 'bg-white border-slate-100'}`}
                   >
                      <div className={`p-3 rounded-xl ${selectedMethod === PaymentMethod.CASH ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Banknote size={24} />
                      </div>
                      <div>
                         <span className="block text-[10px] font-black uppercase text-slate-400">Physical</span>
                         <span className="text-sm font-black text-slate-800">CASH IN HAND</span>
                      </div>
                   </button>
                   <button 
                     onClick={() => {
                        setSelectedMethod(PaymentMethod.CARD);
                        setReceivedAmount(finalTotal.toString());
                     }} 
                     className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all active:scale-95 text-left ${selectedMethod === PaymentMethod.CARD ? 'border-blue-500 bg-blue-50' : 'bg-white border-slate-100'}`}
                   >
                      <div className={`p-3 rounded-xl ${selectedMethod === PaymentMethod.CARD ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Globe size={24} />
                      </div>
                      <div>
                         <span className="block text-[10px] font-black uppercase text-slate-400">Digital</span>
                         <span className="text-sm font-black text-slate-800">ONLINE / BANK</span>
                      </div>
                   </button>
                </div>
             </div>

             {/* Right: Cashier Desk (Calculator) */}
             <div className="flex-1 flex flex-col pt-4">
                {selectedMethod === PaymentMethod.CASH ? (
                  <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
                     <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-900 rounded-[2rem] p-6 text-left border border-white/5 shadow-xl">
                           <label className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 mb-3 tracking-widest">
                              <Coins size={14} /> Amount Received (ZAR)
                           </label>
                           <input 
                              type="number"
                              autoFocus
                              placeholder="0.00"
                              className="w-full bg-transparent text-5xl font-black text-white outline-none placeholder:text-slate-800"
                              value={receivedAmount}
                              onChange={(e) => setReceivedAmount(e.target.value)}
                           />
                        </div>
                        <div className="bg-emerald-500 rounded-[2rem] p-6 text-left shadow-xl shadow-emerald-500/20">
                           <label className="flex items-center gap-2 text-[10px] font-black uppercase text-white/70 mb-3 tracking-widest">
                              <Receipt size={14} /> Change to Give
                           </label>
                           <div className="text-5xl font-black text-white">{formatZAR(changeDue)}</div>
                        </div>
                     </div>

                     <div className="grid grid-cols-5 gap-3 mb-auto">
                        {[10, 20, 50, 100, 200].map(den => (
                           <button 
                             key={den} 
                             onClick={() => handleAddDenomination(den)}
                             className="py-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all active:scale-95 group"
                           >
                              <span className="text-[10px] font-black text-slate-400 group-hover:text-slate-500 uppercase">Add</span>
                              <span className="text-xl font-black tracking-tight">R{den}</span>
                           </button>
                        ))}
                     </div>

                     <div className="mt-8 flex gap-4">
                        <button 
                           onClick={() => setIsCheckoutOpen(false)} 
                           className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200"
                        >
                           Go Back
                        </button>
                        <button 
                           disabled={isProcessing || cashReceivedVal < finalTotal}
                           onClick={handleCheckout} 
                           className="flex-[2] py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-teal-700 shadow-2xl shadow-teal-500/30 disabled:opacity-30 flex items-center justify-center gap-3"
                        >
                           {isProcessing ? <Loader2 className="animate-spin" /> : <>Complete Sale <CheckCircle size={18}/></>}
                        </button>
                     </div>
                  </div>
                ) : selectedMethod === PaymentMethod.CARD ? (
                  <div className="flex flex-col items-center justify-center flex-1 space-y-6 animate-in fade-in zoom-in">
                     <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-[2.5rem] flex items-center justify-center animate-pulse">
                        <CreditCard size={48} />
                     </div>
                     <div className="text-center space-y-2">
                        <h4 className="text-2xl font-black text-slate-900 uppercase">Online Verification</h4>
                        <p className="text-sm font-bold text-slate-400 max-w-xs">Awaiting confirmation from bank terminal for {formatZAR(finalTotal)}</p>
                     </div>
                     <div className="flex gap-4 w-full max-w-sm pt-4">
                        <button onClick={() => setSelectedMethod(null)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Cancel</button>
                        <button 
                           disabled={isProcessing}
                           onClick={handleCheckout} 
                           className="flex-1 py-4 bg-teal-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg"
                        >
                           {isProcessing ? 'Confirming...' : 'Simulate Approval'}
                        </button>
                     </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 opacity-20 italic">
                     <ShoppingCart size={80} className="mb-6" />
                     <p className="text-lg font-black uppercase tracking-widest">Waiting for method...</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
