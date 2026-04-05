/**
 * CSV Export Utilities for Taika Seafood Reports
 * Handles UTF-8 BOM encoding for Excel compatibility with Vietnamese characters.
 */

type Row = Record<string, string | number | boolean | null | undefined>;

/**
 * Convert an array of flat objects into a CSV string.
 * @param data   Array of objects where each object is a row.
 * @param columns  Ordered list of { key, header } to control column order & header labels.
 */
export function toCSV(
  data: Row[],
  columns: { key: string; header: string }[]
): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Wrap in quotes if value contains comma, newline or quote
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headerLine = columns.map((c) => escape(c.header)).join(",");
  const bodyLines = data.map((row) =>
    columns.map((c) => escape(row[c.key])).join(",")
  );

  return [headerLine, ...bodyLines].join("\n");
}

/**
 * Trigger a browser download of a CSV file.
 * Prepends UTF-8 BOM so that Excel opens the file with correct encoding.
 */
export function downloadCSV(csv: string, filename: string): void {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper: generate a timestamped filename.
 * e.g. "inventory_report_20260405_1430.csv"
 */
export function reportFilename(prefix: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${prefix}_${ts}.csv`;
}

/**
 * Format a number as Vietnamese currency string (no symbol, thousands separator).
 */
export function formatVND(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return new Intl.NumberFormat("vi-VN").format(value);
}
