import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import {
  X, ChevronRight, ChevronLeft, Check, Plus, Trash2, Search,
  Package, MapPin, Loader2, Truck, AlertCircle, DollarSign, Info, Printer, CalendarDays,
} from "lucide-react";
import type { Supplier, Product, Warehouse, UnitOfMeasurement } from "../../types/supabase";
import { usePreferences } from "../../contexts/PreferencesContext";
import { useAuth } from "../../contexts/AuthContext";
import LocationPickerGrid from "./LocationPickerGrid";
import BarcodeLabel from "./BarcodeLabel";


// ── Khai báo kiểu (Types) ──────────────
interface InboundLine {
  key: string;
  product_id: string;
  quantity: number;
  lot_number: string;
  production_date: string;
  expiry_date: string;
  qc_status: "Pass" | "Hold" | "Fail";
  warehouse_id: string;
  allocations: { location_id: string; quantity: number }[];
  cost_price: number;   // giá nhập / kg
  tax_rate: number;     // % thuế
  import_fee: number;   // chi phí nhập hàng
  search_term?: string;
  contract_number?: string;
  packaging_spec?: string;
  allow_mix?: boolean;  // cho phép trộn lô - user đã xác nhận
}

interface InboundWizardProps {
  userId: string | null;
  onClose: () => void;
  onComplete: () => void;
  inline?: boolean;
  initialScannedItems?: { product: Product; quantity: number }[];
}

