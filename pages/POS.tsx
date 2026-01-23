
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
  Hash
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
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadData(); }, [user]);
  useEffect(() => { loadProducts(); }, [selectedBusinessId]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.sku.toLowerCase().includes(search.toLowerCase()) || 
      p.description.toLowerCase().includes(search.toLowerCase())
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
        date: new Date().toISOString().split('T')[0],
        salesAmount: cartTotal,
        profitPercentage: ((cartTotal - cartCost) / cartTotal) * 100,
        profitAmount: cartTotal - cartCost,
        paymentMethod: method,
        items: cart,
        orgId: biz?.orgId
      });

      setSuccessMessage(`Checkout Complete (ZAR ${cartTotal.toFixed(2)})`);
      setCart([]);
      setIsCheckoutOpen(false);
      loadProducts();
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
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="p-2 bg-slate-900 text-white rounded-xl"><Store size={20} /></div>
             <select value={selectedBusinessId} onChange={e => setSelectedBusinessId(e.target.value)} className="bg-transparent font-black text-slate-800 text-sm outline-none cursor-pointer">
               {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
             </select>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Scan SKU or Search..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none font-medium text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 bg-slate-50/30">
          {filteredProducts.map(product => (
            <button key={product.id} disabled={product.currentStock <= 0} onClick={() => addToCart(product)} className={`flex flex-col text-left bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-teal-400 transition-all group relative ${product.currentStock <= 0 ? 'opacity-50 grayscale' : ''}`}>
              <div className="flex items-center gap-1.5 mb-3">
                 <Hash size={12} className="text-slate-300" />
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{product.sku}</span>
              </div>
              <p className="text-xs font-bold text-slate-700 line-clamp-3 mb-6 flex-1">{product.description || 'No detailed info'}</p>
              <div className="mt-auto flex items-end justify-between">
                <div className="text-xl font-black text-slate-900">{formatZAR(product.salePrice)}</div>
                <div className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${product.currentStock < 10 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                   Stock: {product.currentStock}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full lg:w-[400px] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <ShoppingCart size={20} className="text-slate-400" />
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Active Sale</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-2 animate-bounce">
              <CheckCircle size={16} /> {successMessage}
            </div>
          )}
          {cart.map(item => (
            <div key={item.productId} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between group">
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.sku}</h4>
                <div className="text-xs font-black text-teal-600">{formatZAR(item.priceAtSale * item.quantity)}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-slate-100 rounded-xl p-1">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 hover:text-rose-500"><Minus size={14} /></button>
                  <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 hover:text-teal-500"><Plus size={14} /></button>
                </div>
                <button onClick={() => removeFromCart(item.productId)} className="p-2 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && !successMessage && (
            <div className="py-20 text-center text-slate-300">
               <ShoppingCart size={40} className="mx-auto mb-3 opacity-10" />
               <p className="text-[10px] font-black uppercase tracking-widest">Terminal Empty</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Total</span>
            <span className="text-3xl font-black text-slate-900 tracking-tighter">{formatZAR(cartTotal)}</span>
          </div>
          <button disabled={cart.length === 0 || isSuspended} onClick={() => setIsCheckoutOpen(true)} className="w-full py-4 bg-teal-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-teal-700 shadow-xl disabled:opacity-50 flex items-center justify-center gap-3 transition-all">
            Authorize Payment <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isProcessing && setIsCheckoutOpen(false)} />
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 relative shadow-2xl text-center">
             <CreditCard size={40} className="text-teal-600 mx-auto mb-6" />
             <h3 className="text-2xl font-black text-slate-900 mb-2">Select Payment</h3>
             <p className="text-sm text-slate-500 mb-10">Terminal Total: <span className="font-black text-slate-900">{formatZAR(cartTotal)}</span></p>
             <div className="grid grid-cols-2 gap-4">
                <button disabled={isProcessing} onClick={() => handleCheckout(PaymentMethod.CASH)} className="flex flex-col items-center gap-3 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl hover:border-emerald-500 transition-all">
                   <Banknote size={32} className="text-slate-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Cash</span>
                </button>
                <button disabled={isProcessing} onClick={() => handleCheckout(PaymentMethod.CARD)} className="flex flex-col items-center gap-3 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl hover:border-blue-500 transition-all">
                   <CreditCard size={32} className="text-slate-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Card</span>
                </button>
             </div>
             <button onClick={() => setIsCheckoutOpen(false)} className="mt-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancel Checkout</button>
          </div>
        </div>
      )}
    </div>
  );
};
