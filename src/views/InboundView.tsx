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
  FileText,
  ShieldCheck,
  Package,
  MapPin,
  X,
  Printer,
} from "lucide-react";
import InboundWizard from "../components/activities/InboundWizard";
import BarcodeLabel from "../components/activities/BarcodeLabel";
import PrintInboundReceipt from "../components/activities/PrintInboundReceipt";
import { useAuth } from "../contexts/AuthContext";
/**
 * Giao diện Quản lý phiếu nhập kho (Inbound).
 * Quản lý danh sách các phiếu nhập, hiển thị chi tiết, và cho phép tạo mới qua wizard.
 */
export default function InboundView() {
  const { user, hasRole } = useAuth();
  const { t } = useTranslation();
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending" | "cancelled">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [initialScanData, setInitialScanData] = useState<any[] | undefined>();
  const [printingBatch, setPrintingBatch] = useState<{ items: any[], creatorName?: string } | null>(null);
  const [printingReceipt, setPrintingReceipt] = useState<{ shipment: any, items: any[] } | null>(null);

  useEffect(() => { 
    fetchShipments(); 
    (window as any).__setPrintingBatch = setPrintingBatch;
    
    // Nhận keyword từ global search header
    const pending = (window as any).__globalSearchKeyword;
    if (pending) {
      setSearch(pending);
      delete (window as any).__globalSearchKeyword;
    }
    
    const handleGlobalSearch = (e: any) => {
      if (e.detail?.keyword) setSearch(e.detail.keyword);
    };
    window.addEventListener("global-search", handleGlobalSearch);
    
    return () => {
      delete (window as any).__setPrintingBatch;
      window.removeEventListener("global-search", handleGlobalSearch);
    };
  }, []);

  useEffect(() => {
    const handleFocus = (prefix: string) => {
      if (!prefix) return;
      const target = shipments.find((s: any) => s.id.startsWith(prefix));
      if (target && expandedId !== target.id) {
        toggleDetail(target.id);
        // Cuộn mượt mà đến thẻ
        setTimeout(() => {
          document.getElementById(`shipment-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };

    const pending = (window as any).__pendingShipmentNav;
    if (pending && shipments.length > 0) {
      handleFocus(pending);
      delete (window as any).__pendingShipmentNav;
    }

    const pendingScan = (window as any).__pendingScannedItems;
    if (pendingScan) {
      setInitialScanData(pendingScan);
      setShowWizard(true);
      delete (window as any).__pendingScannedItems;
    }

    const onEvent = (e: any) => {
      if (e.detail?.id && shipments.length > 0) {
        handleFocus(e.detail.id);
      }
    };
    
    window.addEventListener("focus-shipment", onEvent);
    return () => window.removeEventListener("focus-shipment", onEvent);
  }, [shipments, expandedId]);

  /**
   * Gọi API để tải toàn bộ danh sách phiếu nhập.
   */
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

  /**
   * Chuyển đổi trạng thái mở rộng để xem chi tiết phiếu nhập.
   * @param id Mã phiếu nhập
   */
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

  const filtered = shipments
    .filter(s => {
      if (!search.trim()) {
        return filterStatus === "all" || s.status === filterStatus;
      }
      // Tách nhiều từ khóa theo dấu phẩy hoặc khoảng trắng, bỏ phần rỗng
      const keywords = search.toLowerCase().split(/[,\s]+/).filter(k => k.length > 0);
      const text = (s as any).search_text || "";
      // AND logic: phải khớp TẤT CẢ từ khóa → nhập càng nhiều càng chính xác
      const matchSearch = keywords.every(kw => text.includes(kw));
      const matchStatus = filterStatus === "all" || s.status === filterStatus;
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
    cancelled: { label: t("cancelled", "Đã hủy"), color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400", icon: XCircle },
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-taika-blue" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{t("loading", "Đang tải...")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{error}</p>
        <button onClick={fetchShipments} className="px-4 py-2 bg-taika-blue text-white rounded-xl text-sm font-bold">{t("retry", "Thử lại")}</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tiêu đề */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("inbound_management")}</h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-1">{t("inbound_subtitle")}</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search_receipt")}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium shadow-sm text-neutral-900 dark:text-neutral-50" />
          </div>
          {hasRole("admin", "manager") && (
            <button onClick={() => setShowWizard(!showWizard)}
              className={cn(
                "px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shrink-0",
                showWizard
                  ? "bg-neutral-600 text-white hover:bg-neutral-700 shadow-neutral-600/10"
                  : "bg-taika-blue text-white hover:bg-taika-blue/90 shadow-taika-blue/10"
              )}>
              {showWizard ? <X size={18} /> : <Plus size={18} />} {showWizard ? "Đóng phiếu" : t("create_receipt")}
            </button>
          )}
        </div>
      </div>

      {/* Thống kê */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("total_receipts"), value: shipments.length, color: "text-taika-blue", bg: "bg-blue-50 dark:bg-blue-500/10" },
          { label: t("completed"), value: shipments.filter(s => s.status === "completed").length, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-500/10" },
          { label: t("processing"), value: shipments.filter(s => s.status === "pending").length, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-500/10" },
          { label: t("total_inbound_qty"), value: `${shipments.reduce((s, sh) => s + (sh.total_quantity || 0), 0).toLocaleString()} kg`, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={cn("p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800", stat.bg)}>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={cn("text-2xl font-black", stat.color)}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Quy trình nhập kho */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6">
        <h4 className="text-sm font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest mb-6">
          {t("inbound_process", "Quy trình nhập kho")}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: FileText, title: t("create_receipt"), desc: t("create_receipt_desc", "Chọn nhà cung cấp, tạo phiếu và nhập ghi chú") },
            { icon: Package, title: t("add_products", "Thêm sản phẩm"), desc: t("add_products_desc", "Khai báo sản phẩm, số lô, khối lượng và HSD") },
            { icon: ShieldCheck, title: t("qc_check"), desc: t("qc_inbound_desc", "Kiểm tra chất lượng trước khi đưa vào kho") },
            { icon: MapPin, title: t("put_away", "Xếp vào vị trí"), desc: t("put_away_desc", "Phân bổ vào vị trí kho theo zone, rack, bin") },
          ].map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
              className="p-5 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 relative group hover:border-taika-blue/30 dark:hover:border-blue-500/30 transition-all">
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-taika-blue/10 dark:bg-blue-500/20 flex items-center justify-center text-taika-blue dark:text-blue-400 text-[10px] font-black">
                {i + 1}
              </div>
              <div className="w-10 h-10 rounded-xl bg-taika-blue/10 dark:bg-blue-500/20 flex items-center justify-center text-taika-blue dark:text-blue-400 mb-3">
                <step.icon size={20} />
              </div>
              <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm mb-1">{step.title}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cửa sổ nhập kho thu gọn */}
      <AnimatePresence>
        {showWizard && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
            <InboundWizard
              userId={user?.id || null}
              inline
              initialScannedItems={initialScanData}
              onClose={() => { setShowWizard(false); setInitialScanData(undefined); }}
              onComplete={() => { setShowWizard(false); setInitialScanData(undefined); fetchShipments(); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thanh bộ lọc */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 px-5 py-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Các tab trạng thái */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { key: "all", label: t("all") },
            { key: "completed", label: t("completed") },
            { key: "pending", label: t("processing") },
            { key: "cancelled", label: t("cancelled") },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                filterStatus === tab.key
                  ? "bg-taika-blue text-white shadow-md shadow-taika-blue/20"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1.5 opacity-70">
                  ({shipments.filter(s => s.status === tab.key).length})
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Sắp xếp */}
        <button
          onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all shrink-0"
        >
          {sortOrder === "desc" ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          {sortOrder === "desc" ? t("newest_first", "Mới nhất") : t("oldest_first", "Cũ nhất")}
        </button>
      </div>

      {/* Danh sách phiếu nhập */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <Truck size={48} className="text-neutral-300 dark:text-neutral-600" />
          <p className="text-neutral-400 dark:text-neutral-500 font-medium">
            {search ? t("no_inbound_search", "Không tìm thấy phiếu nhập nào") : t("no_inbound_yet", "Chưa có phiếu nhập nào. Hãy tạo phiếu nhập mới!")}
          </p>
          {!search && hasRole("admin", "manager") && (
            <button onClick={() => setShowWizard(true)} className="px-6 py-2.5 bg-taika-blue text-white rounded-2xl text-sm font-bold flex items-center gap-2">
              <Plus size={16} /> {t("create_receipt")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {currentItems.map((ship, i) => {
            const st = statusConfig[ship.status] || statusConfig.pending;
            const isExpanded = expandedId === ship.id;
            const StIcon = st.icon;
            return (
              <motion.div key={ship.id} id={"shipment-" + ship.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
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
                      {ship.creator_name && ` • ${ship.creator_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{t("product_lines")}</p>
                      <p className="font-bold text-neutral-900 dark:text-neutral-50">{ship.item_count || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{t("total_weight")}</p>
                      <p className="font-bold text-neutral-900 dark:text-neutral-50">{ship.total_quantity || 0} kg</p>
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
                          <div className="space-y-3">
                            {detailItems.map((item: any, idx: number) => {
                              const costTotal = (Number(item.cost_price) || 0) * (Number(item.quantity) || 0);
                              const taxAmt = costTotal * ((Number(item.tax_rate) || 0) / 100);
                              const totalLine = costTotal + taxAmt + (Number(item.import_fee) || 0);
                              return (
                                <div key={item.id} className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-950 space-y-3">
                                  {/* Tiêu đề dòng sản phẩm */}
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center overflow-hidden shrink-0 border border-green-200 dark:border-green-900/50">
                                      {item.products?.image_url ? (
                                        <img src={item.products.image_url} alt={item.products.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-green-600 dark:text-green-400 text-xs font-bold">{idx + 1}</span>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{item.products?.name || "—"}</p>
                                      <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{item.products?.sku || ""}</p>
                                    </div>
                                    <div className="text-right">
                                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Thành phẩm</span>
                                        <span className={cn("text-[10px] font-black uppercase tracking-wider ml-1",
                                          item.batches?.qc_status === "Pass" ? "text-green-600 dark:text-green-400" :
                                            item.batches?.qc_status === "Reject" ? "text-red-600 dark:text-red-400" :
                                              "text-yellow-600 dark:text-yellow-400"
                                        )}>
                                          QC: {item.batches?.qc_status || "Hold"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Lưới thông tin chi tiết */}
                                  {(() => {
                                    let batchNotes: any = {};
                                    try { if (item.batches?.notes) batchNotes = JSON.parse(item.batches.notes); } catch(e) {}
                                    return (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-neutral-50/50 dark:bg-neutral-900/30 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Lô hàng</p>
                                      <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{item.batches?.lot_number || "—"}</p>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Số lượng</p>
                                      <p className="font-bold text-neutral-900 dark:text-neutral-100">{item.quantity} <span className="text-[10px] text-neutral-500 font-medium">{item.products?.uoms?.abbreviation || "kg"}</span></p>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Hạn dùng</p>
                                      <p className="font-medium text-neutral-700 dark:text-neutral-300">{item.batches?.expiry_date ? new Date(item.batches.expiry_date).toLocaleDateString("vi-VN") : "—"}</p>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Vị trí kho</p>
                                      {item.warehouse_id && item.location_id ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.dispatchEvent(new CustomEvent("nav-warehouse-location", { 
                                              detail: { warehouseId: item.warehouse_id, locationId: item.location_id } 
                                            }));
                                          }}
                                          className="inline-flex items-center mt-1 px-2.5 py-1.5 bg-white dark:bg-neutral-950 border border-taika-blue/20 dark:border-blue-500/20 hover:border-taika-blue dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg font-bold text-taika-blue dark:text-blue-400 transition-all text-left shadow-sm shadow-taika-blue/5 group"
                                          title="Nhấn để mở sơ đồ kho"
                                        >
                                          <MapPin size={12} className="mr-1.5 shrink-0 opacity-70 group-hover:opacity-100" />
                                          <span className="truncate">
                                            {item.warehouses.name}
                                            <span className="ml-1 font-mono text-[10px] opacity-80">[{item.storage_locations.zone}-{item.storage_locations.rack}-{item.storage_locations.bin}]</span>
                                          </span>
                                        </button>
                                      ) : (
                                        <p className="font-bold text-taika-blue dark:text-blue-400">
                                          {item.warehouses?.name || "—"}
                                        </p>
                                      )}
                                    </div>
                                    {/* Mã hợp đồng */}
                                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Mã hợp đồng</p>
                                      <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{batchNotes.contract_number || "—"}</p>
                                    </div>
                                    {/* Ngày sản xuất */}
                                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Ngày sản xuất</p>
                                      <p className="font-medium text-neutral-700 dark:text-neutral-300">{item.batches?.production_date ? new Date(item.batches.production_date).toLocaleDateString("vi-VN") : "—"}</p>
                                    </div>
                                    {/* Quy cách đóng gói */}
                                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 md:col-span-2">
                                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Quy cách đóng gói</p>
                                      <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{batchNotes.packaging_spec || "—"}</p>
                                    </div>
                                  </div>
                                    );
                                  })()}

                                  {/* Tóm tắt chi phí */}
                                  {(Number(item.cost_price) > 0) && (
                                    <div className="flex items-center gap-4 text-[11px] text-neutral-400 pt-1 border-t border-neutral-50 dark:border-neutral-900">
                                      <span>Đơn giá: <span className="font-bold text-neutral-600 dark:text-neutral-300">{Number(item.cost_price).toLocaleString("vi-VN")} ₫</span></span>
                                      {Number(item.tax_rate) > 0 && <span>Thuế: <span className="font-bold text-red-500">{item.tax_rate}%</span></span>}
                                      {Number(item.import_fee) > 0 && <span>Phí nhập: <span className="font-bold text-orange-500">{Number(item.import_fee).toLocaleString("vi-VN")} ₫</span></span>}
                                      <span className="ml-auto font-bold text-green-600 dark:text-green-400">{totalLine.toLocaleString("vi-VN")} ₫</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Tổng giá trị phiếu */}
                            {detailItems.length > 0 && (() => {
                              const grandTotal = detailItems.reduce((sum: number, item: any) => {
                                const costTotal = (Number(item.cost_price) || 0) * (Number(item.quantity) || 0);
                                const taxAmt = costTotal * ((Number(item.tax_rate) || 0) / 100);
                                return sum + costTotal + taxAmt + (Number(item.import_fee) || 0);
                              }, 0);
                              return grandTotal > 0 ? (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-500/5 border border-green-100 dark:border-green-500/10">
                                  <span className="text-xs font-bold text-green-700 dark:text-green-400">Tổng giá trị phiếu nhập</span>
                                    <div className="flex items-center gap-4">
                                      <span className="text-sm font-black text-green-600 dark:text-green-400">{grandTotal.toLocaleString("vi-VN")} ₫</span>
                                      <button 
                                        onClick={() => setPrintingReceipt({ shipment: ship, items: detailItems })} 
                                        className="px-3 py-1.5 bg-neutral-600 dark:bg-neutral-700 text-white rounded-lg text-[11px] font-bold shadow-sm flex items-center gap-1.5 hover:bg-neutral-700 dark:hover:bg-neutral-600"
                                      >
                                        <FileText size={12} /> IN PHIẾU NHẬP
                                      </button>
                                      <button 
                                        onClick={() => (window as any).__setPrintingBatch ? (window as any).__setPrintingBatch({ items: detailItems, creatorName: ship.creator_name }) : null} 
                                        className="px-3 py-1.5 bg-taika-blue text-white rounded-lg text-[11px] font-bold shadow-sm shadow-taika-blue/20 flex items-center gap-1.5 hover:bg-taika-blue/90"
                                      >
                                      <Printer size={12} /> IN TEM MÃ VẠCH
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                  <div className="flex justify-end mt-2 gap-2">
                                    <button 
                                      onClick={() => setPrintingReceipt({ shipment: ship, items: detailItems })} 
                                      className="px-3 py-1.5 bg-neutral-600 dark:bg-neutral-700 text-white rounded-lg text-[11px] font-bold shadow-sm flex items-center gap-1.5 hover:bg-neutral-700 dark:hover:bg-neutral-600"
                                    >
                                      <FileText size={12} /> IN PHIẾU NHẬP
                                    </button>
                                    <button 
                                      onClick={() => (window as any).__setPrintingBatch ? (window as any).__setPrintingBatch({ items: detailItems, creatorName: ship.creator_name }) : null} 
                                      className="px-3 py-1.5 bg-taika-blue text-white rounded-lg text-[11px] font-bold shadow-sm shadow-taika-blue/20 flex items-center gap-1.5 hover:bg-taika-blue/90"
                                    >
                                    <Printer size={12} /> IN TEM MÃ VẠCH
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          
          {totalPages > 1 && (
            <div className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between bg-white dark:bg-neutral-950">
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
                  <span className="text-xs font-bold text-taika-blue dark:text-blue-400 px-2">{currentPage}</span>
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
      )}

      {/* Đã chuyển modal nhập kho thành dạng hiển thị trực tiếp */}

      {/* Modal In Lại Tem */}
      <AnimatePresence>
        {printingBatch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-white dark:bg-neutral-950 text-black dark:text-white flex flex-col">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-900 print:hidden">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">In lại tem nhãn phiếu nhập</h3>
              <div className="flex gap-4">
                <button onClick={() => setPrintingBatch(null)} className="px-5 py-2.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-bold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition">Đóng</button>
                <button onClick={() => window.print()} className="px-5 py-2.5 bg-taika-blue text-white rounded-xl font-bold flex items-center gap-2 hover:bg-taika-blue/90 shadow-lg shadow-taika-blue/20">
                  <Printer size={18} /> IN TOÀN BỘ TEM
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-neutral-200 dark:bg-neutral-800 p-8 flex flex-wrap gap-6 justify-center items-start print:p-0 print:bg-white print:block custom-scrollbar pt-12">
              {printingBatch.items?.map((item, idx) => {
                 let parsedNotes: any = {};
                 try {
                     if (item.batches?.notes) parsedNotes = JSON.parse(item.batches.notes);
                 } catch(e) {}
                 
                 return (
                   <BarcodeLabel
                     key={idx}
                     productName={item.products?.name || ""}
                     sku={item.products?.sku || ""}
                     contractNumber={parsedNotes.contract_number}
                     productionDate={item.batches?.production_date}
                     packagingSpec={parsedNotes.packaging_spec}
                     lotNumber={item.batches?.lot_number || "000000"}
                     userName={printingBatch.creatorName || user?.email || "NV"}
                   />
                 );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal In Phiếu Nhập Kho */}
      <AnimatePresence>
        {printingReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-white dark:bg-neutral-950 text-black dark:text-white flex flex-col">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-900 print:hidden">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">In Phiếu Nhập Kho</h3>
              <div className="flex gap-4">
                <button onClick={() => setPrintingReceipt(null)} className="px-5 py-2.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-bold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition">Đóng</button>
                <button onClick={() => window.print()} className="px-5 py-2.5 bg-taika-blue text-white rounded-xl font-bold flex items-center gap-2 hover:bg-taika-blue/90 shadow-lg shadow-taika-blue/20">
                  <Printer size={18} /> IN PHIẾU
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-neutral-200 dark:bg-neutral-800 p-8 flex flex-col items-center print:p-0 print:bg-white print:block custom-scrollbar pt-12">
              <div className="print-container">
                <PrintInboundReceipt shipment={printingReceipt.shipment} items={printingReceipt.items} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
