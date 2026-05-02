import React, { useState, useMemo } from "react";
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
  ChevronRight,
  MapPin,
  Image as ImageIcon,
  AlertCircle
} from "lucide-react";
import type { InventoryItem } from "../../types/supabase";
import { usePreferences } from "../../contexts/PreferencesContext";

/**
 * Cấu trúc tùy chọn cho Props của Bảng tồn kho.
 */
interface InventoryTableProps {
  inventory: InventoryItem[];
  /** Callback khi người dùng muốn xem vị trí của hàng hóa đó lên bản đồ */
  onViewOnMap?: (locationId: string, warehouseId: string) => void;
}

type SortField = "name" | "quantity" | "date" | "retail" | "import" | "wholesale" | "status";
type SortDir = "asc" | "desc";

/**
 * Đối tượng gom nhóm sản phẩm cùng loại trên hệ thống.
 */
type ProductGroup = {
  productId: string;
  product: any;
  items: InventoryItem[];
  totalQty: number;
  latestImportDate: string | null;
  qcStatus: string;
};

/**
 * Component `InventoryTable`
 * Bố cục bảng phân tích hàng tồn kho. Nhóm theo SKU Sản phẩm (Product Grouping).
 * Tính toán số lượng tồn kho tổng thể, giá xuất lẻ, và hỗ trợ Expand dòng (Accordions)
 * để theo dõi chi tiết từng lô.
 *
 * @param {InventoryTableProps} props Props component InventoryTable
 * @returns {JSX.Element} Bảng danh sách Hàng hóa quản lý kho
 */
