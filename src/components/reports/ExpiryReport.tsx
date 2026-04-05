import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { toCSV, downloadCSV, reportFilename } from "../../lib/exportUtils";
import { usePreferences } from "../../contexts/PreferencesContext";
import { motion } from "motion/react";
import {
  Loader2,
  Download,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Clock,
} from "lucide-react";

type SortField = "product" | "lot" | "expiry" | "daysLeft" | "qty";
type SortDir = "asc" | "desc";
type ExpiryStatus = "expired" | "warning" | "safe";

interface FlatRow {
  productName: string;
  sku: string;
  category: string;
  warehouse: string;
  location: string;
  lot: string;
  qty: number;
  unit: string;
  expiryDate: string;
  daysLeft: number;
  status: ExpiryStatus;
}

export default function ExpiryReport() {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ExpiryStatus>("all");
  const [sortField, setSortField] = useState<SortField>("daysLeft");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/inventory?_t=${Date.now()}`);
        if (res.ok) setRawData(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, []);

  const warningDays = preferences.fefo_warning_days;

  const flatData: FlatRow[] = useMemo(() => {
    return rawData
      .filter((item: any) => {
        const ed = item.expiry_date || item.batches?.expiry_date;
        return !!ed;
      })
      .map((item: any) => {
        const loc = item.storage_locations;
        const locLabel = loc ? `${loc.zone || ""}-${loc.rack || ""}-${loc.bin || ""}` : "—";
        const whName = loc?.warehouses?.name || "—";
        const expiryStr = item.expiry_date || item.batches?.expiry_date || "";
        const diffMs = new Date(expiryStr).getTime() - Date.now();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        let status: ExpiryStatus = "safe";
        if (daysLeft < 0) status = "expired";
        else if (daysLeft <= warningDays) status = "warning";
        return {
          productName: item.products?.name || "—",
          sku: item.products?.sku || "—",
          category: item.products?.categories?.name || "—",
          warehouse: whName,
          location: locLabel,
          lot: item.batches?.lot_number || item.batch_number || "—",
          qty: Number(item.quantity) || 0,
          unit: item.products?.uoms?.abbreviation || "kg",
          expiryDate: expiryStr,
          daysLeft,
          status,
        };
      });
  }, [rawData, warningDays]);

  const filtered = useMemo(() => {
    let rows = [...flatData];
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.lot.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "product": cmp = a.productName.localeCompare(b.productName); break;
        case "lot": cmp = a.lot.localeCompare(b.lot); break;
        case "expiry": cmp = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(); break;
        case "daysLeft": cmp = a.daysLeft - b.daysLeft; break;
        case "qty": cmp = a.qty - b.qty; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [flatData, search, statusFilter, sortField, sortDir]);

  const expiredCount = useMemo(() => flatData.filter((r) => r.status === "expired").length, [flatData]);
  const warningCount = useMemo(() => flatData.filter((r) => r.status === "warning").length, [flatData]);
  const safeCount = useMemo(() => flatData.filter((r) => r.status === "safe").length, [flatData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const handleExport = () => {
    const csv = toCSV(
      filtered.map((r) => ({ ...r, statusLabel: r.status === "expired" ? t("report_expired") : r.status === "warning" ? t("report_expiring_soon") : t("report_safe") })),
      [
        { key: "productName", header: t("report_col_product") },
        { key: "sku", header: t("report_col_sku") },
        { key: "lot", header: t("report_col_lot") },
        { key: "expiryDate", header: t("report_col_expiry") },
        { key: "daysLeft", header: t("report_col_days_left") },
        { key: "statusLabel", header: t("report_col_status") },
        { key: "qty", header: t("report_col_qty") },
        { key: "warehouse", header: t("report_col_warehouse") },
        { key: "location", header: t("report_col_location") },
      ]
    );
    downloadCSV(csv, reportFilename("expiry_report"));
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t("report_expired_batches"), value: expiredCount, icon: AlertCircle, color: "red", onClick: () => setStatusFilter(statusFilter === "expired" ? "all" : "expired") },
          { label: t("report_warning_batches"), value: warningCount, icon: AlertTriangle, color: "orange", onClick: () => setStatusFilter(statusFilter === "warning" ? "all" : "warning") },
          { label: t("report_safe"), value: safeCount, icon: ShieldCheck, color: "green", onClick: () => setStatusFilter(statusFilter === "safe" ? "all" : "safe") },
        ].map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={card.onClick}
            className={cn(
              "bg-white dark:bg-neutral-950 p-5 rounded-2xl border shadow-sm cursor-pointer transition-all hover:shadow-md",
              statusFilter === (card.color === "red" ? "expired" : card.color === "orange" ? "warning" : "safe")
                ? "border-2 ring-2 ring-offset-1 " + (card.color === "red" ? "border-red-400 ring-red-200 dark:ring-red-500/30 dark:border-red-500" : card.color === "orange" ? "border-orange-400 ring-orange-200 dark:ring-orange-500/30 dark:border-orange-500" : "border-green-400 ring-green-200 dark:ring-green-500/30 dark:border-green-500")
                : "border-neutral-200 dark:border-neutral-700"
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                card.color === "red" && "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
                card.color === "orange" && "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400",
                card.color === "green" && "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
              )}>
                <card.icon size={20} />
              </div>
              <p className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{card.label}</p>
            </div>
            <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50 font-mono">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search_inventory")}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50 transition-all"
          />
        </div>
        <button
          onClick={handleExport}
          className="px-5 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-taika-blue/90 shadow-lg shadow-taika-blue/10 transition-all shrink-0"
        >
          <Download size={16} />
          {t("report_download_csv")}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
                {([
                  { field: "product" as SortField, label: t("report_col_product") },
                  { field: "lot" as SortField, label: t("report_col_lot") },
                  { field: "expiry" as SortField, label: t("report_col_expiry") },
                  { field: "daysLeft" as SortField, label: t("report_col_days_left") },
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
                <th className="p-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest whitespace-nowrap">{t("report_col_status")}</th>
                <th className="p-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest whitespace-nowrap">{t("report_col_warehouse")}</th>
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
                filtered.slice(0, 200).map((row, i) => (
                  <tr key={i} className={cn(
                    "transition-colors",
                    row.status === "expired" ? "bg-red-50/30 dark:bg-red-500/5 hover:bg-red-50/50 dark:hover:bg-red-500/10" :
                    row.status === "warning" ? "bg-orange-50/30 dark:bg-orange-500/5 hover:bg-orange-50/50 dark:hover:bg-orange-500/10" :
                    "hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50"
                  )}>
                    <td className="p-4">
                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{row.productName}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">{row.sku}</p>
                    </td>
                    <td className="p-4 text-xs font-mono font-bold text-neutral-600 dark:text-neutral-300">{row.lot}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-neutral-400" />
                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{row.expiryDate}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "text-sm font-black font-mono",
                        row.status === "expired" ? "text-red-600 dark:text-red-400" :
                        row.status === "warning" ? "text-orange-600 dark:text-orange-400" :
                        "text-green-600 dark:text-green-400"
                      )}>
                        {row.daysLeft < 0 ? row.daysLeft : `+${row.daysLeft}`}
                      </span>
                      <span className="text-[10px] text-neutral-400 ml-1">{t("days").toLowerCase()}</span>
                    </td>
                    <td className="p-4 text-sm font-bold font-mono text-neutral-900 dark:text-neutral-50">{row.qty.toLocaleString()} <span className="text-xs text-neutral-400">{row.unit}</span></td>
                    <td className="p-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full",
                        row.status === "expired" && "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
                        row.status === "warning" && "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400",
                        row.status === "safe" && "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400",
                      )}>
                        {row.status === "expired" && <AlertCircle size={10} />}
                        {row.status === "warning" && <AlertTriangle size={10} />}
                        {row.status === "safe" && <ShieldCheck size={10} />}
                        {row.status === "expired" ? t("report_expired") : row.status === "warning" ? t("report_expiring_soon") : t("report_safe")}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-medium text-neutral-500 dark:text-neutral-400">{row.warehouse} · {row.location}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">{filtered.length} {t("items_count")}</p>
          <p className="text-[11px] font-bold text-neutral-400">
            FEFO {t("alert")}: ≤ {warningDays} {t("days").toLowerCase()}
          </p>
        </div>
      </div>
    </div>
  );
}
