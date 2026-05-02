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
  Truck,
  Package,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type SortField = "name" | "shipments" | "totalImported" | "lastDelivery";
type SortDir = "asc" | "desc";

interface SupplierRow {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  status: string;
  shipmentCount: number;
  totalImported: number;
  lastDelivery: string;
  lastDeliveryRaw: number;
  categories: string;
}

/**
 * Component Báo cáo Phân tích Nhà cung cấp (Supplier Report).
 * Theo dõi hiệu suất giao hàng, số lượng đơn, cùng với biểu đồ top nhà cung cấp.
 *
 * @returns {JSX.Element} Giao diện Báo cáo Nhà cung cấp
 */
export default function SupplierReport() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalImported");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [supRes, shipRes] = await Promise.all([
          fetch(`/api/suppliers?_t=${Date.now()}`),
          fetch(`/api/inbound-shipments?_t=${Date.now()}`),
        ]);
        if (supRes.ok) setSuppliers(await supRes.json());
        if (shipRes.ok) setShipments(await shipRes.json());
      } catch {}
      setLoading(false);
    })();
  }, []);

  const flatData: SupplierRow[] = useMemo(() => {
    return suppliers.map((s: any) => {
      const supShipments = shipments.filter((sh: any) => sh.supplier_id === s.id);
      const totalImported = supShipments.reduce((sum: number, sh: any) => sum + (Number(sh.total_quantity) || 0), 0);
      const lastShipment = supShipments.length > 0
        ? supShipments.reduce((latest: any, sh: any) => {
            const d = new Date(sh.created_at).getTime();
            return d > (latest?.time || 0) ? { time: d, date: sh.created_at } : latest;
          }, { time: 0, date: "" })
        : null;
      const cats = (s.categories || []).map((c: any) => c.name).join(", ");

      return {
        id: s.id,
        name: s.name,
        contactPerson: s.contact_person || "—",
        phone: s.phone || "—",
        email: s.email || "—",
        status: s.status || "active",
        shipmentCount: supShipments.length,
        totalImported,
        lastDelivery: lastShipment?.date ? new Date(lastShipment.date).toLocaleDateString("vi-VN") : "—",
        lastDeliveryRaw: lastShipment?.time || 0,
        categories: cats || "—",
      };
    });
  }, [suppliers, shipments]);

  const filtered = useMemo(() => {
    let rows = [...flatData];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.contactPerson.toLowerCase().includes(q) ||
          r.categories.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "shipments": cmp = a.shipmentCount - b.shipmentCount; break;
        case "totalImported": cmp = a.totalImported - b.totalImported; break;
        case "lastDelivery": cmp = a.lastDeliveryRaw - b.lastDeliveryRaw; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [flatData, search, sortField, sortDir]);

  // Dữ liệu biểu đồ: Top 8 đối tác có sản lượng nhập kho cao nhất
  const chartData = useMemo(() => {
    return [...flatData]
      .sort((a, b) => b.totalImported - a.totalImported)
      .slice(0, 8)
      .map((r) => ({
        name: r.name.length > 12 ? r.name.substring(0, 12) + "…" : r.name,
        value: r.totalImported,
      }));
  }, [flatData]);

  const activeCount = useMemo(() => flatData.filter((r) => r.status === "active").length, [flatData]);
  const totalShipmentCount = useMemo(() => flatData.reduce((s, r) => s + r.shipmentCount, 0), [flatData]);
  const totalImportedAll = useMemo(() => flatData.reduce((s, r) => s + r.totalImported, 0), [flatData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const handleExport = () => {
    downloadExcel(
      filtered.map((r) => ({ ...r })),
      [
        { key: "name", header: t("report_col_supplier"), width: 30 },
        { key: "contactPerson", header: t("report_col_contact"), width: 20 },
        { key: "phone", header: t("phone_number"), width: 15 },
        { key: "email", header: t("email"), width: 25 },
        { key: "categories", header: t("report_col_category"), width: 25 },
        { key: "shipmentCount", header: t("report_col_shipments"), width: 15 },
        { key: "totalImported", header: t("report_col_total_imported"), width: 20 },
        { key: "lastDelivery", header: t("report_col_last_delivery"), width: 20 },
        { key: "status", header: t("report_col_status"), width: 15 },
      ],
      reportFilename("supplier_report"),
      "Suppliers"
    );
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
      {/* Khu vực Biểu đồ & Chỉ số thống kê tổng quan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bộ Thẻ chỉ số */}
        <div className="space-y-4">
          {[
            { label: t("report_active_suppliers"), value: activeCount, icon: Users, color: "blue" },
            { label: t("report_total_shipment_count"), value: totalShipmentCount, icon: Truck, color: "green" },
            { label: t("report_col_total_imported"), value: `${formatVND(totalImportedAll)} kg`, icon: Package, color: "orange" },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-neutral-950 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  card.color === "blue" && "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400",
                  card.color === "green" && "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
                  card.color === "orange" && "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400",
                )}>
                  <card.icon size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{card.label}</p>
                  <p className="text-lg font-black text-neutral-900 dark:text-neutral-50 font-mono">{card.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Vùng Hiển thị Biểu đồ cột */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-950 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <h4 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp size={14} />
            {t("top_suppliers")}
          </h4>
          {chartData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-neutral-800" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} angle={-20} textAnchor="end" height={50} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontSize: "12px" }}
                    formatter={(value: any) => [`${Number(value).toLocaleString()} kg`, t("report_col_total_imported")]}
                  />
                  <Bar dataKey="value" fill="#004A99" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-neutral-400 py-12">{t("report_no_data")}</p>
          )}
        </div>
      </div>

      {/* Thanh công cụ Tìm kiếm & Export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search_suppliers")}
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

      {/* Bảng dữ liệu chi tiết Đối tác Cung cấp */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
                {([
                  { field: "name" as SortField, label: t("report_col_supplier") },
                  { field: "shipments" as SortField, label: t("report_col_shipments") },
                  { field: "totalImported" as SortField, label: t("report_col_total_imported") },
                  { field: "lastDelivery" as SortField, label: t("report_col_last_delivery") },
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
                <th className="p-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest whitespace-nowrap">{t("report_col_contact")}</th>
                <th className="p-4 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest whitespace-nowrap">{t("report_col_status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-neutral-400 dark:text-neutral-500 font-medium">
                    {t("report_no_data")}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                    <td className="p-4">
                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{row.name}</p>
                      {row.categories !== "—" && (
                        <p className="text-[10px] text-taika-blue dark:text-blue-400 font-medium mt-0.5">{row.categories}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-black font-mono text-neutral-900 dark:text-neutral-50">{row.shipmentCount}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-bold font-mono text-green-600 dark:text-green-400">{formatVND(row.totalImported)} kg</span>
                    </td>
                    <td className="p-4 text-xs font-medium text-neutral-500 dark:text-neutral-400">{row.lastDelivery}</td>
                    <td className="p-4">
                      <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{row.contactPerson}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">{row.phone}</p>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2.5 py-1 text-[10px] font-bold rounded-full",
                        row.status === "active" && "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400",
                        row.status === "pending" && "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400",
                        row.status === "inactive" && "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400",
                      )}>
                        {row.status === "active" ? t("status_active") : row.status === "pending" ? t("status_pending") : t("status_inactive")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">{filtered.length} {t("suppliers_count")}</p>
        </div>
      </div>
    </div>
  );
}
