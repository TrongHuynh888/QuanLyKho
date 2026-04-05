import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { X, Package, Upload, Loader2, ImageOff, Wand2, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import type { Product, Category, UnitOfMeasurement } from "../../types/supabase";

interface ProductFormModalProps {
  open: boolean;
  product?: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

const STATE_OPTIONS = ["raw", "cooked", "processed"] as const;

const TYPE_OPTIONS = [
  "Nguyên con (HOSO)",
  "Bỏ đầu (HLSO)",
  "Lột vỏ rút chỉ (P&D)",
  "Lột vỏ chừa đuôi (PTO)",
  "Cắt lát (Steak)",
  "Fillet (Phi-lê)",
  "Xiên que (Skewered)",
  "Nguyên vỏ",
  "Hàng tinh chế (VAP)",
  "Tẩm bột (Breaded/Coated)",
  "Chiên sơ (Pre-fried)",
  "Dimsum (Há cảo/Xíu mại)",
];

const SHRIMP_COUNT_OPTIONS = [
  "16/20", "21/25", "26/30", "31/40", "41/50", "51/60", "61/70", "71/90"
];

const PACKAGE_SIZE_OPTIONS = [
  "100g", "200g", "250g", "300g", "500g", "1kg", "2kg", "5kg", "10kg"
];

export default function ProductFormModal({ open, product, onClose, onSaved }: ProductFormModalProps) {
  const { t } = useTranslation();
  const isEdit = !!product;

  const [form, setForm] = useState({
    sku: "",
    name: "",
    category_id: "",
    uom_id: "",
    type: "",
    size: "",
    state: "raw" as "raw" | "cooked" | "processed",
    min_stock_level: 0,
    image_url: "",
    description: "",
    ingredients: "",
    retail_price: 0,
    wholesale_price: 0,
    import_price: 0,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [uoms, setUoms] = useState<UnitOfMeasurement[]>([]);
  const [saving, setSaving] = useState(false);
  const [autoK, setAutoK] = useState(true);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchMeta();
      if (product) {
        setForm({
          sku: product.sku || "",
          name: product.name || "",
          category_id: product.category_id || "",
          uom_id: product.uom_id || "",
          type: product.type || "",
          size: product.size || "",
          state: product.state || "raw",
          min_stock_level: product.min_stock_level || 0,
          image_url: product.image_url || "",
          description: product.description || "",
          ingredients: product.ingredients || "",
          retail_price: product.retail_price || 0,
          wholesale_price: product.wholesale_price || 0,
          import_price: product.import_price || 0,
        });
        setImagePreview(product.image_url || "");
      } else {
        setForm({ sku: "", name: "", category_id: "", uom_id: "", type: "", size: "", state: "raw", min_stock_level: 0, image_url: "", description: "", ingredients: "", retail_price: 0, wholesale_price: 0, import_price: 0 });
        setImagePreview("");
      }
    }
  }, [open, product]);

  async function fetchMeta() {
    const [catRes, uomRes] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/uoms"),
    ]);
    if (catRes.ok) setCategories(await catRes.json());
    if (uomRes.ok) setUoms(await uomRes.json());
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/product-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(f => ({ ...f, image_url: data.url }));
      setImagePreview(data.url);
      toast.success(t("upload_image") + " ✓");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) {
      toast.error("SKU và Tên sản phẩm không được để trống");
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/products/${product!.id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(isEdit ? t("product_updated") : t("product_created"));
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  }

  const handleAutoGenerateSKU = () => {
    let prefix = "TTCT"; // Mặc định là Tôm thẻ chân trắng
    if (form.sku.includes("-")) {
      prefix = form.sku.split("-")[0];
    } else if (form.name) {
      // Chuẩn hóa chuỗi: bỏ dấu tiếng Việt, đưa về chữ thường
      const nameNorm = form.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .toLowerCase();
        
      if (nameNorm.includes("su") || nameNorm.includes("black tiger")) prefix = "BT";
      else if (nameNorm.includes("the") || nameNorm.includes("vannamei")) prefix = "TTCT";
      else if (nameNorm.includes("muc") || nameNorm.includes("squid")) prefix = "SQ";
      else if (nameNorm.includes("bach tuoc") || nameNorm.includes("octopus")) prefix = "OCT";
      else if (nameNorm.includes("ca ") || nameNorm.startsWith("ca") || nameNorm.includes("fish")) prefix = "FSH";
      else {
        // Không chứa keyword hải sản quen thuộc -> Lấy ký tự đầu các chữ (VD: Sò điệp -> SD, Nghêu -> N)
        const initials = form.name.split(/\s+/).map(w => w[0]).join("").substring(0, 3).toUpperCase();
        prefix = initials || "SP"; // Fallback lần cuối là SP (Sản Phẩm)
      }
    }

    let typeCode = "X";
    if (form.type) {
      const match = form.type.match(/\(([^)]+)\)/);
      typeCode = match ? match[1].replace(/[^A-Za-z0-9]/g, "").toUpperCase() : form.type.substring(0, 3).toUpperCase();
    }

    const stateMap: Record<string, string> = { raw: "R", cooked: "C", processed: "P" };
    const stateCode = stateMap[form.state] || "X";

    let sizeCode = "00";
    if (form.size) {
      sizeCode = form.size.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    }

    const newSku = `${prefix}-${typeCode}-${stateCode}-${sizeCode}`;
    setForm(f => ({ ...f, sku: newSku }));
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-neutral-950 w-full max-w-6xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-taika-blue/10 dark:bg-blue-500/10 flex items-center justify-center text-taika-blue dark:text-blue-400">
                <Package size={20} />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                {isEdit ? t("edit_product") : t("add_product")}
              </h3>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
            <div className="p-6 space-y-5">
              {/* Image Upload */}
              <div>
                <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-2">
                  {t("product_image")}
                </label>
                <div className="flex items-center gap-4">
                  <div
                    className="w-24 h-24 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 overflow-hidden flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 cursor-pointer hover:border-taika-blue dark:hover:border-blue-400 transition-colors shrink-0"
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 size={24} className="animate-spin text-taika-blue" />
                    ) : imagePreview ? (
                      <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-2">
                        <ImageOff size={24} className="text-neutral-300 dark:text-neutral-600 mx-auto mb-1" />
                        <span className="text-[10px] text-neutral-400">{t("no_image")}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <Upload size={14} /> {uploading ? t("uploading") : imagePreview ? t("change_image") : t("upload_image")}
                      </button>
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm(f => ({ ...f, image_url: "" }));
                            setImagePreview("");
                          }}
                          className="px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl text-sm font-bold transition-all"
                        >
                          {t("remove_image")}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">JPG, PNG, WEBP · Tối đa 5MB</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  />
                </div>
              </div>

              {/* SKU & Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 relative group">
                      <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block">{t("sku_code")}</label>
                      <Info size={12} className="text-neutral-400 cursor-help" />
                      
                      {/* Tooltip */}
                      <div className="absolute left-0 bottom-full mb-1 bg-neutral-800 dark:bg-white text-white dark:text-black text-[10px] p-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all font-medium whitespace-pre-wrap z-50 shadow-xl border border-neutral-700 dark:border-neutral-200 pointer-events-none w-max max-w-xs">
                        Công thức: [GIỐNG] - [QUY CÁCH] - [TRẠNG THÁI] - [SIZE]
                        VD: TTCT-HOSO-C-2630
                        
                        Mẹo: Cứ điền Tên, Loại, Trạng thái, Size rồi bấm "Tạo mã"
                      </div>
                    </div>
                    <button type="button" onClick={handleAutoGenerateSKU} title="Tự động tạo mã chuẩn quốc tế"
                      className="text-[10px] font-bold px-2 py-0.5 bg-taika-blue/10 text-taika-blue hover:bg-taika-blue hover:text-white rounded transition-colors flex items-center gap-1">
                      <Wand2 size={10} /> Tạo mã
                    </button>
                  </div>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={e => setForm(f => ({ ...f, sku: e.target.value.toUpperCase() }))}
                    placeholder="VD: TTCT-HOSO-C-2630"
                    required
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-mono font-bold uppercase placeholder:normal-case"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1.5">{t("product_name")}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Tôm sú đông lạnh"
                    required
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium"
                  />
                </div>
              </div>

              {/* Category & UOM */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1.5">{t("category")}</label>
                  <select
                    value={form.category_id}
                    onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium"
                  >
                    <option value="">-- {t("all_categories")} --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1.5">{t("unit_of_measurement")}</label>
                  <select
                    value={form.uom_id}
                    onChange={e => setForm(f => ({ ...f, uom_id: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium"
                  >
                    <option value="">-- Chọn đơn vị --</option>
                    {uoms.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
              </div>

              {/* State, Type, Size */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1.5">{t("state")}</label>
                  <select
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value as any }))}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium"
                  >
                    {STATE_OPTIONS.map(s => <option key={s} value={s}>{t(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1.5">{t("product_type", "Loại hình thức")}</label>
                  <input
                    type="text"
                    list="product-types"
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    placeholder="Chọn menu hoặc tự nhập..."
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium"
                  />
                  <datalist id="product-types">
                    {TYPE_OPTIONS.map(type => (
                      <option key={type} value={type} />
                    ))}
                  </datalist>
                </div>
                {(() => {
                  const selUom = uoms.find(u => u.id === form.uom_id);
                  const uomStr = (selUom?.name || "").toLowerCase() + " " + (selUom?.abbreviation || "").toLowerCase();
                  
                  // Decide which options to show based on the Unit of Measurement
                  let dynamicSizeOptions = SHRIMP_COUNT_OPTIONS; // default to count grading
                  if (uomStr.includes("gói") || uomStr.includes("pcs") || uomStr.includes("hộp") || uomStr.includes("thùng") || uomStr.includes("box")) {
                    dynamicSizeOptions = PACKAGE_SIZE_OPTIONS;
                  }

                  return (
                    <div>
                      <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1.5">{t("size_grading")}</label>
                      <input
                        type="text"
                        list="product-sizes"
                        value={form.size}
                        onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                        placeholder="Chọn menu hoặc tự nhập..."
                        className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium"
                      />
                      <datalist id="product-sizes">
                        {dynamicSizeOptions.map(size => (
                          <option key={size} value={size} />
                        ))}
                      </datalist>
                    </div>
                  );
                })()}
              </div>

              {/* Min stock & Prices */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                {(() => {
                  const selUom = uoms.find(u => u.id === form.uom_id);
                  const uomLabel = selUom?.symbol || selUom?.abbreviation || "";
                  return (
                    <div>
                      <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1.5">
                        {t("min_stock")} {uomLabel ? `(${uomLabel})` : ""}
                      </label>
                  <input
                    type="number"
                    min={0}
                    value={form.min_stock_level}
                    onChange={e => setForm(f => ({ ...f, min_stock_level: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium"
                  />
                  </div>
                )})}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-blue-500 uppercase tracking-widest block">Giá nhập (VNĐ)</label>
                    <button type="button" onClick={() => setAutoK(!autoK)}
                      className={cn("text-[10px] font-bold px-2 py-0.5 rounded transition-colors", autoK ? "bg-taika-blue text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500")}>
                      ×1k
                    </button>
                  </div>
                  <input
                    type={focusedField === "import_price" ? "number" : "text"}
                    min={0}
                    value={focusedField === "import_price" ? (autoK && form.import_price > 0 ? form.import_price / 1000 : form.import_price || "") : (form.import_price > 0 ? form.import_price.toLocaleString("vi-VN") : "")}
                    onFocus={() => setFocusedField("import_price")}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setForm(f => ({ ...f, import_price: autoK ? val * 1000 : val }));
                    }}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-bold font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-orange-500 uppercase tracking-widest block">Giá bán buôn (VNĐ)</label>
                    <button type="button" onClick={() => setAutoK(!autoK)}
                      className={cn("text-[10px] font-bold px-2 py-0.5 rounded transition-colors", autoK ? "bg-taika-blue text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500")}>
                      ×1k
                    </button>
                  </div>
                  <input
                    type={focusedField === "wholesale_price" ? "number" : "text"}
                    min={0}
                    value={focusedField === "wholesale_price" ? (autoK && form.wholesale_price > 0 ? form.wholesale_price / 1000 : form.wholesale_price || "") : (form.wholesale_price > 0 ? form.wholesale_price.toLocaleString("vi-VN") : "")}
                    onFocus={() => setFocusedField("wholesale_price")}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setForm(f => ({ ...f, wholesale_price: autoK ? val * 1000 : val }));
                    }}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 text-orange-700 dark:text-orange-300 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-bold font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-green-500 uppercase tracking-widest block">Giá bán lẻ (VNĐ)</label>
                    <button type="button" onClick={() => setAutoK(!autoK)}
                      className={cn("text-[10px] font-bold px-2 py-0.5 rounded transition-colors", autoK ? "bg-taika-blue text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500")}>
                      ×1k
                    </button>
                  </div>
                  <input
                    type={focusedField === "retail_price" ? "number" : "text"}
                    min={0}
                    value={focusedField === "retail_price" ? (autoK && form.retail_price > 0 ? form.retail_price / 1000 : form.retail_price || "") : (form.retail_price > 0 ? form.retail_price.toLocaleString("vi-VN") : "")}
                    onFocus={() => setFocusedField("retail_price")}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setForm(f => ({ ...f, retail_price: autoK ? val * 1000 : val }));
                    }}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-300 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-bold font-mono"
                  />
                </div>
              </div>

              {/* Description & Ingredients */}
              <div className="space-y-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <div>
                  <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1.5">{t("ingredients", "Thành phần")}</label>
                  <textarea
                    value={form.ingredients}
                    onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))}
                    placeholder="Ví dụ: Tôm sú, nước, muối..."
                    rows={2}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium resize-y"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1.5">{t("description", "Mô tả")}</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Mô tả chi tiết sản phẩm..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-taika-blue text-sm font-medium resize-y"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-0 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={onClose} className="px-6 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-taika-blue text-white rounded-xl font-bold text-sm hover:bg-taika-blue/90 shadow-lg shadow-taika-blue/20 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? t("loading") : isEdit ? t("save_changes") : t("add_product")}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
