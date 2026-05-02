import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import type { Product } from "../../types/supabase";
import { Pencil, Trash2, ImageOff } from "lucide-react";
import { motion } from "motion/react";

interface ProductCardProps {
  product: Product;
  index: number;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onClick: (product: Product) => void;
}

const STATE_COLOR: Record<string, { bg: string; text: string; label_key: string }> = {
  raw:       { bg: "bg-blue-100 dark:bg-blue-500/20",     text: "text-blue-700 dark:text-blue-400",     label_key: "raw" },
  cooked:    { bg: "bg-orange-100 dark:bg-orange-500/20",  text: "text-orange-700 dark:text-orange-400", label_key: "cooked" },
  processed: { bg: "bg-green-100 dark:bg-green-500/20",    text: "text-green-700 dark:text-green-400",   label_key: "processed" },
  packaging: { bg: "bg-purple-100 dark:bg-purple-500/20",  text: "text-purple-700 dark:text-purple-400", label_key: "packaging" },
};

/**
 * Card hiển thị thông tin 1 sản phẩm — dùng trong chế độ Card View
 *
 * @param {ProductCardProps} props
 * @returns {JSX.Element} Card sản phẩm
 */
export default function ProductCard({ product, index, onEdit, onDelete, onClick }: ProductCardProps) {
  const { t } = useTranslation();
  const st = STATE_COLOR[product.state] || STATE_COLOR.raw;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => onClick(product)}
      className="group relative bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden cursor-pointer hover:border-taika-blue/40 dark:hover:border-blue-500/40 hover:shadow-lg hover:shadow-taika-blue/5 transition-all duration-200"
    >
      <div className="relative w-full aspect-[3/2] bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={32} className="text-neutral-300 dark:text-neutral-600" />
          </div>
        )}

        {/* Badge trạng thái overlay trên ảnh */}
        <span className={cn(
          "absolute top-2.5 left-2.5 inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-sm",
          st.bg, st.text
        )}>
          {t(st.label_key)}
        </span>

        {/* Hành động hover — Edit / Delete */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(product); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm hover:bg-taika-blue hover:text-white text-neutral-500 dark:text-neutral-400 transition-colors shadow-sm"
            title={t("edit_product")}
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(product); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm hover:bg-red-500 hover:text-white text-neutral-500 dark:text-neutral-400 transition-colors shadow-sm"
            title={t("delete_product")}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Nội dung card */}
      <div className="p-3">
        {/* Tên sản phẩm */}
        <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-50 line-clamp-2 leading-tight min-h-[2.5rem]" title={product.name}>
          {product.name}
        </h4>

        {/* Mô tả phụ: Loại chế biến · Kích cỡ */}
        {(product.type || product.size) && (
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium truncate mt-0.5">
            {[product.type, product.size].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* SKU + Danh mục */}
        <div className="flex items-center justify-between mt-2.5">
          <p className="text-[11px] font-mono font-bold text-taika-blue dark:text-blue-400 truncate max-w-[60%]">
            {product.sku}
          </p>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium truncate max-w-[38%] text-right">
            {product.categories?.name || "—"}
          </p>
        </div>

        {/* Tồn kho tối thiểu */}
        <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/60">
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
            {t("min_stock")}:{" "}
            <span className="font-bold text-neutral-700 dark:text-neutral-300">
              {product.min_stock_level.toLocaleString()}
            </span>
            <span className="ml-0.5 text-neutral-400">{product.uoms?.abbreviation || "kg"}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
