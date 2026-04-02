import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import type { InboundShipment } from "../types/supabase";
import {
  ArrowDownLeft,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
} from "lucide-react";
import InboundWizard from "../components/activities/InboundWizard";

function getCurrentUserId(): string | null {
  try {
    const raw = localStorage.getItem("taika_session");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.user?.id || null;
    }
  } catch { /* ignore */ }
  return null;
}

export default function InboundView() {
  const { t } = useTranslation();
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => { fetchShipments(); }, []);

  async function fetchShipments() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inbound-shipments");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setShipments(data || []);
    } catch (err: any) {
      setError(err.message);
      toast.error("Lỗi tải dữ liệu phiếu nhập");
    }
    setLoading(false);
  }

  async function toggleDetail(id: string) {
    if (expandedId === id) { setExpandedId(null); setDetailItems([]); return; }
    setExpandedId(id);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/inbound-shipments/${id}`);
      const data = await res.json();
      setDetailItems(data.items || []);
    } catch { /* ignore */ }
    setLoadingDetail(false);
  }

  const filtered = shipments.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.supplier_name?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q);
  });

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Đang xử lý", color: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400", icon: Clock },
    completed: { label: "Hoàn tất", color: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400", icon: CheckCircle2 },
    cancelled: { label: "Đã hủy", color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400", icon: XCircle },
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
        <button onClick={fetchShipments} className="px-4 py-2 bg-taika-blue text-white rounded-xl text-sm font-bold">Thử lại</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Quản lý nhập kho</h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-1">Tạo phiếu, theo dõi và kiểm soát hàng nhập kho</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm phiếu nhập..."
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium shadow-sm text-neutral-900 dark:text-neutral-50" />
          </div>
          <button onClick={() => setShowWizard(true)}
            className="px-5 py-3 bg-taika-blue text-white rounded-2xl text-sm font-bold hover:bg-taika-blue/90 transition-all flex items-center gap-2 shadow-lg shadow-taika-blue/10 shrink-0">
            <Plus size={18} /> Tạo phiếu nhập
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tổng phiếu", value: shipments.length, color: "text-taika-blue", bg: "bg-blue-50 dark:bg-blue-500/10" },
          { label: "Hoàn tất", value: shipments.filter(s => s.status === "completed").length, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-500/10" },
          { label: "Đang xử lý", value: shipments.filter(s => s.status === "pending").length, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-500/10" },
          { label: "Tổng SL nhập", value: `${shipments.reduce((s, sh) => s + (sh.total_quantity || 0), 0).toLocaleString()} kg`, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={cn("p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800", stat.bg)}>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={cn("text-2xl font-black", stat.color)}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Shipments List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <Truck size={48} className="text-neutral-300 dark:text-neutral-600" />
          <p className="text-neutral-400 dark:text-neutral-500 font-medium">
            {search ? "Không tìm thấy phiếu nhập nào" : "Chưa có phiếu nhập nào. Hãy tạo phiếu nhập mới!"}
          </p>
          {!search && (
            <button onClick={() => setShowWizard(true)} className="px-6 py-2.5 bg-taika-blue text-white rounded-2xl text-sm font-bold flex items-center gap-2">
              <Plus size={16} /> Tạo phiếu nhập
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ship, i) => {
            const st = statusConfig[ship.status] || statusConfig.pending;
            const isExpanded = expandedId === ship.id;
            const StIcon = st.icon;
            return (
              <motion.div key={ship.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
                <div className="p-5 flex items-center gap-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                  onClick={() => toggleDetail(ship.id)}>
                  <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
                    <ArrowDownLeft size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1", st.color)}>
                        <StIcon size={10} /> {st.label}
                      </span>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 font-bold">#{ship.id.slice(0, 8)}</span>
                    </div>
                    <p className="font-bold text-neutral-900 dark:text-neutral-50 truncate">{ship.supplier_name || ship.suppliers?.name || "—"}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">
                      {new Date(ship.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {ship.profiles?.full_name && ` • ${ship.profiles.full_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Dòng SP</p>
                      <p className="text-lg font-black text-neutral-900 dark:text-neutral-50">{ship.item_count || 0}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">Tổng lượng</p>
                      <p className="text-lg font-black text-neutral-900 dark:text-neutral-50">{(ship.total_quantity || 0).toLocaleString()} <span className="text-xs font-medium text-neutral-400">kg</span></p>
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="text-neutral-400" /> : <ChevronDown size={18} className="text-neutral-400" />}
                  </div>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="border-t border-neutral-100 dark:border-neutral-800 px-5 py-4 bg-neutral-50/50 dark:bg-neutral-900/30">
                        {ship.notes && <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 italic">📝 {ship.notes}</p>}
                        {loadingDetail ? (
                          <div className="py-6 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-taika-blue" /></div>
                        ) : detailItems.length === 0 ? (
                          <p className="text-sm text-neutral-400 dark:text-neutral-500 py-4 text-center">Chưa có dòng sản phẩm nào.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                                  {["Sản phẩm", "Số lô", "SL (kg)", "HSD", "QC", "Kho", "Vị trí"].map(h => (
                                    <th key={h} className="pb-2 pr-4 text-left text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-50 dark:divide-neutral-900">
                                {detailItems.map((item: any) => (
                                  <tr key={item.id} className="hover:bg-white dark:hover:bg-neutral-950 transition-colors">
                                    <td className="py-2.5 pr-4">
                                      <p className="font-bold text-neutral-900 dark:text-neutral-50 text-xs">{item.products?.name || "—"}</p>
                                      <p className="text-[10px] text-neutral-400 font-mono">{item.products?.sku}</p>
                                    </td>
                                    <td className="py-2.5 pr-4 font-mono text-xs text-neutral-500 dark:text-neutral-400">{item.batches?.lot_number || "—"}</td>
                                    <td className="py-2.5 pr-4 font-bold text-xs text-neutral-900 dark:text-neutral-50">{Number(item.quantity).toLocaleString()}</td>
                                    <td className="py-2.5 pr-4 text-xs text-neutral-500">{item.batches?.expiry_date || "—"}</td>
                                    <td className="py-2.5 pr-4">
                                      <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-md",
                                        item.batches?.qc_status === "Pass" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                                          : item.batches?.qc_status === "Fail" ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                                          : "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                                      )}>{item.batches?.qc_status || "Hold"}</span>
                                    </td>
                                    <td className="py-2.5 pr-4 text-xs text-neutral-500 dark:text-neutral-400">{item.warehouses?.name || "—"}</td>
                                    <td className="py-2.5 text-xs font-mono font-bold text-taika-blue dark:text-blue-400">
                                      {item.storage_locations ? `${item.storage_locations.zone}-${item.storage_locations.rack}-${item.storage_locations.bin}` : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Wizard Modal */}
      <AnimatePresence>
        {showWizard && (
          <InboundWizard userId={getCurrentUserId()} onClose={() => setShowWizard(false)} onComplete={() => { setShowWizard(false); fetchShipments(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
