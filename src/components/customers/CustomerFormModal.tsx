import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import type { Customer } from "../../types/supabase";

interface CustomerFormModalProps {
  customer?: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Component hiển thị cửa sổ bật lên để tạo mới hoặc cập nhật một Khách hàng
 *
 * @param {CustomerFormModalProps} props - Thuộc tính component
 * @returns {JSX.Element} Cửa sổ khai báo khách hàng
 */
export default function CustomerFormModal({ customer, onClose, onSaved }: CustomerFormModalProps) {
  const { t } = useTranslation();
  const isEdit = !!customer;

  const [form, setForm] = useState({
    name: customer?.name || "",
    contact_person: customer?.contact_person || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    address: customer?.address || "",
    status: customer?.status || "active",
    notes: customer?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  /** Cập nhật giá trị một trường của form */
  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Xử lý xác nhận và gửi dữ liệu thông tin khách hàng tới máy chủ API
   * @async
   */
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error(t("customer_name") + " is required");
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/customers/${customer!.id}` : "/api/customers";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success(isEdit ? t("customer_updated") : t("customer_created"));
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

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
        className="relative bg-white dark:bg-neutral-950 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Phần Tiêu đề */}
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            {isEdit ? t("edit_customer") : t("add_customer")}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-neutral-400">
            <X size={20} />
          </button>
        </div>

        {/* Biểu mẫu cập nhật */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Tên khách hàng */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
              {t("customer_name")} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Aeon Mall Vietnam"
              className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
            />
          </div>

          {/* Liên hệ & Số điện thoại */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                {t("contact_person")}
              </label>
              <input
                type="text"
                value={form.contact_person}
                onChange={(e) => handleChange("contact_person", e.target.value)}
                placeholder="Nguyễn Văn B"
                className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                {t("phone_number")}
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+84 987 654 321"
                className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
              />
            </div>
          </div>

          {/* Địa chỉ Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="order@customer.com"
              className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
            />
          </div>

          {/* Địa chỉ */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
              {t("address")}
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="30 Bờ Bao Tân Thắng, Q. Tân Phú, TP.HCM"
              className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all"
            />
          </div>

          {/* Ghi chú */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
              {t("notes")}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder={t("notes_placeholder")}
              rows={2}
              className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-medium text-sm text-neutral-900 dark:text-neutral-50 transition-all resize-none"
            />
          </div>

          {/* Trạng thái */}
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
            className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 shadow-lg shadow-orange-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isEdit ? t("save_changes") : t("add_customer")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
