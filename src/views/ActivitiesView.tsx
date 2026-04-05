import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  Search,
  Loader2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  ClipboardCheck,
  Filter,
  Calendar,
  Activity,
} from "lucide-react";

interface ActivityRecord {
  id: string;
  type: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  batch_number: string | null;
  status: string;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
  products?: { name: string; sku: string } | null;
  warehouses?: { name: string } | null;
  to_warehouses?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  inbound: { label: "Nhập kho", icon: ArrowDownLeft, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-500/10" },
  outbound: { label: "Xuất kho", icon: ArrowUpRight, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
  transfer: { label: "Điều chuyển", icon: ArrowRightLeft, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10" },
  stocktake: { label: "Kiểm kê", icon: ClipboardCheck, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10" },
};

export default function ActivitiesView() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => { fetchActivities(); }, []);
  useEffect(() => { setCurrentPage(1); }, [search, filterType]);

  async function fetchActivities() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/activities");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setActivities(data || []);
    } catch (err: any) {
      setError(err.message);
      toast.error("Lỗi tải nhật ký hoạt động");
    }
    setLoading(false);
  }

  const filtered = activities.filter(a => {
    if (filterType !== "all" && a.type !== filterType) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.products?.name?.toLowerCase().includes(q) ||
      a.products?.sku?.toLowerCase().includes(q) ||
      a.batch_number?.toLowerCase().includes(q) ||
      a.notes?.toLowerCase().includes(q) ||
      a.warehouses?.name?.toLowerCase().includes(q) ||
      a.profiles?.full_name?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);

  const stats = {
    total: activities.length,
    inbound: activities.filter(a => a.type === "inbound").length,
    outbound: activities.filter(a => a.type === "outbound").length,
    transfer: activities.filter(a => a.type === "transfer").length,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-taika-blue" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">Đang tải...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{error}</p>
        <button onClick={fetchActivities} className="px-4 py-2 bg-taika-blue text-white rounded-xl text-sm font-bold">Thử lại</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("activities_log")}</h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-1">{t("activities_subtitle")}</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search_activities")}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium shadow-sm text-neutral-900 dark:text-neutral-50" />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("total_activities"), value: stats.total, color: "text-taika-blue", bg: "bg-blue-50 dark:bg-blue-500/10" },
          { label: t("inbound_type"), value: stats.inbound, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-500/10" },
          { label: t("outbound_type"), value: stats.outbound, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
          { label: t("transfer_type"), value: stats.transfer, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={cn("p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800", stat.bg)}>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={cn("text-2xl font-black", stat.color)}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-neutral-400 dark:text-neutral-500" />
        {[
          { key: "all", label: t("all") },
          { key: "inbound", label: t("inbound_type") },
          { key: "outbound", label: t("outbound_type") },
          { key: "transfer", label: t("transfer_type") },
          { key: "stocktake", label: t("stocktake_type") },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterType(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              filterType === f.key
                ? "bg-taika-blue text-white shadow-sm"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity Log Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <Activity size={48} className="text-neutral-300 dark:text-neutral-600" />
          <p className="text-neutral-400 dark:text-neutral-500 font-medium">
            {search || filterType !== "all" ? t("no_activities_found") : t("no_activities_recorded")}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50">
                  {[t("col_type"), t("col_product"), t("col_quantity"), t("col_batch"), t("col_warehouse"), t("col_performed_by"), t("col_notes"), t("col_time")].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 dark:divide-neutral-900">
                {currentItems.map((act, i) => {
                  const cfg = TYPE_CONFIG[act.type] || TYPE_CONFIG.inbound;
                  const Icon = cfg.icon;
                  
                  const handleRowClick = () => {
                    if (!act.notes) return;
                    const match = act.notes.match(/#([a-f0-9A-F]{8})/);
                    if (match && match[1]) {
                      const idPrefix = match[1];
                      if (act.type === "inbound") {
                        window.dispatchEvent(new CustomEvent("nav-shipment", { detail: { id: idPrefix } }));
                      } else if (act.type === "outbound") {
                        window.dispatchEvent(new CustomEvent("nav-order", { detail: { id: idPrefix } }));
                      }
                    }
                  };

                  return (
                    <motion.tr key={act.id}
                      onClick={handleRowClick}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className={cn("transition-colors", (act.type === "inbound" || act.type === "outbound") && act.notes?.includes("#") ? "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50" : "")}>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide", cfg.bg, cfg.color)}>
                          <Icon size={11} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-neutral-900 dark:text-neutral-50 text-xs">{act.products?.name || "—"}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">{act.products?.sku || ""}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-xs text-neutral-900 dark:text-neutral-50">
                        {Number(act.quantity).toLocaleString()} <span className="text-neutral-400 font-medium">kg</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500 dark:text-neutral-400">{act.batch_number || "—"}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                        {act.type === "transfer" && act.to_warehouses ? (
                          <div className="flex items-center gap-1.5 min-w-max">
                            <span className="truncate">{act.warehouses?.name || "—"}</span>
                            <ArrowRightLeft size={10} className="text-neutral-300 dark:text-neutral-600 shrink-0" />
                            <span className="font-medium text-taika-blue dark:text-blue-400 truncate">{act.to_warehouses.name}</span>
                          </div>
                        ) : (
                          act.warehouses?.name || "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">{act.profiles?.full_name || "—"}</td>
                      <td className="px-4 py-3 text-xs text-neutral-400 dark:text-neutral-500 max-w-[160px] truncate">{act.notes || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
                          <Calendar size={11} />
                          {new Date(act.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
              <span className="text-xs text-neutral-500 font-medium">
                Hiển thị {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filtered.length)} trên tổng {filtered.length} bản ghi
              </span>
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => p - 1)} 
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Trước
                </button>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-taika-blue dark:text-blue-400 px-2">{currentPage}</span>
                  <span className="text-xs font-medium text-neutral-400">/</span>
                  <span className="text-xs font-medium text-neutral-500 px-2">{totalPages}</span>
                </div>
                <button 
                  disabled={currentPage === totalPages} 
                  onClick={() => setCurrentPage(p => p + 1)} 
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
