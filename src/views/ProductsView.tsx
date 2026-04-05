import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ProductFormModal from "../components/products/ProductFormModal";

interface ProductsViewProps {
  onAction: (action: string) => void;
}

const STATE_COLOR: Record<string, { bg: string; text: string; label_key: string }> = {
  raw:       { bg: "bg-blue-100 dark:bg-blue-500/20",   text: "text-blue-700 dark:text-blue-400",   label_key: "raw" },
  cooked:    { bg: "bg-orange-100 dark:bg-orange-500/20", text: "text-orange-700 dark:text-orange-400", label_key: "cooked" },
  processed: { bg: "bg-green-100 dark:bg-green-500/20",  text: "text-green-700 dark:text-green-400",  label_key: "processed" },
};

export default function ProductsView({ onAction }: ProductsViewProps) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{t("products")}</h3>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">
            {t("total_stock")}: <span className="font-bold text-neutral-700 dark:text-neutral-300">{products.length}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditProduct(null); setShowModal(true); }}
          className="px-5 py-2.5 bg-taika-blue text-white rounded-2xl text-sm font-bold hover:bg-taika-blue/90 shadow-xl shadow-taika-blue/10 transition-all flex items-center gap-2 shrink-0"
        >
          <Plus size={18} /> {t("add_product")}
        </button>
      </div>

      {/* Filters */}
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
          </select>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Package size={48} className="text-neutral-300 dark:text-neutral-600" />
          <p className="text-neutral-400 dark:text-neutral-500 font-medium">{search ? t("no_suppliers_found") : t("no_products_yet")}</p>
          {!search && (
            <button type="button" onClick={() => { setEditProduct(null); setShowModal(true); }}
              className="px-5 py-2 bg-taika-blue text-white rounded-2xl text-sm font-bold">
              <Plus size={16} className="inline mr-1" />{t("add_product")}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[3rem_2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
            <div />
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("product_name")}</p>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">SKU</p>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("category")}</p>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("state")}</p>
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("min_stock")}</p>
            <div />
          </div>

          {/* Rows */}
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
                    className="grid grid-cols-[3rem_2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors group cursor-pointer"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("nav-product", { detail: { id: product.id } }));
                    }}
                  >
                    {/* Image */}
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

                    {/* Name */}
                    <div className="min-w-0">
                      <p className="font-bold text-neutral-900 dark:text-neutral-50 text-sm truncate">{product.name}</p>
                      {(product.type || product.size) && (
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium truncate">
                          {[product.type, product.size].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>

                    {/* SKU */}
                    <p className="text-xs font-mono font-bold text-taika-blue dark:text-blue-400 truncate">{product.sku}</p>

                    {/* Category */}
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium truncate">
                      {product.categories?.name || "—"}
                    </p>

                    {/* State badge */}
                    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit", st.bg, st.text)}>
                      {t(st.label_key)}
                    </span>

                    {/* Min stock */}
                    <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                      {product.min_stock_level.toLocaleString()}
                      <span className="text-xs font-medium text-neutral-400 ml-1">{product.uoms?.abbreviation || "kg"}</span>
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Modal */}
      <ProductFormModal
        open={showModal}
        product={editProduct}
        onClose={() => setShowModal(false)}
        onSaved={fetchProducts}
      />

      {/* Delete Confirmation Modal */}
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
