import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ArrowRightLeft,
  ArrowRight,
  MapPin,
  Package,
  Loader2,
  Check,
  AlertTriangle,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import type { Warehouse, LocationWithInventory, LocationInventoryItem } from "../../types/supabase";
import { useAuth } from "../../contexts/AuthContext";

interface TransferModalProps {
  key?: React.Key;
  fromLocation: LocationWithInventory;
  fromWarehouse: Warehouse;
  onClose: () => void;
  onComplete: () => void;
}
export default function TransferModal({
  fromLocation,
  fromWarehouse,
  onClose,
  onComplete,
  destLocationFromMap,
  currentMapWarehouseId,
}: TransferModalProps & {
  destLocationFromMap?: LocationWithInventory | null;
  currentMapWarehouseId?: string;
}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState<LocationInventoryItem | null>(
    fromLocation.inventory_items.length === 1 ? fromLocation.inventory_items[0] : null
  );
  const [transferQty, setTransferQty] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // Destination
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [destWarehouseId, setDestWarehouseId] = useState(fromWarehouse.id);
  const [destLocations, setDestLocations] = useState<any[]>([]);
  const [destLocationId, setDestLocationId] = useState("");
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync map selection
  useEffect(() => {
    if (currentMapWarehouseId && currentMapWarehouseId !== destWarehouseId) {
      setDestWarehouseId(currentMapWarehouseId);
    }
  }, [currentMapWarehouseId]);

  useEffect(() => {
    if (destLocationFromMap) {
      setDestLocationId(destLocationFromMap.id);
      // Ensure the location exists in destLocations
      setDestLocations((prev) => {
        if (!prev.find((l) => l.id === destLocationFromMap.id)) {
          return [destLocationFromMap, ...prev];
        }
        return prev;
      });
    }
  }, [destLocationFromMap]);

  // Load warehouses
  useEffect(() => {
    fetch("/api/warehouses").then(r => r.json()).then(d => setWarehouses(d || [])).catch(() => {});
  }, []);

  // Load available locations when dest warehouse changes
  useEffect(() => {
    if (!destWarehouseId) return;
    setLoadingLocs(true);
    // Don't reset if we just synced from the map
    if (!destLocationFromMap || destLocationFromMap.warehouse_id !== destWarehouseId) {
      setDestLocationId("");
    }
    fetch(`/api/warehouses/${destWarehouseId}/available-locations`)
      .then(r => r.json())
      .then(data => {
        const filtered = (data || []).filter((l: any) => l.id !== fromLocation.id);
        
        // If we have a map selection, ensure it's in the list
        if (destLocationFromMap && destLocationFromMap.warehouse_id === destWarehouseId) {
          if (!filtered.find((l: any) => l.id === destLocationFromMap.id)) {
            filtered.unshift(destLocationFromMap);
          }
        }
        
        setDestLocations(filtered);
      })
      .catch(() => setDestLocations([]))
      .finally(() => setLoadingLocs(false));
  }, [destWarehouseId, fromLocation.id]);

  const maxQty = selectedItem?.quantity || 0;
  const destLoc = destLocationFromMap || null;
  const destWarehouseForSubmit = destLocationFromMap?.warehouse_id || fromWarehouse.id;
  const canSubmit = selectedItem && transferQty > 0 && transferQty <= maxQty && destLocationFromMap && notes.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedItem || !destLocationFromMap) return;
    setSaving(true);
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedItem.product_id,
          batch_id: selectedItem.batch_id,
          from_location_id: fromLocation.id,
          to_location_id: destLocationFromMap.id,
          from_warehouse_id: fromWarehouse.id,
          to_warehouse_id: destWarehouseForSubmit,
          quantity: transferQty,
          movement_type: "transfer",
          user_id: user?.id || null,
          notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Lỗi điều chuyển");
      }
      toast.success(`Điều chuyển ${transferQty} kg thành công!`);
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Lỗi điều chuyển");
    }
    setSaving(false);
  };

  const fromLabel = `${fromLocation.zone}-${fromLocation.rack || "—"}-${fromLocation.bin || "—"}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full lg:w-[400px] flex-shrink-0 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl overflow-hidden shadow-xl flex flex-col pointer-events-auto h-full"
    >
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-purple-50/50 dark:bg-purple-900/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mb-0.5">Điều chuyển hàng</h2>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
              Từ <span className="font-bold text-purple-600 dark:text-purple-400">{fromLabel}</span>
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
          <X size={18} className="text-neutral-400" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        {/* Step 1: Select Product */}
        <div>
          <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2.5">
            1. Chọn sản phẩm
          </p>
          <div className="space-y-2">
            {fromLocation.inventory_items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => { setSelectedItem(item); setTransferQty(0); }}
                className={cn(
                  "w-full text-left p-2.5 rounded-xl border transition-all",
                  selectedItem === item
                    ? "border-purple-400 dark:border-purple-500 bg-purple-50 dark:bg-purple-500/10 ring-1 ring-purple-400/30"
                    : "border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package size={14} className={cn(selectedItem === item ? "text-purple-500" : "text-neutral-400")} />
                    <span className="text-[13px] font-bold text-neutral-900 dark:text-neutral-50 truncate">{item.product_name}</span>
                  </div>
                  <span className="text-xs font-black text-neutral-900 dark:text-neutral-50 shrink-0 ml-2">{item.quantity} kg</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[9px] text-neutral-400">
                  <span className="font-mono">{item.sku}</span>
                  <span>Lô: {item.lot_number}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Quantity */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2.5 mt-2">
                2. Số lượng chuyển
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={transferQty || ""}
                    onChange={e => setTransferQty(Math.min(maxQty, Math.max(0, Number(e.target.value))))}
                    placeholder="0"
                    className="flex-1 p-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 font-bold text-sm text-neutral-900 dark:text-neutral-50"
                  />
                  <span className="text-[11px] font-bold text-neutral-400">/ {maxQty}</span>
                  <button
                    onClick={() => setTransferQty(maxQty)}
                    className="px-2.5 py-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20 rounded hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors shrink-0"
                  >
                    Tất cả
                  </button>
                </div>
                {/* Slider */}
                <input
                  type="range" min={0} max={maxQty} value={transferQty}
                  onChange={e => setTransferQty(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 3: Destination */}
        <AnimatePresence>
          {selectedItem && transferQty > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <div className="flex items-center justify-between mb-2.5 mt-2">
                 <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                   3. Vị trí đích
                 </p>
                 {!destLocationFromMap && (
                   <span className="text-[9px] font-medium text-purple-500 animate-pulse bg-purple-100 dark:bg-purple-500/20 px-1.5 py-0.5 rounded">
                     ← Click ô trên sơ đồ
                   </span>
                 )}
              </div>
              
              <div className="space-y-3">
                {/* Selected destination from map - Rich Card */}
                {destLocationFromMap ? (
                  <div className="rounded-xl border-2 border-purple-400 dark:border-purple-500 bg-purple-50/50 dark:bg-purple-500/5 overflow-hidden">
                    {/* Dest header */}
                    <div className="px-3 py-2 bg-purple-100/60 dark:bg-purple-500/10 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin size={14} className="text-purple-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-purple-700 dark:text-purple-300">
                              {destLocationFromMap.zone}-{destLocationFromMap.rack || "—"}-{destLocationFromMap.bin || "—"}
                            </span>
                            {destLocationFromMap.warehouse_id !== fromWarehouse.id && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded font-bold shrink-0">
                                Khác kho • {warehouses.find(w => w.id === destLocationFromMap.warehouse_id)?.name || "—"}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-purple-500/70 dark:text-purple-400/60 truncate">
                            {warehouses.find(w => w.id === destLocationFromMap.warehouse_id)?.name || "—"}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0",
                        destLocationFromMap.status === "active"
                          ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      )}>
                        {destLocationFromMap.status === "active" ? "Hoạt động" : destLocationFromMap.status}
                      </span>
                    </div>

                    {/* Capacity bar */}
                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">Sức chứa</span>
                        <span className={cn(
                          "text-[11px] font-black",
                          destLocationFromMap.utilization >= 90 ? "text-red-500"
                            : destLocationFromMap.utilization >= 70 ? "text-orange-500"
                            : "text-emerald-500"
                        )}>
                          {destLocationFromMap.utilization}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            destLocationFromMap.utilization >= 90 ? "bg-red-500"
                              : destLocationFromMap.utilization >= 70 ? "bg-orange-500"
                              : destLocationFromMap.utilization >= 30 ? "bg-blue-500"
                              : "bg-emerald-500"
                          )}
                          style={{ width: `${destLocationFromMap.utilization}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                          Đang chứa: {destLocationFromMap.total_quantity.toLocaleString()} kg
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Còn trống: {((destLocationFromMap.capacity || 5000) - destLocationFromMap.total_quantity).toLocaleString()} kg
                        </span>
                      </div>
                    </div>

                    {/* Current items at destination */}
                    {destLocationFromMap.inventory_items.length > 0 && (
                      <div className="px-3 pb-2">
                        <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">
                          Hàng hiện tại ({destLocationFromMap.inventory_items.length})
                        </p>
                        <div className="space-y-1">
                          {destLocationFromMap.inventory_items.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] px-2 py-1 bg-neutral-100 dark:bg-neutral-800/50 rounded">
                              <span className="font-medium text-neutral-600 dark:text-neutral-300 truncate max-w-[160px]">{item.product_name}</span>
                              <span className="font-bold text-neutral-500 dark:text-neutral-400 shrink-0 ml-2">{item.quantity} kg</span>
                            </div>
                          ))}
                          {destLocationFromMap.inventory_items.length > 3 && (
                            <p className="text-[9px] text-neutral-400 italic text-center">
                              +{destLocationFromMap.inventory_items.length - 3} sản phẩm khác
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Capacity warning */}
                    {transferQty > ((destLocationFromMap.capacity || 5000) - destLocationFromMap.total_quantity) && (
                      <div className="px-3 pb-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-500/10 p-1.5 rounded">
                          <AlertTriangle size={12} />
                          Số lượng chuyển vượt sức chứa còn lại!
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Fallback: empty state prompting map click */
                  <div className="rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-600 p-4 text-center">
                    <MapPin size={24} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-1.5" />
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
                      Click vào một ô trên sơ đồ kho để chọn vị trí đích
                    </p>
                    <p className="text-[9px] text-neutral-300 dark:text-neutral-600 mt-1">
                      Chuyển tab kho ở trên để chọn vị trí ở kho khác
                    </p>
                  </div>
                )}

                {/* Notes / Reason */}
                <div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Lý do điều chuyển (VD: dồn hàng)... *"
                    className="w-full p-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 font-medium text-[11px] resize-none text-neutral-900 dark:text-neutral-50"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary */}
        <AnimatePresence>
          {canSubmit && destLoc && selectedItem && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              <div className="p-3 mt-2 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/5 dark:to-blue-500/5 border border-purple-100 dark:border-purple-500/20 space-y-2">
                <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Xác nhận điều chuyển</p>
                
                {/* Product + Qty */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight">{selectedItem.product_name}</span>
                  <span className="text-[12px] font-black text-purple-600 dark:text-purple-400 shrink-0">{transferQty} kg</span>
                </div>

                {/* Route */}
                <div className="flex items-center gap-0 text-[10px]">
                  {/* From */}
                  <div className="flex-1 p-1.5 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-100 dark:border-red-500/20 text-center">
                    <p className="font-black text-red-600 dark:text-red-400">{fromLabel}</p>
                    <p className="text-[9px] text-red-400 dark:text-red-500 font-medium truncate">{fromWarehouse.name}</p>
                  </div>
                  <ArrowRight size={14} className="text-purple-400 mx-1 shrink-0" />
                  {/* To */}
                  <div className="flex-1 p-1.5 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-100 dark:border-green-500/20 text-center">
                    <p className="font-black text-green-600 dark:text-green-400">{destLoc.zone}-{destLoc.rack || "—"}-{destLoc.bin || "—"}</p>
                    <p className="text-[9px] text-green-500 dark:text-green-500 font-medium truncate">
                      {warehouses.find(w => w.id === destWarehouseForSubmit)?.name || fromWarehouse.name}
                    </p>
                  </div>
                </div>

                {destWarehouseForSubmit !== fromWarehouse.id && (
                  <div className="flex justify-center">
                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full font-bold text-[9px]">
                      ⚠ Điều chuyển khác kho
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 flex gap-3 bg-neutral-50/50 dark:bg-neutral-900/50">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-[13px] font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
        >
          Hủy
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-[13px] font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? "Đang xử lý..." : "Xác nhận"}
        </button>
      </div>
    </motion.div>
  );
}

