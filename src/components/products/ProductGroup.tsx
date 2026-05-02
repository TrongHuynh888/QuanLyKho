import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import type { Product } from "../../types/supabase";
import { ChevronDown, Package } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ProductCard from "./ProductCard";

interface ProductGroupProps {
  /** Key nhóm: raw | cooked | processed | packaging */
  groupKey: string;
  /** Tiêu đề nhóm (đã qua t()) */
  title: string;
  /** Mô tả ngắn (đã qua t()) */
  description: string;
  /** Icon component */
  icon: React.ReactNode;
  /** Màu nhóm — dùng cho accent */
  colorScheme: {
    bg: string;
    text: string;
    border: string;
    iconBg: string;
    countBg: string;
    countText: string;
  };
  /** Danh sách sản phẩm trong nhóm */
  products: Product[];
  /** Trạng thái thu gọn */
  collapsed: boolean;
  /** Toggle thu gọn */
  onToggle: () => void;
  /** Callback khi edit sản phẩm */
  onEdit: (product: Product) => void;
  /** Callback khi delete sản phẩm */
  onDelete: (product: Product) => void;
  /** Callback khi click vào sản phẩm */
  onProductClick: (product: Product) => void;
}

/**
 * Component nhóm sản phẩm — hiển thị 1 section với header, collapse toggle, và lưới cards
 *
 * @param {ProductGroupProps} props
 * @returns {JSX.Element} Section nhóm sản phẩm
 */
export default function ProductGroup({
  groupKey,
  title,
  description,
  icon,
  colorScheme,
  products,
  collapsed,
  onToggle,
  onEdit,
  onDelete,
  onProductClick,
}: ProductGroupProps) {
  const { t } = useTranslation();

  return (
    <div className={cn(
      "rounded-2xl border transition-colors",
      colorScheme.border,
      "bg-white dark:bg-neutral-950"
    )}>
      {/* Header nhóm — click để collapse/expand */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left group"
      >
        {/* Icon nhóm */}
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          colorScheme.iconBg
        )}>
          {icon}
        </div>

        {/* Title + Description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">
              {title}
            </h3>
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black",
              colorScheme.countBg, colorScheme.countText
            )}>
              {products.length}
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5 truncate">
            {description}
          </p>
        </div>

        {/* Collapse chevron */}
        <ChevronDown
          size={18}
          className={cn(
            "text-neutral-400 dark:text-neutral-500 transition-transform duration-200 shrink-0",
            collapsed && "-rotate-90"
          )}
        />
      </button>

      {/* Content — Grid of cards */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Package size={28} className="text-neutral-300 dark:text-neutral-600" />
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                    {t("no_products_in_group")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
                  <AnimatePresence mode="popLayout">
                    {products.map((product, i) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        index={i}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onClick={onProductClick}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
