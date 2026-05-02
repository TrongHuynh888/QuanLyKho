import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { motion } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
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
  ArrowLeft,
  Building,
  Thermometer,
  User,
  Package,
  MapPin,
  Maximize,
  Scale,
} from "lucide-react";

import InventoryStats from "../components/inventory/InventoryStats";
import InventoryTable from "../components/inventory/InventoryTable";
import WarehouseMap from "../components/inventory/WarehouseMap";

interface InventoryViewProps {
  onAction: (action: string) => void;
}

type ViewTab = "list" | "map";

/**
 * Giao diện Tồn kho (Inventory).
 * Cho phép xem hàng hóa đang có trong kho dưới dạng danh sách (bảng) hoặc xem trực quan trên bản đồ.
 * @param onAction Hàm callback dùng để kích hoạt các hành động nhanh
 */
export default function InventoryView({ onAction }: InventoryViewProps) {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<{id: string; name: string}[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("list");
  const [viewMode, setViewMode] = useState<"warehouses" | "detail">("warehouses");
  const [bulkTransferMode, setBulkTransferMode] = useState(false);
  const [targetLocationId, setTargetLocationId] = useState<string | null>(null);

  // Bắt sự kiện kích hoạt điều chuyển từ các trang khác (vd: Dashboard)
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
        setViewMode("detail");
        setActiveTab("map");
        if (locId) setTargetLocationId(locId);
      }
    };
    
    // Kiểm tra xem có lệnh điều hướng từ nơi khác (chưa được render) lưu trên vùng chung hay không
    const pending = (window as any).__pendingWarehouseNav;
    if (pending?.warehouseId) {
      setSelectedWarehouse(pending.warehouseId);
      setViewMode("detail");
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

  /**
   * Gọi API tải danh sách toàn bộ tồn kho, kho và danh mục.
   */
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

  if (viewMode === "warehouses") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-3">
              <Building className="text-taika-blue" />
              {t("warehouses", "Danh sách Kho hàng")}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Chọn một kho hàng để xem chi tiết tồn kho và sơ đồ vị trí
            </p>
          </div>
          <button
            onClick={() => { setViewMode("detail"); setSelectedWarehouse("all"); }}
            className="px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
          >
            <List size={16} /> Xem tổng hợp tất cả
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((wh) => {
            const whInventory = inventory.filter(i => i.warehouse_id === wh.id);
            const totalKg = whInventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalProducts = new Set(whInventory.map(i => i.product_id)).size;
            
            return (
              <motion.div
                key={wh.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                onClick={() => {
                  setSelectedWarehouse(wh.id);
                  setViewMode("detail");
                }}
                className="bg-white dark:bg-neutral-950 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-xl hover:shadow-taika-blue/10 hover:border-taika-blue/50 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-taika-blue group-hover:scale-110 transition-transform">
                    <Building size={24} />
                  </div>
                  {wh.status === "active" ? (
                    <span className="px-2.5 py-1 rounded-md bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-[10px] font-black uppercase tracking-widest">
                      Đang H.Động
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[10px] font-black uppercase tracking-widest">
                      Tạm ngưng
                    </span>
                  )}
                </div>
                
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-4 group-hover:text-taika-blue transition-colors">
                  {wh.name}
                </h3>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                    <MapPin size={16} className="text-neutral-400 shrink-0" />
                    <span className="font-medium line-clamp-1">{wh.location || "Chưa có địa chỉ"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                    <Thermometer size={16} className="text-neutral-400 shrink-0" />
                    <span className="font-medium">{wh.temperature_zone || "Nhiệt độ phòng"}</span>
                  </div>
                  {wh.total_floor_area_sqm && (
                    <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                      <Maximize size={16} className="text-neutral-400 shrink-0" />
                      <span className="font-medium">DT sàn: {wh.total_floor_area_sqm} m²</span>
                    </div>
                  )}
                  {wh.max_capacity_kg && (
                    <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                      <Scale size={16} className="text-neutral-400 shrink-0" />
                      <span className="font-medium">Sức chứa: {(wh.max_capacity_kg / 1000).toLocaleString()} tấn</span>
                    </div>
                  )}
                  <div className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400 max-h-24 overflow-y-auto custom-scrollbar">
                    <User size={16} className="text-neutral-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      {wh.managers_info && wh.managers_info.length > 0 ? (
                        wh.managers_info.map((m: any, idx: number) => (
                          <div key={idx} className="font-medium">
                            <span className="text-neutral-400 dark:text-neutral-500 mr-1">{m.role}:</span>
                            <span className="text-neutral-900 dark:text-neutral-50">{m.name}</span>
                            {m.phone && <span className="text-xs ml-1 opacity-70">({m.phone})</span>}
                          </div>
                        ))
                      ) : (
                        <span className="font-medium text-neutral-400 italic">Chưa có nhân sự</span>
                      )}
                    </div>
                  </div>
                  {wh.notes && (
                    <div className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                      <List size={16} className="text-neutral-400 shrink-0 mt-0.5" />
                      <span className="font-medium line-clamp-2 italic">{wh.notes}</span>
                    </div>
                  )}
                </div>

                <div className="pt-5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Tổng KL Tồn</p>
                    <p className="text-lg font-black text-neutral-900 dark:text-neutral-50">{totalKg.toLocaleString()} <span className="text-xs text-neutral-500">kg</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Sản phẩm</p>
                    <p className="text-lg font-bold text-neutral-900 dark:text-neutral-50 flex items-center justify-end gap-1">
                      <Package size={16} className="text-neutral-400" />
                      {totalProducts}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nút quay lại và Tiêu đề kho */}
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setViewMode("warehouses")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            {selectedWarehouse !== "all" ? warehouses.find(w => w.id === selectedWarehouse)?.name : t("all_warehouses")}
          </h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-1">Chi tiết tồn kho</p>
        </div>
      </div>

      {/* Các nút hành động và bộ lọc kho */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex gap-2 flex-wrap">
          {hasRole("admin", "manager") && (
            <>
              <button
                onClick={() => onAction("stock_take")}
                className="px-4 py-2.5 bg-taika-blue text-white rounded-xl text-sm font-bold hover:bg-taika-blue/90 transition-all flex items-center gap-2 shadow-lg shadow-taika-blue/10"
              >
                <CheckCircle2 size={16} /> {t("stock_take")}
              </button>
              <button
                onClick={() => {
                  // Kích hoạt điều chuyển hàng loạt: mở bản đồ và bật chế độ bulk mode
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
            </>
          )}
          <button className="px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <Download size={16} /> {t("export")}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Lọc theo danh mục */}
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
          {/* Lọc theo kho hàng */}
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

      {/* Thống kê tồn kho */}
      <InventoryStats inventory={filteredInventory} />

      {/* Chuyển chế độ xem Dạng danh sách | Bản đồ */}
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

      {/* Chi tiết theo Tab */}
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
