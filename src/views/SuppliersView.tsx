import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import {
  Truck,
  User,
  Phone,
  Mail,
  MapPin,
  Plus,
} from "lucide-react";
import { motion } from "motion/react";

interface SuppliersViewProps {
  onAction: (action: string) => void;
}

export default function SuppliersView({ onAction }: SuppliersViewProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("suppliers")}</h3>
        <button 
          onClick={() => onAction("add_supplier")}
          className="px-6 py-3 bg-taika-blue text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-taika-blue/10 hover:bg-taika-blue/90 transition-all"
        >
          <Plus size={20} /> {t("add_supplier")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { name: "Hải Sản Miền Trung", contact: "Nguyễn Văn A", phone: "0901 234 567", email: "mientrung@seafood.vn", address: "Đà Nẵng", status: "Active" },
          { name: "Vannamei Farm Co.", contact: "Trần Thị B", phone: "0902 345 678", email: "contact@vannamei.com", address: "Cà Mau", status: "Active" },
          { name: "Đại Dương Xanh", contact: "Lê Văn C", phone: "0903 456 789", email: "info@daiduongxanh.vn", address: "Nha Trang", status: "Pending" },
          { name: "Mekong Delta Fish", contact: "Phạm Văn D", phone: "0904 567 890", email: "sales@mekongfish.vn", address: "Cần Thơ", status: "Active" },
        ].map((supplier, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-neutral-950 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-taika-blue-light dark:bg-blue-500/10 rounded-xl flex items-center justify-center text-taika-blue dark:text-blue-400">
                <Truck size={24} />
              </div>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold",
                supplier.status === "Active" ? "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400" : "bg-taika-red-light dark:bg-red-500/10 text-taika-red dark:text-red-400"
              )}>
                {supplier.status}
              </span>
            </div>
            <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-4">{supplier.name}</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                <User size={16} className="text-neutral-400 dark:text-neutral-500" />
                <span>{supplier.contact}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                <Phone size={16} className="text-neutral-400 dark:text-neutral-500" />
                <span>{supplier.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                <Mail size={16} className="text-neutral-400 dark:text-neutral-500" />
                <span>{supplier.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                <MapPin size={16} className="text-neutral-400 dark:text-neutral-500" />
                <span>{supplier.address}</span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-neutral-50 flex gap-2">
              <button className="flex-1 py-2 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 rounded-xl text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all">{t("details")}</button>
              <button className="flex-1 py-2 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 rounded-xl text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all">{t("import_history")}</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
