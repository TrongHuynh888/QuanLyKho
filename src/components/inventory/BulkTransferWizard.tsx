import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import {
  Package, ArrowRight, X, Check, Loader2, AlertTriangle, ChevronDown, Boxes, MapPin, Info
} from "lucide-react";
import type { Warehouse, LocationWithInventory } from "../../types/supabase";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";

export type BulkPhase = "select_source" | "select_dest" | "done";

interface BulkTransferWizardProps {
  phase: BulkPhase;
  setPhase: (p: BulkPhase) => void;
  /** Source locations selected by user */
  selectedSourceLocs: LocationWithInventory[];
  /** Destination locations allocated by user */
  selectedDestLocs: LocationWithInventory[];
  /** All warehouses */
  warehouses: Warehouse[];
  /** Current source warehouse */
  sourceWarehouse: Warehouse | undefined;
  /** Selected destination warehouse id */
  destWarehouseId: string;
  setDestWarehouseId: (id: string) => void;
  /** Close/cancel the wizard */
  onClose: () => void;
  /** After successful transfer */
  onComplete: () => void;
  /** Switch the map to dest warehouse */
  onSwitchWarehouse: (id: string) => void;
}

export default function BulkTransferWizard({
  phase,
  setPhase,
  selectedSourceLocs,
  selectedDestLocs,
  warehouses,
  sourceWarehouse,
  destWarehouseId,
  setDestWarehouseId,
  onClose,
  onComplete,
  onSwitchWarehouse,
}: BulkTransferWizardProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  // Calculate total source kg
  const totalSourceKg = useMemo(() => {
    return selectedSourceLocs.reduce((sum, loc) => sum + (loc.total_quantity || 0), 0);
  }, [selectedSourceLocs]);

  // Calculate total dest capacity
  const totalDestCapacity = useMemo(() => {
    return selectedDestLocs.reduce((sum, loc) => {
      const remaining = (loc.capacity || 5000) - (loc.total_quantity || 0);
      return sum + Math.max(0, remaining);
    }, 0);
  }, [selectedDestLocs]);

  // Estimated bins needed
  const destWarehouse = warehouses.find(w => w.id === destWarehouseId);
  const binCap = destWarehouse?.bin_capacity_kg || 5000;
  const estimatedBins = Math.ceil(totalSourceKg / binCap);

  const canProceedToDest = selectedSourceLocs.length > 0 && totalSourceKg > 0;
  const canConfirm = phase === "select_dest" && selectedDestLocs.length > 0 && totalDestCapacity >= totalSourceKg;

  // Handle submission
  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      const userId = user?.id || null;
      // Build movement list: for each source location's items, move them to dest locations
      // We distribute items across dest locations based on remaining capacity
      const movements: any[] = [];

      // Flatten source items
      const allSourceItems: { loc: LocationWithInventory; item: any }[] = [];
      selectedSourceLocs.forEach(loc => {
        loc.inventory_items.forEach(item => {
          allSourceItems.push({ loc, item });
        });
      });

      // Sort dest locations by remaining capacity (largest first)
      const destPool = selectedDestLocs.map(loc => ({
        loc,
        remaining: (loc.capacity || 5000) - (loc.total_quantity || 0),
      })).sort((a, b) => b.remaining - a.remaining);

      // Allocate each source item to destination locations
      for (const { loc: srcLoc, item } of allSourceItems) {
        let qtyToMove = item.quantity;
        for (const dest of destPool) {
          if (qtyToMove <= 0) break;
          if (dest.remaining <= 0) continue;

          const moveQty = Math.min(qtyToMove, dest.remaining);

          movements.push({
            product_id: item.product_id,
            batch_id: item.batch_id,
            from_location_id: srcLoc.id,
            to_location_id: dest.loc.id,
            quantity: moveQty,
            movement_type: "transfer",
            user_id: userId,
            notes: notes || `Điều chuyển hàng loạt`,
            from_warehouse_id: srcLoc.warehouse_id,
            to_warehouse_id: dest.loc.warehouse_id,
          });

          dest.remaining -= moveQty;
          qtyToMove -= moveQty;
        }

        if (qtyToMove > 0) {
          toast.error(`Không đủ sức chứa cho ${item.product_name} (thiếu ${qtyToMove} kg)`);
          setSaving(false);
          return;
        }
      }

      // Execute all transfers
      let successCount = 0;
      for (const mov of movements) {
        const res = await fetch("/api/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mov),
        });
        if (res.ok) {
          successCount++;
        } else {
          const err = await res.json();
          console.error("Transfer failed:", err);
          toast.error(err.error || "Lỗi điều chuyển");
        }
      }

      if (successCount > 0) {
        toast.success(`Đã điều chuyển thành công ${successCount} lô hàng!`);
        setPhase("done");
        onComplete();
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi hệ thống");
    } finally {
      setSaving(false);
    }
  };

  // Click next: switch to destination phase
  const handleNext = () => {
    if (!canProceedToDest) return;
    
    // Auto-select a different warehouse as destination
    const otherWh = warehouses.find(w => w.id !== sourceWarehouse?.id);
    const newDestId = otherWh?.id || warehouses[0]?.id || "";
    setDestWarehouseId(newDestId);
    setPhase("select_dest");
    
    // Switch the map to show destination warehouse
    if (newDestId) onSwitchWarehouse(newDestId);
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="mx-4 mb-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              phase === "select_source"
                ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            )}>
              {phase === "select_source" ? <Package size={16} /> : <MapPin size={16} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-50">
                  {phase === "select_source"
                    ? "Bước 1: Chọn ô hàng cần chuyển"
                    : "Bước 2: Chọn vị trí đích"}
                </h3>
                {phase === "select_dest" && (
                  <div className="relative group flex items-center">
                    <Info size={14} className="text-neutral-400 cursor-help transition-colors group-hover:text-neutral-200" />
                    {/* Tooltip legend */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-40 p-2.5 bg-neutral-800 dark:bg-black border border-neutral-700 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-xl z-50 pointer-events-none font-medium">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded shadow-sm bg-emerald-500 border border-emerald-400" /> <span className="text-[10px] text-white">Được rót đầy hàng</span></div>
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded shadow-sm bg-amber-500 border border-amber-400" /> <span className="text-[10px] text-white">Sử dụng một phần</span></div>
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded border border-dashed border-neutral-500" /> <span className="text-[10px] text-neutral-300">Dư thừa (giữ trống)</span></div>
                      </div>
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-800 dark:border-t-black" />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {phase === "select_source"
                  ? `Bấm vào các ô có hàng trên sơ đồ ${sourceWarehouse?.name || ""}`
                  : `Bấm vào ô trống trên sơ đồ ${destWarehouse?.name || ""} để phân bổ`}
              </p>
            </div>
          </div>

          {/* Phase indicator */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-black",
              phase === "select_source"
                ? "bg-blue-500 text-white"
                : "bg-blue-200 dark:bg-blue-800 text-blue-600 dark:text-blue-300"
            )}>1</div>
            <div className="w-6 h-px bg-neutral-300 dark:bg-neutral-600" />
            <div className={cn(
              "w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-black",
              phase === "select_dest"
                ? "bg-emerald-500 text-white"
                : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400"
            )}>2</div>
            <div className="ml-3">
              <button onClick={onClose}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Source summary */}
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50">
                  {selectedSourceLocs.length}
                </p>
                <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">ô chọn</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {totalSourceKg.toLocaleString()}<span className="text-sm ml-0.5">kg</span>
                </p>
                <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">tổng KL</p>
              </div>
            </div>

            {phase === "select_source" && canProceedToDest && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg">
                <AlertTriangle size={12} />
                <span className="font-medium">Cần ~{estimatedBins} ô trống ({binCap.toLocaleString()}kg/ô)</span>
              </div>
            )}

            {/* Arrow */}
            {phase === "select_dest" && (
              <>
                <ArrowRight size={20} className="text-neutral-300 dark:text-neutral-600 shrink-0" />

                {/* Destination warehouse selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-400 uppercase">Kho nhận:</span>
                  <select
                    value={destWarehouseId}
                    onChange={e => {
                      setDestWarehouseId(e.target.value);
                      onSwitchWarehouse(e.target.value);
                    }}
                    className="text-sm font-bold bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 outline-none text-neutral-900 dark:text-neutral-50"
                  >
                    {warehouses.filter(w => w.id !== sourceWarehouse?.id).map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Dest summary */}
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {selectedDestLocs.length}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">ô đích</p>
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      "text-2xl font-black",
                      totalDestCapacity >= totalSourceKg
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500"
                    )}>
                      {totalDestCapacity.toLocaleString()}<span className="text-sm ml-0.5">kg</span>
                    </p>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">sức chứa</p>
                  </div>
                </div>

                {/* Capacity meter */}
                <div className="flex-1 min-w-[120px] max-w-[200px]">
                  <div className="flex justify-between text-[10px] font-bold mb-1">
                    <span className="text-neutral-400">Phân bổ</span>
                    <span className={cn(
                      totalDestCapacity >= totalSourceKg ? "text-emerald-500" : "text-red-500"
                    )}>
                      {totalDestCapacity >= totalSourceKg
                        ? `✓ Đủ sức chứa`
                        : `Thiếu ${(totalSourceKg - totalDestCapacity).toLocaleString()} kg`
                      }
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        totalDestCapacity >= totalSourceKg
                          ? "bg-emerald-500"
                          : "bg-red-500"
                      )}
                      style={{ width: `${Math.min(100, totalSourceKg > 0 ? (totalDestCapacity / totalSourceKg) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action buttons */}
            {phase === "select_source" && (
              <button
                onClick={handleNext}
                disabled={!canProceedToDest}
                className={cn(
                  "px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  canProceedToDest
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed"
                )}
              >
                Tiếp tục <ArrowRight size={14} />
              </button>
            )}

            {phase === "select_dest" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPhase("select_source");
                    if (sourceWarehouse) onSwitchWarehouse(sourceWarehouse.id);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                >
                  ← Quay lại
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm || saving}
                  className={cn(
                    "px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                    canConfirm && !saving
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
                      : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed"
                  )}
                >
                  {saving ? (
                    <><Loader2 size={14} className="animate-spin" /> Đang xử lý...</>
                  ) : (
                    <><Check size={14} /> Xác nhận chuyển</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Notes field in dest phase */}
          {phase === "select_dest" && (
            <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ghi chú lý do điều chuyển (tuỳ chọn)..."
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-50"
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
