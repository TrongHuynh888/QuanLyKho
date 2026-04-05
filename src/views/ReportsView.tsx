import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toCSV, downloadCSV, reportFilename } from "../lib/exportUtils";
import { motion, AnimatePresence } from "motion/react";
import {
  Boxes,
  AlertTriangle,
  Truck,
  FileText,
  History,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Download,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Sub-reports
import InventoryReport from "../components/reports/InventoryReport";
import MovementReport from "../components/reports/MovementReport";
import ExpiryReport from "../components/reports/ExpiryReport";
import SupplierReport from "../components/reports/SupplierReport";

type ReportTab = "dashboard" | "inventory" | "movement" | "expiry" | "supplier";

interface ChartDataPoint {
  name: string;
  inbound: number;
  outbound: number;
}

export default function ReportsView() {
  const { t } = useTranslation();
  const [activeReport, setActiveReport] = useState<ReportTab>("dashboard");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "quarter">("week");

  // Fetch activities for the chart
  useEffect(() => {
    (async () => {
      setChartLoading(true);
      try {
        const res = await fetch(`/api/activities?_t=${Date.now()}`);
        if (!res.ok) throw new Error();
        const activities: any[] = await res.json();
        setChartData(computeChartData(activities, chartPeriod));
      } catch {
        setChartData([]);
      }
      setChartLoading(false);
    })();
  }, [chartPeriod]);

  /** Compute chart data aggregated by day labels */
  function computeChartData(activities: any[], period: "week" | "month" | "quarter"): ChartDataPoint[] {
    const now = new Date();
    let days = 7;
    if (period === "month") days = 30;
    if (period === "quarter") days = 90;

    // Generate date buckets
    const buckets: { key: string; label: string; inbound: number; outbound: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      let label: string;
      if (period === "week") {
        label = d.toLocaleDateString("vi-VN", { weekday: "short" });
      } else if (period === "month") {
        label = `${d.getDate()}/${d.getMonth() + 1}`;
      } else {
        // quarter: show weekly labels
        if (i % 7 === 0 || i === 0) label = `${d.getDate()}/${d.getMonth() + 1}`;
        else label = "";
      }
      buckets.push({ key, label, inbound: 0, outbound: 0 });
    }

    // Aggregate activities into buckets
    for (const act of activities) {
      const dateKey = new Date(act.created_at).toISOString().slice(0, 10);
      const bucket = buckets.find((b) => b.key === dateKey);
      if (!bucket) continue;
      const qty = Number(act.quantity) || 0;
      if (act.type === "inbound") bucket.inbound += qty;
      else if (act.type === "outbound") bucket.outbound += qty;
    }

    // For quarter, aggregate weekly
    if (period === "quarter") {
      const weekly: ChartDataPoint[] = [];
      for (let i = 0; i < buckets.length; i += 7) {
        const chunk = buckets.slice(i, i + 7);
        const inbound = chunk.reduce((s, c) => s + c.inbound, 0);
        const outbound = chunk.reduce((s, c) => s + c.outbound, 0);
        const lastDay = chunk[chunk.length - 1];
        weekly.push({ name: lastDay.label || `W${Math.floor(i / 7) + 1}`, inbound, outbound });
      }
      return weekly;
    }

    return buckets
      .filter((b) => b.label !== "")
      .map((b) => ({ name: b.label, inbound: b.inbound, outbound: b.outbound }));
  }

  /** Export an aggregated summary CSV */
  const handleExportSummary = async () => {
    try {
      const [invRes, actRes, supRes] = await Promise.all([
        fetch(`/api/inventory?_t=${Date.now()}`),
        fetch(`/api/activities?_t=${Date.now()}`),
        fetch(`/api/suppliers?_t=${Date.now()}`),
      ]);
      const inv = invRes.ok ? await invRes.json() : [];
      const act = actRes.ok ? await actRes.json() : [];
      const sup = supRes.ok ? await supRes.json() : [];

      const totalQty = inv.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
      const totalInbound = act.filter((a: any) => a.type === "inbound").reduce((s: number, a: any) => s + (Number(a.quantity) || 0), 0);
      const totalOutbound = act.filter((a: any) => a.type === "outbound").reduce((s: number, a: any) => s + (Number(a.quantity) || 0), 0);
      const activeSuppliers = sup.filter((s: any) => s.status === "active").length;

      const csv = toCSV(
        [
          { metric: t("report_total_qty"), value: `${totalQty} kg` },
          { metric: t("report_total_inbound"), value: `${totalInbound} kg` },
          { metric: t("report_total_outbound"), value: `${totalOutbound} kg` },
          { metric: t("report_active_suppliers"), value: String(activeSuppliers) },
          { metric: t("total_suppliers"), value: String(sup.length) },
        ],
        [
          { key: "metric", header: "Metric" },
          { key: "value", header: "Value" },
        ]
      );
      downloadCSV(csv, reportFilename("summary_report"));
    } catch {}
  };

  const reportCards = [
    { id: "inventory" as ReportTab, title: t("inventory_report"), desc: t("inventory_report_desc"), icon: Boxes, color: "blue" },
    { id: "movement" as ReportTab, title: t("in_out_report"), desc: t("in_out_report_desc"), icon: History, color: "green" },
    { id: "expiry" as ReportTab, title: t("expiry_report"), desc: t("expiry_report_desc"), icon: AlertTriangle, color: "red" },
    { id: "supplier" as ReportTab, title: t("supplier_report"), desc: t("supplier_report_desc"), icon: Truck, color: "orange" },
  ];

  const getReportTitle = () => {
    const card = reportCards.find((c) => c.id === activeReport);
    return card?.title || t("reports_analysis");
  };

  // Render sub-report
  if (activeReport !== "dashboard") {
    return (
      <div className="space-y-6">
        {/* Header with back */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveReport("dashboard")}
            className="p-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-sm"
          >
            <ArrowLeft size={18} className="text-neutral-600 dark:text-neutral-300" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{getReportTitle()}</h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("report_back_to_dashboard")}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeReport}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {activeReport === "inventory" && <InventoryReport />}
            {activeReport === "movement" && <MovementReport />}
            {activeReport === "expiry" && <ExpiryReport />}
            {activeReport === "supplier" && <SupplierReport />}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("reports_analysis")}</h3>
        <button
          onClick={handleExportSummary}
          className="px-6 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl font-bold flex items-center gap-2 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all text-neutral-900 dark:text-neutral-50"
        >
          <FileText size={20} /> {t("export_summary")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-950 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-50">{t("inventory_history")}</h3>
            <select
              value={chartPeriod}
              onChange={(e) => setChartPeriod(e.target.value as any)}
              className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold outline-none text-neutral-900 dark:text-neutral-50"
            >
              <option value="week">{t("by_week")}</option>
              <option value="month">{t("by_month")}</option>
              <option value="quarter">{t("by_quarter")}</option>
            </select>
          </div>
          <div className="h-80 w-full">
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-taika-blue" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <defs>
                    <linearGradient id="reportGradBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#004A99" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#004A99" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="reportGradRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E31E24" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#E31E24" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-neutral-800" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "16px",
                      border: "none",
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                    formatter={(value: any, name: string) => [
                      `${Number(value).toLocaleString()} kg`,
                      name === "inbound" ? t("inbound") : t("outbound"),
                    ]}
                  />
                  <Legend
                    formatter={(value: string) => value === "inbound" ? t("inbound") : t("outbound")}
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px", fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="inbound" stroke="#004A99" strokeWidth={3} dot={{ r: 5, fill: "#004A99", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7, strokeWidth: 3 }} />
                  <Line type="monotone" dataKey="outbound" stroke="#E31E24" strokeWidth={3} dot={{ r: 5, fill: "#E31E24", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7, strokeWidth: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Report Cards */}
        <div className="space-y-6">
          {reportCards.map((report, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setActiveReport(report.id)}
              className="p-6 bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-lg transition-all cursor-pointer group flex items-center gap-4"
            >
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110",
                report.color === "blue" && "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400",
                report.color === "green" && "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
                report.color === "red" && "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400",
                report.color === "orange" && "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
              )}>
                <report.icon size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-neutral-900 dark:text-neutral-50">{report.title}</h4>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{report.desc}</p>
              </div>
              <ChevronRight className="text-neutral-300 dark:text-neutral-600 group-hover:text-taika-blue dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" size={20} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
