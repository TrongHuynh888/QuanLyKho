import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { ArrowLeft, Users, Phone, Mail, MapPin, Clock, CheckCircle2, XCircle, Search, Loader2, FileText, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import type { Customer } from "../types/supabase";

interface CustomerDetailViewProps {
  customerId: string;
  onBack: () => void;
}

/**
 * Giao diện hiển thị chi tiết khách hàng và lịch sử đơn hàng của họ.
 * @param customerId ID của khách hàng
 * @param onBack Hàm callback khi bấm nút quay về danh sách
 */
export default function CustomerDetailView({ customerId, onBack }: CustomerDetailViewProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<{ customer: Customer; orders: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchDetail(); }, [customerId]);

  /**
   * Lấy dữ liệu chi tiết của khách hàng và lịch sử đơn hàng từ server.
   */
  async function fetchDetail() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      if (!res.ok) throw new Error("Could not fetch customer details");
      const d = await res.json();
      setData({ customer: d, orders: d.orders || [] });
    } catch (err: any) {
      setError(err.message);
      toast.error(t("error_loading_data"));
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{t("loading")}...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500 font-medium">{error || t("error_loading_data")}</p>
        <button onClick={onBack} className="px-4 py-2 bg-neutral-100 rounded-xl font-bold">{t("back")}</button>
      </div>
    );
  }

  const { customer, orders } = data;

  const filteredOrders = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.id.toLowerCase().includes(q) || o.notes?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q);
  });

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: t("pending"), color: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400", icon: Clock },
    processing: { label: "Processing", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400", icon: Package },
    shipped: { label: "Shipped", color: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400", icon: FileText },
    completed: { label: t("completed"), color: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400", icon: CheckCircle2 },
    cancelled: { label: t("cancelled"), color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400", icon: XCircle },
  };

  return (
    <div className="space-y-6">
      {/* Phần đầu trang */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-3">
            {customer.name}
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md",
              customer.status === "active" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" :
                customer.status === "pending" ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                  "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
            )}>
              {customer.status === "active" ? t("status_active") : customer.status === "pending" ? t("status_pending") : t("status_inactive")}
            </span>
          </h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-1">{t("customer_detail")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thẻ thông tin khách hàng */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-neutral-950 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <h4 className="font-bold text-neutral-900 dark:text-neutral-50 mb-6 flex items-center gap-2">
              <Users size={18} className="text-orange-500" /> {t("customer_info")}
            </h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center text-neutral-400 shrink-0">
                  <span className="font-bold text-xs">{customer.contact_person?.[0]?.toUpperCase() || "—"}</span>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("contact_person")}</p>
                  <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">{customer.contact_person || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-neutral-400 w-8" />
                <div className="flex-1">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("phone_number")}</p>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-50 text-sm">{customer.phone || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-neutral-400 w-8" />
                <div className="flex-1">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Email</p>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-50 text-sm break-all">{customer.email || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-neutral-400 w-8 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("address")}</p>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-50 text-sm line-clamp-3">{customer.address || "—"}</p>
                </div>
              </div>
              {customer.notes && (
                <div className="flex items-start gap-3">
                  <FileText size={16} className="text-neutral-400 w-8 mt-1" />
                  <div className="flex-1">
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("notes")}</p>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-50 text-sm line-clamp-3">{customer.notes}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
               <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">{t("created_at")}: {new Date(customer.created_at).toLocaleDateString()}</p>
            </div>
          </motion.div>

           {/* Tóm tắt thống kê */}
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-4">
              <div className="bg-orange-50 dark:bg-orange-500/10 p-5 rounded-3xl border border-orange-100 dark:border-orange-500/20">
                <p className="text-[10px] font-black text-orange-400/80 uppercase tracking-widest mb-1">{t("order_count")}</p>
                <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{orders.length}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-500/10 p-5 rounded-3xl border border-purple-100 dark:border-purple-500/20">
                <p className="text-[10px] font-black text-purple-400/80 uppercase tracking-widest mb-1">{t("total_ordered_qty")}</p>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
                  {orders.reduce((sum: number, o: any) => sum + (o.total_quantity || 0), 0).toLocaleString()} <span className="text-xs font-semibold">kg</span>
                </p>
              </div>
           </motion.div>
        </div>

        {/* Lịch sử đơn hàng */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h4 className="font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
                <Clock size={18} className="text-orange-500" /> {t("order_history")}
              </h4>
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                 <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")} className="pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-xs font-medium w-48" />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                   <Users size={40} className="mb-3 opacity-20" />
                   <p className="text-sm font-medium">{search ? t("no_customers_found") : t("no_orders_yet")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredOrders.map((order: any, i: number) => {
                    const st = statusConfig[order.status] || statusConfig.pending;
                    const StIcon = st.icon;
                    return (
                      <motion.div key={order.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between p-4 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors border border-transparent hover:border-neutral-100 dark:hover:border-neutral-800">
                        <div className="flex items-center gap-4">
                           <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", st.color)}>
                             <StIcon size={18} />
                           </div>
                           <div>
                              <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm flex items-center gap-2">
                                #{order.id.slice(0,8)}
                                <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded", st.color)}>{st.label}</span>
                              </p>
                              <p className="text-xs text-neutral-400 font-medium mt-0.5">{new Date(order.created_at).toLocaleDateString()}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-black text-neutral-900 dark:text-neutral-50 text-base">{(order.total_quantity || 0).toLocaleString()} <span className="text-xs text-neutral-400">kg</span></p>
                           <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">{order.item_count || 0} {t("items_count")}</p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
