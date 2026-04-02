import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { motion } from "motion/react";
import type { InventoryItem, Warehouse } from "../types/supabase";
import {
  CheckCircle2,
  Download,
  History,
  Loader2,
  AlertCircle,
  Boxes,
  List,
  Map,
} from "lucide-react";

import InventoryStats from "../components/inventory/InventoryStats";
import InventoryTable from "../components/inventory/InventoryTable";
import WarehouseMap from "../components/inventory/WarehouseMap";

interface InventoryViewProps {
  onAction: (action: string) => void;
}

type ViewTab = "list" | "map";

export default function InventoryView({ onAction }: InventoryViewProps) {
  const { t } = useTranslation();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("list");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [invRes, whRes] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/warehouses"),
      ]);
      if (!invRes.ok) throw new Error(`Inventory: HTTP ${invRes.status}`);
      if (!whRes.ok) throw new Error(`Warehouses: HTTP ${whRes.status}`);

      const invData = await invRes.json();
      const whData = await whRes.json();
      setInventory(invData || []);
      setWarehouses(whData || []);
    } catch (err: any) {
      setError(err.message);
      toast.error(t("error_loading_data"));
    }
    setLoading(false);
  }

  const filteredInventory =
    selectedWarehouse === "all"
      ? inventory
      : inventory.filter((item) => item.warehouse_id === selectedWarehouse);

  const handleViewOnMap = (locationId: string, warehouseId: string) => {
    setActiveTab("map");
    setSelectedWarehouse(warehouseId);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-taika-blue" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
          {t("loading")}...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-taika-red" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-taika-blue text-white rounded-xl text-sm font-bold"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons + Warehouse Filter */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onAction("stock_take")}
            className="px-4 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold hover:bg-taika-blue/90 transition-all flex items-center gap-2 shadow-lg shadow-taika-blue/10"
          >
            <CheckCircle2 size={16} /> {t("stock_take")}
          </button>
          <button
            onClick={() => onAction("internal_transfer")}
            className="px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
          >
            <History size={16} /> {t("transfer")}
          </button>
          <button className="px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <Download size={16} /> {t("export")}
          </button>
        </div>
        <select
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50"
        >
          <option value="all">{t("all_warehouses")}</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>
              {wh.name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Stats */}
      <InventoryStats inventory={filteredInventory} />

      {/* Tabs: List | Map */}
      <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("list")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            activeTab === "list"
              ? "bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-sm"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
          )}
        >
          <List size={16} />
          {t("list_view")}
        </button>
        <button
          onClick={() => setActiveTab("map")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            activeTab === "map"
              ? "bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-sm"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
          )}
        >
          <Map size={16} />
          {t("map_view")}
        </button>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "list" && (
          <>
            {filteredInventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                <Boxes size={48} className="text-neutral-300 dark:text-neutral-600" />
                <p className="text-neutral-400 dark:text-neutral-500 font-medium">
                  {t("no_inventory_data")}
                </p>
              </div>
            ) : (
              <InventoryTable
                inventory={filteredInventory}
                onViewOnMap={handleViewOnMap}
              />
            )}
          </>
        )}

        {activeTab === "map" && (
          <WarehouseMap
            warehouses={warehouses}
            selectedWarehouseId={selectedWarehouse}
            onSelectWarehouse={setSelectedWarehouse}
          />
        )}
      </motion.div>
    </div>
  );
}
