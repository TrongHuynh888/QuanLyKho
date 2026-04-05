import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ChevronLeft, Package, Edit, Loader2, ImageOff, Box, Tag, AlertCircle } from "lucide-react";
import type { Product } from "../types/supabase";
import { cn } from "../lib/utils";
import ProductFormModal from "../components/products/ProductFormModal";

interface ProductDetailViewProps {
  productId: string;
  onBack: () => void;
}

const STATE_COLOR: Record<string, { bg: string; text: string; label_key: string }> = {
  raw:       { bg: "bg-blue-100 dark:bg-blue-500/20",   text: "text-blue-700 dark:text-blue-400",   label_key: "raw" },
  cooked:    { bg: "bg-orange-100 dark:bg-orange-500/20", text: "text-orange-700 dark:text-orange-400", label_key: "cooked" },
  processed: { bg: "bg-green-100 dark:bg-green-500/20",  text: "text-green-700 dark:text-green-400",  label_key: "processed" },
};

export default function ProductDetailView({ productId, onBack }: ProductDetailViewProps) {
  const { t } = useTranslation();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  async function fetchProduct() {
    setLoading(true);
    setError(null);
    try {
      // In a real app we might have a GET /api/products/:id, but for now we can get all and find,
      // or we can just query supabase directly here, or get from the /api/products list.
      // Usually it's better to fetch the specific product if we have an endpoint.
      // Let's fetch all and find, since we might not have a GET /api/products/:id endpoint.
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load");
      const data: Product[] = await res.json();
      const p = data.find(item => item.id === productId);
      if (!p) throw new Error("Product not found");
      setProduct(p);
    } catch (err: any) {
      setError(err.message);
      toast.error(t("error_loading_data"));
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-taika-blue" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{t("loading")}...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-taika-red" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{error || "Product not found"}</p>
        <button type="button" onClick={onBack} className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl text-sm font-bold">
          {t("go_back", "Quay lại")}
        </button>
      </div>
    );
  }

  const st = STATE_COLOR[product.state] || STATE_COLOR.raw;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-6"
    >
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50 transition-colors"
        >
          <ChevronLeft size={18} /> {t("back_to_products", "Sản phẩm")}
        </button>
        <button
          onClick={() => setShowEditModal(true)}
          className="px-4 py-2 bg-taika-blue/10 dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 rounded-xl text-sm font-bold hover:bg-taika-blue hover:text-white dark:hover:bg-blue-500 transition-colors flex items-center gap-2"
        >
          <Edit size={16} /> {t("edit_product", "Sửa sản phẩm")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6 lg:gap-8">
        {/* Left Column: Image */}
        <div className="bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 p-4 shadow-sm flex items-center justify-center min-h-[300px] lg:min-h-[500px]">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="w-full h-full object-cover rounded-2xl"
            />
          ) : (
            <div className="flex flex-col items-center text-neutral-300 dark:text-neutral-600">
              <ImageOff size={64} className="mb-4" />
              <p className="text-sm font-medium">{t("no_image", "Chưa có ảnh")}</p>
            </div>
          )}
        </div>

        {/* Right Column: Details */}
        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-neutral-950 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
            {/* Title & Status */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight leading-tight mb-2">
                  {product.name}
                </h1>
                <p className="text-taika-blue dark:text-blue-400 font-mono font-bold text-lg">
                  {product.sku}
                </p>
              </div>
              <span className={cn("inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest", st.bg, st.text)}>
                {t(st.label_key)}
              </span>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl">
                <Tag size={16} className="text-neutral-400 mb-2" />
                <p className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase">{t("category", "Danh mục")}</p>
                <p className="font-bold text-neutral-900 dark:text-neutral-100 min-h-[1.5rem] mt-1">{product.categories?.name || "—"}</p>
              </div>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl">
                <Box size={16} className="text-neutral-400 mb-2" />
                <p className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase">{t("product_type", "Loại")}</p>
                <p className="font-bold text-neutral-900 dark:text-neutral-100 min-h-[1.5rem] mt-1">{product.type || "—"}</p>
              </div>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl">
                <Package size={16} className="text-neutral-400 mb-2" />
                <p className="text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase">{t("size_grading", "Kích cỡ")}</p>
                <p className="font-bold text-neutral-900 dark:text-neutral-100 min-h-[1.5rem] mt-1">{product.size || "—"}</p>
              </div>
            </div>

            <div className="h-px w-full bg-neutral-100 dark:bg-neutral-800 mb-6" />

            {/* Content Details */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-200 uppercase tracking-widest mb-3">
                  {t("ingredients", "Thành phần")}
                </h3>
                {product.ingredients ? (
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed whitespace-pre-wrap">
                    {product.ingredients}
                  </p>
                ) : (
                  <p className="text-neutral-400 dark:text-neutral-600 text-sm italic">{t("no_ingredients", "Chưa có thông tin thành phần")}</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-200 uppercase tracking-widest mb-3">
                  {t("description", "Mô tả")}
                </h3>
                {product.description ? (
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed whitespace-pre-wrap">
                    {product.description}
                  </p>
                ) : (
                  <p className="text-neutral-400 dark:text-neutral-600 text-sm italic">{t("no_description", "Chưa có thông tin mô tả")}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProductFormModal
        open={showEditModal}
        product={product}
        onClose={() => setShowEditModal(false)}
        onSaved={fetchProduct}
      />
    </motion.div>
  );
}
