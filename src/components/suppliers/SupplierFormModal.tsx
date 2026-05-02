import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { X, Loader2, Tag, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import type { Supplier } from "../../types/supabase";

interface SupplierFormModalProps {
  supplier?: Supplier | null; // null = create, object = edit
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Component hiển thị cửa sổ bật lên để tạo mới hoặc thay đổi thông tin một nhà cung cấp
 * Đồng bộ hóa với việc liên kết danh mục nhà cung cấp
 *
 * @param {SupplierFormModalProps} props - Thuộc tính component
 * @returns {JSX.Element} Cửa sổ khai báo thông tin Nhà cung cấp
 */
export default function SupplierFormModal({ supplier, onClose, onSaved }: SupplierFormModalProps) {
  const { t } = useTranslation();
  const isEdit = !!supplier;

  const [form, setForm] = useState({
    name: supplier?.name || "",
    bank_name: supplier?.bank_name || "",
    bank_account: supplier?.bank_account || "",
    email: supplier?.email || "",
    address: supplier?.address || "",
    website: supplier?.website || "",
    notes: supplier?.notes || "",
    status: supplier?.status || "active",
  });
  const [contacts, setContacts] = useState<{name: string, number: string}[]>(() => {
    if (!supplier?.phone) return [{name: "", number: ""}];
    return supplier.phone.split(',').map(s => {
      const parts = s.split(':');
      if (parts.length > 1) {
        return { name: parts[0].trim(), number: parts.slice(1).join(':').trim() };
      }
      return { name: "", number: s.trim() };
    });
  });
  const [saving, setSaving] = useState(false);

  // Liên kết danh mục (Category linking)
  const [allCategories, setAllCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>(() => {
    const initialCats = (supplier as any)?.categories || [];
    return initialCats.map((c: any) => c.id);
  });

  useEffect(() => {
    const safeFetch = async (url: string) => {
      try {
        const r = await fetch(url);
        const text = await r.text();
        return JSON.parse(text);
      } catch { return null; }
    };

    // Tải danh sách danh mục có sẵn
    safeFetch("/api/categories").then(cats => setAllCategories(cats || []));
  }, []);

  const toggleCategory = (id: string) => {
    setSelectedCatIds(prev => 
      prev.includes(id) ? prev.filter(catId => catId !== id) : [...prev, id]
    );
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Xử lý xác nhận và gửi dữ liệu thông tin tới máy chủ API
   * @async
   */
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error(t("supplier_name") + " is required");
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/suppliers/${supplier!.id}` : "/api/suppliers";
      const method = isEdit ? "PUT" : "POST";
      const validContacts = contacts.filter(c => c.number.trim() !== "");
      const formattedPhones = validContacts.map(c => c.name.trim() ? `${c.name.trim()}: ${c.number.trim()}` : c.number.trim()).join(", ");
      
      const finalForm = {
        ...form,
        phone: formattedPhones || null
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const saved = await res.json();
      const supplierId = saved.id || supplier?.id;

      // Đồng bộ danh mục tương ứng với nhà cung cấp
      if (supplierId) {
        const curRes = await fetch(`/api/suppliers/${supplierId}/categories`);
        const curCats: any[] = curRes.ok ? await curRes.json() : [];
        const curIds = curCats.map((c: any) => c.id);

        for (const id of selectedCatIds) {
          if (!curIds.includes(id)) {
            await fetch(`/api/suppliers/${supplierId}/categories`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ category_id: id }),
            });
          }
        }
        for (const id of curIds) {
          if (!selectedCatIds.includes(id)) {
            await fetch(`/api/suppliers/${supplierId}/categories/${id}`, { method: "DELETE" });
          }
        }
      }

      toast.success(isEdit ? t("supplier_updated") : t("supplier_created"));
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  // Đóng Form khi nhấn phím Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const statusOptions = [
    { value: "active", label: t("status_active") },
    { value: "pending", label: t("status_pending") },
    { value: "inactive", label: t("status_inactive") },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white dark:bg-neutral-950 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Phần Tiêu đề */}
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            {isEdit ? t("edit_supplier") : t("add_supplier")}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-400">
            <X size={20} />
          </button>
        </div>

        {/* Biểu mẫu cập nhật */}
        <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {/* Tên nhà cung cấp */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
              {t("supplier_name")} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Mekong Delta Seafood Co."
              className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
            />
          </div>

          {/* Cụm thông tin chia 2 cột */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Bank Info */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                {t("bank_name", "Tên Ngân hàng")}
              </label>
              <input
                type="text"
                value={form.bank_name}
                onChange={(e) => handleChange("bank_name", e.target.value)}
                placeholder="VD: Vietcombank, MB Bank"
                className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                {t("bank_account", "Số tài khoản")}
              </label>
              <input
                type="text"
                value={form.bank_account}
                onChange={(e) => handleChange("bank_account", e.target.value)}
                placeholder="02319203912..."
                className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all font-mono"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="contact@supplier.com"
                className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                {t("address")}
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="123 Trần Hưng Đạo, Cần Thơ"
                className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
              />
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                {t("website", "Link Website")}
              </label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="https://example.com"
                className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all font-mono"
              />
            </div>
            
            {/* Multiple Contacts (Name & Phone) */}
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  {t("phone_number", "LIÊN HỆ & SỐ ĐIỆN THOẠI")}
                </label>
                <button
                  type="button"
                  onClick={() => setContacts([...contacts, {name: "", number: ""}])}
                  className="text-[10px] font-bold text-taika-blue hover:underline flex items-center gap-1 uppercase tracking-widest"
                >
                  <Plus size={12} /> Thêm người
                </button>
              </div>
              <div className="space-y-2">
                {contacts.map((contact, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <input
                      type="text"
                      value={contact.name}
                      onChange={(e) => {
                        const newContacts = [...contacts];
                        newContacts[idx].name = e.target.value;
                        setContacts(newContacts);
                      }}
                      placeholder="Tên (VD: Ms Oanh)"
                      className="w-full sm:w-1/3 p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
                    />
                    <div className="flex flex-1 w-full gap-2 items-center">
                      <input
                        type="text"
                        value={contact.number}
                        onChange={(e) => {
                          const newContacts = [...contacts];
                          newContacts[idx].number = e.target.value;
                          setContacts(newContacts);
                        }}
                        placeholder="Số điện thoại"
                        className="flex-1 p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
                      />
                      {contacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setContacts(contacts.filter((_, i) => i !== idx))}
                          className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
              {t("notes", "Ghi chú")}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Ghi chú thêm về nhà cung cấp..."
              rows={2}
              className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all resize-none"
            />
          </div>

          {/* Bộ chọn danh mục nhiều lựa chọn (Categories multi-select) */}
          {allCategories.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                <Tag size={11} /> {t("supplier_categories", "Chuyên cung cấp danh mục")}
              </label>
              <div className="flex flex-wrap gap-2">
                {allCategories.map(cat => {
                  const selected = selectedCatIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                        selected
                          ? "bg-taika-blue text-white border-taika-blue shadow-md shadow-taika-blue/20"
                          : "bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-taika-blue/40 hover:text-taika-blue dark:hover:text-blue-400"
                      )}
                    >
                      {selected && <Check size={11} />}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
              {t("status")}
            </label>
            <div className="flex gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleChange("status", opt.value)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border",
                    form.status === opt.value
                      ? opt.value === "active"
                        ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30"
                        : opt.value === "pending"
                        ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30"
                        : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30"
                      : "bg-neutral-50 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-500 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Phần điều khiển dưới */}
        <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 rounded-xl font-bold text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name.trim()}
            className="px-6 py-2.5 bg-taika-blue text-white rounded-xl font-bold text-sm hover:bg-taika-blue/90 shadow-lg shadow-taika-blue/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isEdit ? t("save_changes") : t("add_supplier")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
