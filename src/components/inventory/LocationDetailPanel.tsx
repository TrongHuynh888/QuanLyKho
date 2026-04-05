import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import {
  X,
  Package,
  Clock,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Layers,
  ArrowRightLeft,
} from "lucide-react";
import type { Warehouse, LocationWithInventory } from "../../types/supabase";

interface LocationDetailPanelProps {
  key?: React.Key;
  location: LocationWithInventory;
  warehouse: Warehouse;
  onClose: () => void;
  onTransfer: () => void;
}

export default function LocationDetailPanel({
  location,
  warehouse,
  onClose,
  onTransfer,
}: LocationDetailPanelProps) {
  const { t } = useTranslation();

  const locationLabel = `${location.zone}-${location.rack || "—"}-${location.bin || "—"}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full lg:w-80 xl:w-96 flex-shrink-0 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden shadow-xl"
    >
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-taika-blue-light dark:bg-blue-500/10 rounded-xl flex items-center justify-center text-taika-blue dark:text-blue-400">
            <MapPin size={20} />
          </div>
          <div>
            <p className="font-bold text-neutral-900 dark:text-neutral-50">{locationLabel}</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{warehouse.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 dark:text-neutral-500 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Utilization bar */}
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            {t("utilization")}
          </span>
          <span className={cn(
            "text-sm font-black",
            location.utilization >= 90
              ? "text-red-500"
              : location.utilization >= 70
              ? "text-orange-500"
              : location.utilization >= 30
              ? "text-taika-blue dark:text-blue-400"
              : "text-emerald-500"
          )}>
            {location.utilization}%
          </span>
        </div>
        <div className="w-full h-3.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(location.utilization, location.utilization > 0 ? 3 : 0)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full relative",
              location.utilization >= 90
                ? "bg-gradient-to-r from-red-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                : location.utilization >= 70
                ? "bg-gradient-to-r from-orange-500 to-amber-400 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                : location.utilization >= 30
                ? "bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                : location.utilization > 0
                ? "bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : ""
            )}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
            {location.total_quantity.toLocaleString()} kg
          </span>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
            {t("capacity")}: {(location.capacity || 5000).toLocaleString()} kg
          </span>
        </div>
      </div>

      {/* Status line */}
      <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
        <Layers size={14} className="text-neutral-400" />
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t("status")}:
        </span>
        <span className={cn(
          "text-xs font-bold px-2 py-0.5 rounded-md",
          location.status === "active"
            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : location.status === "maintenance"
            ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
            : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
        )}>
          {t(location.status)}
        </span>
      </div>

      {/* Items list */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3">
          {t("products")} ({location.inventory_items.length})
        </p>

        {location.inventory_items.length === 0 ? (
          <div className="py-8 text-center">
            <Package size={32} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
            <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">
              {t("no_items_at_location")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {location.inventory_items.map((item, index) => {
              const isExpiring = item.expiry_date
                ? new Date(item.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                : false;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 truncate">
                        {item.product_name}
                      </p>
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
                        SKU: {item.sku}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-bold rounded-md flex-shrink-0 ml-2",
                        item.qc_status === "Pass"
                          ? "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400"
                          : item.qc_status === "Fail"
                          ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
                          : "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"
                      )}
                    >
                      {item.qc_status === "Pass" ? (
                        <ShieldCheck size={10} className="inline mr-0.5" />
                      ) : (
                        <ShieldAlert size={10} className="inline mr-0.5" />
                      )}
                      {item.qc_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium uppercase">
                        {t("qty")}
                      </p>
                      <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
                        {item.quantity.toLocaleString()} kg
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium uppercase">
                        {t("lot_number")}
                      </p>
                      <p className="text-xs font-mono font-medium text-neutral-600 dark:text-neutral-300 truncate">
                        {item.lot_number}
                      </p>
                    </div>
                  </div>

                  {item.expiry_date && (
                    <div className={cn(
                      "mt-2 flex items-center gap-1 text-[11px] font-medium",
                      isExpiring
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-neutral-400 dark:text-neutral-500"
                    )}>
                      <Clock size={11} />
                      {t("expiry")}: {item.expiry_date}
                      {isExpiring && (
                        <span className="ml-1 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-500/20 rounded text-[10px] font-bold text-orange-600 dark:text-orange-400">
                          ⚠️
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
        <button
          onClick={onTransfer}
          disabled={location.inventory_items.length === 0}
          className="w-full px-4 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold hover:bg-taika-blue/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-taika-blue/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowRightLeft size={16} />
          {t("transfer")}
        </button>
      </div>
    </motion.div>
  );
}
