import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tiện ích kết hợp và gộp các class CSS của Tailwind một cách an toàn.
 * Hàm này dùng để tránh xung đột giữa các class Tailwind và cho phép cấu trúc code linh hoạt hơn.
 * @param inputs Danh sách các class
 * @returns {string} Chuỗi class đã được gộp
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