export default function InventoryTable({ inventory, onViewOnMap }: InventoryTableProps) {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Grouped table takes more height per row

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price || 0);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groupedInventory = useMemo(() => {
    const groups: Record<string, ProductGroup> = {};
    for (const item of inventory) {
      const pid = item.product_id;
      if (!groups[pid]) {
        groups[pid] = { 
          productId: pid, 
          product: item.products, 
          items: [], 
          totalQty: 0, 
          latestImportDate: null, 
          qcStatus: "Pass" 
        };
      }
      groups[pid].items.push(item);
      groups[pid].totalQty += Number(item.quantity) || 0;
      
      const itemDateStr = item.batches?.production_date;
      if (itemDateStr) {
        if (!groups[pid].latestImportDate || new Date(itemDateStr) > new Date(groups[pid].latestImportDate!)) {
          groups[pid].latestImportDate = itemDateStr;
        }
      }
      
      const st = item.batches?.qc_status || "Hold";
      if (st === "Fail") groups[pid].qcStatus = "Fail";
      else if (st === "Hold" && groups[pid].qcStatus !== "Fail") groups[pid].qcStatus = "Hold";
    }
    return Object.values(groups);
  }, [inventory]);

  const filtered = useMemo(() => {
    let groups = [...groupedInventory];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      groups = groups.filter((g) => {
        const name = g.product?.name?.toLowerCase() || "";
        const sku = g.product?.sku?.toLowerCase() || "";
        const category = g.product?.categories?.name?.toLowerCase() || "";
        return name.includes(q) || sku.includes(q) || category.includes(q);
      });
    }

    groups.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = (a.product?.name || "").localeCompare(b.product?.name || ""); break;
        case "quantity": cmp = a.totalQty - b.totalQty; break;
        case "date": 
          const dA = a.latestImportDate ? new Date(a.latestImportDate).getTime() : 0;
          const dB = b.latestImportDate ? new Date(b.latestImportDate).getTime() : 0;
          cmp = dA - dB;
          break;
        case "retail": cmp = (a.product?.retail_price || 0) - (b.product?.retail_price || 0); break;
        case "import": cmp = (a.product?.import_price || 0) - (b.product?.import_price || 0); break;
        case "wholesale": cmp = (a.product?.wholesale_price || 0) - (b.product?.wholesale_price || 0); break;
        case "status": cmp = a.qcStatus.localeCompare(b.qcStatus); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return groups;
  }, [groupedInventory, searchQuery, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedGroups = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="ml-1.5 opacity-30 group-hover/th:opacity-100 transition-opacity inline" />;
    return sortDir === "asc" ? <ChevronUp size={14} className="ml-1.5 text-taika-blue inline" /> : <ChevronDown size={14} className="ml-1.5 text-taika-blue inline" />;
  };

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
      {/* Thanh tìm kiếm */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder={t("search_inventory", "Tìm kiếm theo tên sản phẩm, SKU...")}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-taika-blue/50 transition-all"
          />
        </div>
      </div>

      {/* Bảng dữ liệu Inventory */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
              <th className="p-4 lg:p-5 w-10"></th>
              {[
                { field: "name" as SortField, label: t("product_variant_name") },
                { field: "quantity" as SortField, label: t("current_stock") },
                { field: "date" as SortField, label: t("creation_date_latest_batch") },
                { field: "retail" as SortField, label: t("retail_price") },
                { field: "import" as SortField, label: t("import_price") },
                { field: "wholesale" as SortField, label: t("wholesale_price") },
                { field: "status" as SortField, label: t("status") },
              ].map(({ field, label }) => (
                <th
                  key={field}
                  onClick={() => toggleSort(field)}
                  className="p-4 lg:p-5 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors group/th select-none whitespace-nowrap"
                >
                  {label}
                  <SortIcon field={field} />
                </th>
              ))}
              <th className="p-4 lg:p-5 text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {paginatedGroups.map((group) => {
              const uom = group.product?.uoms?.symbol || group.product?.uoms?.abbreviation || "kg";
              const isExpanded = expandedRows[group.productId];

              return (
                <React.Fragment key={group.productId}>
                  <tr 
                    className={cn(
                      "group hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer",
                      isExpanded && "bg-neutral-50 dark:bg-neutral-900/30"
                    )}
                    onClick={() => toggleRow(group.productId)}
                  >
                    <td className="p-4 lg:p-5">
                      <button className="text-neutral-400 hover:text-taika-blue transition-colors">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                    </td>
                    <td className="p-4 lg:p-5">
                      <div className="flex items-center gap-4">
                        {group.product?.image_url ? (
                          <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 overflow-hidden flex-shrink-0 border border-neutral-200 dark:border-neutral-700">
                            <img src={group.product.image_url} alt={group.product.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-400 flex-shrink-0 border border-neutral-200 dark:border-neutral-700">
                            <ImageIcon size={20} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-neutral-900 dark:text-neutral-50 truncate">{group.product?.name || "—"}</p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">SKU: {group.product?.sku || "—"}</p>
                          {group.product?.categories?.name && (
                            <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 bg-taika-blue/10 text-taika-blue dark:bg-blue-500/10 dark:text-blue-400 rounded-md">
                              {group.product.categories.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 lg:p-5">
                      <p className="font-bold text-neutral-900 dark:text-neutral-50 text-base">
                        {group.totalQty.toLocaleString()} <span className="text-sm font-medium text-neutral-400">{uom}</span>
                      </p>
                      <div className="w-20 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-taika-blue rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (group.totalQty / (group.product?.min_stock_level || 5000)) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="p-4 lg:p-5 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                      {group.latestImportDate ? new Date(group.latestImportDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-4 lg:p-5 font-mono text-sm font-medium text-green-600 dark:text-green-400">
                      {formatPrice(group.product?.retail_price)}
                    </td>
                    <td className="p-4 lg:p-5 font-mono text-sm font-medium text-neutral-600 dark:text-neutral-300">
                      {formatPrice(group.product?.import_price)}
                    </td>
                    <td className="p-4 lg:p-5 font-mono text-sm font-medium text-orange-600 dark:text-orange-400">
                      {formatPrice(group.product?.wholesale_price)}
                    </td>
                    <td className="p-4 lg:p-5">
                      <span
                        className={cn(
                          "px-2.5 py-1 text-xs font-bold rounded-full flex items-center gap-1 w-fit",
                          group.qcStatus === "Pass"
                            ? "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400"
                            : group.qcStatus === "Fail"
                            ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
                            : "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"
                        )}
                      >
                        {group.qcStatus === "Pass" ? <CheckCircle2 size={12} /> : group.qcStatus === "Fail" ? <AlertCircle size={12} /> : <Clock size={12} />}
                        {group.qcStatus}
                      </span>
                    </td>
                    <td className="p-4 lg:p-5 text-right">
                      <button className="text-neutral-400 hover:text-taika-blue px-3 py-1.5 text-xs font-bold rounded-lg border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 bg-transparent hover:bg-white dark:hover:bg-neutral-900 transition-all">
                        {t("view_batch_details")}
                      </button>
                    </td>
                  </tr>

                  {/* Hiển thị chi tiết từng lô (Expanded) */}
                  {isExpanded && (
                    <tr className="bg-neutral-50/50 dark:bg-neutral-900/30 border-b border-neutral-100 dark:border-neutral-800">
                      <td></td>
                      <td colSpan={8} className="p-0 pb-6 pr-6">
                        <div className="ml-4 border-l-2 border-neutral-200 dark:border-neutral-800 pl-6 py-2 mt-2">
                          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">{t("batch_storage_details")}</h4>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {group.items.map((item, idx) => {
                              const loc = item.storage_locations;
                              const locLabel = loc ? `${loc.warehouses?.name || 'Kho'} | ${loc.zone}-${loc.rack || ""}-${loc.bin || ""}` : "—";
                              return (
                                <div key={`${item.id}-${idx}`} className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex items-center justify-between">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-50">
                                        LOT: {item.batch_number || item.batches?.lot_number || "—"}
                                      </span>
                                      <span className={cn(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                        (item.batches?.qc_status || "Hold") === "Pass" ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" : "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
                                      )}>
                                        {item.batches?.qc_status || "Hold"}
                                      </span>
                                    </div>
                                    <p className="text-xs text-neutral-500 font-medium flex items-center gap-1.5"><MapPin size={12}/> {locLabel}</p>
                                    <p className="text-xs text-neutral-500 font-medium flex items-center gap-1.5"><Clock size={12}/> {t("expiry_date_short")} 
                                      {(() => {
                                        const dateStr = item.expiry_date || item.batches?.expiry_date;
                                        if (!dateStr) return <span className="text-neutral-900 dark:text-neutral-300 font-bold">—</span>;
                                        const diffTime = new Date(dateStr).getTime() - new Date().getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        const isWarning = diffDays >= 0 && diffDays <= preferences.fefo_warning_days;
                                        const isExpired = diffDays < 0;
                                        
                                        return (
                                          <span className={cn("font-bold flex items-center gap-1", isExpired ? "text-red-600" : isWarning ? "text-orange-500" : "text-neutral-900 dark:text-neutral-300")}>
                                            {dateStr}
                                            {(isWarning || isExpired) && <AlertCircle size={12} />}
                                            {isWarning && <span className="text-[10px] bg-orange-100 text-orange-600 px-1 rounded">{t("expiring_soon")}</span>}
                                            {isExpired && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">{t("unhandled")}</span>}
                                          </span>
                                        );
                                      })()}
                                    </p>
                                  </div>
                                  <div className="text-right flex flex-col items-end gap-2">
                                    <p className="text-base font-black text-taika-blue dark:text-blue-400">
                                      {Number(item.quantity).toLocaleString()} <span className="text-xs opacity-60">{uom}</span>
                                    </p>
                                    {onViewOnMap && item.location_id && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onViewOnMap(item.location_id!, item.warehouse_id); }}
                                        className="text-[10px] font-bold px-2 py-1 bg-neutral-100 dark:bg-neutral-900 hover:bg-taika-blue hover:text-white rounded transition-colors"
                                      >
                                        {t("scanner_directions")}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phân trang (Pagination) */}
      <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
        <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">
          {t("showing_variants", { count: filtered.length })}
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
