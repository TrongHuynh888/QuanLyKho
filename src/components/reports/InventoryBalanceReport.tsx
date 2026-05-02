import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { downloadExcel, reportFilename, formatVND } from "../../lib/exportUtils";
import { motion } from "motion/react";
import {
  Loader2,
  Download,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Calendar,
  Activity,
  Info,
} from "lucide-react";

type SortField = "name" | "sku" | "category" | "opening_qty" | "in_qty" | "out_qty" | "closing_qty";
type SortDir = "asc" | "desc";

interface FlatRow {
  product_id: string;
  product_name: string;
  sku: string;
  category: string;
  uom: string;
  warehouse_name: string;
  warehouse_code: string;
  batch_number: string;
  contract_number?: string;
  opening_qty: number;
  in_qty: number;
  out_qty: number;
  closing_qty: number;
}

/**
 * Component Báo cáo Xuất Nhập Tồn (Inventory Balance Report).
 * Hiển thị thẻ kho tổng quan (Đầu kỳ - Nhập - Xuất - Cuối kỳ) dựa vào lịch sử giao dịch.
 *
 * @returns {JSX.Element} Giao diện Báo cáo Xuất Nhập tồn
 */
export default function InventoryBalanceReport() {
  const { t } = useTranslation();
  const [rawData, setRawData] = useState<FlatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Default bounds: 1st of current month to today
  const defaultStart = new Date();
  defaultStart.setDate(1);
  const defaultEnd = new Date();
  
  const [dateFrom, setDateFrom] = useState(defaultStart.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(defaultEnd.toISOString().slice(0, 10));
  
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const loadData = async () => {
    setLoading(true);
    try {
      const qStart = dateFrom || new Date().toISOString().slice(0, 10);
      const qEnd = dateTo || new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/inventory-balance?startDate=${qStart}&endDate=${qEnd}&_t=${Date.now()}`);
      if (res.ok) {
        setRawData(await res.json());
      } else {
        setRawData([]);
      }
    } catch {
      setRawData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  // Bộ lọc & sắp xếp (Filter & Sort)
  const filtered = useMemo(() => {
    let rows = [...rawData];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.product_name.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          (r.category && r.category.toLowerCase().includes(q)) ||
          (r.warehouse_code && r.warehouse_code.toLowerCase().includes(q)) ||
          (r.warehouse_name && r.warehouse_name.toLowerCase().includes(q)) ||
          (r.batch_number && r.batch_number.toLowerCase().includes(q)) ||
          (r.contract_number && r.contract_number.toLowerCase().includes(q))
      );
    }
    
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.product_name.localeCompare(b.product_name); break;
        case "sku": cmp = a.sku.localeCompare(b.sku); break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        case "opening_qty": cmp = a.opening_qty - b.opening_qty; break;
        case "in_qty": cmp = a.in_qty - b.in_qty; break;
        case "out_qty": cmp = a.out_qty - b.out_qty; break;
        case "closing_qty": cmp = a.closing_qty - b.closing_qty; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [rawData, search, sortField, sortDir]);

  // Tính toán số liệu tổng thể (Summary)
  const totalsByUnit = useMemo(() => {
    return filtered.reduce((acc: any, r) => {
      const u = (r.uom || "kg").toLowerCase();
      if (!acc[u]) acc[u] = { opening: 0, in: 0, out: 0, closing: 0 };
      acc[u].opening += r.opening_qty;
      acc[u].in += r.in_qty;
      acc[u].out += r.out_qty;
      acc[u].closing += r.closing_qty;
      return acc;
    }, {});
  }, [filtered]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const handleExport = () => {
    downloadExcel(
      filtered.map((r) => ({ ...r })),
      [
        { key: "product_name", header: t("report_col_product"), width: 30 },
        { key: "sku", header: t("report_col_sku"), width: 15 },
        { key: "batch_number", header: t("report_col_batch_inbound"), width: 20 },
        { key: "warehouse_code", header: t("report_col_warehouse"), width: 20 },
        { key: "uom", header: t("report_col_unit"), width: 10 },
        { key: "opening_qty", header: t("report_col_opening_qty"), width: 15 },
        { key: "in_qty", header: t("report_col_in_qty"), width: 15 },
        { key: "out_qty", header: t("report_col_out_qty"), width: 15 },
        { key: "closing_qty", header: t("report_col_closing_qty"), width: 15 },
      ],
      reportFilename("inventory_balance_report"),
      "Balance"
    );
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="ml-1 opacity-30 inline" />;
    return sortDir === "asc" ? <ChevronUp size={12} className="ml-1 text-taika-blue inline" /> : <ChevronDown size={12} className="ml-1 text-taika-blue inline" />;
  };

  if (loading && rawData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-taika-blue" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("compiling_inventory_balance")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Thẻ thống kê tổng quan (Summary Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("total_opening"), value: Object.entries(totalsByUnit).map(([u, unitTotals]: any) => `${formatVND(unitTotals.opening)} ${u}`).join(" | ") || "0", icon: Activity, color: "blue" },
          { label: t("total_inbound_period"), value: Object.entries(totalsByUnit).map(([u, unitTotals]: any) => `${formatVND(unitTotals.in)} ${u}`).join(" | ") || "0", icon: Activity, color: "green" },
          { label: t("total_outbound_period"), value: Object.entries(totalsByUnit).map(([u, unitTotals]: any) => `${formatVND(unitTotals.out)} ${u}`).join(" | ") || "0", icon: Activity, color: "orange" },
          { label: t("total_closing"), value: Object.entries(totalsByUnit).map(([u, unitTotals]: any) => `${formatVND(unitTotals.closing)} ${u}`).join(" | ") || "0", icon: Activity, color: "cyan" },
        ].map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-neutral-950 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                card.color === "blue" && "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400",
                card.color === "cyan" && "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
                card.color === "green" && "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
                card.color === "orange" && "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
              )}>
                <card.icon size={20} />
              </div>
              <p className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{card.label}</p>
            </div>
            <p className="text-lg font-black text-neutral-900 dark:text-neutral-50 font-mono">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Thanh công cụ điều hướng & Lọc */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Ô nhập Tìm kiếm văn bản */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search_product_sku")}
              className="pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50 transition-all w-64 lg:w-80"
            />
          </div>
          
          {/* Lọc khoảng thời gian */}
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-neutral-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className="px-3 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50 cursor-pointer"
              style={{ colorScheme: 'dark light' }}
            />
            <span className="text-neutral-400 text-xs">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className="px-3 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50 cursor-pointer"
              style={{ colorScheme: 'dark light' }}
            />
          </div>
          {/* Tooltip giải thích cách tính kỳ */}
          <div className="relative group">
            <Info size={16} className="text-neutral-400 hover:text-taika-blue cursor-help transition-colors" />
            <div className="absolute left-1/2 -translate-x-1/2 top-8 z-50 hidden group-hover:block w-72 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
              <p className="font-bold text-neutral-900 dark:text-neutral-50 mb-1.5">{t("balance_report")}</p>
              <p>• <strong>{t("report_col_opening_qty")}</strong>: {t("balance_info_opening")}</p>
              <p>• <strong>{t("report_col_in_qty")}/{t("report_col_out_qty")}</strong>: {t("balance_info_period")}</p>
              <p>• <strong>{t("report_col_closing_qty")}</strong>: {t("balance_info_closing")}</p>
              <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 bg-white dark:bg-neutral-900 border-l border-t border-neutral-200 dark:border-neutral-700 rotate-45"></div>
            </div>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="px-5 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-taika-blue/90 shadow-lg shadow-taika-blue/10 transition-all shrink-0"
        >
          <Download size={16} />
          {t("report_download_csv")}
        </button>
      </div>

      {/* Bảng dữ liệu thống kê */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden min-h-[400px] relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-[2px] z-10 flex items-center justify-center">
             <Loader2 className="w-8 h-8 animate-spin text-taika-blue" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
                {([
                  { field: "name" as SortField, label: t("report_col_product") },
                  { field: "warehouse" as SortField, label: t("report_col_warehouse") },
                  { field: "uom" as SortField, label: t("report_col_unit") },
                  { field: "opening_qty" as SortField, label: t("report_col_opening_qty") },
                  { field: "in_qty" as SortField, label: t("report_col_in_qty_short") },
                  { field: "out_qty" as SortField, label: t("report_col_out_qty_short") },
                  { field: "closing_qty" as SortField, label: t("report_col_closing_qty_short") },
                  { field: "batch" as SortField, label: t("report_col_batch_inbound") },
                ]).map(({ field, label }) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={cn(
                      "p-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors select-none whitespace-nowrap",
                      ["opening_qty", "in_qty", "out_qty", "closing_qty"].includes(field) && "text-right"
                    )}
                  >
                    {label}
                    <SortIcon field={field} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-neutral-400 dark:text-neutral-500 font-medium">
                    {t("no_inventory_balance_data")}
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 100).map((row, i) => (
                  <tr key={`${row.product_id}-${row.warehouse_code}-${row.batch_number}-${i}`} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{row.product_name}</p>
                        <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{row.sku}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                        {row.warehouse_code || row.warehouse_name}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-[11px] font-bold text-neutral-500 uppercase">
                        {row.uom}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={cn("text-sm font-bold font-mono", row.opening_qty > 0 ? "text-neutral-900 dark:text-neutral-50" : "text-neutral-400 dark:text-neutral-600")}>
                        {formatVND(row.opening_qty)} <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase ml-0.5">{row.uom}</span>
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={cn("text-sm font-bold font-mono", row.in_qty > 0 ? "text-green-600 dark:text-green-400" : "text-neutral-400 dark:text-neutral-600")}>
                        {formatVND(row.in_qty)} <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase ml-0.5">{row.uom}</span>
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={cn("text-sm font-bold font-mono", row.out_qty > 0 ? "text-orange-600 dark:text-orange-400" : "text-neutral-400 dark:text-neutral-600")}>
                        {formatVND(row.out_qty)} <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase ml-0.5">{row.uom}</span>
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={cn("text-sm font-black font-mono", row.closing_qty > 0 ? "text-taika-blue dark:text-blue-400" : "text-neutral-400 dark:text-neutral-600")}>
                        {formatVND(row.closing_qty)} <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase ml-0.5">{row.uom}</span>
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-[11px] text-neutral-500 font-mono">{row.batch_number || "—"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-neutral-50 dark:bg-neutral-900 border-t-2 border-neutral-200 dark:border-neutral-700">
              {Object.keys(totalsByUnit).length === 0 ? (
                <tr><td colSpan={8}></td></tr>
              ) : (
                Object.entries(totalsByUnit).map(([u, unitTotals]: any, i) => (
                  <tr key={u}>
                    {i === 0 ? (
                      <td colSpan={3} className="p-4" rowSpan={Object.keys(totalsByUnit).length}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                            {filtered.length} {t("data_rows")}
                          </span>
                          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-50 uppercase tracking-widest">{t("total")}:</span>
                        </div>
                      </td>
                    ) : null}
                    <td className="p-4 text-right">
                      <span className="text-[14px] font-bold font-mono text-neutral-900 dark:text-neutral-50">{formatVND(unitTotals.opening)} <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase ml-1">{u}</span></span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-[14px] font-bold font-mono text-green-600 dark:text-green-400">+{formatVND(unitTotals.in)} <span className="text-[10px] text-green-600 dark:text-green-400/80 uppercase ml-1">{u}</span></span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-[14px] font-bold font-mono text-orange-600 dark:text-orange-400">-{formatVND(unitTotals.out)} <span className="text-[10px] text-orange-600 dark:text-orange-400/80 uppercase ml-1">{u}</span></span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-[15px] font-black font-mono text-taika-blue dark:text-blue-400">{formatVND(unitTotals.closing)} <span className="text-[10px] text-taika-blue dark:text-blue-400/80 uppercase ml-1">{u}</span></span>
                    </td>
                    <td className="p-4"></td>
                  </tr>
                ))
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
