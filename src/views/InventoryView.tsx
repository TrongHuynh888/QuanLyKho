import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { motion } from "motion/react";
import type { InventoryItem, Warehouse } from "../types/supabase";
import {
  CheckCircle2,
  Download,
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  Boxes,
  List,
  Map,
  Filter,
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
  const [categories, setCategories] = useState<{id: string; name: string}[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("list");
  const [bulkTransferMode, setBulkTransferMode] = useState(false);
  const [targetLocationId, setTargetLocationId] = useState<string | null>(null);

  // Listen for bulk transfer activation from other views (e.g. Dashboard)
  useEffect(() => {
    const handler = () => {
      if (selectedWarehouse === "all" && warehouses.length > 0) {
        setSelectedWarehouse(warehouses[0].id);
      }
      setActiveTab("map");
      setBulkTransferMode(true);
    };
    const navHandler = (e: any) => {
      const whId = e.detail?.warehouseId;
      const locId = e.detail?.locationId;
      if (whId) {
        setSelectedWarehouse(whId);
        setActiveTab("map");
        if (locId) setTargetLocationId(locId);
      }
    };
    
    // Check for pending navigation set by App.tsx before this component mounted
    const pending = (window as any).__pendingWarehouseNav;
    if (pending?.warehouseId) {
      setSelectedWarehouse(pending.warehouseId);
      setActiveTab("map");
      if (pending.locationId) setTargetLocationId(pending.locationId);
      delete (window as any).__pendingWarehouseNav;
    }
    
    window.addEventListener("activate-bulk-transfer", handler);
    window.addEventListener("navigate-to-warehouse-map", navHandler);
    return () => {
      window.removeEventListener("activate-bulk-transfer", handler);
      window.removeEventListener("navigate-to-warehouse-map", navHandler);
    };
  }, [warehouses, selectedWarehouse]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    if (inventory.length === 0) setLoading(true);
    setError(null);
    try {
      const ts = Date.now();
      const [invRes, whRes, catRes] = await Promise.all([
        fetch(`/api/inventory?_t=${ts}`),
        fetch(`/api/warehouses?_t=${ts}`),
        fetch(`/api/categories?_t=${ts}`),
      ]);
      if (!invRes.ok) throw new Error(`Inventory: HTTP ${invRes.status}`);
      if (!whRes.ok) throw new Error(`Warehouses: HTTP ${whRes.status}`);

      const invData = await invRes.json();
      const whData = await whRes.json();
      setInventory(invData || []);
      setWarehouses(whData || []);
      if (catRes.ok) setCategories(await catRes.json());
    } catch (err: any) {
      setError(err.message);
      toast.error(t("error_loading_data"));
    }
    setLoading(false);
  }

  const filteredInventory = inventory
    .filter((item) => selectedWarehouse === "all" || item.warehouse_id === selectedWarehouse)
    .filter((item) => selectedCategory === "all" || (item.products as any)?.categories?.id === selectedCategory || (item.products as any)?.category_id === selectedCategory);

  const handleViewOnMap = (locationId: string, warehouseId: string) => {
    setTargetLocationId(locationId);
    setSelectedWarehouse(warehouseId);
    setActiveTab("map");
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
            onClick={() => {
              // Activate bulk transfer: switch to map + enable bulk mode
              if (selectedWarehouse === "all" && warehouses.length > 0) {
                setSelectedWarehouse(warehouses[0].id);
              }
              setActiveTab("map");
              setBulkTransferMode(true);
            }}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              bulkTransferMode
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
            )}
          >
            <ArrowRightLeft size={16} /> {t("transfer")}
          </button>
          <button className="px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <Download size={16} /> {t("export")}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Category filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-8 pr-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50"
            >
              <option value="all">{t("all_categories", "Tất cả danh mục")}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {/* Warehouse filter */}
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50"
          >
            <option value="all">{t("all_warehouses")}</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>
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
            onDataChange={fetchData}
            bulkMode={bulkTransferMode}
            onBulkModeChange={setBulkTransferMode}
            externalFocusLocationId={targetLocationId}
            onClearFocus={() => setTargetLocationId(null)}
          />
        )}
      </motion.div>
    </div>
  );
}
