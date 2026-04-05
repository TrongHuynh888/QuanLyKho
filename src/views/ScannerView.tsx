import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Html5Qrcode } from "html5-qrcode";
import { usePreferences } from "../contexts/PreferencesContext";
import { toast } from "sonner";
import {
  ScanLine, ArrowDownLeft, ArrowUpRight,
  CheckCircle2, History, X, Package, Check, Plus, Minus, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import type { Product } from "../types/supabase";

interface ScannedItem {
  id: string; // product id
  product: Product;
  quantity: number;
}

export default function ScannerView() {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  
  const { preferences } = usePreferences();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "reader";

  useEffect(() => {
    // Fetch products map on mount
    fetch("/api/products")
      .then(r => r.json())
      .then(data => setAllProducts(data || []))
      .catch(err => console.error("Failed to load products for scanner:", err));

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanner = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerId);
      }
      
      setIsScanning(true);
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanSuccess(decodedText.trim());
        },
        () => { /* ignore */ }
      );
    } catch (err) {
      console.error(err);
      toast.error(t("camera_error"));
      setIsScanning(false);
    }
  };

  const playBeep = () => {
    if (!preferences.scanner_sound_enabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sine";
      oscillator.frequency.value = 1000;
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
  };

  const handleScanSuccess = async (text: string) => {
    playBeep();
    // Pause scanner to process
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.pause();
    }
    
    // Find product
    const match = allProducts.find(p => p.id === text || p.sku === text);
    if (!match) {
      toast.error("Mã không hợp lệ hoặc sản phẩm không tồn tại!");
      // Resume shortly
      setTimeout(() => {
        if (scannerRef.current && scannerRef.current.getState() === 2 /* PAUSED */) {
           scannerRef.current.resume();
        }
      }, 1500);
      return;
    }
    
    // Prompt config
    setPendingProduct(match);
  };

  const confirmAddProduct = () => {
    if (!pendingProduct) return;
    setScannedItems(prev => {
      const idx = prev.findIndex(item => item.id === pendingProduct.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].quantity += 1;
        return next;
      }
      return [...prev, { id: pendingProduct.id, product: pendingProduct, quantity: 1 }];
    });
    toast.success(`Đã thêm ${pendingProduct.name}`);
    setPendingProduct(null);
    resumeScanner();
  };

  const cancelAddProduct = () => {
    setPendingProduct(null);
    resumeScanner();
  };

  const resumeScanner = () => {
    if (scannerRef.current && scannerRef.current.getState() === 2 /* PAUSED */) {
      scannerRef.current.resume();
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
      setIsScanning(false);
    }
  };

  const handleAction = (type: "inbound" | "outbound") => {
    if (scannedItems.length === 0) {
      toast.error("Chưa có sản phẩm nào trong danh sách quét!");
      return;
    }
    
    const payload = scannedItems.map(item => ({ product: item.product, quantity: item.quantity }));
    
    if (type === "inbound") {
      window.dispatchEvent(new CustomEvent("nav-new-inbound-wizard", { detail: { items: payload } }));
    } else {
      window.dispatchEvent(new CustomEvent("nav-new-outbound-wizard", { detail: { items: payload } }));
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setScannedItems(prev => prev.map(item => {
      if (item.id === id) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setScannedItems(prev => prev.filter(item => item.id !== id));
  };

  // Queue View Overwrite
  if (showQueue) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-6 py-12">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Danh sách đã quét</h3>
          <button onClick={() => setShowQueue(false)} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl hover:bg-neutral-200 transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          {scannedItems.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 dark:text-neutral-500">
              <Package size={48} className="mx-auto mb-4 opacity-20" />
              <p>Chưa có sản phẩm nào</p>
            </div>
          ) : (
            scannedItems.map((item) => (
              <div key={item.id} className="p-4 bg-white dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 rounded-2xl shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden flex-shrink-0">
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={20} className="text-neutral-400" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-900 dark:text-neutral-50 truncate">{item.product.name}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono mt-0.5">{item.product.sku}</p>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Số lượng</span>
                  <div className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900 px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-neutral-500 hover:text-taika-blue transition-colors">
                      <Minus size={14} />
                    </button>
                    <span className="font-bold text-sm w-6 text-center text-neutral-900 dark:text-neutral-50">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-neutral-500 hover:text-taika-blue transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {scannedItems.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={() => handleAction("inbound")} className="py-3 bg-taika-blue text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-taika-blue/20 active:scale-95 transition-all">
              <ArrowDownLeft size={18} /> Kho
            </button>
            <button onClick={() => handleAction("outbound")} className="py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-50 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all">
              <ArrowUpRight size={18} /> Xuất
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col items-center gap-6 py-6 px-4">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{t("mobile_scanner")}</h3>
        <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">{t("scan_instruction")}</p>
      </div>
      
      <div className="w-full max-w-[320px] aspect-square bg-neutral-900 rounded-[2.5rem] relative overflow-hidden flex flex-col items-center justify-center shadow-xl shadow-neutral-200/50 border-4 border-neutral-100 dark:border-neutral-800">
        <div id={scannerId} className="absolute inset-0 w-full h-full" />
        
        {!isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-20 bg-neutral-900/80 backdrop-blur-sm">
            <div className="w-20 h-20 bg-taika-blue/20 rounded-full flex items-center justify-center text-taika-blue animate-pulse">
              <ScanLine size={40} />
            </div>
            <button onClick={startScanner} className="px-6 py-3 bg-taika-blue text-white rounded-xl text-sm font-bold shadow-xl shadow-taika-blue/20 active:scale-95 transition-all">
              {t("start_camera")}
            </button>
          </div>
        )}

        {isScanning && (
          <>
            <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none z-10" />
            <div className="w-56 h-56 border-2 border-white/50 rounded-[1.5rem] relative flex items-center justify-center z-10">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-taika-blue rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-taika-blue rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-taika-blue rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-taika-blue rounded-br-xl" />
              
              <motion.div
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-1 bg-taika-blue shadow-[0_0_20px_rgba(0,102,255,1)] z-10"
              />
            </div>
            <button onClick={stopScanner} className="absolute bottom-6 px-6 py-2 bg-black/50 text-white rounded-full text-xs font-bold backdrop-blur-md transition-all z-20">
              {t("stop_scanning")}
            </button>
          </>
        )}

        {/* Confirmation Overlay */}
        <AnimatePresence>
          {pendingProduct && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
              className="absolute inset-x-3 bottom-3 p-3 bg-white dark:bg-neutral-900 rounded-2xl z-30 shadow-2xl border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden shrink-0">
                  {pendingProduct.image_url ? (
                    <img src={pendingProduct.image_url} alt="" className="w-full h-full object-cover" />
                  ) : <Package className="text-neutral-400" size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-neutral-900 dark:text-neutral-50 truncate">{pendingProduct.name}</p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5">{pendingProduct.sku}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={confirmAddProduct} className="py-2 bg-taika-blue text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                  <Check size={14} /> Thêm vào DS
                </button>
                <button onClick={cancelAddProduct} className="py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                  Huỷ bỏ
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-[320px] grid grid-cols-2 gap-3">
        <button onClick={() => handleAction("inbound")} className="flex flex-col items-center gap-2 p-4 bg-taika-blue text-white rounded-2xl font-bold shadow-lg shadow-taika-blue/20 active:scale-95 transition-all relative overflow-hidden group">
          <div className="w-10 h-10 bg-white/20 dark:bg-neutral-950/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <ArrowDownLeft size={20} />
          </div>
          <span className="z-10 text-xs tracking-wide">{t("inbound")}</span>
        </button>
        <button onClick={() => handleAction("outbound")} className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-neutral-950 border-2 border-neutral-100 dark:border-neutral-800 text-neutral-900 dark:text-neutral-50 rounded-2xl font-bold shadow-sm active:scale-95 transition-all group">
          <div className="w-10 h-10 bg-neutral-50 dark:bg-neutral-900 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <ArrowUpRight size={20} />
          </div>
          <span className="z-10 text-xs tracking-wide">{t("outbound")}</span>
        </button>
        <button onClick={() => setShowQueue(true)} className="col-span-2 flex items-center justify-between p-4 bg-neutral-900 text-white rounded-2xl font-bold active:scale-95 transition-all group">
          <div className="flex items-center gap-3">
             <History size={18} className="text-neutral-400 group-hover:text-white transition-colors" />
             <span className="text-sm">Danh sách đang chờ</span>
          </div>
          <div className="px-2.5 py-1 bg-white/20 rounded-full text-[10px] font-black">
            {scannedItems.length} SP
          </div>
        </button>
      </div>
    </div>
  );
}
