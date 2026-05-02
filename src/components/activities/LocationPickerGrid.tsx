import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { Loader2, MapPin, Info, AlertTriangle, SplitSquareHorizontal } from "lucide-react";
import { toast } from "sonner";

interface AvailableLocation {
  id: string;
  zone: string;
  rack: string | null;
  bin: string | null;
  capacity: number;
  current_quantity: number;
  remaining_capacity: number;
  existing_items?: { product_id: string; product_name: string; expiry_date: string | null; lot_number?: string | null; contract_number?: string | null; production_date?: string | null; quantity?: number }[];
}

interface LocationPickerGridProps {
  locations: AvailableLocation[];
  selectedIds?: string[];
  onSelect: (locId: string, allowMix?: boolean) => void;
  loading?: boolean;
  warehouse: { total_zones?: number; racks_per_zone?: number; bins_per_rack?: number; zones_per_row?: number | null } | null;
  zoneLabels?: Record<string, string>;
  incomingProductId?: string;
  incomingExpiryDate?: string;
  incomingQuantity?: number;
  totalLineQuantity?: number;
}

// ── Hằng số cấu hình Lưới Bản đồ (Grid constants) ──────────────
const BW = 42, BH = 34, BG = 5, RG = 12, ZG = 18;
const HEADER = 44;

/**
 * Component hiển thị bản đồ trực quan lưới các vị trí lưu trữ trong kho (Zones, Racks, Bins)
 * Cho phép người dùng nhấp chọn nhanh một vị trí cụ thể.
 *
 * @param {LocationPickerGridProps} props - Thuộc tính cấu hình đầu vào
 * @returns {JSX.Element} Lưới vị trí trên bản đồ
 */
