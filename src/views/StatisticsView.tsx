import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
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

/**
 * Component hiển thị giao diện báo cáo thống kê chi tiết
 * Cung cấp phân tích về: Sử dụng kho, Biến động tồn kho, Top Sản phẩm xuất, Hiệu suất làm việc
 *
 * @returns {JSX.Element} Giao diện Thống kê
 */
export default function StatisticsView() {
  const { t, i18n } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [occupancyData, setOccupancyData] = useState({ totalPercentage: 0, details: [] as {name: string, percentage: number}[] });
  const [fluctuationData, setFluctuationData] = useState([] as any[]);
  const [topProducts, setTopProducts] = useState([] as any[]);
  const [employeePerformance, setEmployeePerformance] = useState([] as any[]);
  const [dateFilter, setDateFilter] = useState<'day' | 'week' | 'month' | 'year'>('week');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const ts = Date.now();
        const [locRes, invRes, actRes] = await Promise.all([
          fetch(`/api/storage-locations?_t=${ts}`),
          fetch(`/api/inventory?_t=${ts}`),
          fetch(`/api/activities?_t=${ts}`),
        ]);

        const locations = locRes.ok ? await locRes.json() : [];
        const inventory = invRes.ok ? await invRes.json() : [];
        const activities = actRes.ok ? await actRes.json() : [];
        
        // Tỉ lệ lấp đầy Kho hàng
        if (locations && locations.length > 0) {
           const occupiedLocationIds = new Set((inventory || []).filter((i: any) => i.location_id && i.quantity > 0).map((i: any) => i.location_id));
           const totalLocs = locations.length;
           let totalOccupied = 0;
           const whDetails: Record<string, { total: number, occupied: number }> = {};
           
           locations.forEach((loc: any) => {
             const whName = loc.warehouses?.name || 'Unknown Zone';
             if (!whDetails[whName]) whDetails[whName] = { total: 0, occupied: 0 };
             whDetails[whName].total += 1;
             
             if (occupiedLocationIds.has(loc.id)) {
               totalOccupied += 1;
               whDetails[whName].occupied += 1;
             }
           });
           
           const totalPercentage = totalLocs > 0 ? Math.round((totalOccupied / totalLocs) * 100) : 0;
           const details = Object.entries(whDetails).map(([name, stat]) => ({
             name,
             percentage: stat.total > 0 ? Math.round((stat.occupied / stat.total) * 100) : 0
           }));
           
           setOccupancyData({ totalPercentage, details });
        } else {
           setOccupancyData({ totalPercentage: 0, details: [] });
        }

        // Biến động Tồn kho
        const fluctuationMap: Record<string, any> = {};
        const now = new Date();
        const localeCode = i18n.language === "vi" ? "vi-VN" : "en-US";
        
        if (dateFilter === 'day') {
          // Trong 24 giờ qua
          for (let i = 23; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 3600000);
            const key = `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:00`;
            fluctuationMap[key] = { date: key, name: `${d.getHours()}h`, inbound: 0, outbound: 0 };
          }
        } else if (dateFilter === 'week') {
          // Trong 7 ngày qua
          for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 86400000);
            const key = d.toISOString().split('T')[0];
            const name = d.toLocaleDateString(localeCode, { weekday: 'short' });
            fluctuationMap[key] = { date: key, name, inbound: 0, outbound: 0 };
          }
        } else if (dateFilter === 'month') {
          // Trong 30 ngày qua
          for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 86400000);
            const key = d.toISOString().split('T')[0];
            const name = `${d.getDate()}/${d.getMonth()+1}`;
            fluctuationMap[key] = { date: key, name, inbound: 0, outbound: 0 };
          }
        } else if (dateFilter === 'year') {
          // Trong 12 tháng qua
          for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const name = d.toLocaleDateString(localeCode, { month: 'short' });
            fluctuationMap[key] = { date: key, name, inbound: 0, outbound: 0 };
          }
        }
        
        if (activities && activities.length > 0) {
           activities.forEach((act: any) => {
               if (!act.created_at) return;
               const actDate = new Date(act.created_at);
               let key = '';
               
               if (dateFilter === 'day') {
                 key = `${actDate.getDate()}/${actDate.getMonth()+1} ${actDate.getHours()}:00`;
               } else if (dateFilter === 'week' || dateFilter === 'month') {
                 key = actDate.toISOString().split('T')[0];
               } else if (dateFilter === 'year') {
                 key = `${actDate.getFullYear()}-${String(actDate.getMonth() + 1).padStart(2, '0')}`;
               }
               
               if (fluctuationMap[key]) {
                   if (act.type === 'inbound') fluctuationMap[key].inbound += Number(act.quantity);
                   if (act.type === 'outbound') fluctuationMap[key].outbound += Number(act.quantity);
               }
           });
        }
        setFluctuationData(Object.values(fluctuationMap));

        // Sản phẩm xuất đi nhiều nhất
        if (activities && activities.length > 0) {
            const outboundItems = activities.filter((a: any) => a.type === 'outbound');
            const productMap: Record<string, number> = {};
            outboundItems.forEach((item: any) => {
               const pName = item.products?.name || 'Unknown Product';
               productMap[pName] = (productMap[pName] || 0) + Number(item.quantity);
            });
            const sortedProducts = Object.entries(productMap)
                .map(([name, qty]) => ({ name, qty }))
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5);
            
            const maxQty = sortedProducts.length > 0 ? sortedProducts[0].qty : 1;
            setTopProducts(sortedProducts.map(p => ({
               ...p, percent: Math.round((p.qty / maxQty) * 100), qty: `${p.qty.toLocaleString()} kg`
            })));
        } else {
            setTopProducts([]);
        }

        // Hiệu suất làm việc theo Nhân viên
        if (activities && activities.length > 0) {
            const empMap: Record<string, number> = {};
            activities.forEach((act: any) => {
                const empId = act.performed_by;
                if (!empId) return;
                empMap[empId] = (empMap[empId] || 0) + 1;
            });
            
            // Trích xuất tên và ảnh đại diện từ kết quả Query trả về (join SQL qua API)
            const empProfiles: Record<string, { name: string; avatar_url?: string }> = {};
            activities.forEach((act: any) => {
               if (act.performed_by && act.profiles?.full_name) {
                  empProfiles[act.performed_by] = {
                    name: act.profiles.full_name,
                    avatar_url: act.profiles.avatar_url || undefined,
                  };
               }
            });

            const sortedEmps = Object.entries(empMap).map(([id, count]) => {
                const profile = empProfiles[id];
                return {
                    name: profile?.name || `STAFF-${id.substring(0,4).toUpperCase()}`,
                    avatar_url: profile?.avatar_url,
                    tasks: count
                }
            }).sort((a,b) => b.tasks - a.tasks).slice(0, 5);
            
            setEmployeePerformance(sortedEmps);
        } else {
            setEmployeePerformance([]);
        }

      } catch (err) {
         console.error('Failed to fetch statistics data', err);
      } finally {
         setLoading(false);
      }
    }

    fetchData();
  }, [t, dateFilter]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center overflow-x-auto gap-4 pb-2">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex-none">{t("detailed_statistics")}</h3>
        <div className="flex gap-2 flex-none">
          {[
            { id: 'day', label: 'today' },
            { id: 'week', label: 'last_7_days' },
            { id: 'month', label: 'this_month' },
            { id: 'year', label: 'this_year' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                dateFilter === f.id
                  ? "bg-taika-blue text-white shadow-lg shadow-taika-blue/10"
                  : "bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
              )}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-taika-blue"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-neutral-950 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
              <h4 className="font-bold text-neutral-400 dark:text-neutral-500 text-xs uppercase tracking-widest mb-6">{t("warehouse_occupancy")}</h4>
              <div className="relative w-48 h-48 mx-auto">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle className="text-neutral-100 dark:text-neutral-800 stroke-current" strokeWidth="10" fill="transparent" r="40" cx="50" cy="50" />
                  <motion.circle 
                    className="text-taika-blue dark:text-blue-400 stroke-current" 
                    strokeWidth="10" 
                    strokeLinecap="round" 
                    fill="transparent" 
                    r="40" 
                    cx="50" 
                    cy="50" 
                    strokeDasharray="251.2" 
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * occupancyData.totalPercentage) / 100 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-neutral-900 dark:text-neutral-50">{occupancyData.totalPercentage}%</span>
                  <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t("occupied")}</span>
                </div>
              </div>
              <div className="mt-8 space-y-3">
                {occupancyData.details.map((wh, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium">{wh.name}</span>
                    <span className="font-bold whitespace-nowrap">{wh.percentage}%</span>
                  </div>
                ))}
                {occupancyData.details.length === 0 && (
                   <div className="text-center text-sm text-neutral-400">{t("no_data_available")}</div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 bg-white dark:bg-neutral-950 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
              <h4 className="font-bold text-neutral-400 dark:text-neutral-500 text-xs uppercase tracking-widest mb-6">{t("inventory_fluctuation")}</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fluctuationData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.2} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="inbound" name={t("inbound_type")} fill="#004A99" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outbound" name={t("outbound_type")} fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-neutral-950 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
              <h4 className="font-bold text-neutral-400 dark:text-neutral-500 text-xs uppercase tracking-widest mb-6">{t("top_exported_products")}</h4>
              <div className="space-y-6">
                {topProducts.length > 0 ? topProducts.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span>{item.name}</span>
                      <span>{item.qty}</span>
                    </div>
                    <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-taika-blue rounded-full" 
                      />
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-6 text-sm font-medium text-neutral-400">{t("no_data_available")}</div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-950 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm">
              <h4 className="font-bold text-neutral-400 dark:text-neutral-500 text-xs uppercase tracking-widest mb-6">{t("employee_performance")}</h4>
              <div className="space-y-4">
                {employeePerformance.length > 0 ? employeePerformance.map((staff, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl">
                    <div className="w-10 h-10 bg-taika-blue-light dark:bg-blue-500/10 rounded-full flex items-center justify-center text-taika-blue dark:text-blue-400 font-bold shrink-0 overflow-hidden">
                      {staff.avatar_url ? (
                        <img src={staff.avatar_url} alt={staff.name} className="w-full h-full object-cover" />
                      ) : (
                        staff.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-neutral-900 dark:text-neutral-50 truncate">{staff.name}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{staff.tasks} {t("orders_completed")}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-6 text-sm font-medium text-neutral-400">{t("no_data_available")}</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

