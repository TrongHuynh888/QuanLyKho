import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
  CheckCircle2,
  Clock,
  Package,
  Settings,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";
import type { InventoryItem } from "../../types/supabase";

interface InventoryTableProps {
  inventory: InventoryItem[];
  onViewOnMap?: (locationId: string, warehouseId: string) => void;
}

type SortField = "name" | "warehouse" | "batch" | "expiry" | "quantity" | "status";
type SortDir = "asc" | "desc";

export default function InventoryTable({ inventory, onViewOnMap }: InventoryTableProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let items = [...inventory];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item) => {
        const name = item.products?.name?.toLowerCase() || "";
        const sku = item.products?.sku?.toLowerCase() || "";
        const lot = (item.batch_number || item.batches?.lot_number || "").toLowerCase();
        return name.includes(q) || sku.includes(q) || lot.includes(q);
      });
    }

    // Sort
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = (a.products?.name || "").localeCompare(b.products?.name || "");
          break;
        case "warehouse":
          cmp = (a.storage_locations?.warehouses?.name || "").localeCompare(b.storage_locations?.warehouses?.name || "");
          break;
        case "batch":
          cmp = (a.batch_number || "").localeCompare(b.batch_number || "");
          break;
        case "expiry":
          cmp = (a.expiry_date || "").localeCompare(b.expiry_date || "");
          break;
        case "quantity":
          cmp = Number(a.quantity) - Number(b.quantity);
          break;
        case "status":
          cmp = (a.batches?.qc_status || "").localeCompare(b.batches?.qc_status || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [inventory, searchQuery, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex ml-1 opacity-0 group-hover/th:opacity-100 transition-opacity">
      {sortField === field ? (
        sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      ) : (
        <ArrowUpDown size={12} />
      )}
    </span>
  );

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
      {/* Search bar */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder={t("search_inventory")}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
              {[
                { field: "name" as SortField, label: t("products") },
                { field: "warehouse" as SortField, label: t("warehouse") },
                { field: "batch" as SortField, label: t("batch") },
                { field: "expiry" as SortField, label: t("expiry") },
                { field: "quantity" as SortField, label: t("stock_level") },
                { field: "status" as SortField, label: t("status") },
              ].map(({ field, label }) => (
                <th
                  key={field}
                  onClick={() => toggleSort(field)}
                  className="p-4 lg:p-5 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors group/th select-none"
                >
                  {label}
                  <SortIcon field={field} />
                </th>
              ))}
              <th className="p-4 lg:p-5 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {paginatedItems.map((item) => {
              const loc = item.storage_locations;
              const locLabel = loc ? `${loc.zone}-${loc.rack || ""}-${loc.bin || ""}` : "—";
              const whName = loc?.warehouses?.name || "—";
              const qcStatus = item.batches?.qc_status || "Hold";
              const isExpanded = expandedRow === item.id;

              return (
                <tr key={item.id} className="group">
                  <td className="p-4 lg:p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-taika-blue-light dark:bg-blue-500/10 rounded-xl flex items-center justify-center text-taika-blue dark:text-blue-400 group-hover:bg-taika-blue group-hover:text-white transition-all flex-shrink-0">
                        <Package size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-neutral-900 dark:text-neutral-50 truncate">{item.products?.name || "—"}</p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">SKU: {item.products?.sku || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 lg:p-5">
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{whName}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{locLabel}</p>
                  </td>
                  <td className="p-4 lg:p-5 text-sm font-mono font-medium text-neutral-600 dark:text-neutral-300">{item.batch_number || item.batches?.lot_number || "—"}</td>
                  <td className="p-4 lg:p-5 text-sm font-medium text-neutral-600 dark:text-neutral-300">{item.expiry_date || item.batches?.expiry_date || "—"}</td>
                  <td className="p-4 lg:p-5">
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{Number(item.quantity).toLocaleString()} kg</p>
                    <div className="w-20 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-taika-blue rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (Number(item.quantity) / (item.products?.min_stock_level || 5000)) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-4 lg:p-5">
                    <span
                      className={cn(
                        "px-2.5 py-1 text-xs font-bold rounded-full flex items-center gap-1 w-fit",
                        qcStatus === "Pass"
                          ? "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400"
                          : qcStatus === "Fail"
                          ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
                          : "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"
                      )}
                    >
                      {qcStatus === "Pass" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {qcStatus}
                    </span>
                  </td>
                  <td className="p-4 lg:p-5">
                    <div className="flex items-center gap-1">
                      {onViewOnMap && item.location_id && (
                        <button
                          onClick={() => onViewOnMap(item.location_id!, item.warehouse_id)}
                          className="p-2 hover:bg-taika-blue-light dark:hover:bg-blue-500/10 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-taika-blue dark:hover:text-blue-400 transition-all"
                          title={t("view_on_map")}
                        >
                          <MapPin size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50 transition-all"
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
        <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">
          {t("showing_entries")}: {filtered.length} {t("items_count")}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-bold rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {t("previous")}
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "w-8 h-8 text-sm font-bold rounded-lg transition-all",
                  page === currentPage
                    ? "bg-taika-blue text-white shadow-lg shadow-taika-blue/20"
                    : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-bold rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {t("next")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
