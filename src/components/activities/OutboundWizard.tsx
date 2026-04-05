import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import { 
  X, ChevronRight, ChevronLeft, Check, Plus, Trash2, Search,
  Package, MapPin, Loader2, ArrowRight, CornerDownRight, Box, User,
  Phone, Warehouse, ExternalLink, MapPinned, Map
} from "lucide-react";
import type { Customer, Product, Warehouse as WarehouseType } from "../../types/supabase";
import { usePreferences } from "../../contexts/PreferencesContext";
import WarehouseMap from "../inventory/WarehouseMap";

// ── Types ─────────────────────────────────────────────────────
interface OutboundProductLine {
  key: string;
  product_id: string;
  quantity_requested: number;
  search_term?: string;
}

interface BatchAllocation {
  batch_id: string;
  lot_number: string;
  expiry_date: string | null;
  quantity: number;
  available_qty: number;
  locations: { name: string; qty: number; pick_qty: number; warehouse_id?: string; warehouse_name?: string; location_id?: string }[];
}

interface ProductDetails {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
  allocations: BatchAllocation[];
  fulfilled: boolean;
  error?: string;
  total_allocated: number;
}

interface OutboundWizardProps {
  userId: string | null;
  onClose: () => void;
  onComplete: () => void;
  inline?: boolean;
  initialScannedItems?: { product: Product; quantity: number }[];
}

const STEPS = [
  { label: "Khách hàng", icon: User },
  { label: "Sản phẩm", icon: Package },
  { label: "Kiểm tra FEFO & Kho", icon: MapPin },
];

