import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import type { Product } from "../types/supabase";
import {
  Package,
  Download,
  Upload,
  Plus,
  ArrowUpRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { motion } from "motion/react";

interface ProductsViewProps {
  onAction: (action: string) => void;
}

const COLOR_MAP: Record<string, string> = {
  raw: "blue",
  cooked: "red",
  processed: "green",
};

export default function ProductsView({ onAction }: ProductsViewProps) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

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
        <button onClick={fetchProducts} className="px-4 py-2 bg-taika-blue text-white rounded-xl text-sm font-bold">
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 shadow-sm">
            <Download size={18} /> {t("export")}
          </button>
          <button className="px-5 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all flex items-center gap-2 shadow-sm">
            <Upload size={18} /> {t("import")}
          </button>
        </div>
        <button 
          onClick={() => onAction("add_product")}
          className="px-8 py-3 bg-taika-blue text-white rounded-2xl text-sm font-bold hover:bg-taika-blue/90 shadow-xl shadow-taika-blue/10 transition-all flex items-center gap-2"
        >
          <Plus size={20} /> {t("add_product")}
        </button>
      </div>
      
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Package size={48} className="text-neutral-300 dark:text-neutral-600" />
          <p className="text-neutral-400 dark:text-neutral-500 font-medium">{t("no_products_yet")}</p>
          <button 
            onClick={() => onAction("add_product")}
            className="px-6 py-2.5 bg-taika-blue text-white rounded-2xl text-sm font-bold"
          >
            <Plus size={16} className="inline mr-1" />{t("add_product")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product, i) => {
            const color = COLOR_MAP[product.state] || "blue";
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-neutral-950 p-6 rounded-[2rem] border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110",
                    color === "blue" && "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
                    color === "green" && "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
                    color === "red" && "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
                  )}>
                    <Package size={28} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-[0.2em]">{t("product_type")}</span>
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-50 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-lg">{product.type || "N/A"}</span>
                  </div>
                </div>
                <h4 className="font-bold text-xl mb-1 text-neutral-900 dark:text-neutral-50">{product.name}</h4>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="text-[10px] font-bold px-2 py-1 bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 rounded-md border border-neutral-100 dark:border-neutral-800">SIZE: {product.size || "N/A"}</span>
                  <span className="text-[10px] font-bold px-2 py-1 bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 rounded-md border border-neutral-100 dark:border-neutral-800 uppercase">{product.state}</span>
                  {product.categories && (
                    <span className="text-[10px] font-bold px-2 py-1 bg-taika-blue-light dark:bg-blue-500/10 text-taika-blue dark:text-blue-400 rounded-md">{product.categories.name}</span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-5 border-t border-neutral-50 dark:border-neutral-800">
                  <div>
                    <p className="text-[10px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-[0.2em] mb-1">SKU</p>
                    <p className="text-sm font-bold text-taika-blue dark:text-blue-400 font-mono">{product.sku}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center text-neutral-400 dark:text-neutral-500 group-hover:bg-taika-blue group-hover:text-white transition-all">
                    <ArrowUpRight size={20} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