export default function LocationPickerGrid({ locations, selectedIds = [], onSelect, loading, warehouse, zoneLabels, incomingProductId, incomingExpiryDate, incomingQuantity, totalLineQuantity }: LocationPickerGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmMixId, setConfirmMixId] = useState<string | null>(null);
  const [showMixInfo, setShowMixInfo] = useState(false);
  const { t } = useTranslation();

  const isDark = document.documentElement.classList.contains("dark");

  // Xây dựng cấu trúc lưới từ các vị trí đang khả dụng và cấu hình chung kho bãi
  const grid = useMemo(() => {
    const zoneSet = new Set<string>();
    const rackSet = new Set<string>();
    const binSet = new Set<string>();
    locations.forEach(l => { zoneSet.add(l.zone); if (l.rack) rackSet.add(l.rack); if (l.bin) binSet.add(l.bin); });

    const nZ = Math.max(zoneSet.size, warehouse?.total_zones || 1);
    const nR = Math.max(rackSet.size, warehouse?.racks_per_zone || 3);
    const nB = Math.max(binSet.size, warehouse?.bins_per_rack || 6);

    const zones = Array.from({ length: nZ }, (_, i) => `Z${i + 1}`);
    const racks = Array.from({ length: nR }, (_, i) => `R${i + 1}`);
    const bins = Array.from({ length: nB }, (_, i) => `B${i + 1}`);

    const lookup = new Map<string, AvailableLocation>();
    locations.forEach(l => lookup.set(`${l.zone}-${l.rack || "R1"}-${l.bin || "B1"}`, l));

    return { zones, racks, bins, lookup, nZ, nR, nB };
  }, [locations, warehouse]);

  const { zones, racks, bins, lookup, nZ, nR, nB } = grid;

  // Các tính toán tính toán bố cục hiển thị (Layout calculations)
  const zonesPerRow = warehouse?.zones_per_row && warehouse.zones_per_row > 0 ? warehouse.zones_per_row : Math.max(nZ, 1);
  const numRows = Math.ceil(nZ / zonesPerRow) || 1;
  const cols = Math.min(nZ, zonesPerRow);

  const rackW = nR * (BW + BG) - BG + RG;
  const rowH = BH + BG;
  const singleGridH = HEADER + nB * rowH;
  const ROW_GAP = 30;

  const gridW = cols * (rackW + ZG) - ZG;
  const gridH = numRows * singleGridH + (numRows - 1) * ROW_GAP;
  const PAD = 12;
  const VW = PAD * 2 + gridW;
  const VH = PAD * 2 + gridH;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={20} className="animate-spin text-taika-blue" />
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="py-8 text-center border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl">
        <MapPin size={24} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t("iw_no_locations")}</p>
      </div>
    );
  }

  /**
   * Tính toán phong cách màu sắc đại diện cho trạng thái hiện tại của một vị trí thùng (bin).
   * @param {AvailableLocation | undefined} loc - Thông tin vị trí
   * @returns Thuộc tính style cho SVG
   */
  function getBinStyle(loc: AvailableLocation | undefined) {
    if (!loc) {
      return {
        fill: isDark ? "rgba(30,41,59,0.3)" : "rgba(226,232,240,0.4)",
        stroke: isDark ? "#1e293b" : "#e2e8f0",
        text: isDark ? "rgba(71,85,105,0.3)" : "rgba(148,163,184,0.3)",
        cursor: "default" as const,
        clickable: false,
      };
    }

    if (selectedIds.includes(loc.id)) {
      return {
        fill: "#22c55e",
        stroke: "#16a34a",
        text: "#fff",
        cursor: "pointer" as const,
        clickable: true,
      };
    }

    if (loc.id === hoveredId) {
      return {
        fill: isDark ? "#1d4ed8" : "#3b82f6",
        stroke: "#2563eb",
        text: "#fff",
        cursor: "pointer" as const,
        clickable: true,
      };
    }

    // Ô đã đầy sức chứa (remaining_capacity <= 0)
    if (loc.remaining_capacity <= 0 && !selectedIds.includes(loc.id)) {
      return {
        fill: isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)",
        stroke: isDark ? "#dc2626" : "#ef4444",
        text: isDark ? "#f87171" : "#dc2626",
        cursor: "pointer" as const,
        clickable: true,
        isFull: true,
      };
    }

    if (loc.current_quantity > 0) {
      if (incomingProductId && loc.existing_items && loc.existing_items.length > 0) {
        const incompatible = loc.existing_items.some(item => {
          if (item.product_id !== incomingProductId) return true;
          const existingExp = item.expiry_date ? new Date(item.expiry_date).toISOString().slice(0, 10) : null;
          const incomingExp = incomingExpiryDate ? new Date(incomingExpiryDate).toISOString().slice(0, 10) : null;
          return existingExp !== incomingExp;
        });
        if (incompatible) {
          return {
            fill: isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.12)",
            stroke: isDark ? "#d97706" : "#f59e0b",
            text: isDark ? "#f59e0b" : "#b45309",
            cursor: "pointer" as const,
            clickable: true,
            incompatible: true,
          };
        }
      }
      return {
        fill: isDark ? "rgba(59,130,246,0.2)" : "rgba(191,219,254,0.7)",
        stroke: isDark ? "#1e40af" : "#93c5fd",
        text: isDark ? "#60a5fa" : "#2563eb",
        cursor: "pointer" as const,
        clickable: true,
      };
    }

    return {
      fill: isDark ? "rgba(30,58,138,0.25)" : "rgba(219,234,254,0.6)",
      stroke: isDark ? "#1e3a8a" : "#93c5fd",
      text: isDark ? "#60a5fa" : "#3b82f6",
      cursor: "pointer" as const,
      clickable: true,
    };
  }

  const isSelectedHovered = hoveredId && selectedIds.includes(hoveredId);
  const selectedLoc = selectedIds.length > 0 ? locations.find(l => l.id === selectedIds[selectedIds.length - 1]) : null;
  const hoveredLoc = hoveredId ? locations.find(l => l.id === hoveredId) : null;
  const tooltipLoc = hoveredLoc || selectedLoc;

  const muted = isDark ? "#4b5563" : "#94a3b8";
  const subtle = isDark ? "#1e293b" : "#e2e8f0";

  return (
    <div className="space-y-3">
      {/* Thanh chú thích (Legend) */}
      <div className="flex items-center gap-4 text-[10px] font-bold flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: isDark ? "rgba(30,58,138,0.25)" : "rgba(219,234,254,0.6)", border: `1px solid ${isDark ? "#1e3a8a" : "#93c5fd"}` }} />
          {t("iw_legend_empty")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: isDark ? "rgba(59,130,246,0.2)" : "rgba(191,219,254,0.7)", border: `1px solid ${isDark ? "#1e40af" : "#93c5fd"}` }} />
          {t("iw_legend_compatible")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-500 border border-green-600" />
          {t("iw_legend_selected")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.12)", border: `1px solid ${isDark ? "#d97706" : "#f59e0b"}` }} />
          {t("iw_legend_different")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)", border: `1px solid ${isDark ? "#dc2626" : "#ef4444"}` }} />
          {t("iw_legend_full")}
        </span>
        <div className="relative ml-auto">
          <button type="button" onClick={() => setShowMixInfo(v => !v)} className="text-neutral-400 hover:text-taika-blue transition-colors">
            <Info size={14} />
          </button>
          {showMixInfo && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMixInfo(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl p-3 w-[240px] space-y-1.5 text-[11px] font-medium">
                <p className="font-bold text-neutral-700 dark:text-neutral-200 text-xs mb-1">{t("iw_mix_rule_title")}</p>
                <p className="text-neutral-500 dark:text-neutral-400">• {t("iw_mix_rule_1")}</p>
                <p className="text-neutral-500 dark:text-neutral-400">• {t("iw_mix_rule_2")}</p>
                <p className="text-neutral-500 dark:text-neutral-400">• {t("iw_mix_rule_3")}</p>
                <p className="text-neutral-500 dark:text-neutral-400">• {t("iw_mix_rule_4")}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Layout 2 cột: Map + Detail Panel */}
      <div className="flex gap-4">
        {/* SVG Grid */}
        <div className="flex-1 overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50"
          style={{ maxHeight: 350 }}>
          <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`} className="block">
            {(() => {
              const zoneBlocks = zones.map((name, zi) => {
                const row = Math.floor(zi / zonesPerRow);
                const col = zi % zonesPerRow;
                const x = PAD + col * (rackW + ZG);
                const y = PAD + row * (singleGridH + ROW_GAP);
                return { name, x, y, w: rackW, h: singleGridH, zi };
              });

              const catGroups: { minX: number; minY: number; maxX: number; maxY: number; label: string }[] = [];
              if (zoneLabels) {
                const groups: Record<string, any> = {};
                zoneBlocks.forEach(b => {
                  const label = zoneLabels[b.name];
                  if (!label) return;
                  if (!groups[label]) {
                    groups[label] = { minX: b.x - 8, minY: b.y - 8, maxX: b.x + b.w + 8, maxY: b.y + b.h + 8, label };
                  } else {
                    const g = groups[label];
                    g.minX = Math.min(g.minX, b.x - 8);
                    g.minY = Math.min(g.minY, b.y - 8);
                    g.maxX = Math.max(g.maxX, b.x + b.w + 8);
                    g.maxY = Math.max(g.maxY, b.y + b.h + 8);
                  }
                });
                catGroups.push(...Object.values(groups));
              }

              return (
                <>
                  {catGroups.map(g => (
                    <g key={`cat-${g.label}`}>
                      <rect x={g.minX} y={g.minY} width={g.maxX - g.minX} height={g.maxY - g.minY}
                        rx={10} fill="none" stroke={isDark ? "rgb(251,191,36,0.35)" : "rgb(217,119,6,0.4)"}
                        strokeWidth={1.5} strokeDasharray="6 4" />
                      <rect x={(g.minX + g.maxX) / 2 - 40} y={g.minY - 7} width={80} height={14} rx={6}
                        fill={isDark ? "rgba(251,191,36,0.15)" : "#fef3c7"} />
                      <text x={(g.minX + g.maxX) / 2} y={g.minY + 2} textAnchor="middle"
                        fontSize={7} fontWeight="900" fill={isDark ? "#fbbf24" : "#d97706"}>
                        {g.label.length > 20 ? g.label.slice(0, 18) + "..." : g.label}
                      </text>
                    </g>
                  ))}

                  {zoneBlocks.map(({ name, x, y, w, h, zi }) => (
                    <g key={name}>
                      <rect x={x - 4} y={y} width={w + 8} height={h} rx={6}
                        fill={isDark ? (zi % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(56,189,248,0.03)") : (zi % 2 === 0 ? "rgba(0,0,0,0.015)" : "rgba(14,165,233,0.02)")}
                        stroke={subtle} strokeWidth={0.5} strokeDasharray="3 2" />
                      <text x={x + w / 2} y={y + 12} textAnchor="middle" fontSize={9} fontWeight="900"
                        fill={isDark ? (zi % 2 === 0 ? muted : "#bae6fd") : (zi % 2 === 0 ? muted : "#0284c7")}
                        letterSpacing={0.5}>{name}</text>

                      {racks.map((rack, ri) => (
                        <text key={rack} x={x + ri * (BW + BG) + BW / 2} y={y + HEADER - 8}
                          textAnchor="middle" fontSize={7} fontWeight="700" fill={muted}>{rack}</text>
                      ))}

                      {bins.map((bin, bi) => {
                        const by = y + HEADER + bi * rowH;
                        return racks.map((rack, ri) => {
                          const bx = x + ri * (BW + BG);
                          const key = `${name}-${rack}-${bin}`;
                          const loc = lookup.get(key);
                          const style = getBinStyle(loc);
                          const isSelected = !!loc && selectedIds.includes(loc.id);
                          return (
                            <g key={key}>
                              {isSelected && (
                                <rect x={bx - 2} y={by - 2} width={BW + 4} height={BH + 4} rx={5} fill="none" stroke="#22c55e" strokeWidth={2} className="animate-pulse" />
                              )}
                              <rect x={bx} y={by} width={BW} height={BH} rx={4}
                                fill={style.fill} stroke={style.stroke} strokeWidth={isSelected ? 1.5 : 1}
                                style={{ cursor: style.cursor, transition: "fill 0.1s" }}
                              onClick={() => { 
                                if (!loc || !style.clickable) return; 
                                if ((style as any).isFull) {
                                  // Cho xem nhưng không cho chọn ô đầy
                                  setHoveredId(loc.id);
                                  toast.error("Ô này đã đầy sức chứa! Vui lòng chọn vị trí khác.");
                                  return;
                                }
                                if ((style as any).incompatible) { setConfirmMixId(loc.id); } else { onSelect(loc.id); } 
                              }}
                                onMouseEnter={() => loc && style.clickable ? setHoveredId(loc.id) : null}
                                onMouseLeave={() => setHoveredId(null)} />
                              {(style as any).incompatible && (
                                <rect x={bx - 1.5} y={by - 1.5} width={BW + 3} height={BH + 3} rx={5} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 2" className="pointer-events-none" />
                              )}
                              {(style as any).isFull && (
                                <rect x={bx - 1.5} y={by - 1.5} width={BW + 3} height={BH + 3} rx={5} fill="none" stroke={isDark ? "#dc2626" : "#ef4444"} strokeWidth={1.5} strokeDasharray="3 2" className="pointer-events-none" />
                              )}
                              <text x={bx + BW / 2} y={by + BH / 2 + 2} textAnchor="middle" fontSize={7} fontWeight={isSelected ? "900" : "700"} fill={style.text} className="pointer-events-none select-none">{bin}</text>
                              {loc && loc.current_quantity > 0 && (
                                <rect x={bx + 2} y={by + BH - 3} width={Math.max(1, (BW - 4) * (loc.current_quantity / (loc.capacity || 5000)))} height={2} rx={1} fill="rgba(255,255,255,0.5)" />
                              )}
                            </g>
                          );
                        });
                      })}
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        </div>

        <div className="w-[300px] shrink-0 space-y-3">
          {/* Tổng nhập lô - hiển thị luôn để user biết tổng số kg */}
          {totalLineQuantity !== undefined && totalLineQuantity > 0 && (
            <div className="p-3 rounded-xl bg-taika-blue/5 dark:bg-blue-500/10 border border-taika-blue/20 dark:border-blue-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-taika-blue dark:text-blue-400 uppercase tracking-widest">Tổng nhập lô</span>
                <span className="text-lg font-black text-taika-blue dark:text-blue-400">{totalLineQuantity.toLocaleString()} <span className="text-xs">kg</span></span>
              </div>
              {incomingQuantity !== undefined && (
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">Chưa phân bổ:</span>
                  <span className={cn("font-bold", incomingQuantity > 0 ? "text-amber-500" : "text-green-600 dark:text-green-400")}>
                    {incomingQuantity > 0 ? `Còn ${incomingQuantity.toLocaleString()} kg` : "✓ Đã đủ"}
                  </span>
                </div>
              )}
            </div>
          )}

          {tooltipLoc ? (
            <>
              <div className={cn("p-3 rounded-xl border", (tooltipLoc && selectedIds.includes(tooltipLoc.id)) ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30" : "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30")}>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={14} className={(tooltipLoc && selectedIds.includes(tooltipLoc.id)) ? "text-green-500" : "text-taika-blue"} />
                  <span className={cn("text-sm font-black", (tooltipLoc && selectedIds.includes(tooltipLoc.id)) ? "text-green-700 dark:text-green-400" : "text-taika-blue dark:text-blue-400")}>
                    {tooltipLoc.zone}-{tooltipLoc.rack}-{tooltipLoc.bin}
                  </span>
                </div>
                {(tooltipLoc && selectedIds.includes(tooltipLoc.id)) && (
                  <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20 px-2 py-0.5 rounded-md">✓ {t("iw_legend_selected")}</span>
                )}
              </div>

              <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 space-y-2">
                <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("iw_bin_capacity", "Capacity")}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium">{t("iw_current_stock")}</span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-50">{tooltipLoc.current_quantity.toLocaleString()} kg</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium">{t("iw_remaining")}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{tooltipLoc.remaining_capacity.toLocaleString()} kg</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium">{t("iw_bin_total", "Total")}</span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-50">{tooltipLoc.capacity.toLocaleString()} kg</span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", tooltipLoc.current_quantity / tooltipLoc.capacity > 0.8 ? "bg-amber-500" : "bg-taika-blue")}
                      style={{ width: `${Math.min(100, (tooltipLoc.current_quantity / (tooltipLoc.capacity || 1)) * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-neutral-400 text-right font-medium">
                    {Math.round((tooltipLoc.current_quantity / (tooltipLoc.capacity || 1)) * 100)}% {t("iw_bin_used", "used")}
                  </p>
                </div>

                {incomingQuantity !== undefined && incomingQuantity > 0 && (
                  <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Hàng chuẩn bị xếp:</span>
                      <span className="font-bold text-taika-blue">{incomingQuantity.toLocaleString()} kg</span>
                    </div>
                    {incomingQuantity > tooltipLoc.remaining_capacity ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-amber-500 font-medium">Vượt mức trống:</span>
                          <span className="font-bold text-amber-500">+{(incomingQuantity - tooltipLoc.remaining_capacity).toLocaleString()} {t("iw_kg", "kg")}</span>
                        </div>
                        {(!selectedIds.includes(tooltipLoc.id) && tooltipLoc.remaining_capacity > 0) && (
                           <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                             <MapPin size={12} className="inline mr-1" />
                             Bạn có thể click chọn ô này để phân bổ {tooltipLoc.remaining_capacity.toLocaleString()} kg vào đây, phần dư hệ thống sẽ nhắc bạn chọn ô tiếp theo.
                           </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600 dark:text-green-400 font-medium">Sức chứa:</span>
                        <span className="font-bold text-green-600 dark:text-green-400">✓ Đủ sức chứa ghép</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {tooltipLoc.existing_items && tooltipLoc.existing_items.length > 0 && (
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 space-y-2">
                  <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t("iw_bin_contents", "Contents")}</p>
                  <div className="space-y-2 max-h-[180px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                    {tooltipLoc.existing_items.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-100 dark:border-neutral-700 space-y-1">
                        <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate">{item.product_name}</p>
                        {item.lot_number && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-neutral-400">{t("iw_lot_number")}</span>
                            <span className="font-mono font-bold text-neutral-600 dark:text-neutral-300">{item.lot_number}</span>
                          </div>
                        )}
                        {item.contract_number && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-neutral-400">{t("iw_contract")}</span>
                            <span className="font-bold text-neutral-600 dark:text-neutral-300">{item.contract_number}</span>
                          </div>
                        )}
                        {item.production_date && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-neutral-400">{t("iw_production_date")}</span>
                            <span className="font-medium text-neutral-600 dark:text-neutral-300">{new Date(item.production_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {item.expiry_date && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-neutral-400">{t("iw_expiry_date")}</span>
                            <span className="font-medium text-amber-600 dark:text-amber-400">{new Date(item.expiry_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {item.quantity !== undefined && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-neutral-400">{t("iw_quantity")}</span>
                            <span className="font-bold text-taika-blue">{item.quantity.toLocaleString()} kg</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!tooltipLoc.existing_items || tooltipLoc.existing_items.length === 0) && tooltipLoc.current_quantity === 0 && (
                <div className="p-3 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-700 text-center">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("iw_bin_empty", "Empty bin")}</p>
                </div>
              )}
            </>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-700 text-center h-full flex items-center justify-center">
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">{t("iw_bin_select_hint", "Hover or click a bin to see details")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog xác nhận trộn lô */}
      {confirmMixId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmMixId(null)}>
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl p-5 w-[380px] max-w-[95vw] space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{t("iw_confirm_mix_title")}</h3>
                <p className="text-[11px] text-neutral-500 font-medium">{t("iw_confirm_mix_subtitle")}</p>
              </div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
              {t("iw_confirm_mix_warning")}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmMixId(null)}
                className="flex-1 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">
                {t("iw_confirm_mix_cancel")}
              </button>
              <button onClick={() => { onSelect(confirmMixId, true); setConfirmMixId(null); }}
                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-500/20">
                {t("iw_confirm_mix_allow")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