// Hàm tự động tạo số lô (Lot Number)
// Cập nhật để trả về số chuẩn theo EAN13 base, hoặc CODE128 (giữ dạng YYYYMMDD)
function generateLotNumber(format: string = "{YYYYMMDD}{HHmm}{XXXX}"): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`;
  const hm = `${d.getHours().toString().padStart(2, "0")}${d.getMinutes().toString().padStart(2, "0")}`;
  const rnd = Math.floor(1000 + Math.random() * 9000).toString();
  return format.replace("{YYYYMMDD}", ymd).replace("{HHmm}", hm).replace("{XXXX}", rnd).replace(/[^0-9]/g, "");
}

// ── Nhãn các bước (Step labels) ───────────────


// STEPS will be built inside the component to use t()
const STEP_KEYS = [
  { key: "iw_supplier", icon: Truck },
  { key: "iw_products_batches", icon: Package },
  { key: "iw_cost_import", icon: DollarSign },
  { key: "iw_location", icon: MapPin },
  { key: "iw_finalize_barcode", icon: Printer },
];

/**
 * Component hiển thị giao diện đa bước (Wizard) để tạo phiếu Nhập Kho
 * Hỗ trợ tạo đơn hàng Inbound một cách thuận tiện nhất (Nhà cung cấp -> Hàng hóa -> Chi phí -> Vị trí)
 *
 * @param {InboundWizardProps} props - Thuộc tính cấu hình đầu vào
 * @returns {JSX.Element} Giao diện khai báo lưu kho (Inbound Wizard)
 */
export default function InboundWizard({ userId, onClose, onComplete, inline = false, initialScannedItems }: InboundWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const { preferences } = usePreferences();
  const { profile } = useAuth();

  // ── Nguồn dữ liệu ──
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [uoms, setUoms] = useState<UnitOfMeasurement[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [availableLocations, setAvailableLocations] = useState<Record<string, any[]>>({});
  const [loadingLocs, setLoadingLocs] = useState<string | null>(null);
  const [autoK, setAutoK] = useState(true); // ×1000 mode for VND inputs
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showAutoKTip, setShowAutoKTip] = useState(false);

  // ── Bước 1: Khai báo Nhà cung cấp ──
  const [supplierId, setSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [notes, setNotes] = useState("");

  // ── Bước 2: Khai báo danh sách sản phẩm ──
  const [inheritContract, setInheritContract] = useState(true);
  const [lines, setLines] = useState<InboundLine[]>(() => {
    if (initialScannedItems && initialScannedItems.length > 0) {
      return initialScannedItems.map(item => ({
        key: crypto.randomUUID(), product_id: item.product.id, quantity: item.quantity, 
        lot_number: generateLotNumber(preferences.lot_number_format), production_date: "", expiry_date: "", qc_status: preferences.require_qa_inbound ? "Hold" : "Pass", 
        warehouse_id: "", allocations: [], cost_price: 0, tax_rate: preferences.default_tax_rate, import_fee: 0
      }));
    }
    return [{ key: crypto.randomUUID(), product_id: "", quantity: 0, lot_number: generateLotNumber(preferences.lot_number_format), production_date: "", expiry_date: "", qc_status: preferences.require_qa_inbound ? "Hold" : "Pass", warehouse_id: "", allocations: [], cost_price: 0, tax_rate: preferences.default_tax_rate, import_fee: 0 }];
  });

  // Tải dữ liệu metadata ban đầu khi bật form
  useEffect(() => {
    Promise.all([
      fetch("/api/suppliers").then(r => r.json()),
      fetch("/api/products").then(r => r.json()),
      fetch("/api/warehouses").then(r => r.json()),
      fetch("/api/uoms").then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
    ]).then(([sup, prod, wh, ums, cats]) => {
      setSuppliers(sup || []);
      setProducts(prod || []);
      setWarehouses(wh || []);
      setUoms(ums || []);
      setCategories(cats || []);
    });
  }, []);

  /**
   * Truy vấn thông tin các vị trí có thể đặt hàng hóa của một Kho hàng
   * @param {string} warehouseId ID kho hàng
   */
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

  // ── Quản lý dòng khai báo sản phẩm ──
  const addLine = () => {
    setLines(prev => {
      const lastLine = prev.length > 0 ? prev[prev.length - 1] : null;
      return [...prev, {
        key: crypto.randomUUID(), product_id: "", quantity: 0, lot_number: generateLotNumber(preferences.lot_number_format),
        production_date: "", expiry_date: "", qc_status: preferences.require_qa_inbound ? "Hold" : "Pass", warehouse_id: "", allocations: [],
        cost_price: 0, tax_rate: preferences.default_tax_rate, import_fee: 0,
        contract_number: (inheritContract && lastLine) ? lastLine.contract_number : "",
      }];
    });
  };

  const updateLine = (key: string, field: keyof InboundLine, value: any) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));
  };

  const removeLine = (key: string) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter(l => l.key !== key));
  };

  // ── Kiểm tra mức độ hợp lệ ──
  const canGoToStep2 = supplierId !== "";
  const canGoToStep3 = lines.every(l => {
    if (!l.product_id || l.quantity <= 0 || !l.lot_number) return false;
    if (!l.contract_number || !l.packaging_spec) return false;
    if (!l.production_date || !l.expiry_date) return false;
    if (l.production_date && l.expiry_date && new Date(l.expiry_date) < new Date(l.production_date)) return false;
    return true;
  });
  const canGoToStep4 = canGoToStep3; // cost fields are optional
  const canSubmit = lines.every(l => l.warehouse_id && l.allocations.length > 0 && Math.abs(l.allocations.reduce((s, a) => s + a.quantity, 0) - l.quantity) < 0.001);

  /**
   * Xử lý xác nhận gửi dữ liệu khởi tạo phiếu nhập
   * @async
   */
  const handleSubmit = async () => {
    setSaving(true);
    try {
      const supplier = suppliers.find(s => s.id === supplierId);
      // 1. Tạo bản ghi phiếu giao hàng (shipment header)
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

      // 2. Thêm từng sản phẩm vào cơ sở dữ liệu
      for (const line of lines) {
        // Encode contract and packaging into the notes field
        const lineNotes = JSON.stringify({
          contract_number: line.contract_number,
          packaging_spec: line.packaging_spec,
        });

        for (const alloc of line.allocations) {
          // Nếu ô này đã được line khác (sản phẩm khác) sử dụng → tự động allow_mix
          const otherLineUsedSameBin = lines.some(ol => 
            ol.key !== line.key && 
            ol.warehouse_id === line.warehouse_id && 
            ol.allocations.some(a => a.location_id === alloc.location_id)
          );
          const itemRes = await fetch(`/api/inbound-shipments/${shipment.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product_id: line.product_id,
              quantity: alloc.quantity,
              lot_number: line.lot_number,
              production_date: line.production_date || null,
              expiry_date: line.expiry_date || null,
              qc_status: line.qc_status,
              warehouse_id: line.warehouse_id,
              location_id: alloc.location_id,
              user_id: userId,
              cost_price: line.cost_price || 0,
              tax_rate: line.tax_rate || 0,
              import_fee: line.import_fee || 0,
              notes: lineNotes,
              allow_mix: line.allow_mix || otherLineUsedSameBin || false,
            }),
          });
          if (!itemRes.ok) {
            const err = await itemRes.json();
            throw new Error(err.error || "Lỗi thêm dòng sản phẩm");
          }
        }
      }

      // 3. Đánh dấu hoàn tất xác nhận phiếu nhập
      await fetch(`/api/inbound-shipments/${shipment.id}/complete`, { method: "PUT" });

      toast.success("Nhập kho thành công! Đang chuyển sang màn hình in mã vạch...");
      setStep(4); // Advance to barcode print step
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
            <h2 className={cn("font-bold text-neutral-900 dark:text-neutral-50", inline ? "text-lg" : "text-xl")}>{t("iw_create_receipt_title")}</h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 font-medium">{t("iw_create_receipt_subtitle")}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-neutral-50 dark:border-neutral-900 flex items-center gap-2 shrink-0">
          {STEP_KEYS.map((s, i) => (
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
                {t(s.key)}
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
                    <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("iw_supplier_label")}</label>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                      <input
                        type="text"
                        value={supplierSearch}
                        onChange={e => setSupplierSearch(e.target.value)}
                        placeholder={t("iw_search_supplier")}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-medium focus:ring-2 focus:ring-taika-blue outline-none text-neutral-900 dark:text-neutral-100 shadow-sm"
                      />
                    </div>
                  </div>

                  {(() => {
                    const filteredSuppliers = suppliers.filter(s => {
                      if (s.status !== "active") return false;
                      if (!supplierSearch?.trim()) return true;
                      const q = supplierSearch.toLowerCase();
                      return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone?.includes(q);
                    });

                    return filteredSuppliers.length > 0 ? (
                      <div className="flex flex-wrap gap-3 pb-2 max-h-[220px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {filteredSuppliers.map((s: any) => {
                          const selected = supplierId === s.id;
                          const supplierCats = s.categories || [];
                            return (
                              <button
                                key={s.id}
                                onClick={() => setSupplierId(selected ? "" : s.id)}
                                className={cn(
                                  "flex items-center gap-4 px-4 py-3 rounded-2xl border-2 text-left transition-all w-[320px] shrink-0",
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
                                  {s.phone && (
                                    <span className="text-[10px] text-neutral-500 font-medium truncate block">
                                      LH: {s.phone}
                                    </span>
                                  )}
                                  {supplierCats.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {supplierCats.map((cat: any) => (
                                        <span
                                          key={cat.id}
                                          className={cn(
                                            "inline-block px-2 py-0.5 rounded-md text-[9px] font-bold leading-tight border",
                                            selected
                                              ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30"
                                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700"
                                          )}
                                        >
                                          {cat.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-sm text-neutral-400 font-medium bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                        {t("iw_no_supplier_found")} "{supplierSearch}"
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("iw_notes_label")}</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                    placeholder={t("iw_notes_placeholder")}
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
                  const uomName = uomVal?.abbreviation || uomVal?.name || "kg";
                  
                  return (
                  <div key={line.key} className="p-5 border border-neutral-200 dark:border-neutral-700 rounded-2xl space-y-4 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-taika-blue dark:text-blue-400">{t("iw_line")} #{idx + 1}</span>
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
                          <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("iw_product")}</label>
                          <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                            <input
                              type="text"
                              value={line.search_term || ""}
                              onChange={e => updateLine(line.key, "search_term", e.target.value)}
                              placeholder={t("iw_search_product")}
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
                                      
                                      let autoSpec = "";
                                      if (prod) {
                                        const pUom = uoms.find(u => u.id === (prod as any).uom_id);
                                        const uomText = pUom?.name || pUom?.abbreviation || "";
                                        const sizeText = (prod as any).size || "";
                                        
                                        if (sizeText && uomText) autoSpec = `${sizeText}/${uomText}`;
                                        else autoSpec = sizeText || uomText || "";
                                        
                                        if (autoSpec) {
                                          autoSpec = autoSpec.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
                                        }
                                      }

                                      // Auto-fill tax_rate from category
                                      const catTax = prod
                                        ? categories.find((c: any) => c.id === (prod as any).category_id)?.default_tax_rate
                                        : undefined;

                                      setLines(prev => prev.map(l => l.key === line.key ? { 
                                        ...l, 
                                        product_id: pid, 
                                        cost_price: (prod as any)?.import_price || 0,
                                        packaging_spec: pid ? autoSpec : "",
                                        tax_rate: catTax !== undefined ? catTax : l.tax_rate
                                      } : l));
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
                              {t("iw_no_product_found")} "{line.search_term}"
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* Quantity & Unit */}
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest flex items-center gap-1 box-border">
                          {t("iw_quantity")}
                          <span className="group relative cursor-help flex items-center">
                            <Info size={12} className="text-neutral-400 hover:text-taika-blue transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-neutral-800 border border-neutral-700 text-white text-[11px] drop-shadow-xl rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none normal-case font-medium tracking-normal text-center">
                              Tổng số lượng nhập của Lô này. Đơn vị ({uomName}) lấy từ cài đặt của Sản phẩm (kg = cân nặng, cái/thùng = đếm số lượng).
                            </div>
                          </span>
                        </label>
                        <div className="relative">
                          <input type="number" value={line.quantity || ""} onChange={e => updateLine(line.key, "quantity", Number(e.target.value))}
                            placeholder="0"
                            className="w-full p-3 pr-12 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">{uomName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {/* Lot number */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest flex items-center gap-1 box-border">
                          {t("iw_lot_number")}
                          <span className="group relative cursor-help flex items-center">
                            <Info size={12} className="text-neutral-400 hover:text-taika-blue transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-800 border border-neutral-700 text-white text-[11px] drop-shadow-xl rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none normal-case font-medium tracking-normal text-center">
                              Mã lô sinh tự động hoặc quét tay. Hệ thống dùng số này để tạo QR/Barcode.
                            </div>
                          </span>
                        </label>
                        <input type="text" value={line.lot_number} onChange={e => updateLine(line.key, "lot_number", e.target.value)}
                          className="w-full p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-mono font-bold outline-none focus:ring-1 focus:ring-taika-blue" />
                      </div>
                      {/* Số hợp đồng */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest flex items-center gap-1 box-border">
                          {t("iw_contract")} *
                          <span className="group relative cursor-help flex items-center">
                            <Info size={12} className="text-neutral-400 hover:text-taika-blue transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-800 border border-neutral-700 text-white text-[11px] drop-shadow-xl rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none normal-case font-medium tracking-normal text-center">
                              {t("iw_contract_tooltip")}
                            </div>
                          </span>
                        </label>
                        <input type="text" value={line.contract_number || ""} onChange={e => updateLine(line.key, "contract_number", e.target.value.toUpperCase())}
                          placeholder={t("iw_contract_placeholder", "e.g. HD788T")}
                          className={cn("w-full p-3 bg-white dark:bg-neutral-950 border rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-taika-blue", !line.contract_number ? "border-amber-400 dark:border-amber-600" : "border-neutral-200 dark:border-neutral-700")} />
                      </div>
                      {/* Quy cách */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest flex items-center gap-1 box-border">
                          {t("iw_packaging_spec")} *
                          <span className="group relative cursor-help flex items-center">
                            <Info size={12} className="text-neutral-400 hover:text-taika-blue transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-800 border border-neutral-700 text-white text-[11px] drop-shadow-xl rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none normal-case font-medium tracking-normal text-center">
                              {t("iw_packaging_tooltip")}
                            </div>
                          </span>
                        </label>
                        <input type="text" value={line.packaging_spec || ""} onChange={e => updateLine(line.key, "packaging_spec", e.target.value)}
                          placeholder={t("iw_packaging_placeholder", "e.g. 40pcs/C")}
                          className={cn("w-full p-3 bg-white dark:bg-neutral-950 border rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-taika-blue", !line.packaging_spec ? "border-amber-400 dark:border-amber-600" : "border-neutral-200 dark:border-neutral-700")} />
                      </div>
                      {/* Production date */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("iw_production_date")} *</label>
                        <div className="relative flex items-center">
                          <button type="button" className="absolute left-2.5 z-10 p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-taika-blue transition-colors"
                            onClick={() => { const inp = document.getElementById(`prod-date-${line.key}`) as HTMLInputElement; if (inp) try { inp.showPicker(); } catch {} }}>
                            <CalendarDays size={14} />
                          </button>
                          <input id={`prod-date-${line.key}`} type="date" value={line.production_date} onChange={e => updateLine(line.key, "production_date", e.target.value)}
                            className="w-full pl-9 pr-3 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium outline-none focus:ring-1 focus:ring-taika-blue" />
                        </div>
                      </div>
                      {/* Expiry date */}
                      <div className="space-y-1.5 cursor-help" title={line.production_date && line.expiry_date && new Date(line.expiry_date) < new Date(line.production_date) ? "❌ Hạn sử dụng không hợp lệ" : ""}>
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("iw_expiry_date")} *</label>
                        <div className="relative flex items-center">
                          <button type="button" className="absolute left-2.5 z-10 p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-taika-blue transition-colors"
                            onClick={() => { const inp = document.getElementById(`exp-date-${line.key}`) as HTMLInputElement; if (inp) try { inp.showPicker(); } catch {} }}>
                            <CalendarDays size={14} />
                          </button>
                          <input id={`exp-date-${line.key}`} type="date" value={line.expiry_date} onChange={e => updateLine(line.key, "expiry_date", e.target.value)}
                            className={cn(
                              "w-full pl-9 pr-3 py-3 bg-white dark:bg-neutral-950 border rounded-xl text-sm font-medium outline-none focus:ring-1",
                              line.production_date && line.expiry_date && new Date(line.expiry_date) < new Date(line.production_date)
                                ? "border-red-500 focus:ring-red-500 text-red-600 dark:text-red-400"
                                : "border-neutral-200 dark:border-neutral-700 focus:ring-taika-blue"
                            )} />
                        </div>
                      </div>
                    </div>

                    {/* QC Status */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest flex items-center gap-2">
                        {t("iw_qc_label")}
                        {preferences.require_qa_inbound && <span className="text-[9px] bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">{t("iw_qc_default_hold")}</span>}
                      </label>
                      <div className="flex gap-2">
                        {([["Pass", t("iw_qc_pass")], ["Hold", t("iw_qc_hold")], ["Fail", t("iw_qc_fail")]] as [string, string][]).map(([qc, label]) => (
                            <button key={qc} onClick={() => updateLine(line.key, "qc_status", qc)}
                              className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold border transition-all",
                                line.qc_status === qc
                                  ? qc === "Pass" ? "bg-green-500 text-white border-green-500"
                                  : qc === "Fail" ? "bg-red-500 text-white border-red-500"
                                  : "bg-orange-500 text-white border-orange-500"
                                : "bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-neutral-300"
                              )}>
                              {label}
                            </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  );
                })}

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <button onClick={addLine}
                    className="flex-1 w-full py-3 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold text-neutral-400 dark:text-neutral-500 hover:border-taika-blue hover:text-taika-blue transition-all flex items-center justify-center gap-2">
                    <Plus size={16} /> {t("iw_add_line")}
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl w-full sm:w-auto shrink-0 select-none hover:border-taika-blue/50 transition-all">
                    <input type="checkbox" checked={inheritContract} onChange={e => setInheritContract(e.target.checked)} className="w-4 h-4 text-taika-blue border-neutral-300 rounded focus:ring-taika-blue dark:bg-neutral-800 dark:border-neutral-600" />
                    <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">{t("iw_remember_contract")}</span>
                  </label>
                </div>
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
                  const uomName = uomVal?.abbreviation || uomVal?.name || "kg";
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
                            <p className="text-xs text-neutral-400 font-medium">{t("iw_line_total")}</p>
                            <p className="text-sm font-black text-green-600 dark:text-green-400">{lineTotal.toLocaleString("vi-VN")} ₫</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {renderMoneyInput("cost_price", `${t("iw_cost_price")} / ${uomName}`, line.cost_price, true)}
                        {/* Tax rate */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("iw_tax_rate")}</label>
                          <div className="relative">
                            <input type="number" value={line.tax_rate === 0 ? "" : line.tax_rate} onChange={e => {
                              let val = Number(e.target.value);
                              if (val < 0) val = 0;
                              if (val > 100) val = 100;
                              updateLine(line.key, "tax_rate", val);
                            }}
                              placeholder="0"
                              className="w-full p-3 pr-10 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-amber-500 text-neutral-900 dark:text-neutral-50" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">%</span>
                          </div>
                        </div>
                        {renderMoneyInput("import_fee", t("iw_import_fee"), line.import_fee)}
                      </div>

                      {/* Line summary */}
                      {lineTotal > 0 && (
                        <div className="flex items-center gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs flex-wrap">
                          <span className="text-neutral-400 font-medium">{t("iw_subtotal")}: <span className="font-bold text-neutral-600 dark:text-neutral-300">{subtotal.toLocaleString("vi-VN")} ₫</span></span>
                          {taxAmount > 0 && <span className="text-neutral-400 font-medium">{t("iw_tax")}: <span className="font-bold text-red-500">+{taxAmount.toLocaleString("vi-VN")} ₫</span></span>}
                          {line.import_fee > 0 && <span className="text-neutral-400 font-medium">{t("iw_fee")}: <span className="font-bold text-orange-500">+{line.import_fee.toLocaleString("vi-VN")} ₫</span></span>}
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
                                  {t("iw_ref_wholesale")}: <span className={cn("font-bold", refWholesale > line.cost_price ? "text-purple-500" : "text-red-500")}>
                                    {refWholesale > line.cost_price ? "+" : ""}{((refWholesale - line.cost_price) / line.cost_price * 100).toFixed(1)}%
                                  </span>
                                </span>
                              )}
                              {refRetail > 0 && (
                                <span className="text-neutral-400 font-medium">
                                  {t("iw_ref_retail")}: <span className={cn("font-bold", refRetail > line.cost_price ? "text-green-500" : "text-red-500")}>
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
                    <span className="text-sm font-bold text-green-700 dark:text-green-400">{t("iw_total_receipt")}</span>
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
                    {t("iw_location_hint")}
                  </p>
                </div>

                {lines.map((line, idx) => {
                  const product = products.find(p => p.id === line.product_id) as any;
                  const uomVal = uoms.find(u => u.id === product?.uom_id);
                  const uomName = uomVal?.abbreviation || uomVal?.name || "kg";
                  const rawLocs = availableLocations[line.warehouse_id] || [];
                  const wh = warehouses.find(w => w.id === line.warehouse_id) || null;

                  // ── Tính toán "ảo": trừ đi các phân bổ từ các dòng KHÁC cùng kho ──
                  const adjustedLocs = rawLocs.map((loc: any) => {
                    let virtualQty = 0;
                    const virtualItems: any[] = [];
                    lines.forEach((otherLine, otherIdx) => {
                      if (otherIdx === idx) return; // bỏ qua dòng hiện tại
                      if (otherLine.warehouse_id !== line.warehouse_id) return;
                      otherLine.allocations.forEach(alloc => {
                        if (alloc.location_id === loc.id && alloc.quantity > 0) {
                          virtualQty += alloc.quantity;
                          const prd = products.find(p => p.id === otherLine.product_id);
                          virtualItems.push({
                            product_id: otherLine.product_id,
                            product_name: prd?.name || "—",
                            expiry_date: otherLine.expiry_date || null,
                            lot_number: otherLine.lot_number,
                            contract_number: otherLine.contract_number || null,
                            production_date: otherLine.production_date || null,
                            quantity: alloc.quantity,
                          });
                        }
                      });
                    });
                    if (virtualQty === 0) return loc;
                    return {
                      ...loc,
                      current_quantity: loc.current_quantity + virtualQty,
                      remaining_capacity: Math.max(0, loc.remaining_capacity - virtualQty),
                      existing_items: [...(loc.existing_items || []), ...virtualItems],
                    };
                  });
                  const locs = adjustedLocs;
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
                        {line.allocations.length > 0 && (
                          <span className={cn("px-3 py-1 text-xs font-bold rounded-lg", 
                            Math.abs(line.allocations.reduce((s, a) => s + a.quantity, 0) - line.quantity) < 0.001 
                              ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" 
                              : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                          )}>
                            {Math.abs(line.allocations.reduce((s, a) => s + a.quantity, 0) - line.quantity) < 0.001 
                              ? "✓ Đã phân bổ " + line.allocations.length + " ô" 
                              : "Đang chia lẻ (" + line.allocations.length + " ô)"}
                          </span>
                        )}
                      </div>

                      {/* Warehouse selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{t("iw_warehouse")}</label>
                        <select value={line.warehouse_id}
                          onChange={async e => {
                            const whId = e.target.value;
                            updateLine(line.key, "warehouse_id", whId);
                            updateLine(line.key, "allocations", []);
                            if (whId) {
                               let fetchedLocs = availableLocations[whId];
                               if (!fetchedLocs) {
                                  setLoadingLocs(whId);
                                  try {
                                    const res = await fetch(`/api/warehouses/${whId}/available-locations`);
                                    fetchedLocs = await res.json() || [];
                                    setAvailableLocations(prev => ({ ...prev, [whId]: fetchedLocs }));
                                  } catch { fetchedLocs = []; }
                                  setLoadingLocs(null);
                               }
                               
                               const autoAllocations: { location_id: string, quantity: number }[] = [];
                               let remainder = line.quantity;

                               const whObj = warehouses.find(w => w.id === whId) as any;
                               const prdObj = products.find(p => p.id === line.product_id) as any;
                               let targetZone = null;
                               if (whObj?.zone_categories && prdObj?.category_id) {
                                  targetZone = Object.keys(whObj.zone_categories).find(z => whObj.zone_categories[z] === prdObj.category_id);
                               }

                               // Điều chỉnh ảo: trừ đi phân bổ từ các dòng KHÁC
                               const adjForAuto = (fetchedLocs || []).map((loc: any) => {
                                  let vQty = 0;
                                  lines.forEach((ol, oi) => {
                                    if (oi === idx || ol.warehouse_id !== whId) return;
                                    ol.allocations.forEach(a => { if (a.location_id === loc.id && a.quantity > 0) vQty += a.quantity; });
                                  });
                                  if (vQty === 0) return loc;
                                  return { ...loc, current_quantity: loc.current_quantity + vQty, remaining_capacity: Math.max(0, loc.remaining_capacity - vQty) };
                               });

                               const sortedLocs = [...adjForAuto].sort((a: any, b: any) => {
                                  const aInZone = targetZone && a.zone === targetZone ? 1 : 0;
                                  const bInZone = targetZone && b.zone === targetZone ? 1 : 0;
                                  if (aInZone !== bInZone) return bInZone - aInZone; // zone ưu tiên

                                  const aHasProd = a.existing_items?.some((i: any) => i.product_id === line.product_id) ? 1 : 0;
                                  const bHasProd = b.existing_items?.some((i: any) => i.product_id === line.product_id) ? 1 : 0;
                                  if (aHasProd !== bHasProd) return bHasProd - aHasProd;

                                  const aEmpty = a.current_quantity === 0 ? 1 : 0;
                                  const bEmpty = b.current_quantity === 0 ? 1 : 0;
                                  if (aEmpty !== bEmpty) return bEmpty - aEmpty;

                                  return b.remaining_capacity - a.remaining_capacity;
                               });

                               for (const loc of sortedLocs) {
                                  if (remainder <= 0) break;
                                  if (loc.remaining_capacity > 0) {
                                      const take = Math.min(remainder, loc.remaining_capacity);
                                      if (take > 0) {
                                          autoAllocations.push({ location_id: loc.id, quantity: take });
                                          remainder -= take;
                                      }
                                  }
                               }

                               if (autoAllocations.length > 0) {
                                  updateLine(line.key, "allocations", autoAllocations);
                                  toast.success(`Hệ thống đã tự động phân bổ lô hàng vào ${autoAllocations.length} ô vị trí chứa vừa nhất.`);
                               }
                            }
                          }}
                          className="w-full p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium outline-none focus:ring-1 focus:ring-taika-blue">
                          <option value="">{t("iw_select_warehouse")}</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.temperature_zone})</option>)}
                        </select>
                      </div>

                      {/* Visual Location Picker Grid */}
                      {line.warehouse_id && (() => {
                        const zoneLabels: Record<string, string> = {};
                        if ((wh as any)?.zone_categories) {
                           for (const [z, id] of Object.entries((wh as any).zone_categories)) {
                               const c = categories.find((x:any) => x.id === id);
                               if (c) zoneLabels[z] = c.name;
                           }
                        }
                        return (
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest flex items-center justify-between">
                              <span>{t("iw_click_map")}</span>
                              {line.allocations.length > 0 && (
                                <span className={cn("px-2 py-0.5 rounded text-xs", Math.abs(line.allocations.reduce((s, a) => s + a.quantity, 0) - line.quantity) < 0.001 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                                  Đã nhập: {line.allocations.reduce((s, a) => s + a.quantity, 0)} / {line.quantity} {uomName}
                                </span>
                              )}
                            </label>
                            
                            {/* Bảng phân bổ nhiều vị trí */}
                            {line.allocations.length > 0 && (
                                <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden mb-4 shadow-sm">
                                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800 max-h-40 overflow-y-auto">
                                    {line.allocations.map((alloc, i) => {
                                      const locInfo = locs.find(l => l.id === alloc.location_id);
                                      return (
                                        <div key={i} className="flex items-center justify-between p-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors">
                                          <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-taika-blue/10 dark:bg-blue-500/20 text-taika-blue flex items-center justify-center">
                                              <MapPin size={12} />
                                            </div>
                                            <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                                              {locInfo?.zone}-{locInfo?.rack}-{locInfo?.bin}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <div className="relative">
                                              <input 
                                                type="number"
                                                value={alloc.quantity || ""}
                                                onChange={e => {
                                                  const newVal = Math.max(0, Number(e.target.value) || 0);
                                                  const cp = [...line.allocations];
                                                  // Tổng các ô khác (trừ ô đang sửa)
                                                  const othersTotal = cp.reduce((sum, a, idx) => idx === i ? sum : sum + a.quantity, 0);
                                                  // Giới hạn: không được vượt quá tổng lô hàng
                                                  const maxAllowed = line.quantity - othersTotal;
                                                  cp[i] = { ...cp[i], quantity: Math.min(newVal, maxAllowed) };
                                                  updateLine(line.key, "allocations", cp);
                                                }}
                                                className="w-24 pl-2 pr-8 py-1.5 text-sm font-bold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg outline-none focus:border-taika-blue text-right"
                                              />
                                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">{uomName}</span>
                                            </div>
                                            <button onClick={() => {
                                              const remaining = line.allocations;
                                              const removedQty = remaining[i].quantity;
                                              const newAllocs = remaining.filter((_, idx) => idx !== i);
                                              // Phân bổ lại phần dư cho ô cuối
                                              if (newAllocs.length > 0 && removedQty > 0) {
                                                const lastIdx = newAllocs.length - 1;
                                                const othersTotal = newAllocs.reduce((s, a) => s + a.quantity, 0);
                                                const deficit = line.quantity - othersTotal;
                                                if (deficit > 0) {
                                                  newAllocs[lastIdx] = { ...newAllocs[lastIdx], quantity: newAllocs[lastIdx].quantity + deficit };
                                                }
                                              }
                                              updateLine(line.key, "allocations", newAllocs);
                                            }} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-200 dark:hover:border-red-500/30">
                                              <Trash2 size={16} />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                            )}

                            <LocationPickerGrid
                              locations={locs}
                              selectedIds={line.allocations.map(a => a.location_id)}
                              onSelect={(locId, allowMix) => {
                                const exists = line.allocations.find(a => a.location_id === locId);
                                let newAllocs = [...line.allocations];
                                if (exists) {
                                  newAllocs = newAllocs.filter(a => a.location_id !== locId);
                                } else {
                                  const loc = locs.find(l => l.id === locId);
                                  const locRemaining = loc?.remaining_capacity || 0;
                                  // Chặn chọn ô đã đầy sức chứa
                                  if (locRemaining <= 0) {
                                    toast.error("Ô này đã đầy sức chứa! Vui lòng chọn vị trí khác.");
                                    return;
                                  }
                                  const currentTotal = newAllocs.reduce((sum, a) => sum + a.quantity, 0);
                                  const remaining = Math.max(0, line.quantity - currentTotal);
                                  const qtyToAllocate = Math.min(remaining, locRemaining);
                                  // Chỉ thêm nếu thực sự có kg để phân bổ
                                  if (qtyToAllocate <= 0) {
                                    toast.warning("Đã phân bổ đủ số lượng. Không thể thêm ô mới.");
                                    return;
                                  }
                                  newAllocs.push({ location_id: locId, quantity: qtyToAllocate });
                                  if (allowMix) updateLine(line.key, "allow_mix", true);
                                }
                                updateLine(line.key, "allocations", newAllocs);
                              }}
                              loading={loadingLocs === line.warehouse_id}
                              warehouse={wh}
                              zoneLabels={zoneLabels}
                              incomingProductId={line.product_id}
                              incomingExpiryDate={line.expiry_date}
                              incomingQuantity={Math.max(0, line.quantity - line.allocations.reduce((s, a) => s + a.quantity, 0))}
                              totalLineQuantity={line.quantity}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </motion.div>
            )}
            {/* ── Step 5: Hoàn tất & In tem ── */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">{t("iw_saved_success")}</h3>
                  <p className="text-sm text-neutral-500 font-medium">{t("iw_saved_subtitle", { count: lines.length })}</p>
                </div>

                <div className="bg-neutral-50 dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-4">
                     <h4 className="font-bold text-neutral-900 dark:text-neutral-50">{t("iw_barcode_title")}</h4>
                     <button onClick={() => window.print()} className="px-5 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-taika-blue/90">
                       <Printer size={16} /> {t("iw_print_all")}
                     </button>
                  </div>
                  <div className="print-container flex flex-wrap justify-center gap-6 overflow-y-auto max-h-[40vh] p-4 bg-neutral-200 dark:bg-neutral-800 rounded-xl custom-scrollbar relative">
                    {lines.map((line) => {
                       const product = products.find(p => p.id === line.product_id) as any;
                       return (
                           <BarcodeLabel 
                             key={`${line.key}`}
                             productName={product?.name || ""}
                             sku={product?.sku || ""}
                             contractNumber={line.contract_number}
                             productionDate={line.production_date}
                             packagingSpec={line.packaging_spec}
                             lotNumber={line.lot_number}
                             userName={profile?.full_name || profile?.email || "NV"}
                           />
                       );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
          {step === 4 ? (
            <div className="w-full flex justify-end">
              <button
                onClick={onComplete}
                className="px-6 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold hover:bg-taika-blue/90"
              >
                {t("iw_close")}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => step > 0 ? setStep(step - 1) : onClose()}
                className="px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center gap-2"
              >
                <ChevronLeft size={16} />
                {step === 0 ? t("iw_cancel") : t("iw_go_back")}
              </button>

              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 0 ? !canGoToStep2 : step === 1 ? !canGoToStep3 : !canGoToStep4}
                  className="px-6 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold hover:bg-taika-blue/90 transition-all flex items-center gap-2 shadow-lg shadow-taika-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("iw_next_step")} <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || saving}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {saving ? t("iw_submitting") : t("iw_submit")}
                </button>
              )}
            </>
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
