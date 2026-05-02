import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { downloadExcel, reportFilename } from "../../lib/exportUtils";
import { motion } from "motion/react";
import {
  Loader2,
  Download,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Calendar,
  Activity,
  Filter,
} from "lucide-react";

type SortField = "time" | "type" | "product" | "qty";
type SortDir = "asc" | "desc";

interface FlatRow {
  id: string;
  type: string;
  typeLabel: string;
  productName: string;
  sku: string;
  qty: number;
  unit: string;
  batchNumber: string;
  warehouse: string;
  performedBy: string;
  notes: string;
  time: string;
  timeRaw: number;
}

/**
 * Component Báo cáo Luân chuyển dòng Hàng hóa (Movement Report).
 * Thống kê Lịch sử giao dịch: Nhập kho, Xuất kho, Chuyển nội bộ trong hệ thống.
 *
 * @returns {JSX.Element} Giao diện Báo cáo Luân chuyển
 */
export default function MovementReport() {
  const { t } = useTranslation();
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/activities?_t=${Date.now()}`);
        if (res.ok) setRawData(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, []);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "inbound": return t("inbound_type");
      case "outbound": return t("outbound_type");
      case "transfer": return t("transfer_type");
      default: return type;
    }
  };

  const flatData: FlatRow[] = useMemo(() => {
    return rawData.map((a: any) => {
      const d = new Date(a.created_at);
      return {
        id: a.id,
        type: a.type,
        typeLabel: getTypeLabel(a.type),
        productName: a.products?.name || "—",
        sku: a.products?.sku || "—",
        qty: Number(a.quantity) || 0,
        unit: a.products?.uoms?.abbreviation || "kg",
        batchNumber: a.batch_number || "—",
        warehouse: a.warehouses?.name || "—",
        performedBy: a.profiles?.full_name || "—",
        notes: a.notes || "",
        time: d.toLocaleString("vi-VN"),
        timeRaw: d.getTime(),
      };
    });
  }, [rawData, t]);

  const filtered = useMemo(() => {
    let rows = [...flatData];
    if (typeFilter !== "all") rows = rows.filter((r) => r.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.warehouse.toLowerCase().includes(q) ||
          r.performedBy.toLowerCase().includes(q)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      rows = rows.filter((r) => r.timeRaw >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000; // include the whole day
      rows = rows.filter((r) => r.timeRaw <= to);
    }
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "time": cmp = a.timeRaw - b.timeRaw; break;
        case "type": cmp = a.type.localeCompare(b.type); break;
        case "product": cmp = a.productName.localeCompare(b.productName); break;
        case "qty": cmp = a.qty - b.qty; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [flatData, search, typeFilter, dateFrom, dateTo, sortField, sortDir]);

  // Tính toán số liệu thống kê tổng hợp nhóm theo UoM
  const totalsByUnit = useMemo(() => {
    return filtered.reduce((acc: any, r) => {
      const u = (r.unit || "kg").toLowerCase();
      if (!acc[u]) acc[u] = { inbound: 0, outbound: 0, transfer: 0 };
      if (r.type === "inbound") acc[u].inbound += r.qty;
      else if (r.type === "outbound") acc[u].outbound += r.qty;
      else if (r.type === "transfer") acc[u].transfer += r.qty;
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
        { key: "time", header: t("report_col_time"), width: 20 },
        { key: "typeLabel", header: t("report_col_type"), width: 15 },
        { key: "productName", header: t("report_col_product"), width: 30 },
        { key: "sku", header: t("report_col_sku"), width: 15 },
        { key: "qty", header: t("report_col_qty"), width: 15 },
        { key: "batchNumber", header: t("report_col_lot"), width: 20 },
        { key: "warehouse", header: t("report_col_warehouse"), width: 25 },
        { key: "performedBy", header: t("report_col_performed_by"), width: 20 },
        { key: "notes", header: t("report_col_notes"), width: 30 },
      ],
      reportFilename("movement_report"),
      "Movements"
    );
  };

  const TypeIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "inbound": return <ArrowDownLeft size={14} />;
      case "outbound": return <ArrowUpRight size={14} />;
      default: return <ArrowRightLeft size={14} />;
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="ml-1 opacity-30 inline" />;
    return sortDir === "asc" ? <ChevronUp size={12} className="ml-1 text-taika-blue inline" /> : <ChevronDown size={12} className="ml-1 text-taika-blue inline" />;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-taika-blue" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("loading")}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Các Thẻ chỉ số tổng quan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t("report_total_inbound"), value: Object.entries(totalsByUnit).map(([u, t]: any) => `${(t.inbound).toLocaleString("vi-VN")} ${u}`).join(" | ") || "0", icon: ArrowDownLeft, color: "green" },
          { label: t("report_total_outbound"), value: Object.entries(totalsByUnit).map(([u, t]: any) => `${(t.outbound).toLocaleString("vi-VN")} ${u}`).join(" | ") || "0", icon: ArrowUpRight, color: "red" },
          { label: t("report_total_transfers"), value: Object.entries(totalsByUnit).map(([u, t]: any) => `${(t.transfer).toLocaleString("vi-VN")} ${u}`).join(" | ") || "0", icon: ArrowRightLeft, color: "blue" },
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
                card.color === "green" && "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
                card.color === "red" && "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400",
                card.color === "blue" && "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400",
              )}>
                <card.icon size={20} />
              </div>
              <p className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{card.label}</p>
            </div>
            <p className="text-lg font-black text-neutral-900 dark:text-neutral-50 font-mono">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Vùng Bảng điều khiển bộ lọc & xuất file */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search_activities")}
              className="pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50 transition-all w-56"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="pl-8 pr-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50"
            >
              <option value="all">{t("all")}</option>
              <option value="inbound">{t("inbound_type")}</option>
              <option value="outbound">{t("outbound_type")}</option>
              <option value="transfer">{t("transfer_type")}</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-neutral-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50"
            />
            <span className="text-neutral-400 text-xs">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50"
            />
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

      {/* Bảng hiển thị giao dịch */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
                {([
                  { field: "time" as SortField, label: t("report_col_time") },
                  { field: "type" as SortField, label: t("report_col_type") },
                  { field: "product" as SortField, label: t("report_col_product") },
                  { field: "qty" as SortField, label: t("report_col_qty") },
                ]).map(({ field, label }) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    className="p-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors select-none whitespace-nowrap"
                  >
                    {label}
                    <SortIcon field={field} />
                  </th>
                ))}
                <th className="p-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest whitespace-nowrap">{t("report_col_warehouse")}</th>
                <th className="p-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest whitespace-nowrap">{t("report_col_performed_by")}</th>
                <th className="p-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest whitespace-nowrap">{t("report_col_notes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-neutral-400 dark:text-neutral-500 font-medium">
                    {t("report_no_data")}
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 200).map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                    <td className="p-4 text-xs font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{row.time}</td>
                    <td className="p-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full",
                        row.type === "inbound" && "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400",
                        row.type === "outbound" && "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
                        row.type === "transfer" && "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
                      )}>
                        <TypeIcon type={row.type} />
                        {row.typeLabel}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{row.productName}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">LOT: {row.batchNumber}</p>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "text-sm font-bold font-mono",
                        row.type === "inbound" ? "text-green-600 dark:text-green-400" :
                        row.type === "outbound" ? "text-red-600 dark:text-red-400" :
                        "text-neutral-900 dark:text-neutral-50"
                      )}>
                        {row.type === "inbound" ? "+" : row.type === "outbound" ? "-" : ""}{row.qty.toLocaleString()}
                      </span>
                      <span className="text-xs text-neutral-400 ml-1">{row.unit}</span>
                    </td>
                    <td className="p-4 text-xs font-medium text-neutral-600 dark:text-neutral-300">{row.warehouse}</td>
                    <td className="p-4 text-xs font-medium text-neutral-600 dark:text-neutral-300">{row.performedBy}</td>
                    <td className="p-4 text-xs text-neutral-400 dark:text-neutral-500 max-w-[200px] truncate">{row.notes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">{filtered.length} {t("items_count")}</p>
        </div>
      </div>
    </div>
  );
}
