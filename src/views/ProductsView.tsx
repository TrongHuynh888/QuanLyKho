import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import type { Product } from "../types/supabase";
import {
  Package,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  ImageOff,
  LayoutGrid,
  List,
  CookingPot,
  Fish,
  Settings2,
  Box
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ProductFormModal from "../components/products/ProductFormModal";
import ProductGroup from "../components/products/ProductGroup";

interface ProductsViewProps {
  onAction: (action: string) => void;
}

const STATE_COLOR: Record<string, { bg: string; text: string; label_key: string }> = {
  raw:       { bg: "bg-blue-100 dark:bg-blue-500/20",   text: "text-blue-700 dark:text-blue-400",   label_key: "raw" },
  cooked:    { bg: "bg-orange-100 dark:bg-orange-500/20", text: "text-orange-700 dark:text-orange-400", label_key: "cooked" },
  processed: { bg: "bg-green-100 dark:bg-green-500/20",  text: "text-green-700 dark:text-green-400",  label_key: "processed" },
  packaging: { bg: "bg-purple-100 dark:bg-purple-500/20",  text: "text-purple-700 dark:text-purple-400", label_key: "packaging" },
};

export default function ProductsView({ onAction }: ProductsViewProps) {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  
  // Collapse states for groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    raw: false,
    cooked: false,
    processed: false,
    packaging: false
  });

  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProducts(data || []);
    } catch (err: any) {
      setError(err.message);
      toast.error(t("error_loading_data"));
    }
    setLoading(false);
  }

  function handleDelete(product: Product) {
    setDeleteProduct(product);
  }

  async function confirmDelete() {
    if (!deleteProduct) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteProduct.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("product_deleted"));
      fetchProducts();
      setDeleteProduct(null);
    } catch (err: any) {
      toast.error(err.message);
    }
    setIsDeleting(false);
  }

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.type || "").toLowerCase().includes(q);
    const matchState = stateFilter === "all" || p.state === stateFilter;
    return matchSearch && matchState;
  });

  // Derived groups
  const rawProducts = filtered.filter(p => p.state === "raw");
  const processedProducts = filtered.filter(p => p.state === "processed");
  const cookedProducts = filtered.filter(p => p.state === "cooked");
  const packagingProducts = filtered.filter(p => p.state === "packaging");

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const scrollToGroup = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-taika-blue" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{t("loading")}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-taika-red" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{error}</p>
        <button type="button" onClick={fetchProducts} className="px-4 py-2 bg-taika-blue text-white rounded-xl text-sm font-bold">
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tiêu đề & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("products")}</h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">
            {t("total_stock")}: <span className="font-bold text-neutral-700 dark:text-neutral-300">{products.length}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Toggle View Mode */}
          <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl" title="Toggle view mode">
            <button
              onClick={() => setViewMode("card")}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === "card" ? "bg-white dark:bg-neutral-700 shadow flex text-taika-blue" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              )}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === "table" ? "bg-white dark:bg-neutral-700 shadow flex text-taika-blue" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              )}
            >
              <List size={16} />
            </button>
          </div>
          {hasRole("admin") && (
            <button
              type="button"
              onClick={() => { setEditProduct(null); setShowModal(true); }}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-taika-blue text-white rounded-2xl text-sm font-bold hover:bg-taika-blue/90 shadow-xl shadow-taika-blue/10 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Plus size={18} /> {t("add_product")}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {viewMode === "card" && !search && stateFilter === "all" && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => scrollToGroup("group-cooked")}
            className="group p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center gap-4 hover:border-green-500/30 dark:hover:border-green-500/30 hover:shadow-lg hover:shadow-green-500/5 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white shadow-lg shadow-green-500/20 shrink-0 group-hover:scale-110 transition-transform">
              <CookingPot size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50 leading-none mb-1">{cookedProducts.length}</p>
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">{t("finished_products")}</p>
            </div>
          </button>
          
          <button
            onClick={() => scrollToGroup("group-raw")}
            className="group p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center gap-4 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0 group-hover:scale-110 transition-transform">
              <Fish size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50 leading-none mb-1">{rawProducts.length}</p>
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">{t("raw_materials")}</p>
            </div>
          </button>
          
          <button
            onClick={() => scrollToGroup("group-processed")}
            className="group p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center gap-4 hover:border-orange-500/30 dark:hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 shrink-0 group-hover:scale-110 transition-transform">
              <Settings2 size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50 leading-none mb-1">{processedProducts.length}</p>
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">{t("semi_finished")}</p>
            </div>
          </button>

          <button
            onClick={() => scrollToGroup("group-packaging")}
            className="group p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center gap-4 hover:border-purple-500/30 dark:hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 shrink-0 group-hover:scale-110 transition-transform">
              <Box size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50 leading-none mb-1">{packagingProducts.length}</p>
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">{t("packaging")}</p>
            </div>
          </button>
        </div>
      )}

      {/* Bộ lọc */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("search_products")}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue transition-all"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="pl-8 pr-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-taika-blue appearance-none"
          >
            <option value="all">{t("all_states")}</option>
            <option value="raw">{t("raw")}</option>
            <option value="cooked">{t("cooked")}</option>
            <option value="processed">{t("processed")}</option>
            <option value="packaging">{t("packaging")}</option>
          </select>
        </div>
      </div>

      {/* Render Nội dung */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-800">
          <Package size={48} className="text-neutral-300 dark:text-neutral-600" />
          <p className="text-neutral-400 dark:text-neutral-500 font-medium">{search ? t("no_results") : t("no_products_yet")}</p>
          {!search && hasRole("admin") && (
            <button type="button" onClick={() => { setEditProduct(null); setShowModal(true); }}
              className="px-5 py-2 mt-2 bg-taika-blue text-white rounded-2xl text-sm font-bold">
              <Plus size={16} className="inline mr-1" />{t("add_product")}
            </button>
          )}
        </div>
      ) : viewMode === "table" ? (
        // TABLE VIEW (Chế độ cũ)
        <div className="bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
          {/* Tiêu đề bảng */}
          <div className="grid grid-cols-[3rem_2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 hidden md:grid">
            <div />
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("product_name")}</p>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">SKU</p>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("category")}</p>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("state")}</p>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("min_stock")}</p>
            <div />
          </div>

          {/* Các hàng dữ liệu */}
          <div className="divide-y divide-neutral-50 dark:divide-neutral-800/50">
            <AnimatePresence mode="popLayout">
              {filtered.map((product, i) => {
                const st = STATE_COLOR[product.state] || STATE_COLOR.raw;
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-[3rem_minmax(0,1fr)] md:grid-cols-[3rem_2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors group cursor-pointer"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("nav-product", { detail: { id: product.id } }));
                    }}
                  >
                    {/* Hình ảnh */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <ImageOff size={16} className="text-neutral-300 dark:text-neutral-600" />
                      )}
                    </div>

                    {/* Tên sản phẩm */}
                    <div className="min-w-0 col-span-1 md:col-span-1">
                      <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm truncate">{product.name}</p>
                      <div className="flex items-center flex-wrap gap-2 md:hidden mt-1">
                         <span className="text-xs font-mono font-bold text-taika-blue dark:text-blue-400">{product.sku}</span>
                         <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest", st.bg, st.text)}>{t(st.label_key)}</span>
                      </div>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium truncate hidden md:block">
                        {[product.type, product.size].filter(Boolean).join(" · ")}
                      </p>
                    </div>

                    {/* Mã SKU (Desktop) */}
                    <p className="text-xs font-mono font-bold text-taika-blue dark:text-blue-400 truncate hidden md:block">{product.sku}</p>

                    {/* Danh mục (Desktop) */}
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium truncate hidden md:block">
                      {product.categories?.name || "—"}
                    </p>

                    {/* Nhãn trạng thái (Desktop) */}
                    <div className="hidden md:block">
                      <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit", st.bg, st.text)}>
                        {t(st.label_key)}
                      </span>
                    </div>

                    {/* Tồn kho tối thiểu (Desktop) */}
                    <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 hidden md:block">
                      {product.min_stock_level.toLocaleString()}
                      <span className="text-xs font-medium text-neutral-400 ml-1">{product.uoms?.abbreviation || "kg"}</span>
                    </p>

                    {/* Hành động */}
                    {hasRole("admin") && (
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity col-span-2 md:col-span-1 justify-end md:justify-start mt-2 md:mt-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditProduct(product); setShowModal(true); }}
                          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-taika-blue/10 text-neutral-400 hover:text-taika-blue dark:hover:text-blue-400 transition-colors"
                          title={t("edit_product")}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(product); }}
                          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title={t("delete_product")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        // CARD VIEW (Chế độ nhóm)
        <div className="flex flex-col gap-6">
          {(stateFilter === "all" || stateFilter === "cooked") && cookedProducts.length > 0 && (
            <div id="group-cooked" className="scroll-mt-24">
              <ProductGroup
                groupKey="cooked"
                title={t("finished_products")}
                description={t("finished_products_desc")}
                icon={<CookingPot size={20} className="text-green-600 dark:text-green-400" />}
                colorScheme={{
                  bg: "bg-green-50 dark:bg-green-500/10",
                  text: "text-green-700 dark:text-green-400",
                  border: "border-green-200/50 dark:border-green-500/20",
                  iconBg: "bg-green-100 dark:bg-green-500/20",
                  countBg: "bg-green-500",
                  countText: "text-white"
                }}
                products={cookedProducts}
                collapsed={collapsedGroups.cooked}
                onToggle={() => toggleGroup("cooked")}
                onEdit={hasRole("admin") ? ((p) => { setEditProduct(p); setShowModal(true); }) : undefined}
                onDelete={hasRole("admin") ? handleDelete : undefined}
                onProductClick={(p) => window.dispatchEvent(new CustomEvent("nav-product", { detail: { id: p.id } }))}
              />
            </div>
          )}

          {(stateFilter === "all" || stateFilter === "raw") && rawProducts.length > 0 && (
            <div id="group-raw" className="scroll-mt-24">
              <ProductGroup
                groupKey="raw"
                title={t("raw_materials")}
                description={t("raw_materials_desc")}
                icon={<Fish size={20} className="text-blue-600 dark:text-blue-400" />}
                colorScheme={{
                  bg: "bg-blue-50 dark:bg-blue-500/10",
                  text: "text-blue-700 dark:text-blue-400",
                  border: "border-blue-200/50 dark:border-blue-500/20",
                  iconBg: "bg-blue-100 dark:bg-blue-500/20",
                  countBg: "bg-blue-500",
                  countText: "text-white"
                }}
                products={rawProducts}
                collapsed={collapsedGroups.raw}
                onToggle={() => toggleGroup("raw")}
                onEdit={hasRole("admin") ? ((p) => { setEditProduct(p); setShowModal(true); }) : undefined}
                onDelete={hasRole("admin") ? handleDelete : undefined}
                onProductClick={(p) => window.dispatchEvent(new CustomEvent("nav-product", { detail: { id: p.id } }))}
              />
            </div>
          )}

          {(stateFilter === "all" || stateFilter === "processed") && processedProducts.length > 0 && (
            <div id="group-processed" className="scroll-mt-24">
              <ProductGroup
                groupKey="processed"
                title={t("semi_finished")}
                description={t("semi_finished_desc")}
                icon={<Settings2 size={20} className="text-orange-600 dark:text-orange-400" />}
                colorScheme={{
                  bg: "bg-orange-50 dark:bg-orange-500/10",
                  text: "text-orange-700 dark:text-orange-400",
                  border: "border-orange-200/50 dark:border-orange-500/20",
                  iconBg: "bg-orange-100 dark:bg-orange-500/20",
                  countBg: "bg-orange-500",
                  countText: "text-white"
                }}
                products={processedProducts}
                collapsed={collapsedGroups.processed}
                onToggle={() => toggleGroup("processed")}
                onEdit={hasRole("admin") ? ((p) => { setEditProduct(p); setShowModal(true); }) : undefined}
                onDelete={hasRole("admin") ? handleDelete : undefined}
                onProductClick={(p) => window.dispatchEvent(new CustomEvent("nav-product", { detail: { id: p.id } }))}
              />
            </div>
          )}

          {(stateFilter === "all" || stateFilter === "packaging") && packagingProducts.length > 0 && (
            <div id="group-packaging" className="scroll-mt-24">
              <ProductGroup
                groupKey="packaging"
                title={t("packaging_materials")}
                description={t("packaging_materials_desc")}
                icon={<Box size={20} className="text-purple-600 dark:text-purple-400" />}
                colorScheme={{
                  bg: "bg-purple-50 dark:bg-purple-500/10",
                  text: "text-purple-700 dark:text-purple-400",
                  border: "border-purple-200/50 dark:border-purple-500/20",
                  iconBg: "bg-purple-100 dark:bg-purple-500/20",
                  countBg: "bg-purple-500",
                  countText: "text-white"
                }}
                products={packagingProducts}
                collapsed={collapsedGroups.packaging}
                onToggle={() => toggleGroup("packaging")}
                onEdit={hasRole("admin") ? ((p) => { setEditProduct(p); setShowModal(true); }) : undefined}
                onDelete={hasRole("admin") ? handleDelete : undefined}
                onProductClick={(p) => window.dispatchEvent(new CustomEvent("nav-product", { detail: { id: p.id } }))}
              />
            </div>
          )}
        </div>
      )}

      {/* Cửa sổ thêm/sửa sản phẩm */}
      <ProductFormModal
        open={showModal}
        product={editProduct}
        onClose={() => setShowModal(false)}
        onSaved={fetchProducts}
      />

      {/* Cửa sổ xác nhận xóa */}
      <AnimatePresence>
        {deleteProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setDeleteProduct(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-neutral-950 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="w-16 h-16 rounded-3xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-bold text-center text-neutral-900 dark:text-neutral-50 mb-2">
                {t("confirm_delete")}
              </h3>
              <p className="text-center text-neutral-500 dark:text-neutral-400 font-medium mb-8 text-sm">
                {t("delete_warning_1")}<span className="font-bold text-neutral-900 dark:text-neutral-100">{deleteProduct.name}</span>{t("delete_warning_2")}
              </p>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteProduct(null)}
                  className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-bold text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  {isDeleting ? t("deleting") : t("delete")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
