
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
  AlertCircle,
  ScanBarcode,
  FileText,
  Printer
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Product, Business, SaleItem, PaymentMethod, UserRole, DailySale } from '../types';
import { formatZAR, getLocalISOString } from '../utils/formatters';

export const POS: React.FC = () => {
  const { user, isSuspended } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Search State
  const [searchFields, setSearchFields] = useState({
    sku: '',
    barcode: '',
    description: ''
  });

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Checkout & Calculator State
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [todayTotals, setTodayTotals] = useState({ cash: 0, bank: 0 });
  const [lastCompletedSale, setLastCompletedSale] = useState<DailySale | null>(null);

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
    return products.filter(p => {
      const matchSku = !searchFields.sku || p.sku.toLowerCase().includes(searchFields.sku.toLowerCase());
      const matchBarcode = !searchFields.barcode || (p.barcode && p.barcode.toLowerCase().includes(searchFields.barcode.toLowerCase()));
      const matchDesc = !searchFields.description || (p.description && p.description.toLowerCase().includes(searchFields.description.toLowerCase()));
      return matchSku && matchBarcode && matchDesc;
    });
  }, [products, searchFields]);

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
    if (searchFields.barcode) {
      setSearchFields(prev => ({ ...prev, barcode: '' }));
    }
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

  const printReceipt = (sale: DailySale) => {
    const biz = businesses.find(b => b.id === sale.businessId);
    const date = sale.createdAt ? new Date(sale.createdAt) : new Date(sale.date);
    
    const printWindow = window.open('', '', 'width=400,height=600');
    if (!printWindow) return;

    const itemsHtml = (sale.items || []).map(item => `
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
        <span>${item.quantity} x ${item.description || item.sku}</span>
        <span>${formatZAR(item.priceAtSale * item.quantity)}</span>
      </div>
      ${item.discount ? `<div style="font-size: 10px; color: #666; text-align: right;">Disc: -${formatZAR(item.discount)}</div>` : ''}
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; width: 300px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .title { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
            .meta { font-size: 10px; color: #333; }
            .items { margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .totals { text-align: right; font-size: 12px; margin-bottom: 20px; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 5px; }
            .footer { text-align: center; font-size: 10px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${biz?.name || 'ZARlytics Store'}</div>
            <div class="meta">${biz?.location || ''}</div>
            <div class="meta">Date: ${date.toLocaleString()}</div>
            <div class="meta">Ref: ${sale.id.substring(0, 8)}</div>
          </div>
          <div class="items">
            ${itemsHtml}
          </div>
          <div class="totals">
            ${sale.profitAmount > 0 && sale.profitPercentage > 0 ? '' : ''} 
            <div class="total-row">
              <span>TOTAL</span>
              <span>${formatZAR(sale.salesAmount)}</span>
            </div>
            <div style="font-size: 10px; margin-top: 5px;">Method: ${sale.paymentMethod}</div>
          </div>
          <div class="footer">
            Thank you for your business!
          </div>
          <script>
            window.print();
            // Removed auto-close to prevent slip hiding before user is done
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !selectedMethod || isProcessing) return;
    if (selectedMethod === PaymentMethod.CASH && cashReceivedVal < finalTotal) {
      alert("Amount received is less than the total due. Please enter correct cash amount.");
      return;
    }

    setIsProcessing(true);
    try {
      const biz = businesses.find(b => b.id === selectedBusinessId);
      const timestamp = new Date().toISOString();

      const saleData = await storage.saveSale({
        businessId: selectedBusinessId,
        date: timestamp, 
        salesAmount: finalTotal,
        profitPercentage: finalTotal > 0 ? ((finalTotal - cartCost) / finalTotal) * 100 : 0,
        profitAmount: finalTotal - cartCost,
        paymentMethod: selectedMethod,
        items: cart,
        orgId: biz?.orgId
      });

      setLastCompletedSale(saleData);
      setSuccessMessage(`Sale Completed: ${formatZAR(finalTotal)}`);
      setCart([]);
      setReceivedAmount('');
      setSelectedMethod(null);
      setIsCheckoutOpen(false);
      
      await loadProducts();
      await fetchTodayTotals(selectedBusinessId);
      
      setTimeout(() => {
        setSuccessMessage(null);
        setLastCompletedSale(null);
      }, 8000);
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
    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Left: Product Selection */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm text-left">
        
        {/* Header Container */}
        <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-20 space-y-4">
          
          {/* Row 1: Store Controls */}
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                 <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-md"><Store size={18} /></div>
                 <select 
                   value={selectedBusinessId} 
                   onChange={e => setSelectedBusinessId(e.target.value)} 
                   className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-3 pl-3 pr-8 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-teal-500/20 transition-all w-64 hover:bg-slate-100"
                 >
                   {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                 </select>
                 <button 
                   onClick={() => loadProducts(true)} 
                   className={`p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-teal-600 transition-all ${isRefreshing ? 'animate-spin text-teal-600' : 'text-slate-400'}`}
                   title="Refresh Inventory"
                 >
                   <RefreshCw size={16} />
                 </button>
             </div>
          </div>
          
          {/* Row 2: Search Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative group">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="SKU Code" 
                className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 shadow-sm" 
                value={searchFields.sku} 
                onChange={e => setSearchFields(prev => ({ ...prev, sku: e.target.value }))} 
              />
            </div>
            <div className="relative group">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Item Description" 
                className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-sm" 
                value={searchFields.description} 
                onChange={e => setSearchFields(prev => ({ ...prev, description: e.target.value }))} 
              />
            </div>
            <div className="relative group">
              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
              <input 
                type="text" 
                autoFocus
                placeholder="Scan Barcode" 
                className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-sm" 
                value={searchFields.barcode} 
                onChange={e => setSearchFields(prev => ({ ...prev, barcode: e.target.value }))} 
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          <div className="min-w-full">
            <div className="sticky top-0 z-10 grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
               <div className="col-span-3 md:col-span-2">SKU / ID</div>
               <div className="col-span-5 md:col-span-6">Product Details</div>
               <div className="col-span-2 text-right">Unit Price</div>
               <div className="col-span-2 text-right">Stock</div>
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
                      className={`w-full grid grid-cols-12 gap-4 items-center px-6 py-3.5 text-left transition-all group ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50/50' : 'hover:bg-teal-50/30'}`}
                    >
                      <div className="col-span-3 md:col-span-2 overflow-hidden">
                         <div className="flex flex-col items-start gap-1">
                           <div className="flex items-center gap-2">
                             <div className={`p-1 rounded-md border transition-colors ${isOutOfStock ? 'bg-slate-100 text-slate-300 border-slate-200' : 'bg-white text-teal-600 border-teal-100 group-hover:bg-teal-600 group-hover:text-white'}`}>
                                <Hash size={12} />
                             </div>
                             <span className="font-mono text-xs font-black text-slate-800 tracking-tight truncate">{product.sku}</span>
                           </div>
                           {product.barcode && (
                             <div className="flex items-center gap-1.5 pl-0.5 opacity-60">
                               <ScanBarcode size={10} />
                               <span className="text-[9px] font-mono truncate max-w-[80px]">{product.barcode}</span>
                             </div>
                           )}
                         </div>
                      </div>
                      <div className="col-span-5 md:col-span-6 overflow-hidden">
                         <p className="text-sm font-bold text-slate-700 truncate">{product.description || 'No Description Available'}</p>
                         <div className="flex items-center gap-2 mt-0.5">
                            <Layers size={10} className="text-slate-300" />
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Standard Unit</span>
                         </div>
                      </div>
                      <div className="col-span-2 text-right">
                         <span className="text-sm font-black text-slate-900">{formatZAR(product.salePrice)}</span>
                      </div>
                      <div className="col-span-2 flex flex-col items-end">
                         <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all ${
                           isOutOfStock ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white'
                         }`}>
                           {isOutOfStock ? 'Out' : `${stock}`}
                         </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                 <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-[2.5rem] flex items-center justify-center mb-6">
                   <PackageSearch size={40} />
                 </div>
                 <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">No Matches</h4>
                 <p className="text-xs font-medium text-slate-400">Try adjusting your search criteria</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Digital Basket */}
      <div className="w-full xl:w-[420px] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden text-left shrink-0">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-slate-400" />
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Digital Basket</h3>
            </div>
            {cart.length > 0 && (
              <button onClick={() => {setCart([]);}} className="text-[9px] font-black text-rose-500 uppercase hover:text-rose-700 tracking-widest bg-rose-50 px-2 py-1 rounded-md border border-rose-100">Clear</button>
            )}
          </div>

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

        <div className="flex-1 overflow-y-auto bg-slate-50/30">
          {successMessage && (
            <div className="m-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold flex flex-col gap-3 animate-in zoom-in slide-in-from-top-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg"><CheckCircle size={18} /></div>
                <span>{successMessage}</span>
              </div>
              {lastCompletedSale && (
                <button 
                  onClick={() => printReceipt(lastCompletedSale)} 
                  className="w-full py-2 bg-white border border-emerald-200 rounded-xl text-emerald-700 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
                >
                  <Printer size={14} /> Print Receipt
                </button>
              )}
            </div>
          )}
          
          <div className="divide-y divide-slate-100">
            {cart.map(item => {
              const itemSubtotal = item.priceAtSale * item.quantity;
              const itemDiscount = item.discount || 0;
              const itemFinal = Math.max(0, itemSubtotal - itemDiscount);

              return (
                <div key={item.productId} className="p-3 bg-white group hover:bg-teal-50/30 transition-all flex flex-col gap-2">
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
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 text-slate-400 hover:text-rose-500"><Minus size={12} /></button>
                      <span className="w-6 text-center text-[11px] font-black text-slate-800">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 text-slate-400 hover:text-teal-500"><Plus size={12} /></button>
                    </div>

                    <div className="flex-1 max-w-[90px]">
                      <div className="relative group/input">
                        <Tag className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors" size={10} />
                        <input 
                          type="number"
                          placeholder="Disc."
                          className="w-full pl-5 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all placeholder:text-slate-300 text-right"
                          value={item.discount || ''}
                          onChange={(e) => updateItemDiscount(item.productId, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

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

      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => !isProcessing && setIsCheckoutOpen(false)} />
          <div className="bg-white rounded-[3rem] w-full max-w-4xl p-10 relative shadow-2xl border border-slate-100 flex flex-col md:flex-row gap-10">
             
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
