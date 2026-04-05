import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import {
  X, ChevronRight, ChevronLeft, Check, Plus, Trash2, Search,
  Package, MapPin, Loader2, Truck, AlertCircle, DollarSign, Info,
} from "lucide-react";
import type { Supplier, Product, Warehouse, UnitOfMeasurement } from "../../types/supabase";
import { usePreferences } from "../../contexts/PreferencesContext";
import LocationPickerGrid from "./LocationPickerGrid";


// ── Types ─────────────────────────────────────────────────────
interface InboundLine {
  key: string;
  product_id: string;
  quantity: number;
  lot_number: string;
  production_date: string;
  expiry_date: string;
  qc_status: "Pass" | "Hold" | "Fail";
  warehouse_id: string;
  location_id: string;
  cost_price: number;   // giá nhập / kg
  tax_rate: number;     // % thuế
  import_fee: number;   // chi phí nhập hàng
  search_term?: string;
}

interface InboundWizardProps {
  userId: string | null;
  onClose: () => void;
  onComplete: () => void;
  inline?: boolean;
  initialScannedItems?: { product: Product; quantity: number }[];
}

// Generate lot number
function generateLotNumber(format: string = "LOT-{YYYYMMDD}-{XXXX}"): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`;
  const rnd = Math.floor(1000 + Math.random() * 9000).toString();
  return format.replace("{YYYYMMDD}", ymd).replace("{XXXX}", rnd);
}

// ── Step labels ───────────────────────────────────────────────
const STEPS = [
  { label: "Nhà cung cấp", icon: Truck },
  { label: "Sản phẩm & Lô hàng", icon: Package },
  { label: "Chi phí & Giá nhập", icon: DollarSign },
  { label: "Vị trí lưu trữ", icon: MapPin },
];

export default function InboundWizard({ userId, onClose, onComplete, inline = false, initialScannedItems }: InboundWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const { preferences } = usePreferences();

  // ── Data sources ──
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [uoms, setUoms] = useState<UnitOfMeasurement[]>([]);
  const [availableLocations, setAvailableLocations] = useState<Record<string, any[]>>({});
  const [loadingLocs, setLoadingLocs] = useState<string | null>(null);
  const [autoK, setAutoK] = useState(true); // ×1000 mode for VND inputs
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showAutoKTip, setShowAutoKTip] = useState(false);

  // ── Step 1: Supplier ──
  const [supplierId, setSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [notes, setNotes] = useState("");

  // ── Step 2: Lines ──
  const [lines, setLines] = useState<InboundLine[]>(() => {
    if (initialScannedItems && initialScannedItems.length > 0) {
      return initialScannedItems.map(item => ({
        key: crypto.randomUUID(), product_id: item.product.id, quantity: item.quantity, 
        lot_number: generateLotNumber(preferences.lot_number_format), production_date: "", expiry_date: "", qc_status: preferences.require_qa_inbound ? "Hold" : "Pass", 
        warehouse_id: "", location_id: "", cost_price: 0, tax_rate: preferences.default_tax_rate, import_fee: 0
      }));
    }
    return [{ key: crypto.randomUUID(), product_id: "", quantity: 0, lot_number: generateLotNumber(preferences.lot_number_format), production_date: "", expiry_date: "", qc_status: preferences.require_qa_inbound ? "Hold" : "Pass", warehouse_id: "", location_id: "", cost_price: 0, tax_rate: preferences.default_tax_rate, import_fee: 0 }];
  });

  // Fetch data on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/suppliers").then(r => r.json()),
      fetch("/api/products").then(r => r.json()),
      fetch("/api/warehouses").then(r => r.json()),
      fetch("/api/uoms").then(r => r.json()),
    ]).then(([sup, prod, wh, ums]) => {
      setSuppliers(sup || []);
      setProducts(prod || []);
      setWarehouses(wh || []);
      setUoms(ums || []);
    });
  }, []);

  // Fetch available locations when warehouse is selected
  const fetchLocations = async (warehouseId: string) => {
    if (availableLocations[warehouseId]) return;
    setLoadingLocs(warehouseId);
    try {
      const res = await fetch(`/api/warehouses/${warehouseId}/available-locations`);
      const data = await res.json();
      setAvailableLocations(prev => ({ ...prev, [warehouseId]: data || [] }));
    } catch { /* ignore */ }
    setLoadingLocs(null);
  };

  // ── Line management ──
  const addLine = () => {
    setLines(prev => [...prev, {
      key: crypto.randomUUID(), product_id: "", quantity: 0, lot_number: generateLotNumber(preferences.lot_number_format),
      production_date: "", expiry_date: "", qc_status: preferences.require_qa_inbound ? "Hold" : "Pass", warehouse_id: "", location_id: "",
      cost_price: 0, tax_rate: preferences.default_tax_rate, import_fee: 0,
    }]);
  };

  const updateLine = (key: string, field: keyof InboundLine, value: any) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));
  };

  const removeLine = (key: string) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter(l => l.key !== key));
  };

  // ── Validation ──
  const canGoToStep2 = supplierId !== "";
  const canGoToStep3 = lines.every(l => l.product_id && l.quantity > 0 && l.lot_number);
  const canGoToStep4 = canGoToStep3; // cost fields are optional
  const canSubmit = lines.every(l => l.warehouse_id && l.location_id);

  // ── Submit ──
  const handleSubmit = async () => {
    setSaving(true);
    try {
      const supplier = suppliers.find(s => s.id === supplierId);
      // 1. Create shipment
      const shipRes = await fetch("/api/inbound-shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId,
          supplier_name: supplier?.name || "",
          notes,
          received_by: userId,
        }),
      });
      if (!shipRes.ok) throw new Error("Tạo phiếu thất bại");
      const shipment = await shipRes.json();

      // 2. Add items one by one
      for (const line of lines) {
        const itemRes = await fetch(`/api/inbound-shipments/${shipment.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: line.product_id,
            quantity: line.quantity,
            lot_number: line.lot_number,
            production_date: line.production_date || null,
            expiry_date: line.expiry_date || null,
            qc_status: line.qc_status,
            warehouse_id: line.warehouse_id,
            location_id: line.location_id,
            user_id: userId,
            cost_price: line.cost_price || 0,
            tax_rate: line.tax_rate || 0,
            import_fee: line.import_fee || 0,
          }),
        });
        if (!itemRes.ok) {
          const err = await itemRes.json();
          throw new Error(err.error || "Lỗi thêm dòng sản phẩm");
        }
      }

      // 3. Complete shipment
      await fetch(`/api/inbound-shipments/${shipment.id}/complete`, { method: "PUT" });

      toast.success("Nhập kho thành công!");
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Lỗi nhập kho");
    }
    setSaving(false);
  };

  // ── Render Steps ──
  const wizardContent = (
    <>
        {/* Header */}
        <div className={cn(
          "border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0",
          inline ? "p-5" : "p-6"
        )}>
          <div>
            <h2 className={cn("font-bold text-neutral-900 dark:text-neutral-50", inline ? "text-lg" : "text-xl")}>Tạo Phiếu Nhập Kho</h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 font-medium">Nhập hàng từ nhà cung cấp vào kho</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-neutral-50 dark:border-neutral-900 flex items-center gap-2 shrink-0">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight size={14} className="text-neutral-300 dark:text-neutral-700" />}
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                i === step
                  ? "bg-taika-blue text-white"
                  : i < step
                    ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500"
              )}>
                {i < step ? <Check size={12} /> : <s.icon size={12} />}
                {s.label}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {/* ── Step 1: Supplier ── */}
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-3">
                    <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Nhà cung cấp *</label>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                      <input
                        type="text"
                        value={supplierSearch}
                        onChange={e => setSupplierSearch(e.target.value)}
                        placeholder="Tìm nhà cung cấp..."
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-medium focus:ring-2 focus:ring-taika-blue outline-none text-neutral-900 dark:text-neutral-100 shadow-sm"
                      />
                    </div>
                  </div>

                  {(() => {
                    const filteredSuppliers = suppliers.filter(s => {
                      if (s.status !== "active") return false;
                      if (!supplierSearch?.trim()) return true;
                      const q = supplierSearch.toLowerCase();
                      return s.name?.toLowerCase().includes(q) || s.contact_person?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone?.includes(q);
                    });

                    return filteredSuppliers.length > 0 ? (
                      <div className="flex flex-wrap gap-3 pb-2 max-h-[160px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {filteredSuppliers.map((s: any) => {
                          const selected = supplierId === s.id;
                            return (
                              <button
                                key={s.id}
                                onClick={() => setSupplierId(selected ? "" : s.id)}
                                className={cn(
                                  "flex items-center gap-4 px-4 py-3 rounded-2xl border-2 text-left transition-all w-[280px] shrink-0",
                                  selected
                                    ? "border-taika-blue bg-blue-50 dark:bg-blue-500/10 shadow-sm shadow-blue-500/10"
                                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-blue-300 dark:hover:border-blue-500/40"
                                )}
                              >
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black",
                                  selected ? "bg-taika-blue text-white" : "bg-neutral-100 dark:bg-neutral-900 text-neutral-400"
                                )}>
                                  {s.name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={cn(
                                    "block text-sm font-bold truncate mb-0.5",
                                    selected ? "text-blue-700 dark:text-blue-400" : "text-neutral-900 dark:text-neutral-100"
                                  )}>
                                    {s.name}
                                  </span>
                                  {s.contact_person && (
                                    <span className="text-[10px] text-neutral-500 font-medium truncate block">
                                      LH: {s.contact_person} {s.phone ? ` - ${s.phone}` : ''}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-sm text-neutral-400 font-medium bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                        Không tìm thấy nhà cung cấp nào khớp "{supplierSearch}"
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Ghi chú</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                    placeholder="Ghi chú cho phiếu nhập (tùy chọn)..."
                    className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium resize-none text-neutral-900 dark:text-neutral-50" />
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Products & Batches ── */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {lines.map((line, idx) => {
                  const product = products.find(p => p.id === line.product_id) as any;
                  const uomVal = uoms.find(u => u.id === product?.uom_id);
                  const uomName = uomVal?.abbreviation || uomVal?.symbol || uomVal?.name || "kg";
                  
                  return (
                  <div key={line.key} className="p-5 border border-neutral-200 dark:border-neutral-700 rounded-2xl space-y-4 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-taika-blue dark:text-blue-400">Dòng #{idx + 1}</span>
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(line.key)}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Product (Full width now, or spans cols) */}
                      <div className="col-span-2 space-y-3 mb-2">
                        <div className="flex sm:items-center justify-between flex-col sm:flex-row gap-3">
                          <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Sản phẩm *</label>
                          <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                            <input
                              type="text"
                              value={line.search_term || ""}
                              onChange={e => updateLine(line.key, "search_term", e.target.value)}
                              placeholder="Tìm sản phẩm, SKU..."
                              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium focus:ring-1 focus:ring-taika-blue outline-none text-neutral-900 dark:text-neutral-100"
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
                            <div className="flex flex-wrap gap-2 pb-2 max-h-[180px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                              {filteredProducts.map(p => {
                                const selected = line.product_id === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      const pid = selected ? "" : p.id;
                                      const prod = selected ? null : products.find(prod => prod.id === pid);
                                      setLines(prev => prev.map(l => l.key === line.key ? { ...l, product_id: pid, cost_price: (prod as any)?.import_price || 0 } : l));
                                    }}
                                    className={cn(
                                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all w-[240px] shrink-0",
                                      selected
                                        ? "border-taika-blue bg-blue-50 dark:bg-blue-500/10 shadow-sm shadow-blue-500/10"
                                        : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:border-blue-300 dark:hover:border-blue-500/40"
                                    )}
                                  >
                                    {(p as any).image_url ? (
                                      <img src={(p as any).image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-800">
                                        <Package size={16} className="text-neutral-400" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                      <span className="text-[10px] font-bold text-neutral-500 mb-0.5">{p.sku}</span>
                                      <span className={cn(
                                        "text-xs font-bold block whitespace-normal leading-tight break-words",
                                        selected ? "text-blue-700 dark:text-blue-400" : "text-neutral-900 dark:text-neutral-100"
                                      )}>{p.name}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-4 text-center text-xs text-neutral-400 font-medium bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                              Không tìm thấy sản phẩm "{line.search_term}"
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* Quantity & Unit */}
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Số lượng *</label>
                        <div className="relative">
                          <input type="number" value={line.quantity || ""} onChange={e => updateLine(line.key, "quantity", Number(e.target.value))}
                            placeholder="0"
                            className="w-full p-3 pr-12 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">{uomName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {/* Lot number */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Số lô *</label>
                        <input type="text" value={line.lot_number} onChange={e => updateLine(line.key, "lot_number", e.target.value)}
                          className="w-full p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-mono font-bold outline-none focus:ring-1 focus:ring-taika-blue" />
                      </div>
                      {/* Production date */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Ngày SX</label>
                        <input type="date" value={line.production_date} onChange={e => updateLine(line.key, "production_date", e.target.value)}
                          className="w-full p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium outline-none focus:ring-1 focus:ring-taika-blue" />
                      </div>
                      {/* Expiry date */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Hạn SD</label>
                        <input type="date" value={line.expiry_date} onChange={e => updateLine(line.key, "expiry_date", e.target.value)}
                          className="w-full p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium outline-none focus:ring-1 focus:ring-taika-blue" />
                      </div>
                    </div>

                    {/* QC Status */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest flex items-center gap-2">
                        Kiểm tra chất lượng (QC)
                        {preferences.require_qa_inbound && <span className="text-[9px] bg-neutral-200 dark:bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">Khóa bởi Hệ thống</span>}
                      </label>
                      <div className="flex gap-2">
                        {(["Pass", "Hold", "Fail"] as const).map(qc => {
                          const disabled = preferences.require_qa_inbound && qc !== "Hold";
                          return (
                            <button key={qc} onClick={() => updateLine(line.key, "qc_status", qc)}
                              disabled={disabled}
                              className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                line.qc_status === qc
                                  ? qc === "Pass" ? "bg-green-500 text-white border-green-500"
                                  : qc === "Fail" ? "bg-red-500 text-white border-red-500"
                                  : "bg-orange-500 text-white border-orange-500"
                                : "bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-neutral-300"
                              )}>
                              {qc}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  );
                })}

                <button onClick={addLine}
                  className="w-full py-3 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold text-neutral-400 dark:text-neutral-500 hover:border-taika-blue hover:text-taika-blue transition-all flex items-center justify-center gap-2">
                  <Plus size={16} /> Thêm dòng sản phẩm
                </button>
              </motion.div>
            )}

            {/* ── Step 3: Cost & Pricing ── */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/20 flex items-start gap-3">
                  <DollarSign size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    Giá nhập sẽ tự động lấy từ danh mục sản phẩm. Bạn có thể ghi đè nếu lô hàng này có giá khác.
                  </p>
                </div>

                {lines.map((line, idx) => {
                  const product = products.find(p => p.id === line.product_id) as any;
                  const uomVal = uoms.find(u => u.id === product?.uom_id);
                  const uomName = uomVal?.abbreviation || uomVal?.symbol || uomVal?.name || "kg";
                  const subtotal = line.quantity * line.cost_price;
                  const taxAmount = subtotal * (line.tax_rate / 100);
                  const lineTotal = subtotal + taxAmount + line.import_fee;

                  const renderMoneyInput = (field: "cost_price" | "import_fee", label: string, value: number, showToggle?: boolean) => {
                    const fieldId = `${field}_${line.key}`;
                    const isFocused = focusedField === fieldId;
                    const rawValue = autoK && value > 0 ? value / 1000 : value;
                    const displayValue = isFocused
                      ? (rawValue || "")
                      : value > 0 ? value.toLocaleString("vi-VN") : "";

                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{label}</label>
                          {showToggle && (
                            <div className="flex items-center gap-1 relative">
                              <button type="button" onClick={() => setAutoK(!autoK)}
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[9px] font-black transition-all leading-none",
                                  autoK
                                    ? "bg-amber-500 text-white"
                                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500"
                                )}>
                                ×1k
                              </button>
                              <button type="button" onClick={() => setShowAutoKTip(!showAutoKTip)}
                                className="text-neutral-300 dark:text-neutral-600 hover:text-amber-500 transition-colors">
                                <Info size={12} />
                              </button>
                              {showAutoKTip && (
                                <div className="absolute top-6 right-0 z-50 w-52 p-2.5 bg-neutral-800 dark:bg-neutral-900 text-white text-[10px] font-medium rounded-lg shadow-xl border border-neutral-700 leading-relaxed">
                                  <p className="mb-1"><span className="font-bold text-amber-400">Bật ×1k:</span> Nhập <span className="font-bold">30</span> → lưu <span className="font-bold">30.000 ₫</span></p>
                                  <p><span className="font-bold text-neutral-400">Tắt ×1k:</span> Nhập số thật, VD <span className="font-bold">30000</span></p>
                                  <button onClick={() => setShowAutoKTip(false)} className="mt-1.5 text-[9px] text-neutral-400 hover:text-white">Đóng ×</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={isFocused ? "number" : "text"}
                            value={displayValue}
                            onFocus={() => setFocusedField(fieldId)}
                            onBlur={() => setFocusedField(null)}
                            onChange={e => {
                              const num = Number(e.target.value) || 0;
                              updateLine(line.key, field, autoK ? num * 1000 : num);
                            }}
                            placeholder="0"
                            className="w-full p-3 pr-10 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-amber-500 text-neutral-900 dark:text-neutral-50"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">₫</span>
                        </div>
                        {autoK && isFocused && rawValue > 0 && (
                          <p className="text-[10px] text-amber-500 font-bold">= {(rawValue * 1000).toLocaleString("vi-VN")} ₫</p>
                        )}
                      </div>
                    );
                  };

                  // Reference prices from product catalog
                  const refImport = product?.import_price || 0;
                  const refWholesale = product?.wholesale_price || 0;
                  const refRetail = product?.retail_price || 0;
                  const hasRefPrices = refImport > 0 || refWholesale > 0 || refRetail > 0;

                  return (
                    <div key={line.key} className="p-5 border border-neutral-200 dark:border-neutral-700 rounded-2xl space-y-4 bg-neutral-50/50 dark:bg-neutral-900/50">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{product?.name || "—"}</p>
                          <p className="text-xs text-neutral-400 font-medium mb-2">{line.lot_number} • {line.quantity.toLocaleString()} {uomName}</p>
                          {/* Inline price tags */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border",
                              refImport > 0
                                ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                                : "bg-neutral-50 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 border-neutral-200 dark:border-neutral-700"
                            )}>
                              Nhập: {refImport > 0 ? `${refImport.toLocaleString("vi-VN")}₫` : "—"}
                            </span>
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border",
                              refWholesale > 0
                                ? "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                                : "bg-neutral-50 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 border-neutral-200 dark:border-neutral-700"
                            )}>
                              Buôn: {refWholesale > 0 ? `${refWholesale.toLocaleString("vi-VN")}₫` : "—"}
                            </span>
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border",
                              refRetail > 0
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                : "bg-neutral-50 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 border-neutral-200 dark:border-neutral-700"
                            )}>
                              Lẻ: {refRetail > 0 ? `${refRetail.toLocaleString("vi-VN")}₫` : "—"}
                            </span>
                          </div>
                        </div>
                        {lineTotal > 0 && (
                          <div className="text-right shrink-0">
                            <p className="text-xs text-neutral-400 font-medium">Thành tiền</p>
                            <p className="text-sm font-black text-green-600 dark:text-green-400">{lineTotal.toLocaleString("vi-VN")} ₫</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {renderMoneyInput("cost_price", `Giá nhập / ${uomName}`, line.cost_price, true)}
                        {/* Tax rate */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Thuế</label>
                          <div className="relative">
                            <input type="number" value={line.tax_rate || ""} onChange={e => updateLine(line.key, "tax_rate", Number(e.target.value))}
                              placeholder="0"
                              className="w-full p-3 pr-10 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-amber-500 text-neutral-900 dark:text-neutral-50" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">%</span>
                          </div>
                        </div>
                        {renderMoneyInput("import_fee", "Chi phí nhập hàng", line.import_fee)}
                      </div>

                      {/* Line summary */}
                      {lineTotal > 0 && (
                        <div className="flex items-center gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs flex-wrap">
                          <span className="text-neutral-400 font-medium">Giá gốc: <span className="font-bold text-neutral-600 dark:text-neutral-300">{subtotal.toLocaleString("vi-VN")} ₫</span></span>
                          {taxAmount > 0 && <span className="text-neutral-400 font-medium">Thuế: <span className="font-bold text-red-500">+{taxAmount.toLocaleString("vi-VN")} ₫</span></span>}
                          {line.import_fee > 0 && <span className="text-neutral-400 font-medium">Chi phí: <span className="font-bold text-orange-500">+{line.import_fee.toLocaleString("vi-VN")} ₫</span></span>}
                          {line.cost_price > 0 && (
                            <span className="ml-auto flex items-center gap-3">
                              <span className="relative group cursor-help">
                                <Info size={12} className="text-neutral-400 group-hover:text-taika-blue transition-colors" />
                                <div className="absolute bottom-full right-0 mb-1.5 w-56 p-2.5 bg-neutral-800 dark:bg-neutral-900 text-white text-[10px] font-medium rounded-lg shadow-xl border border-neutral-700 leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                  <p className="mb-1"><span className="font-bold text-purple-400">Buôn:</span> (Giá buôn − Giá nhập) ÷ Giá nhập</p>
                                  <p className="mb-1"><span className="font-bold text-green-400">Lẻ:</span> (Giá lẻ − Giá nhập) ÷ Giá nhập</p>
                                  <p><span className="font-bold text-emerald-400">Gross:</span> (Giá lẻ − Giá nhập) ÷ Giá lẻ</p>
                                </div>
                              </span>
                              {refWholesale > 0 && (
                                <span className="text-neutral-400 font-medium">
                                  Buôn: <span className={cn("font-bold", refWholesale > line.cost_price ? "text-purple-500" : "text-red-500")}>
                                    {refWholesale > line.cost_price ? "+" : ""}{((refWholesale - line.cost_price) / line.cost_price * 100).toFixed(1)}%
                                  </span>
                                </span>
                              )}
                              {refRetail > 0 && (
                                <span className="text-neutral-400 font-medium">
                                  Lẻ: <span className={cn("font-bold", refRetail > line.cost_price ? "text-green-500" : "text-red-500")}>
                                    {refRetail > line.cost_price ? "+" : ""}{((refRetail - line.cost_price) / line.cost_price * 100).toFixed(1)}%
                                  </span>
                                </span>
                              )}
                              {refRetail > 0 && (
                                <span className="text-neutral-400 font-medium">
                                  Gross: <span className={cn("font-bold", refRetail > line.cost_price ? "text-emerald-500" : "text-red-500")}>
                                    {((refRetail - line.cost_price) / refRetail * 100).toFixed(1)}%
                                  </span>
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Grand total */}
                {lines.some(l => l.cost_price > 0) && (
                  <div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-2xl border border-green-200 dark:border-green-500/20 flex items-center justify-between">
                    <span className="text-sm font-bold text-green-700 dark:text-green-400">Tổng giá trị phiếu nhập</span>
                    <span className="text-xl font-black text-green-600 dark:text-green-400">
                      {lines.reduce((sum, l) => {
                        const sub = l.quantity * l.cost_price;
                        return sum + sub + sub * (l.tax_rate / 100) + l.import_fee;
                      }, 0).toLocaleString("vi-VN")} ₫
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Step 4: Putaway ── */}
            {step === 3 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20 flex items-start gap-3">
                  <AlertCircle size={16} className="text-taika-blue shrink-0 mt-0.5" />
                  <p className="text-xs text-taika-blue dark:text-blue-400 font-medium">
                    Chọn Kho hàng và Vị trí lưu trữ cho từng dòng sản phẩm. Chỉ hiển thị các ô còn sức chứa.
                  </p>
                </div>

                {lines.map((line, idx) => {
                  const product = products.find(p => p.id === line.product_id) as any;
                  const uomVal = uoms.find(u => u.id === product?.uom_id);
                  const uomName = uomVal?.abbreviation || uomVal?.symbol || uomVal?.name || "kg";
                  const locs = availableLocations[line.warehouse_id] || [];
                  const wh = warehouses.find(w => w.id === line.warehouse_id) || null;
                  return (
                    <div key={line.key} className="p-5 border border-neutral-200 dark:border-neutral-700 rounded-2xl space-y-4 bg-neutral-50/50 dark:bg-neutral-900/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-taika-blue/10 dark:bg-blue-500/20 flex items-center justify-center text-taika-blue dark:text-blue-400 text-xs font-bold">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{product?.name || "—"}</p>
                            <p className="text-xs text-neutral-400 font-medium">{line.lot_number} • {line.quantity.toLocaleString()} {uomName}</p>
                          </div>
                        </div>
                        {line.location_id && (
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-bold rounded-lg">
                            ✓ Đã chọn vị trí
                          </span>
                        )}
                      </div>

                      {/* Warehouse selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">Kho hàng *</label>
                        <select value={line.warehouse_id}
                          onChange={e => {
                            const whId = e.target.value;
                            updateLine(line.key, "warehouse_id", whId);
                            updateLine(line.key, "location_id", "");
                            if (whId) fetchLocations(whId);
                          }}
                          className="w-full p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium outline-none focus:ring-1 focus:ring-taika-blue">
                          <option value="">— Chọn kho —</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.temperature_zone})</option>)}
                        </select>
                      </div>

                      {/* Visual Location Picker Grid */}
                      {line.warehouse_id && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">
                            Click chọn vị trí trên sơ đồ kho *
                          </label>
                          <LocationPickerGrid
                            locations={locs}
                            selectedId={line.location_id}
                            onSelect={(locId) => updateLine(line.key, "location_id", locId)}
                            loading={loadingLocs === line.warehouse_id}
                            warehouse={wh}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center gap-2"
          >
            <ChevronLeft size={16} />
            {step === 0 ? "Hủy" : "Quay lại"}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 0 ? !canGoToStep2 : step === 1 ? !canGoToStep3 : !canGoToStep4}
              className="px-6 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold hover:bg-taika-blue/90 transition-all flex items-center gap-2 shadow-lg shadow-taika-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Tiếp theo <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || saving}
              className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? "Đang xử lý..." : "Hoàn tất nhập kho"}
            </button>
          )}
        </div>
    </>
  );

  if (inline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-white dark:bg-neutral-950 rounded-2xl border border-taika-blue/30 dark:border-blue-500/30 shadow-xl shadow-taika-blue/5 flex flex-col overflow-hidden"
      >
        {wizardContent}
      </motion.div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white dark:bg-neutral-950 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {wizardContent}
      </motion.div>
    </div>
  );
}