export default function OutboundWizard({ userId, onClose, onComplete, inline = false, initialScannedItems }: OutboundWizardProps) {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── Step 1 ──
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  // ── Step 2 ──
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<OutboundProductLine[]>(() => {
    if (initialScannedItems && initialScannedItems.length > 0) {
      return initialScannedItems.map(item => ({
        key: crypto.randomUUID(), product_id: item.product.id, quantity_requested: item.quantity
      }));
    }
    return [{ key: crypto.randomUUID(), product_id: "", quantity_requested: 0 }];
  });

  // ── Step 3 ──
  const [allocationsData, setAllocationsData] = useState<Record<string, ProductDetails>>({});
  const [isAllocating, setIsAllocating] = useState(false);

  // ── Map overlay ──
  const [mapOverlayWarehouseId, setMapOverlayWarehouseId] = useState<string | null>(null);
  const [mapOverlaySku, setMapOverlaySku] = useState("");
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers").then(r => r.json()),
      fetch("/api/products").then(r => r.json()),
      fetch("/api/warehouses").then(r => r.json())
    ]).then(([c, p, w]) => {
      setCustomers(c || []);
      setProducts(p || []);
      setWarehouses(w || []);
    });
  }, []);

  // Set default shipping address when customer changes
  useEffect(() => {
    if (customerId) {
      const c = customers.find(x => x.id === customerId);
      if (c && c.address) setShippingAddress(c.address);
    }
  }, [customerId, customers]);

  const addLine = () => setLines(prev => [...prev, { key: crypto.randomUUID(), product_id: "", quantity_requested: 0 }]);
  const updateLine = (key: string, field: keyof OutboundProductLine, value: any) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));
  };
  const removeLine = (key: string) => {
    if (lines.length > 1) setLines(prev => prev.filter(l => l.key !== key));
  };

  const calculateFEFO = async () => {
    setIsAllocating(true);
    const newAllocations: Record<string, ProductDetails> = {};
    
    try {
      for (const line of lines) {
        if (!line.product_id || line.quantity_requested <= 0) continue;
        
        const reqQty = Number(line.quantity_requested);
        const p = products.find(x => x.id === line.product_id);
        if (!p) continue;
        
        const res = await fetch(`/api/inventory/by-product/${line.product_id}`);
        const batches = await res.json();
        
        const allocs: BatchAllocation[] = [];
        let remaining = reqQty;
        
        for (const b of batches) {
          const locs = (b.locations || []).map((loc: any) => {
            const locTake = remaining > 0 ? Math.min(Number(loc.qty), remaining) : 0;
            if (remaining > 0) remaining -= locTake;
            return { ...loc, pick_qty: locTake };
          });
          
          const batchPick = locs.reduce((s: number, l: any) => s + l.pick_qty, 0);
          allocs.push({
            batch_id: b.id,
            lot_number: b.lot_number,
            expiry_date: b.expiry_date,
            quantity: batchPick,
            available_qty: Number(b.total_quantity),
            locations: locs
          });
        }
        
        const total_allocated = allocs.flatMap(a => a.locations).reduce((sum: number, l) => sum + (l.pick_qty || 0), 0);
        newAllocations[line.key] = {
           id: p.id,
           name: p.name,
           sku: p.sku,
           image_url: p.image_url || null,
           allocations: allocs,
           fulfilled: total_allocated === reqQty,
           total_allocated,
           error: total_allocated < reqQty ? `Thiếu ${reqQty - total_allocated} (${p.unit_of_measurement || 'kg'}) trong kho` : undefined
        };
      }
      setAllocationsData(newAllocations);
      setStep(2);
    } catch (err) {
      toast.error("Lỗi khi tính toán FEFO");
    } finally {
      setIsAllocating(false);
    }
  };

  const updateLocationPickQty = (lineKey: string, batchId: string, locIdx: number, value: string) => {
    setAllocationsData(prev => {
      const newData = { ...prev[lineKey] };
      const newAllocs = newData.allocations.map(a => ({ ...a, locations: a.locations.map(l => ({ ...l })) }));
      const allocIdx = newAllocs.findIndex(a => a.batch_id === batchId);
      if (allocIdx < 0) return prev;
      
      let qty = parseInt(value);
      if (isNaN(qty)) qty = 0;
      if (qty < 0) qty = 0;
      const maxQty = newAllocs[allocIdx].locations[locIdx]?.qty || 0;
      if (qty > maxQty) qty = maxQty;
      
      newAllocs[allocIdx].locations[locIdx].pick_qty = qty;
      
      // Recompute batch-level and product-level totals
      for (const alloc of newAllocs) {
        alloc.quantity = alloc.locations.reduce((s, l) => s + (l.pick_qty || 0), 0);
      }
      const requested = lines.find(l => l.key === lineKey)?.quantity_requested || 0;
      const total = newAllocs.reduce((s, a) => s + a.quantity, 0);
      
      newData.allocations = newAllocs;
      newData.total_allocated = total;
      newData.fulfilled = total === requested;
      newData.error = total < requested ? `Thiếu ${requested - total} kg` : (total > requested ? `Thừa ${total - requested} kg` : undefined);
      
      return { ...prev, [lineKey]: newData };
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const cust = customers.find(c => c.id === customerId);
      
      // 1. Create order
      const ordRes = await fetch("/api/outbound-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           customer_id: customerId,
           customer_name: cust?.name,
           shipping_address: shippingAddress,
           notes,
           created_by: userId
        })
      });
      if (!ordRes.ok) throw new Error("Không thể tạo đơn hàng xuất");
      const order = await ordRes.json();
      
      // 2. Add items & decrement inv
      for (const line of lines) {
         const allocData = allocationsData[line.key];
         if (!allocData || !allocData.fulfilled) continue;
         
         for (const alloc of allocData.allocations) {
            if (alloc.quantity <= 0) continue;
            
            const itemRes = await fetch(`/api/outbound-orders/${order.id}/items`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                 product_id: line.product_id,
                 batch_id: alloc.batch_id,
                 quantity: alloc.quantity,
                 user_id: userId
              })
            });
            if (!itemRes.ok) throw new Error(`Lỗi cập nhật dòng sản phẩm ${allocData.name}`);
         }
      }
      
      // 3. Mark complete
      if (!preferences.two_step_outbound) {
        await fetch(`/api/outbound-orders/${order.id}/complete`, { method: "PUT" });
        toast.success(t("outbound_created_successfully", "Xuất kho thành công"));
      } else {
        toast.success("Đã tạo phiếu chờ Nhặt hàng (Pending Pick) do chính sách 2-Step đang bật.");
      }
      
      onComplete();
    } catch (err: any) {
      toast.error(err.message || t("error_creating_outbound"));
    } finally {
      setSaving(false);
    }
  };

  const step1Valid = customerId !== "";
  const step2Valid = lines.every(l => l.product_id && l.quantity_requested > 0);
  const step3Valid = Object.values(allocationsData).length > 0 && Object.values(allocationsData).every((x: ProductDetails) => x.fulfilled);

  const TitleBadge = ({ stepNum }: { stepNum: number }) => (
    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors", 
      step >= stepNum ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400")}>
      {step > stepNum ? <Check size={12} strokeWidth={4} /> : stepNum + 1}
    </div>
  );

  return (
    <div className={cn("flex flex-col bg-white dark:bg-neutral-900", inline ? "h-full min-h-[600px] border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm" : "fixed inset-0 z-50")}>
      
      {/* Header */}
      <div className="shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-10 hidden md:flex">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{t("create_outbound")}</h2>
            <p className="text-xs text-neutral-500 font-medium">Xuất kho bằng công nghệ FEFO</p>
          </div>
          <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex items-center gap-6">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <TitleBadge stepNum={i} />
                <span className={cn("text-xs font-bold transition-colors", step >= i ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400")}>{s.label}</span>
                {i < STEPS.length - 1 && <ChevronRight size={14} className="text-neutral-300 ml-3" />}
              </div>
            ))}
          </div>
        </div>
        {!inline && (
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
            <X size={20} className="text-neutral-500" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-neutral-50/50 dark:bg-neutral-950/50 relative">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            
            {/* STEP 1 */}
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="flex items-end justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{t("select_customer")}</h3>
                    <p className="text-sm text-neutral-500 mt-1">{t("create_outbound_desc")}</p>
                  </div>
                  {/* Search inline */}
                  <div className="relative w-72">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="Tìm khách hàng..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none text-neutral-900 dark:text-neutral-100 shadow-sm"
                    />
                  </div>
                </div>
                
                {/* Customer cards — compact chips, 1 row, scroll ngang */}
                {(() => {
                  const filtered = customers.filter(c => {
                    if (!customerSearch.trim()) return true;
                    const q = customerSearch.toLowerCase();
                    return (
                      c.name?.toLowerCase().includes(q) ||
                      c.phone?.toLowerCase().includes(q) ||
                      c.email?.toLowerCase().includes(q) ||
                      c.address?.toLowerCase().includes(q) ||
                      c.contact_person?.toLowerCase().includes(q)
                    );
                  });
                  return filtered.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pb-2 max-h-[160px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {filtered.map(c => {
                          const selected = customerId === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setCustomerId(selected ? "" : c.id)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all w-[160px] shrink-0",
                                selected
                                  ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10 shadow-sm shadow-orange-500/10"
                                  : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:border-orange-300 dark:hover:border-orange-500/40"
                              )}
                            >
                              <div className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                                selected ? "bg-orange-500 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400",
                              )}>
                                {selected ? <Check size={12} strokeWidth={4} /> : c.name?.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col leading-tight min-w-0">
                                <span className={cn("text-xs font-bold break-words", selected ? "text-orange-600 dark:text-orange-400" : "text-neutral-900 dark:text-neutral-100")}>
                                  {c.name}
                                </span>
                                {c.phone && (
                                  <span className="text-[10px] text-neutral-500 font-medium flex items-center gap-0.5">
                                    <Phone size={8} className="shrink-0" /> {c.phone}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                  ) : (
                    <div className="py-6 text-center text-sm text-neutral-400 font-medium bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                      Không tìm thấy khách hàng nào khớp "{customerSearch}"
                    </div>
                  );
                })()}

                {/* Shipping + Notes */}
                {customerId && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">{t("shipping_address")}</label>
                      <input type="text" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="Nhập địa chỉ nhận hàng"
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none text-neutral-900 dark:text-neutral-100" />
                    </div>
                    <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Ghi chú (Tùy chọn)</label>
                      <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ví dụ: Giao hỏa tốc, gọi trước..."
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none text-neutral-900 dark:text-neutral-100" />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="mb-6 flex justify-between items-end">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Sản phẩm xuất</h3>
                    <p className="text-sm text-neutral-500 mt-1">Hệ thống sẽ tự động chỉ định lô FEFO sau khi bạn nhập số lượng.</p>
                  </div>
                  <button onClick={addLine}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl font-bold text-sm hover:bg-orange-100 border border-orange-200/50">
                    <Plus size={16} /> Thêm dòng
                  </button>
                </div>
                
                <div className="space-y-4">
                  {lines.map((line, idx) => (
                    <div key={line.key} className="bg-white dark:bg-neutral-900 p-4 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex gap-4 items-start shadow-sm hover:border-orange-200 dark:hover:border-orange-500/30 transition-colors group">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-black text-neutral-400 shrink-0 mt-1">
                        {idx + 1}
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-4">
                        <div>
                          <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-3 mb-3">
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{t("select_product")}</label>
                            <div className="relative w-full sm:w-64">
                              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                              <input
                                type="text"
                                value={line.search_term || ""}
                                onChange={e => updateLine(line.key, "search_term", e.target.value)}
                                placeholder="Tìm theo tên sản phẩm, SKU..."
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none text-neutral-900 dark:text-neutral-100 shadow-sm"
                              />
                            </div>
                          </div>
                          
                          {(() => {
                            const filteredProducts = products.filter(p => {
                              if (!line.search_term?.trim()) return true;
                              const q = line.search_term.toLowerCase();
                              return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
                            });

                            return filteredProducts.length > 0 ? (
                              <div className="overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.ceil(filteredProducts.length / 2)}, max-content)`, gridAutoFlow: 'row' }}>
                                {filteredProducts.map(p => {
                                  const selected = line.product_id === p.id;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => updateLine(line.key, "product_id", selected ? "" : p.id)}
                                      className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all w-[260px] shrink-0",
                                        selected
                                          ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10 shadow-sm shadow-orange-500/10"
                                          : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:border-orange-300 dark:hover:border-orange-500/40"
                                      )}
                                    >
                                      {p.image_url ? (
                                        <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900" />
                                      ) : (
                                        <div className={cn(
                                          "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black shrink-0",
                                          selected ? "bg-orange-500 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
                                        )}>
                                          {selected ? <Check size={16} strokeWidth={3} /> : <Package size={16} />}
                                        </div>
                                      )}
                                      <div className="flex flex-col leading-tight min-w-0 flex-1">
                                        <span className={cn("text-xs font-bold break-words whitespace-normal leading-tight block", selected ? "text-orange-600 dark:text-orange-400" : "text-neutral-900 dark:text-neutral-100")}>
                                          {p.name}
                                        </span>
                                        <span className="text-[10px] text-neutral-500 font-medium mt-1 uppercase tracking-wider">
                                          {p.sku}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                                </div>
                              </div>
                            ) : (
                              <div className="py-6 text-center text-sm text-neutral-400 font-medium bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                                Không tìm thấy sản phẩm nào khớp "{line.search_term}"
                              </div>
                            );
                          })()}
                        </div>
                        {line.product_id && (
                          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="w-full sm:w-1/2 lg:w-1/3">
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">{t("req_qty")}</label>
                            <div className="relative">
                              <input type="number" min="0" value={line.quantity_requested || ""} onChange={e => updateLine(line.key, "quantity_requested", e.target.value)} placeholder="0"
                                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-4 pr-12 py-2.5 text-sm font-medium outline-none focus:ring-1 focus:ring-orange-500 text-neutral-900 dark:text-neutral-100" />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                                {products.find(p => p.id === line.product_id)?.unit_of_measurement || "kg"}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </div>
                      
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(line.key)} className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg mt-5 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 3 */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="mb-6 flex justify-between items-end">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Lịch trình lấy hàng & Tùy chỉnh (FEFO / Manual)</h3>
                    <p className="text-sm text-neutral-500 mt-1">Hệ thống đã tự động xuất kho theo chuẩn FEFO. Bạn có thể thay đổi số lượng lấy từ các lô theo ý muốn ở cột "SL Lấy".</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {lines.map((line, i) => {
                    const alloc = allocationsData[line.key];
                    if (!alloc) return null;
                    return (
                      <div key={line.key} className={cn("bg-white dark:bg-neutral-900 border rounded-2xl overflow-hidden shadow-sm", alloc.fulfilled ? "border-green-200 dark:border-green-900/50" : "border-red-200 dark:border-red-900/50")}>
                        <div className={cn("px-5 py-3 border-b flex justify-between items-center", alloc.fulfilled ? "bg-green-50/50 dark:bg-green-500/5" : "bg-red-50/50 dark:bg-red-500/5")}>
                          <div className="flex items-center gap-3">
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black", alloc.fulfilled ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>{i + 1}</div>
                            {alloc.image_url ? (
                              <div className="w-10 h-10 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden shrink-0 bg-white dark:bg-neutral-800">
                                <img src={alloc.image_url} alt={alloc.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                                <Package size={18} className="text-neutral-400" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">[{alloc.sku}] {alloc.name}</p>
                              {alloc.error && <p className="text-xs text-red-500 font-bold mt-0.5">{alloc.error}</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-neutral-500 font-bold uppercase">Yêu cầu / Đáp ứng</p>
                            <p className="text-sm font-black text-neutral-900 dark:text-neutral-50">{line.quantity_requested} / <span className={alloc.fulfilled ? "text-green-500" : "text-red-500"}>{alloc.total_allocated}</span></p>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-neutral-50/30 dark:bg-neutral-950/30">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr>
                                <th className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pb-2 border-b">Lô hàng (FEFO)</th>
                                <th className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pb-2 border-b">Hạn dùng</th>
                                <th className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pb-2 border-b">Kho & Vị trí</th>
                                <th className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pb-2 border-b text-right">SL Lấy</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                              {alloc.allocations.map((a, j) => (
                                <React.Fragment key={j}>
                                  {a.locations && a.locations.length > 0 ? (
                                    a.locations.map((loc: any, k: number) => (
                                      <tr key={`${j}-${k}`} className="text-sm border-neutral-100 dark:border-neutral-800">
                                        {k === 0 && (
                                          <>
                                            <td className="py-2.5 font-bold text-neutral-900 dark:text-neutral-100" rowSpan={a.locations.length}>{a.lot_number}</td>
                                            <td className="py-2.5 text-neutral-500" rowSpan={a.locations.length}>{a.expiry_date ? new Date(a.expiry_date).toLocaleDateString("vi-VN") : "---"}</td>
                                          </>
                                        )}
                                        <td className="py-2.5">
                                          <div className="flex items-center gap-1.5">
                                            {loc.warehouse_name && (
                                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 rounded text-[10px] font-bold whitespace-nowrap">
                                                <Warehouse size={10} />
                                                {loc.warehouse_name}
                                              </span>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (loc.warehouse_id) {
                                                  setMapOverlayWarehouseId(loc.warehouse_id);
                                                  setMapOverlaySku(alloc.sku);
                                                }
                                              }}
                                              className="group/loc inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 rounded text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all cursor-pointer"
                                              title={`Xem vị trí ${loc.name} trên sơ đồ kho`}
                                            >
                                              <MapPin size={10} className="shrink-0" />
                                              {loc.name}
                                              <ExternalLink size={9} className="opacity-0 group-hover/loc:opacity-100 transition-opacity shrink-0" />
                                            </button>
                                          </div>
                                        </td>
                                        <td className="py-2.5">
                                          <div className="flex items-center justify-end gap-2 pr-1">
                                            <input 
                                              type="number"
                                              min="0"
                                              max={loc.qty}
                                              value={loc.pick_qty ?? ""}
                                              onChange={e => updateLocationPickQty(line.key, a.batch_id, k, e.target.value)}
                                              className={cn("w-20 bg-white dark:bg-neutral-900 border text-right rounded-md px-2 py-1 text-sm font-bold outline-none transition-colors", 
                                                (loc.pick_qty || 0) > 0 ? "border-orange-500 text-orange-600 focus:ring-2 focus:ring-orange-500 shadow-sm" : "border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:border-neutral-400")}
                                            />
                                            <span className="text-[10px] text-neutral-400 font-medium whitespace-nowrap min-w-[35px]">
                                              / <span className="font-bold">{loc.qty}</span>
                                            </span>
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr className="text-sm">
                                      <td className="py-2.5 font-bold text-neutral-900 dark:text-neutral-100">{a.lot_number}</td>
                                      <td className="py-2.5 text-neutral-500">{a.expiry_date ? new Date(a.expiry_date).toLocaleDateString("vi-VN") : "---"}</td>
                                      <td className="py-2.5 text-xs text-neutral-400">Không rõ vị trí</td>
                                      <td className="py-2.5 text-right text-xs text-neutral-400">---</td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                              {alloc.allocations.length === 0 && (
                                <tr><td colSpan={4} className="py-4 text-center text-xs text-neutral-400 font-medium">Không có lô hàng phù hợp</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Footer Details */}
      <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-6 py-4 flex items-center justify-between sticky bottom-0 z-10 w-full">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} disabled={saving || isAllocating}
            className="px-5 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-sm font-bold transition-all disabled:opacity-50 text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
            <ChevronLeft size={16} /> Quay lại
          </button>
        ) : <div />}
        
        {step === 0 && (
          <button onClick={() => setStep(1)} disabled={!step1Valid}
            className="px-6 py-3 bg-orange-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center gap-2">
            Tiếp tục <ChevronRight size={16} />
          </button>
        )}
        
        {step === 1 && (
          <button onClick={calculateFEFO} disabled={!step2Valid || isAllocating}
            className="px-6 py-3 bg-orange-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center gap-2">
            Chọn quỹ FEFO <ChevronRight size={16} />
          </button>
        )}
        
        {step === 2 && (
          <button onClick={handleSubmit} disabled={!step3Valid || saving}
            className="px-6 py-3 bg-green-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all disabled:opacity-50 flex items-center gap-2">
            {saving ? "Đang xử lý..." : "Xác nhận & Hoàn tất"} <Check size={16} />
          </button>
        )}
      </div>

      {/* ── Map Overlay ── */}
      <AnimatePresence>
        {mapOverlayWarehouseId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-white dark:bg-neutral-950 flex flex-col"
          >
            {/* Map overlay header */}
            <div className="shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-taika-blue dark:text-blue-400">
                  <Map size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-50">Sơ đồ kho trực quan</h3>
                  <p className="text-[10px] text-neutral-500">
                    {warehouses.find(w => w.id === mapOverlayWarehouseId)?.name || "Kho"}
                  </p>
                </div>
                {mapOverlaySku && (
                  <div className="ml-3 flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-900/30 rounded-lg">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse shadow-sm shadow-yellow-400/50" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Đang hiển thị: [{mapOverlaySku}] {products.find(p => p.sku === mapOverlaySku)?.name}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setMapOverlayWarehouseId(null)}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 transition-all"
              >
                <ChevronLeft size={14} /> Quay lại phiếu xuất
              </button>
            </div>
            {/* Map content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <WarehouseMap
                warehouses={warehouses}
                selectedWarehouseId={mapOverlayWarehouseId}
                onSelectWarehouse={(id) => setMapOverlayWarehouseId(id)}
                initialSearchSku={mapOverlaySku}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
