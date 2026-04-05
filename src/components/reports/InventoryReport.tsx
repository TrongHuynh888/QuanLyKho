import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { toCSV, downloadCSV, reportFilename, formatVND } from "../../lib/exportUtils";
import { motion } from "motion/react";
import {
  Loader2,
  Download,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Boxes,
  Package,
  DollarSign,
  Layers,
  Filter,
  MapPin,
} from "lucide-react";

type SortField = "name" | "sku" | "category" | "warehouse" | "location" | "qty" | "value";
type SortDir = "asc" | "desc";

interface FlatRow {
  productName: string;
  sku: string;
  category: string;
  warehouse: string;
  location: string;
  lot: string;
  qty: number;
  unit: string;
  importPrice: number;
  value: number;
}

export default function InventoryReport() {
  const { t } = useTranslation();
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [locationSearch, setLocationSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
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

  // Flatten
  const flatData: FlatRow[] = useMemo(() => {
    return rawData.map((item: any) => {
      const loc = item.storage_locations;
      const locLabel = loc ? `${loc.zone || ""}-${loc.rack || ""}-${loc.bin || ""}` : "—";
      const whName = loc?.warehouses?.name || "—";
      const qty = Number(item.quantity) || 0;
      const importPrice = Number(item.products?.import_price) || 0;
      return {
        productName: item.products?.name || "—",
        sku: item.products?.sku || "—",
        category: item.products?.categories?.name || "—",
        warehouse: whName,
        location: locLabel,
        lot: item.batches?.lot_number || item.batch_number || "—",
        qty,
        unit: item.products?.uoms?.abbreviation || "kg",
        importPrice,
        value: qty * importPrice,
      };
    });
  }, [rawData]);

  // Extract unique warehouses for filter dropdown
  const warehouseOptions = useMemo(() => {
    const set = new Set(flatData.map((r) => r.warehouse).filter((w) => w !== "—"));
    return Array.from(set).sort();
  }, [flatData]);

  // Filter & sort
  const filtered = useMemo(() => {
    let rows = [...flatData];
    // Warehouse filter
    if (warehouseFilter !== "all") {
      rows = rows.filter((r) => r.warehouse === warehouseFilter);
    }
    // Location search
    if (locationSearch.trim()) {
      const lq = locationSearch.toLowerCase();
      rows = rows.filter((r) => r.location.toLowerCase().includes(lq));
    }
    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.lot.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.productName.localeCompare(b.productName); break;
        case "sku": cmp = a.sku.localeCompare(b.sku); break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        case "warehouse": cmp = a.warehouse.localeCompare(b.warehouse); break;
        case "location": cmp = a.location.localeCompare(b.location); break;
        case "qty": cmp = a.qty - b.qty; break;
        case "value": cmp = a.value - b.value; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [flatData, search, warehouseFilter, locationSearch, sortField, sortDir]);

  // Summary
  const totalQty = useMemo(() => filtered.reduce((s, r) => s + r.qty, 0), [filtered]);
  const totalValue = useMemo(() => filtered.reduce((s, r) => s + r.value, 0), [filtered]);
  const uniqueProducts = useMemo(() => new Set(filtered.map((r) => r.sku)).size, [filtered]);
  const totalBatches = filtered.length;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const handleExport = () => {
    const csv = toCSV(
      filtered.map((r) => ({ ...r, value: r.value, importPrice: r.importPrice })),
      [
        { key: "productName", header: t("report_col_product") },
        { key: "sku", header: t("report_col_sku") },
        { key: "category", header: t("report_col_category") },
        { key: "warehouse", header: t("report_col_warehouse") },
        { key: "location", header: t("report_col_location") },
        { key: "lot", header: t("report_col_lot") },
        { key: "qty", header: t("report_col_qty") },
        { key: "unit", header: t("report_col_unit") },
        { key: "importPrice", header: t("report_col_import_price") },
        { key: "value", header: t("report_col_value") },
      ]
    );
    downloadCSV(csv, reportFilename("inventory_report"));
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("report_unique_products"), value: uniqueProducts.toLocaleString(), icon: Package, color: "blue" },
          { label: t("report_total_batches"), value: totalBatches.toLocaleString(), icon: Layers, color: "cyan" },
          { label: t("report_total_qty"), value: `${formatVND(totalQty)} kg`, icon: Boxes, color: "green" },
          { label: t("report_total_value"), value: `${formatVND(totalValue)} ₫`, icon: DollarSign, color: "orange" },
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
            <p className="text-xl font-black text-neutral-900 dark:text-neutral-50 font-mono">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Text search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search_inventory")}
              className="pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50 transition-all w-56"
            />
          </div>
          {/* Warehouse filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="pl-8 pr-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50 appearance-none cursor-pointer"
            >
              <option value="all">{t("all_warehouses")}</option>
              {warehouseOptions.map((wh) => (
                <option key={wh} value={wh}>{wh}</option>
              ))}
            </select>
          </div>
          {/* Location search */}
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              placeholder={t("report_col_location") + " (Z1-R2-B3...)"}
              className="pl-8 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50 transition-all w-52"
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

      {/* Table */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
                {([
                  { field: "name" as SortField, label: t("report_col_product") },
                  { field: "sku" as SortField, label: t("report_col_sku") },
                  { field: "category" as SortField, label: t("report_col_category") },
                  { field: "warehouse" as SortField, label: t("report_col_warehouse") },
                  { field: "location" as SortField, label: t("report_col_location") },
                  { field: "qty" as SortField, label: t("report_col_qty") },
                  { field: "value" as SortField, label: t("report_col_value") },
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
                filtered.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{row.productName}</p>
                        <p className="text-[10px] text-neutral-400 font-mono mt-0.5">LOT: {row.lot}</p>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-mono font-medium text-neutral-600 dark:text-neutral-300">{row.sku}</td>
                    <td className="p-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-taika-blue/10 text-taika-blue dark:bg-blue-500/10 dark:text-blue-400 rounded-md">
                        {row.category}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-medium text-neutral-600 dark:text-neutral-300">{row.warehouse}</td>
                    <td className="p-4 text-xs font-mono font-medium text-neutral-500 dark:text-neutral-400">{row.location}</td>
                    <td className="p-4">
                      <span className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{formatVND(row.qty)}</span>
                      <span className="text-xs text-neutral-400 ml-1">{row.unit}</span>
                    </td>
                    <td className="p-4 text-sm font-bold font-mono text-green-600 dark:text-green-400">{formatVND(row.value)} ₫</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">
            {filtered.length} {t("items_count")}
          </p>
          <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 font-mono">
            Σ {formatVND(totalQty)} kg · {formatVND(totalValue)} ₫
          </p>
        </div>
      </div>
    </div>
  );
}
