import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { MOCK_CHART_DATA } from "../data/mockData";
import {
  Boxes,
  AlertTriangle,
  Truck,
  FileText,
  History,
  ChevronRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ReportsView() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("reports_analysis")}</h3>
        <button className="px-6 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl font-bold flex items-center gap-2 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all">
          <FileText size={20} /> {t("export_summary")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-neutral-950 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg">{t("inventory_history")}</h3>
            <select className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold outline-none">
              <option>{t("by_week")}</option>
              <option>{t("by_month")}</option>
              <option>{t("by_quarter")}</option>
            </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_CHART_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                <Tooltip 
                  contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                />
                <Line type="monotone" dataKey="inbound" stroke="#004A99" strokeWidth={4} dot={{ r: 6, fill: "#004A99", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="outbound" stroke="#E31E24" strokeWidth={4} dot={{ r: 6, fill: "#E31E24", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          {[
            { title: t("inventory_report"), desc: t("inventory_report_desc"), icon: Boxes, color: "blue" },
            { title: t("in_out_report"), desc: t("in_out_report_desc"), icon: History, color: "green" },
            { title: t("expiry_report"), desc: t("expiry_report_desc"), icon: AlertTriangle, color: "red" },
            { title: t("supplier_report"), desc: t("supplier_report_desc"), icon: Truck, color: "orange" },
          ].map((report, i) => (
            <div key={i} className="p-6 bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110",
                report.color === "blue" && "bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400",
                report.color === "green" && "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
                report.color === "red" && "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400",
                report.color === "orange" && "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
              )}>
                <report.icon size={24} />
              </div>
              <div>
                <h4 className="font-bold text-neutral-900 dark:text-neutral-50">{report.title}</h4>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{report.desc}</p>
              </div>
              <ChevronRight className="ml-auto text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors" size={20} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
