import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  Plus,
  Search,
  Package,
  Clock,
  Truck,
  FileText,
  ShieldCheck,
} from "lucide-react";

export default function OutboundView() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const steps = [
    { icon: FileText, title: "Tạo phiếu xuất", desc: "Chọn khách hàng, đơn hàng và ghi chú" },
    { icon: Package, title: "Chọn sản phẩm", desc: "Chọn sản phẩm, lô hàng theo FEFO/FIFO" },
    { icon: ShieldCheck, title: "Kiểm tra QC", desc: "Xác nhận chất lượng trước khi xuất" },
    { icon: Truck, title: "Xuất kho", desc: "Xác nhận xuất kho và in phiếu giao hàng" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Quản lý xuất kho</h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-1">Tạo phiếu, theo dõi và kiểm soát hàng xuất kho</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={18} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm phiếu xuất..."
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-taika-blue font-medium shadow-sm text-neutral-900 dark:text-neutral-50" />
          </div>
          <button disabled
            className="px-5 py-3 bg-orange-500 text-white rounded-2xl text-sm font-bold hover:bg-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-orange-500/10 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed">
            <Plus size={18} /> Tạo phiếu xuất
          </button>
        </div>
      </div>

      {/* Stats placeholder */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tổng phiếu xuất", value: "0", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
          { label: "Hoàn tất", value: "0", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-500/10" },
          { label: "Đang xử lý", value: "0", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-500/10" },
          { label: "Tổng SL xuất", value: "0 kg", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={cn("p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800", stat.bg)}>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={cn("text-2xl font-black", stat.color)}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Process Flow */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6">
        <h4 className="text-sm font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest mb-6">Quy trình xuất kho</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
              className="p-5 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 relative group hover:border-orange-200 dark:hover:border-orange-500/30 transition-all">
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 text-[10px] font-black">
                {i + 1}
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-3">
                <step.icon size={20} />
              </div>
              <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm mb-1">{step.title}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Coming Soon */}
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
        className="flex flex-col items-center justify-center py-20 gap-5 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-xl shadow-orange-500/20">
          <ArrowUpRight size={36} className="text-white" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1">Tính năng đang phát triển</p>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium max-w-md">
            Quy trình xuất kho sẽ sớm được hoàn thiện. Bao gồm chọn hàng theo FEFO/FIFO, kiểm tra QC, và in phiếu giao hàng tự động.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-200 dark:border-orange-500/20">
          <Clock size={14} className="text-orange-500" />
          <span className="text-xs font-bold text-orange-600 dark:text-orange-400">Sắp ra mắt</span>
        </div>
      </motion.div>
    </div>
  );
}
