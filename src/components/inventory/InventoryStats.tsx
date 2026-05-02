import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  Package,
  Clock,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import type { InventoryItem } from "../../types/supabase";

/**
 * Thuộc tính của component `InventoryStats`.
 */
interface InventoryStatsProps {
  inventory: InventoryItem[];
}

/**
 * Component Hiển thị Thẻ thống kê tổng quan (Inventory Stats).
 * Thống kê Tổng số lượng tồn kho, Lô hàng sắp hết hạn, Cảnh báo mức an toàn, và Tỷ lệ Đạt QC.
 *
 * @param {InventoryStatsProps} props - Thuộc tính truyền vào chứa mảng `inventory`
 * @returns {JSX.Element} Tập hợp các Thẻ chỉ số tổng quan
 */
export default function InventoryStats({ inventory }: InventoryStatsProps) {
  const { t } = useTranslation();

  const totalStock = inventory.reduce((sum, item) => sum + Number(item.quantity), 0);

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringSoon = inventory.filter((item) => {
    const expiry = item.expiry_date || item.batches?.expiry_date;
    if (!expiry) return false;
    const expiryDate = new Date(expiry);
    return expiryDate <= thirtyDaysLater && expiryDate > now;
  }).length;

  const lowStock = inventory.filter((item) => {
    const minLevel = item.products?.min_stock_level || 0;
    return Number(item.quantity) < minLevel && minLevel > 0;
  }).length;

  const totalBatches = inventory.filter((i) => i.batches?.qc_status).length;
  const passBatches = inventory.filter((i) => i.batches?.qc_status === "Pass").length;
  const qcPassRate = totalBatches > 0 ? Math.round((passBatches / totalBatches) * 100) : 0;

  const stats = [
    {
      label: t("total_stock"),
      value: `${totalStock.toLocaleString()} kg`,
      icon: Package,
      color: "text-taika-blue dark:text-blue-400",
      bgColor: "bg-taika-blue-light dark:bg-blue-500/10",
      borderColor: "border-taika-blue/20 dark:border-blue-500/20",
    },
    {
      label: t("expiring_soon"),
      value: `${expiringSoon}`,
      subtitle: t("within_30_days"),
      icon: Clock,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-500/10",
      borderColor: "border-orange-200 dark:border-orange-500/20",
    },
    {
      label: t("low_stock"),
      value: `${lowStock}`,
      subtitle: t("items_count"),
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-500/10",
      borderColor: "border-red-200 dark:border-red-500/20",
    },
    {
      label: t("qc_pass_rate"),
      value: `${qcPassRate}%`,
      subtitle: `${passBatches}/${totalBatches}`,
      icon: ShieldCheck,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-500/10",
      borderColor: "border-emerald-200 dark:border-emerald-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08, duration: 0.4 }}
          className={`bg-white dark:bg-neutral-950 rounded-2xl border ${stat.borderColor} p-5 hover:shadow-lg transition-all duration-300 cursor-default group`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 ${stat.bgColor} rounded-xl flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
              <stat.icon size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight">{stat.value}</p>
          <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 mt-1 uppercase tracking-wider">{stat.label}</p>
          {stat.subtitle && (
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">{stat.subtitle}</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
