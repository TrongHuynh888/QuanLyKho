import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { MOCK_CHART_DATA, MOCK_PIE_DATA } from "../data/mockData";
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  History,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
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
  BarChart,
  Bar,
} from "recharts";

interface DashboardViewProps {
  onAction: (action: string) => void;
}

export default function DashboardView({ onAction }: DashboardViewProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">{t("good_morning")}</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{t("overview_desc")}</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* KPI Cards (Dense Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("stock_level"), value: "12,450", unit: "kg", trend: "+12.5%", color: "blue", icon: Boxes },
          { label: t("inbound"), value: "850", unit: "kg", trend: "+5.2%", color: "green", icon: ArrowDownLeft },
          { label: t("outbound"), value: "1,200", unit: "kg", trend: "-2.1%", color: "orange", icon: ArrowUpRight },
          { label: t("low_stock_alert"), value: "12", unit: "SKUs", trend: "Critical", color: "red", icon: AlertTriangle },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.1)] transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider mb-1">{stat.label}</p>
                <div className="flex items-baseline gap-1">
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 font-mono tracking-tight">{stat.value}</h3>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{stat.unit}</span>
                </div>
              </div>
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200",
                stat.color === "blue" && "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 group-hover:bg-taika-blue group-hover:text-white",
                stat.color === "green" && "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 group-hover:bg-green-600 group-hover:text-white",
                stat.color === "orange" && "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white",
                stat.color === "red" && "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400 group-hover:bg-taika-red group-hover:text-white"
              )}>
                <stat.icon size={20} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1",
                stat.color === "red" ? "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400" : "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
              )}>
                {stat.color !== "red" && <TrendingUp size={10} />}
                {stat.trend}
              </span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{t("vs_last_month")}</span>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Analytics Area */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-950 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm transition-shadow duration-200 hover:shadow-md cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-50">{t("stock_level")}</h3>
            <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-md">
              <button className="px-2 py-1 bg-white dark:bg-neutral-700 rounded text-[10px] font-semibold text-neutral-900 dark:text-neutral-50 shadow-sm cursor-pointer transition-colors duration-200">7D</button>
              <button className="px-2 py-1 rounded text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50 cursor-pointer transition-colors duration-200">30D</button>
            </div>
          </div>
          <div className="h-64 w-full cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_CHART_DATA} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004A99" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#004A99" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E31E24" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#E31E24" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-neutral-800" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6B7280" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#6B7280" }} />
                <Tooltip 
                  contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", fontSize: "12px", backgroundColor: "var(--color-bg, #fff)" }}
                />
                <Area type="monotone" dataKey="inbound" stroke="#004A99" strokeWidth={2} fillOpacity={1} fill="url(#colorInbound)" activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="outbound" stroke="#E31E24" strokeWidth={2} fillOpacity={1} fill="url(#colorOutbound)" activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Secondary Analytics */}
        <div className="bg-white dark:bg-neutral-950 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm transition-shadow duration-200 hover:shadow-md flex flex-col cursor-pointer">
          <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-50 mb-2">{t("category_distribution")}</h3>
          <div className="flex-1 flex items-center justify-center -my-4">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={MOCK_PIE_DATA}
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {MOCK_PIE_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity duration-200 cursor-pointer" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "none", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {MOCK_PIE_DATA.map((item, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full transition-transform duration-200 group-hover:scale-150" style={{ backgroundColor: item.color }} />
                  <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">{t(item.name.toLowerCase())}</span>
                </div>
                <span className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-50 font-mono">{item.value} kg</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Row (Denser Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Movements Table */}
        <div className="bg-white dark:bg-neutral-950 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-50">{t("recent_movements")}</h3>
            <button className="text-taika-blue dark:text-blue-400 text-[11px] font-semibold hover:underline cursor-pointer transition-all duration-200">{t("view_all")}</button>
          </div>
          <div className="flex-1 overflow-auto pr-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="pb-2 text-[10px] font-bold text-neutral-400 uppercase">{t("product")}</th>
                  <th className="pb-2 text-[10px] font-bold text-neutral-400 uppercase text-right">{t("qty")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {[
                  { type: "inbound", product: "PTO Shrimp 20/30", batch: "LOT-001", qty: "+250", time: "2h" },
                  { type: "outbound", product: "HOSO Black Tiger", batch: "LOT-045", qty: "-120", time: "4h" },
                  { type: "transfer", product: "PD Vannamei", batch: "LOT-012", qty: "500", time: "6h" },
                  { type: "inbound", product: "HLSO Scampi", batch: "LOT-089", qty: "+1,000", time: "1d" },
                ].map((move, i) => (
                  <tr key={i} className="group hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors duration-150 cursor-pointer">
                    <td className="py-2.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-7 h-7 rounded flex items-center justify-center shrink-0",
                          move.type === "inbound" ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400" : 
                          move.type === "outbound" ? "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400" : "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400"
                        )}>
                          {move.type === "inbound" ? <ArrowDownLeft size={12} /> : 
                           move.type === "outbound" ? <ArrowUpRight size={12} /> : <History size={12} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-50 truncate">{move.product}</p>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">{move.batch} • {move.time}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <p className={cn(
                        "text-[11px] font-bold font-mono",
                        move.type === "inbound" ? "text-green-600 dark:text-green-400" : 
                        move.type === "outbound" ? "text-taika-red dark:text-red-400" : "text-neutral-600 dark:text-neutral-300"
                      )}>{move.qty}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FEFO Alerts */}
        <div className="bg-white dark:bg-neutral-950 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-50">{t("fefo_suggestion")}</h3>
            <span className="px-2 py-0.5 bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 text-[10px] font-bold rounded">{t("automated")}</span>
          </div>
          <div className="space-y-2 flex-1 overflow-auto pr-1">
            {[
              { product: "HOSO Black Tiger 30/40", batch: "LOT-2023-12-01", days: 60, progress: 80 },
              { product: "PTO Shrimp 20/30", batch: "LOT-2023-11-15", days: 45, progress: 85 },
              { product: "PD Vannamei 40/50", batch: "LOT-2023-10-20", days: 20, progress: 95 },
            ].map((item, i) => (
              <div key={i} className="p-3 border border-neutral-100 dark:border-neutral-800 rounded-lg hover:border-taika-red/30 bg-neutral-50/30 dark:bg-neutral-900/30 transition-all duration-200 cursor-pointer group">
                <div className="flex justify-between items-center mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[11px] text-neutral-900 dark:text-neutral-50 truncate">{item.product}</p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">#{item.batch}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold text-taika-red dark:text-red-400 uppercase">{t("exp")}: {item.days}d</p>
                  </div>
                </div>
                {/* Micro Progress Bar for Expiry */}
                <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500", item.progress > 90 ? "bg-taika-red" : "bg-orange-500")} style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
