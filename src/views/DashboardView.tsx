import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Plus,
  History,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardViewProps {
  onAction: (action: string) => void;
}

// Bảng màu cho biểu đồ tròn
const PIE_COLORS = [
  "#004A99", "#10B981", "#E31E24", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

/**
 * Giao diện Bảng điều khiển (Dashboard).
 * Hiển thị các chỉ số tổng quan (KPIs), biểu đồ thống kê, cảnh báo FEFO và các hoạt động nhập xuất kho.
 * @param onAction Hàm callback gọi hành động nhanh như kiểm kê, điều chuyển
 */
export default function DashboardView({ onAction }: DashboardViewProps) {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();

  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [chartRange, setChartRange] = useState<"7d" | "30d">("7d");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const ts = Date.now();
        const [invRes, actRes, prodRes] = await Promise.all([
          fetch(`/api/inventory?_t=${ts}`),
          fetch(`/api/activities?_t=${ts}`),
          fetch(`/api/products?_t=${ts}`),
        ]);
        const invData = invRes.ok ? await invRes.json() : [];
        const actData = actRes.ok ? await actRes.json() : [];
        const prodData = prodRes.ok ? await prodRes.json() : [];
        setInventory(invData || []);
        setActivities(actData || []);
        setProducts(prodData || []);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ── Tính toán các chỉ số KPI ──
  const kpis = useMemo(() => {
    const totalStock = inventory.reduce(
      (sum: number, item: any) => sum + Number(item.quantity || 0),
      0
    );

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);

    // Các hoạt động trong tháng này
    const currentMonthActs = activities.filter(
      (a: any) => a.created_at && new Date(a.created_at) >= thirtyDaysAgo
    );
    // Các hoạt động trong tháng trước
    const prevMonthActs = activities.filter(
      (a: any) =>
        a.created_at &&
        new Date(a.created_at) >= sixtyDaysAgo &&
        new Date(a.created_at) < thirtyDaysAgo
    );

    const inboundQty = currentMonthActs
      .filter((a: any) => a.type === "inbound")
      .reduce((sum: number, a: any) => sum + Number(a.quantity || 0), 0);

    const outboundQty = currentMonthActs
      .filter((a: any) => a.type === "outbound")
      .reduce((sum: number, a: any) => sum + Number(a.quantity || 0), 0);

    const prevInbound = prevMonthActs
      .filter((a: any) => a.type === "inbound")
      .reduce((sum: number, a: any) => sum + Number(a.quantity || 0), 0);
    const prevOutbound = prevMonthActs
      .filter((a: any) => a.type === "outbound")
      .reduce((sum: number, a: any) => sum + Number(a.quantity || 0), 0);

    const inboundTrend =
      prevInbound > 0
        ? (((inboundQty - prevInbound) / prevInbound) * 100).toFixed(1)
        : inboundQty > 0
        ? "+100"
        : "0";
    const outboundTrend =
      prevOutbound > 0
        ? (((outboundQty - prevOutbound) / prevOutbound) * 100).toFixed(1)
        : outboundQty > 0
        ? "+100"
        : "0";

    // Sắp hết hàng: sản phẩm có tổng số lượng tồn kho < mức tối thiểu
    const inventoryByProduct: Record<string, number> = {};
    inventory.forEach((item: any) => {
      inventoryByProduct[item.product_id] =
        (inventoryByProduct[item.product_id] || 0) + Number(item.quantity || 0);
    });

    const lowStockCount = products.filter((p: any) => {
      const currentQty = inventoryByProduct[p.id] || 0;
      const minLevel = p.min_stock_level || 0;
      return minLevel > 0 && currentQty < minLevel;
    }).length;

    return {
      totalStock,
      inboundQty,
      outboundQty,
      lowStockCount,
      inboundTrend,
      outboundTrend,
    };
  }, [inventory, activities, products]);

  // ── Dữ liệu biểu đồ (Biểu đồ vùng) ──
  const chartData = useMemo(() => {
    const now = new Date();
    const days = chartRange === "7d" ? 7 : 30;
    const localeCode = i18n.language === "vi" ? "vi-VN" : "en-US";

    const map: Record<string, { name: string; inbound: number; outbound: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split("T")[0];
      const name =
        days <= 7
          ? d.toLocaleDateString(localeCode, { weekday: "short" })
          : `${d.getDate()}/${d.getMonth() + 1}`;
      map[key] = { name, inbound: 0, outbound: 0 };
    }

    activities.forEach((act: any) => {
      if (!act.created_at) return;
      const key = new Date(act.created_at).toISOString().split("T")[0];
      if (map[key]) {
        if (act.type === "inbound")
          map[key].inbound += Number(act.quantity || 0);
        if (act.type === "outbound")
          map[key].outbound += Number(act.quantity || 0);
      }
    });

    return Object.values(map);
  }, [activities, chartRange, i18n.language]);

  // ── Dữ liệu biểu đồ tròn (theo trạng thái sản phẩm) ──
  const pieData = useMemo(() => {
    const stateMap: Record<string, number> = {};
    inventory.forEach((item: any) => {
      const state = item.products?.state || "raw";
      stateMap[state] = (stateMap[state] || 0) + Number(item.quantity || 0);
    });

    const stateLabels: Record<string, string> = {
      raw: t("raw"),
      cooked: t("cooked"),
      processed: t("processed"),
    };

    return Object.entries(stateMap).map(([state, value], i) => ({
      name: stateLabels[state] || state,
      value: Math.round(value),
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [inventory, t]);

  // ── Hoạt động gần đây ──
  const recentMovements = useMemo(() => {
    return activities
      .slice(0, 8) // Hiển thị 8 hoạt động gần nhất, không lược bỏ loại nào
      .map((act: any) => {
        const now = new Date();
        const created = new Date(act.created_at);
        const diffMs = now.getTime() - created.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        let timeAgo: string;
        if (diffMin < 60) timeAgo = `${diffMin}m`;
        else if (diffHr < 24) timeAgo = `${diffHr}h`;
        else timeAgo = `${diffDay}d`;

        let prefix = "";
        const qtyVal = Number(act.quantity || 0);
        if (act.type === "inbound") prefix = "+";
        else if (act.type === "outbound") prefix = "-";
        else if (qtyVal > 0 && (act.type === "adjustment" || act.type === "stock_take")) prefix = "+";

        return {
          type: act.type,
          product: act.products?.name || "—",
          batch: act.batch_number || "—",
          qty: `${prefix}${qtyVal.toLocaleString()}`,
          time: timeAgo,
        };
      });
  }, [activities]);

  // ── Cảnh báo hết hạn (FEFO) ──
  const fefoAlerts = useMemo(() => {
    const now = new Date();
    const items = inventory
      .filter((item: any) => {
        const exp = item.expiry_date || item.batches?.expiry_date;
        return exp && new Date(exp) > now;
      })
      .map((item: any) => {
        const exp = item.expiry_date || item.batches?.expiry_date;
        const expiryDate = new Date(exp);
        const daysLeft = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / 86400000
        );
        // Thanh tiến trình: 100% = hết hạn, 0% = mới (tối đa 365 ngày)
        const maxDays = 365;
        const progress = Math.min(
          100,
          Math.max(0, Math.round(((maxDays - daysLeft) / maxDays) * 100))
        );
        return {
          product: item.products?.name || "—",
          batch: item.batches?.lot_number || item.batch_number || "—",
          days: daysLeft,
          progress,
          expDate: exp,
        };
      })
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);

    return items;
  }, [inventory]);

  // Định dạng số rút gọn
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return n.toLocaleString();
    return n.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-taika-blue animate-spin" />
      </div>
    );
  }

  const kpiCards = [
    {
      label: t("stock_level"),
      value: formatNumber(kpis.totalStock),
      unit: "kg",
      trend: `${kpis.totalStock > 0 ? "+" : ""}${kpis.totalStock > 0 ? "—" : "0"}`,
      trendType: "neutral" as const,
      color: "blue" as const,
      icon: Boxes,
    },
    {
      label: t("inbound"),
      value: formatNumber(kpis.inboundQty),
      unit: "kg",
      trend: `${Number(kpis.inboundTrend) >= 0 ? "+" : ""}${kpis.inboundTrend}%`,
      trendType: (Number(kpis.inboundTrend) >= 0 ? "up" : "down") as "up" | "down",
      color: "green" as const,
      icon: ArrowDownLeft,
    },
    {
      label: t("outbound"),
      value: formatNumber(kpis.outboundQty),
      unit: "kg",
      trend: `${Number(kpis.outboundTrend) >= 0 ? "+" : ""}${kpis.outboundTrend}%`,
      trendType: (Number(kpis.outboundTrend) >= 0 ? "up" : "down") as "up" | "down",
      color: "orange" as const,
      icon: ArrowUpRight,
    },
    {
      label: t("low_stock_alert"),
      value: kpis.lowStockCount.toString(),
      unit: "SKUs",
      trend: kpis.lowStockCount > 0 ? "Critical" : "OK",
      trendType: (kpis.lowStockCount > 0 ? "critical" : "ok") as "critical" | "ok",
      color: "red" as const,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Nút thao tác phần đầu */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
            {t("good_morning")}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
            {t("overview_desc")}
          </p>
        </div>
        <div className="flex gap-2">
          {hasRole("admin", "manager") && (
            <>
              <button
                onClick={() => onAction("stock_take")}
                className="px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-200 cursor-pointer flex items-center gap-2 shadow-sm"
              >
                <CheckCircle2 size={14} /> {t("stock_take")}
              </button>
              <button
                onClick={() => onAction("internal_transfer")}
                className="px-4 py-2 bg-taika-blue text-white rounded-lg text-xs font-semibold hover:bg-taika-blue/90 shadow-md shadow-taika-blue/10 transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
              >
                <Plus size={14} /> {t("internal_transfer")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Các thẻ chỉ số KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.1)] transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider mb-1">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-1">
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 font-mono tracking-tight">
                    {stat.value}
                  </h3>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                    {stat.unit}
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200",
                  stat.color === "blue" &&
                    "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 group-hover:bg-taika-blue group-hover:text-white",
                  stat.color === "green" &&
                    "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 group-hover:bg-green-600 group-hover:text-white",
                  stat.color === "orange" &&
                    "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white",
                  stat.color === "red" &&
                    "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400 group-hover:bg-taika-red group-hover:text-white"
                )}
              >
                <stat.icon size={20} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1",
                  stat.trendType === "critical"
                    ? "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400"
                    : stat.trendType === "ok"
                    ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                    : stat.trendType === "down"
                    ? "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400"
                    : stat.trendType === "neutral"
                    ? "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400"
                    : "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                )}
              >
                {stat.trendType === "up" && <TrendingUp size={10} />}
                {stat.trendType === "down" && <TrendingDown size={10} />}
                {stat.trendType === "neutral" && <Boxes size={10} />}
                {stat.trend}
              </span>
              {stat.trendType !== "critical" && stat.trendType !== "ok" && stat.trendType !== "neutral" && (
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  {t("vs_last_month")}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Hàng biểu đồ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Khu vực biểu đồ thống kê chính */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-950 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-50">
              {t("stock_level")}
            </h3>
            <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-md">
              <button
                onClick={() => setChartRange("7d")}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-semibold cursor-pointer transition-colors duration-200",
                  chartRange === "7d"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50 shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50"
                )}
              >
                7D
              </button>
              <button
                onClick={() => setChartRange("30d")}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-semibold cursor-pointer transition-colors duration-200",
                  chartRange === "30d"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50 shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50"
                )}
              >
                30D
              </button>
            </div>
          </div>
          <div className="h-64 w-full cursor-crosshair">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="colorInbound"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#004A99"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="#004A99"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="colorOutbound"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#E31E24"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="#E31E24"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E5E7EB"
                    className="dark:stroke-neutral-800"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#6B7280" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#6B7280" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                      fontSize: "12px",
                      backgroundColor: "var(--color-bg, #fff)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="inbound"
                    stroke="#004A99"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorInbound)"
                    activeDot={{ r: 6 }}
                    name={t("inbound")}
                  />
                  <Area
                    type="monotone"
                    dataKey="outbound"
                    stroke="#E31E24"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorOutbound)"
                    activeDot={{ r: 6 }}
                    name={t("outbound")}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-neutral-400">
                {t("no_data_available")}
              </div>
            )}
          </div>
        </div>

        {/* Phân bổ danh mục - Biểu đồ tròn */}
        <div className="bg-white dark:bg-neutral-950 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm transition-shadow duration-200 hover:shadow-md flex flex-col">
          <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-50 mb-2">
            {t("category_distribution")}
          </h3>
          {pieData.length > 0 ? (
            <>
              <div className="flex-1 flex items-center justify-center -my-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        fontSize: "12px",
                        border: "none",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full transition-transform duration-200 group-hover:scale-150"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-50 font-mono">
                      {item.value.toLocaleString()} kg
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-neutral-400">
              {t("no_data_available")}
            </div>
          )}
        </div>
      </div>

      {/* Hàng danh sách bảng */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bảng hoạt động kho gần đây */}
        <div className="bg-white dark:bg-neutral-950 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-50">
              {t("recent_movements")}
            </h3>
            <button
              onClick={() => onAction("activities")}
              className="text-taika-blue dark:text-blue-400 text-[11px] font-semibold hover:underline cursor-pointer transition-all duration-200"
            >
              {t("view_all")}
            </button>
          </div>
          <div className="flex-1 overflow-auto pr-1">
            {recentMovements.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="pb-2 text-[10px] font-bold text-neutral-400 uppercase">
                      {t("product")}
                    </th>
                    <th className="pb-2 text-[10px] font-bold text-neutral-400 uppercase text-right">
                      {t("qty")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {recentMovements.map((move, i) => (
                    <tr
                      key={i}
                      className="group hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors duration-150 cursor-pointer"
                    >
                      <td className="py-2.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-7 h-7 rounded flex items-center justify-center shrink-0",
                              move.type === "inbound"
                                ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                                : move.type === "outbound"
                                ? "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400"
                                : move.type === "transfer"
                                ? "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400"
                                : "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            )}
                          >
                            {move.type === "inbound" ? (
                              <ArrowDownLeft size={12} />
                            ) : move.type === "outbound" ? (
                              <ArrowUpRight size={12} />
                            ) : move.type === "transfer" ? (
                              <History size={12} />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-50 truncate">
                              {move.product}
                            </p>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                              {move.batch} • {move.time}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <p
                          className={cn(
                            "text-[11px] font-bold font-mono",
                            move.type === "inbound"
                              ? "text-green-600 dark:text-green-400"
                              : move.type === "outbound"
                              ? "text-taika-red dark:text-red-400"
                              : move.type === "transfer"
                              ? "text-taika-blue dark:text-blue-400"
                              : "text-purple-600 dark:text-purple-400"
                          )}
                        >
                          {move.qty}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-neutral-400">
                {t("no_data_available")}
              </div>
            )}
          </div>
        </div>

        {/* Cảnh báo hạn sử dụng FEFO */}
        <div className="bg-white dark:bg-neutral-950 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-50">
              {t("fefo_suggestion")}
            </h3>
            <span className="px-2 py-0.5 bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 text-[10px] font-bold rounded">
              {t("automated")}
            </span>
          </div>
          <div className="space-y-2 flex-1 overflow-auto pr-1">
            {fefoAlerts.length > 0 ? (
              fefoAlerts.map((item, i) => (
                <div
                  key={i}
                  className="p-3 border border-neutral-100 dark:border-neutral-800 rounded-lg hover:border-taika-red/30 bg-neutral-50/30 dark:bg-neutral-900/30 transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[11px] text-neutral-900 dark:text-neutral-50 truncate">
                        {item.product}
                      </p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                        #{item.batch}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={cn(
                          "text-[10px] font-bold uppercase",
                          item.days <= 30
                            ? "text-taika-red dark:text-red-400"
                            : item.days <= 90
                            ? "text-orange-500 dark:text-orange-400"
                            : "text-green-600 dark:text-green-400"
                        )}
                      >
                        {t("exp")}: {item.days}d
                      </p>
                    </div>
                  </div>
                  {/* Thanh tiến trình mini cho ngày hết hạn */}
                  <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        item.days <= 30
                          ? "bg-taika-red"
                          : item.days <= 90
                          ? "bg-orange-500"
                          : "bg-green-500"
                      )}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-neutral-400">
                {t("no_data_available")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
