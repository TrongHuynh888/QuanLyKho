import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
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
  Package,
  X,
  FileText,
  Printer
} from "lucide-react";
import OutboundWizard from "../components/activities/OutboundWizard";
import PrintOutboundReceipt from "../components/activities/PrintOutboundReceipt";
import { useAuth } from "../contexts/AuthContext";
/**
 * Component hiển thị giao diện quản lý Phiếu xuất kho
 * Bao gồm danh sách các phiếu xuất, tổng quan thống kê và tìm kiếm/lọc
 *
 * @returns {JSX.Element} Giao diện quản lý Phiếu xuất kho
 */
export default function OutboundView() {
  const { user, hasRole } = useAuth();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending" | "cancelled" | "shipped">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [initialScanData, setInitialScanData] = useState<any[] | undefined>();
  const [printingReceipt, setPrintingReceipt] = useState<{ order: any, items: any[] } | null>(null);

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    const handleFocus = (prefix: string) => {
      if (!prefix) return;
      const target = orders.find((o: any) => o.id.startsWith(prefix));
      if (target && expandedId !== target.id) {
        toggleDetail(target.id);
        // Cuộn màn hình tới thẻ đơn hàng một cách mượt mà
        setTimeout(() => {
          document.getElementById(`order-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };

    const pending = (window as any).__pendingOrderNav;
    if (pending && orders.length > 0) {
      handleFocus(pending);
      delete (window as any).__pendingOrderNav;
    }

    const pendingScan = (window as any).__pendingScannedItems;
    if (pendingScan) {
      setInitialScanData(pendingScan);
      setShowWizard(true);
      delete (window as any).__pendingScannedItems;
    }

    const onEvent = (e: any) => {
      if (e.detail?.id && orders.length > 0) {
        handleFocus(e.detail.id);
      }
    };
    
    window.addEventListener("focus-order", onEvent);
    return () => window.removeEventListener("focus-order", onEvent);
  }, [orders, expandedId]);

  /**
   * Lấy danh sách phiếu xuất kho từ hệ thống
   * @async
   */
  async function fetchOrders() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/outbound-orders");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message);
      toast.error("Lỗi tải dữ liệu phiếu xuất");
    }
    setLoading(false);
  }

  /**
   * Xem chi tiết một phiếu xuất kho
   * Mở rộng thẻ và tải danh sách sản phẩm bên trong phiếu xuất
   *
   * @async
   * @param {string} id - ID của phiếu xuất kho
   */
  async function toggleDetail(id: string) {
    if (expandedId === id) { setExpandedId(null); setDetailItems([]); return; }
    setExpandedId(id);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/outbound-orders/${id}`);
      const data = await res.json();
      setDetailItems(data.items || []);
    } catch { /* bỏ qua lỗi */ }
    setLoadingDetail(false);
  }

  const filtered = orders
    .filter(o => {
      const matchSearch = !search || [
        o.customer_name, o.id, o.notes, o.creator_name, o.shipping_address
      ].some(v => v?.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = filterStatus === "all" || o.status === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? tb - ta : ta - tb;
    });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, sortOrder]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: t("processing", "Đang xử lý"), color: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400", icon: Clock },
    completed: { label: t("completed", "Hoàn tất"), color: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400", icon: CheckCircle2 },
    shipped: { label: "Đã giao", color: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400", icon: Truck },
    cancelled: { label: t("cancelled", "Đã hủy"), color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400", icon: XCircle },
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{t("loading", "Đang tải...")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{error}</p>
        <button onClick={fetchOrders} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold">{t("retry", "Thử lại")}</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Phần tiêu đề */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("outbound_management")}</h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-1">{t("outbound_subtitle")}</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search_outbound_receipt", "Tìm phiếu xuất")}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-medium shadow-sm text-neutral-900 dark:text-neutral-50" />
          </div>
          {hasRole("admin", "manager") && (
            <button onClick={() => setShowWizard(!showWizard)}
              className={cn(
                "px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shrink-0",
                showWizard
                  ? "bg-neutral-600 text-white hover:bg-neutral-700 shadow-neutral-600/10"
                  : "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20"
              )}>
              {showWizard ? <X size={18} /> : <Plus size={18} />} {showWizard ? "Đóng" : t("create_outbound")}
            </button>
          )}
        </div>
      </div>

      {/* Thống kê */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("total_outbound"), value: orders.length, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
          { label: t("completed"), value: orders.filter(o => o.status === "completed").length, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-500/10" },
          { label: t("processing"), value: orders.filter(o => o.status === "pending").length, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-500/10" },
          { label: t("total_outbound_qty"), value: orders.reduce((sum, o) => sum + (o.total_quantity || 0), 0) + " kg", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={cn("p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800", stat.bg)}>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={cn("text-2xl font-black", stat.color)}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Cửa sổ bật lên trực tiếp */}
      <AnimatePresence>
        {showWizard && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="py-2">
              <OutboundWizard userId={user?.id || null} inline initialScannedItems={initialScanData} onClose={() => { setShowWizard(false); setInitialScanData(undefined); }} onComplete={() => { setShowWizard(false); setInitialScanData(undefined); fetchOrders(); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Danh sách dữ liệu */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2">
            {(["all", "pending", "completed", "shipped"] as const).map(status => (
              <button key={status} onClick={() => setFilterStatus(status)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize",
                  filterStatus === status ? "bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-neutral-100" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}>
                {status === "all" ? t("all") : statusConfig[status]?.label}
              </button>
            ))}
          </div>
          <button onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-bold text-neutral-600 dark:text-neutral-300">
            {t("sort_by_date", "Ngày")} {sortOrder === "desc" ? "↓" : "↑"}
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
              <FileText size={24} className="text-neutral-400" />
            </div>
            <p className="text-neutral-900 dark:text-neutral-50 font-bold mb-1">Không thấy đơn hàng</p>
            <p className="text-sm text-neutral-500">Chưa có đơn hàng nào khớp tìm kiếm hoặc chưa tạo phiếu xuất</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {currentItems.map(order => {
              const st = statusConfig[order.status] || { label: order.status, color: "bg-neutral-100 text-neutral-500", icon: Package };
              const isExpanded = expandedId === order.id;

              return (
                <div key={order.id} id={"order-" + order.id} className="group">
                  <div className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors flex items-center gap-4 cursor-pointer" onClick={() => toggleDetail(order.id)}>
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                      <Truck size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-neutral-900 dark:text-neutral-50">{order.customer_name}</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1", st.color)}>
                          <st.icon size={12} /> {st.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium">
                        <span>{new Date(order.created_at).toLocaleString("vi-VN")}</span>
                        <span>•</span>
                        <span>{order.item_count || 0} Dòng SP</span>
                        <span>•</span>
                        <span>Khối lượng: <span className="text-neutral-900 dark:text-neutral-100 font-bold">{order.total_quantity || 0} kg</span></span>
                      </div>
                    </div>
                    <div className="text-right mr-4 hidden md:block">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Tạo bởi</p>
                      <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{order.creator_name || "Trống"}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-400 group-hover:bg-white dark:group-hover:bg-neutral-800 transition-colors">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/30 border-t border-neutral-100 dark:border-neutral-800">
                          <div className="mb-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Mã tham chiếu</p>
                              <p className="text-xs font-mono font-medium text-neutral-900 dark:text-neutral-50">{order.id}</p>
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Giao hàng đến</p>
                              <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 rounded-lg">{order.shipping_address || "Giao tại xưởng (Mặc định)"}</p>
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Ghi chú</p>
                              <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{order.notes || "Không có"}</p>
                            </div>
                            <div className="shrink-0 flex items-end">
                                <button 
                                  onClick={() => setPrintingReceipt({ order, items: detailItems })} 
                                  className="px-4 py-2 bg-neutral-600 dark:bg-neutral-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 hover:bg-neutral-700 dark:hover:bg-neutral-600 transition"
                                >
                                  <Printer size={14} /> IN PHIẾU XUẤT
                                </button>
                            </div>
                          </div>

                          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                            {loadingDetail ? (
                              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
                            ) : (
                              <table className="w-full text-left">
                                <thead className="bg-neutral-50 dark:bg-neutral-900/50">
                                  <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Sản phẩm</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Số lô (FEFO)</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-right">SL Xuất</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                  {detailItems.map(item => (
                                    <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors">
                                      <td className="px-4 py-3 border-r border-neutral-100 dark:border-neutral-800 lg:border-none">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 overflow-hidden border border-neutral-200 dark:border-neutral-700">
                                            {item.products?.image_url ? (
                                              <img src={item.products.image_url} alt={item.products.name} className="w-full h-full object-cover" />
                                            ) : (
                                              <Package size={14} className="text-neutral-500" />
                                            )}
                                          </div>
                                          <div>
                                            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{item.products?.name}</p>
                                            <p className="text-[10px] font-medium text-neutral-500 mt-0.5">{item.products?.sku} • {item.products?.categories?.name}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{item.batches?.lot_number || "---"}</span>
                                          {item.batches?.expiry_date && (
                                            <span className="text-[10px] font-medium text-neutral-500">
                                              HSD: {new Date(item.batches.expiry_date).toLocaleDateString("vi-VN")}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <span className="text-sm font-black text-orange-600 dark:text-orange-400">{item.quantity_allocated}</span>
                                      </td>
                                    </tr>
                                  ))}
                                  {detailItems.length === 0 && (
                                    <tr>
                                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-neutral-500 font-medium">
                                        Không có chi tiết sản phẩm.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
        {totalPages > 1 && (
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-950">
            <span className="text-xs text-neutral-500 font-medium">
              Hiển thị {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filtered.length)} trên tổng {filtered.length} phiếu
            </span>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)} 
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Trước
              </button>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 px-2">{currentPage}</span>
                <span className="text-xs font-medium text-neutral-400">/</span>
                <span className="text-xs font-medium text-neutral-500 px-2">{totalPages}</span>
              </div>
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)} 
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal In Phiếu Xuất Kho */}
      <AnimatePresence>
        {printingReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-white dark:bg-neutral-950 text-black dark:text-white flex flex-col">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-900 print:hidden">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">In Phiếu Xuất Kho</h3>
              <div className="flex gap-4">
                <button onClick={() => setPrintingReceipt(null)} className="px-5 py-2.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-bold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition">Đóng</button>
                <button onClick={() => window.print()} className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-500/20">
                  <Printer size={18} /> IN PHIẾU
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-neutral-200 dark:bg-neutral-800 p-8 flex flex-col items-center print:p-0 print:bg-white print:block custom-scrollbar pt-12">
              <div className="print-container">
                <PrintOutboundReceipt order={printingReceipt.order} items={printingReceipt.items} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
