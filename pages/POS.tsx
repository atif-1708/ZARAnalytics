
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
  Info,
  ChevronRight,
  Store,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { storage } from '../services/mockStorage';
import { useAuth } from '../context/AuthContext';
import { Product, Business, SaleItem, PaymentMethod } from '../types';
import { formatZAR } from '../utils/formatters';

export const POS: React.FC = () => {
  const { user, isSuspended } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const bData = await storage.getBusinesses();
      const filteredBiz = bData.filter(b => user?.role === 'SUPER_ADMIN' || user?.assignedBusinessIds?.includes(b.id));
      setBusinesses(filteredBiz);
      if (filteredBiz.length > 0) setSelectedBusinessId(filteredBiz[0].id);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!selectedBusinessId) return;
    try {
      const pData = await storage.getProducts(selectedBusinessId);
      setProducts(pData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadData(); }, [user]);
  useEffect(() => { loadProducts(); }, [selectedBusinessId]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats)].filter(Boolean);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

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
        name: product.name,
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
        date: new Date().toISOString().split('T')[0],
        salesAmount: cartTotal,
        profitPercentage: ((cartTotal - cartCost) / cartTotal) * 100,
        profitAmount: cartTotal - cartCost,
        paymentMethod: method,
        items: cart,
        orgId: biz?.orgId
      });

      setSuccessMessage(`Order Successful (ZAR ${cartTotal.toFixed(2)}) via ${method}`);
      setCart([]);
      setIsCheckoutOpen(false);
      loadProducts(); // Refresh stock
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      alert("Checkout failed: " + (e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Left side: Products */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Header/Filters */}
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
               <div className="p-2 bg-teal-50 text-teal-600 rounded-xl"><Store size={20} /></div>
               <select 
                 value={selectedBusinessId} 
                 onChange={e => setSelectedBusinessId(e.target.value)}
                 className="bg-transparent font-black text-slate-800 text-sm outline-none cursor-pointer"
               >
                 {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
               </select>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search products or descriptions..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-teal-500/20 font-medium text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                  selectedCategory === cat ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 bg-slate-50/30">
          {filteredProducts.map(product => {
            const isOutOfStock = product.currentStock <= 0;
            return (
              <button
                key={product.id}
                disabled={isOutOfStock}
                onClick={() => addToCart(product)}
                className={`flex flex-col text-left bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-teal-200 transition-all group relative overflow-hidden ${isOutOfStock ? 'opacity-60 grayscale' : ''}`}
              >
                <div className="mb-3 flex justify-between items-start">
                  <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-teal-50 transition-colors">
                    <Package size={20} className="text-slate-400 group-hover:text-teal-600" />
                  </div>
                  {product.currentStock < 10 && !isOutOfStock && (
                    <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Low Stock</span>
                  )}
                  {isOutOfStock && (
                    <span className="bg-rose-100 text-rose-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Sold Out</span>
                  )}
                </div>
                <h4 className="text-sm font-black text-slate-800 leading-tight mb-1 truncate">{product.name}</h4>
                <p className="text-[10px] text-slate-400 font-medium line-clamp-2 mb-4 h-8">{product.description}</p>
                <div className="mt-auto flex items-end justify-between">
                  <div className="text-lg font-black text-teal-600">{formatZAR(product.salePrice)}</div>
                  <div className="text-[9px] font-black text-slate-400 uppercase">Stock: {product.currentStock}</div>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus size={16} className="text-teal-500" />
                </div>
              </button>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400">
               <Package size={48} className="mx-auto mb-4 opacity-10" />
               <p className="font-bold text-xs uppercase tracking-widest">No products found</p>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Cart */}
      <div className="w-full lg:w-[400px] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-slate-400" />
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Active Cart</h3>
          </div>
          <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{cart.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-4">
              <CheckCircle size={16} /> {successMessage}
            </div>
          )}
          {cart.map(item => (
            <div key={item.productId} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between group">
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-slate-800 truncate mb-1">{item.name}</h4>
                <div className="text-[10px] font-black text-teal-600">{formatZAR(item.priceAtSale * item.quantity)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white border border-slate-100 rounded-xl p-1 shadow-sm">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 hover:text-rose-500 transition-colors"><Minus size={14} /></button>
                  <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 hover:text-teal-500 transition-colors"><Plus size={14} /></button>
                </div>
                <button onClick={() => removeFromCart(item.productId)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && !successMessage && (
            <div className="py-20 text-center text-slate-300">
               <ShoppingCart size={40} className="mx-auto mb-3 opacity-10" />
               <p className="text-[10px] font-black uppercase tracking-widest">Cart is empty</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Amount</span>
            <span className="text-3xl font-black text-slate-900 tracking-tighter">{formatZAR(cartTotal)}</span>
          </div>
          <button
            disabled={cart.length === 0 || isSuspended}
            onClick={() => setIsCheckoutOpen(true)}
            className="w-full py-4 bg-teal-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-teal-700 shadow-xl shadow-teal-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
          >
            Authorize Payment
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isProcessing && setIsCheckoutOpen(false)} />
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 relative shadow-2xl text-center">
             <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <CreditCard size={40} />
             </div>
             <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Select Payment Method</h3>
             <p className="text-sm text-slate-500 font-medium mb-10">Total due for order: <span className="font-black text-slate-900">{formatZAR(cartTotal)}</span></p>

             <div className="grid grid-cols-2 gap-4">
                <button
                  disabled={isProcessing}
                  onClick={() => handleCheckout(PaymentMethod.CASH)}
                  className="flex flex-col items-center gap-3 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group disabled:opacity-50"
                >
                   <Banknote size={32} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-700">Cash Payment</span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleCheckout(PaymentMethod.CARD)}
                  className="flex flex-col items-center gap-3 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl hover:border-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-50"
                >
                   <CreditCard size={32} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-700">Card Payment</span>
                </button>
             </div>

             <button 
               onClick={() => setIsCheckoutOpen(false)}
               className="mt-10 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors"
             >
               Go back to cart
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
