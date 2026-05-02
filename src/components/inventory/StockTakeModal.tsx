import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Boxes, Loader2, CheckCircle2, AlertTriangle, AlertCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { Warehouse } from "../../types/supabase";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Interface thuộc tính cho Component Kiểm kê Kho.
 */
type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Cấu trúc dữ liệu Từng phần tử của phiên kiểm đếm.
 */
type StockTakeItemData = {
  id: string;
  inventory_id: string | null;
  product_id: string;
  batch_id: string | null;
  location_id: string | null;
  system_qty: number;
  actual_qty: number | null;
  variance: number;
  products?: { name: string; sku: string; uoms?: { abbreviation: string } };
  batches?: { lot_number: string };
  storage_locations?: { zone: string; rack: string; bin: string };
};

/**
 * Component Modal Kiểm Kê Kho định kỳ (Stock Take Modal).
 * Cho phép thiết lập 1 phiên kiểm kê hàng ở kho cụ thể, tiến hành đếm thủ công,
 * thay đổi số lượng thực tế, và tự đối soát, lưu vết trên Database.
 * 
 * @param {Props} props Thuộc tính truyền vào cho việc Mở/Đóng Modal
 * @returns {JSX.Element} Cửa sổ Kiểm kê Kho
 */
export default function StockTakeModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [items, setItems] = useState<StockTakeItemData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (offset: number) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedWarehouse("");
      setTitle("");
      setNotes("");
      setSessionData(null);
      setItems([]);
      fetchWarehouses();
    }
  }, [isOpen]);

  const fetchWarehouses = async () => {
    try {
      const response = await fetch("/api/warehouses");
      const data = await response.json();
      if (response.ok) setWarehouses(data);
    } catch (err) {
      console.error(err);
    }
  };

  const startSession = async () => {
    if (!selectedWarehouse || !title.trim()) {
      toast.error(t("select_warehouse_first"));
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch("/api/stock-takes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: selectedWarehouse,
          title: title.trim(),
          notes: notes.trim(),
          created_by: user?.id
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setSessionData(data);
      await fetchItems(data.id);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Cannot start stock take");
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/stock-takes/${sessionId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems(data.items || []);
    } catch (err: any) {
      toast.error(err.message || "Cannot load items");
    }
  };

  const saveTemporarily = async () => {
    if (!sessionData) return;
    setLoading(true);
    try {
      const payload = items.map(it => ({ id: it.id, actual_qty: it.actual_qty }));
      const response = await fetch(`/api/stock-takes/${sessionData.id}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload })
      });
      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.error);
      }
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to save items");
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (id: string, val: string) => {
    const num = val === "" ? null : Number(val);
    setItems(items.map(it => {
      if (it.id === id) {
        const actual = num;
        const variance = actual !== null ? actual - it.system_qty : 0;
        return { ...it, actual_qty: actual, variance };
      }
      return it;
    }));
  };

  const completeAudit = async () => {
    if (!sessionData) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/stock-takes/${sessionData.id}/complete`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user?.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      toast.success(t("stock_take_completed"));
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete stock take");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(it => 
    (it.products?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (it.products?.sku || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const countedItemsCount = items.filter(i => i.actual_qty !== null).length;
  const varianceCount = items.filter(i => i.actual_qty !== null && i.variance !== 0).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-950/50 backdrop-blur-sm z-50 transition-opacity"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-8 py-6 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-taika-blue-light dark:bg-blue-500/20 rounded-2xl flex items-center justify-center text-taika-blue dark:text-blue-400">
                  <Boxes size={24} className="stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">{t("stock_take")}</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                    {step === 1 && t("step_create_session")}
                    {step === 2 && t("step_input_quantities")}
                    {step === 3 && t("step_review_complete")}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              {step === 1 && (
                <div className="space-y-6 max-w-lg mx-auto py-8">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{t("warehouse")} *</label>
                    <div className="relative group">
                      <button onClick={(e) => { e.preventDefault(); scrollBy(-250); }} className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 w-8 h-8 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                         <ChevronLeft size={18} />
                      </button>
                      <div ref={scrollRef} className="flex overflow-x-auto gap-4 pb-2 snap-x custom-scrollbar">
                        {warehouses.map(w => (
                          <div
                            key={w.id}
                            onClick={() => setSelectedWarehouse(w.id)}
                            className={cn(
                              "w-64 shrink-0 p-4 rounded-2xl border-2 cursor-pointer transition-all snap-start",
                              selectedWarehouse === w.id
                                ? "border-taika-blue bg-blue-50 dark:bg-blue-900/20"
                                : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                selectedWarehouse === w.id 
                                  ? "bg-taika-blue text-white dark:bg-blue-600" 
                                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                              )}>
                                <Boxes size={20} />
                              </div>
                              <div>
                                <p className="font-bold text-neutral-900 dark:text-white leading-tight">{w.name}</p>
                                <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">{w.location}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={(e) => { e.preventDefault(); scrollBy(250); }} className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 w-8 h-8 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                         <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{t("stock_take_title")} *</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{t("notes")}</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue" rows={3} />
                  </div>
                  <button onClick={startSession} disabled={loading || !selectedWarehouse || !title} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-taika-blue text-white rounded-2xl font-bold hover:bg-taika-blue-hover disabled:opacity-50 transition-all">
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <Boxes size={20} />} {t("start_stock_take")}
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4">
                       <div className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                          <span className="text-sm text-neutral-500 font-medium mr-2">{t("total")}</span>
                          <span className="font-bold">{items.length}</span>
                       </div>
                       <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-taika-blue dark:text-blue-400 rounded-xl">
                          <span className="text-sm font-medium mr-2">{t("items_counted")}</span>
                          <span className="font-bold">{countedItemsCount}</span>
                       </div>
                    </div>
                    <div className="relative w-64">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                      <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t("search")} className="w-full pl-11 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl text-sm outline-none" />
                    </div>
                  </div>

                  <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">{t("product")}</th>
                          <th className="px-4 py-3 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">{t("location_detail")}</th>
                          <th className="px-4 py-3 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">{t("system_qty")}</th>
                          <th className="px-4 py-3 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">{t("actual_qty")}</th>
                          <th className="px-4 py-3 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">{t("variance")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {filteredItems.map(it => (
                          <tr key={it.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                            <td className="px-4 py-3">
                               <p className="font-bold text-neutral-900 dark:text-neutral-100">{it.products?.name}</p>
                               <p className="text-xs text-neutral-500">{it.products?.sku} • {it.batches?.lot_number || t("no_batch")}</p>
                            </td>
                            <td className="px-4 py-3">
                               <p className="text-sm font-medium">{it.storage_locations ? `${it.storage_locations.zone}-${it.storage_locations.rack}-${it.storage_locations.bin}` : "N/A"}</p>
                            </td>
                            <td className="px-4 py-3">
                               <span className="font-bold text-neutral-900 dark:text-neutral-100">{it.system_qty}</span>
                               <span className="text-xs text-neutral-500 ml-1">{it.products?.uoms?.abbreviation}</span>
                            </td>
                            <td className="px-4 py-3">
                               <input 
                                 type="number" 
                                 value={it.actual_qty ?? ""} 
                                 onChange={(e) => handleQtyChange(it.id, e.target.value)}
                                 className="w-24 p-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg outline-none focus:ring-2 focus:ring-taika-blue text-right font-bold w-full"
                               />
                            </td>
                            <td className="px-4 py-3">
                               {it.actual_qty !== null ? (
                                  <span className={cn(
                                    "font-bold px-2 py-1 rounded-md text-sm",
                                    it.variance === 0 ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" :
                                    it.variance > 0 ? "bg-blue-100 text-taika-blue dark:bg-blue-500/20 dark:text-blue-400" :
                                    "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                                  )}>
                                     {it.variance > 0 ? '+' : ''}{it.variance}
                                  </span>
                               ) : (
                                  <span className="text-neutral-400 text-sm">—</span>
                               )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-neutral-100 dark:border-neutral-800">
                        <CheckCircle2 className="text-green-500 mb-4" size={32} />
                        <p className="text-sm font-bold text-neutral-500 dark:text-neutral-400">{t("items_counted")}</p>
                        <p className="text-3xl font-black text-neutral-900 dark:text-white mt-1">{countedItemsCount} / {items.length}</p>
                     </div>
                     <div className="p-6 bg-red-50 dark:bg-red-500/5 rounded-3xl border border-red-100 dark:border-red-900/30">
                        <AlertTriangle className="text-red-500 mb-4" size={32} />
                        <p className="text-sm font-bold text-red-500/80 dark:text-red-400/80">{t("items_with_variance")}</p>
                        <p className="text-3xl font-black text-red-600 dark:text-red-400 mt-1">{varianceCount}</p>
                     </div>
                  </div>
                  
                  {varianceCount > 0 && (
                     <div>
                        <h3 className="font-bold text-neutral-900 dark:text-neutral-100 mb-4">{t("adjustments_to_be_made")}</h3>
                        <div className="space-y-2">
                           {items.filter(i => i.variance !== 0 && i.actual_qty !== null).map(it => (
                              <div key={it.id} className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                                 <div>
                                    <p className="font-bold text-neutral-900 dark:text-white">{it.products?.name}</p>
                                    <p className="text-xs text-neutral-500">{it.storage_locations ? `${it.storage_locations.zone}-${it.storage_locations.rack}-${it.storage_locations.bin}` : "N/A"}</p>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <span className="text-neutral-500 line-through text-sm">{it.system_qty}</span>
                                    <span className="font-bold">{it.actual_qty}</span>
                                    <span className={cn(
                                       "px-2 py-1 rounded-md text-xs font-bold",
                                       it.variance > 0 ? "bg-blue-100 text-taika-blue dark:bg-blue-500/20 dark:text-blue-400" : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                                    )}>
                                       {it.variance > 0 ? '+' : ''}{it.variance}
                                    </span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-taika-blue dark:text-blue-400 rounded-xl flex items-start gap-3">
                     <AlertCircle size={20} className="shrink-0 mt-0.5" />
                     <p className="text-sm font-medium">{t("audit_completion_warning")}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-3 shrink-0">
               {step > 1 && (
                  <button onClick={() => setStep(step === 3 ? 2 : 1)} className="px-6 py-3 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold rounded-2xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
                    {t("back")}
                  </button>
               )}
               {step === 2 && (
                  <button onClick={saveTemporarily} disabled={loading} className="flex items-center gap-2 px-8 py-3 bg-taika-blue text-white font-bold rounded-2xl hover:bg-taika-blue-hover transition-colors disabled:opacity-50">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : t("next")}
                  </button>
               )}
               {step === 3 && (
                  <button onClick={completeAudit} disabled={loading} className="flex items-center gap-2 px-8 py-3 bg-taika-blue text-white font-bold rounded-2xl hover:bg-taika-blue-hover transition-colors disabled:opacity-50">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    {t("confirm_adjustment")}
                  </button>
               )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
