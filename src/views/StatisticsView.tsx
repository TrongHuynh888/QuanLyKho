import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { MOCK_CHART_DATA } from "../data/mockData";
import { motion } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function StatisticsView() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("detailed_statistics")}</h3>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold">{t("today")}</button>
          <button className="px-4 py-2 bg-taika-blue text-white rounded-xl text-sm font-bold shadow-lg shadow-taika-blue/10">{t("last_7_days")}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white dark:bg-neutral-950 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <h4 className="font-bold text-neutral-400 dark:text-neutral-500 text-xs uppercase tracking-widest mb-6">{t("warehouse_occupancy")}</h4>
          <div className="relative w-48 h-48 mx-auto">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle className="text-neutral-100 stroke-current" strokeWidth="10" fill="transparent" r="40" cx="50" cy="50" />
              <circle className="text-taika-blue dark:text-blue-400 stroke-current" strokeWidth="10" strokeLinecap="round" fill="transparent" r="40" cx="50" cy="50" strokeDasharray="251.2" strokeDashoffset="62.8" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-neutral-900 dark:text-neutral-50">75%</span>
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">Occupied</span>
            </div>
          </div>
          <div className="mt-8 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500 dark:text-neutral-400 font-medium">{t("cold_storage_a")}</span>
              <span className="font-bold">85%</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500 dark:text-neutral-400 font-medium">{t("cold_storage_b")}</span>
              <span className="font-bold">60%</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white dark:bg-neutral-950 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <h4 className="font-bold text-neutral-400 dark:text-neutral-500 text-xs uppercase tracking-widest mb-6">{t("inventory_fluctuation")}</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_CHART_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                <Tooltip />
                <Bar dataKey="inbound" fill="#004A99" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outbound" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-neutral-950 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <h4 className="font-bold text-neutral-400 dark:text-neutral-500 text-xs uppercase tracking-widest mb-6">{t("top_exported_products")}</h4>
          <div className="space-y-6">
            {[
              { name: "Tôm Thẻ PTO 20/30", qty: "2,500 kg", percent: 85 },
              { name: "Tôm Sú HOSO 30/40", qty: "1,800 kg", percent: 65 },
              { name: "Tôm Thẻ PD 40/50", qty: "1,200 kg", percent: 45 },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>{item.name}</span>
                  <span>{item.qty}</span>
                </div>
                <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percent}%` }}
                    className="h-full bg-taika-blue rounded-full" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-950 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <h4 className="font-bold text-neutral-400 dark:text-neutral-500 text-xs uppercase tracking-widest mb-6">{t("employee_performance")}</h4>
          <div className="space-y-4">
            {[
              { name: "Nguyễn Văn A", tasks: 45, rating: 4.8 },
              { name: "Trần Thị B", tasks: 38, rating: 4.9 },
              { name: "Lê Văn C", tasks: 32, rating: 4.7 },
            ].map((staff, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl">
                <div className="w-10 h-10 bg-taika-blue-light dark:bg-blue-500/10 rounded-full flex items-center justify-center text-taika-blue dark:text-blue-400 font-bold">
                  {staff.name[0]}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-neutral-900 dark:text-neutral-50">{staff.name}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{staff.tasks} {t("orders_completed")}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-taika-blue dark:text-blue-400">{staff.rating}</p>
                  <p className="text-[10px] font-bold text-neutral-300 dark:text-neutral-600 uppercase">{t("rating")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
