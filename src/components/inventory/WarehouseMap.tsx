import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import {
  Thermometer, Loader2, AlertCircle, MapPin,
  ZoomIn, ZoomOut, Maximize2, Minimize2, Focus, RotateCw, Search, Box, Info,
} from "lucide-react";
import type { Warehouse, LocationWithInventory } from "../../types/supabase";
import LocationDetailPanel from "./LocationDetailPanel";
import TransferModal from "./TransferModal";
import BulkTransferWizard, { type BulkPhase } from "./BulkTransferWizard";

const WarehouseMap3D = lazy(() => import("./WarehouseMap3D"));

/**
 * Cấu trúc props cho Bản đồ Trực quan hóa Kho.
 */
interface WarehouseMapProps {
  warehouses: Warehouse[];
  selectedWarehouseId: string;
  onSelectWarehouse: (id: string) => void;
  onDataChange?: () => void;
  bulkMode?: boolean;
  onBulkModeChange?: (on: boolean) => void;
  initialSearchSku?: string;
  externalFocusLocationId?: string | null;
  onClearFocus?: () => void;
}

// ── Xử lý màu sắc hiển thị Dựa trên Trạng Thái Vị Trí Ô Hàng Kho (Bin colour) ────
function resolveBinColor(loc: LocationWithInventory | undefined, isDark: boolean, searchSku?: string) {
  if (!loc) return {
    fill: isDark ? "rgba(15,23,42,0.6)" : "rgba(241,245,249,0.7)",
    stroke: isDark ? "#1e293b" : "#e2e8f0",
    text: isDark ? "#334155" : "#94a3b8",
  };

  const hasSearchProduct = searchSku && loc.inventory_items.some(i => i.sku === searchSku);
  
  if (searchSku && !hasSearchProduct) {
    return {
      fill: isDark ? "rgba(30,41,59,0.3)" : "rgba(241,245,249,0.4)",
      stroke: isDark ? "rgba(30,41,59,0.5)" : "rgba(226,232,240,0.5)",
      text: isDark ? "rgba(71,85,105,0.4)" : "rgba(148,163,184,0.4)",
    };
  }

  if (hasSearchProduct) {
    return { fill: "#84cc16", stroke: "#65a30d", text: "#000", isHighlighted: true };
  }

  if (loc.status === "maintenance") return { fill: "#f59e0b", stroke: "#d97706", text: "#fff" };
  if (loc.status === "blocked")     return { fill: isDark ? "#374151" : "#9ca3af", stroke: "#6b7280", text: "#fff" };
  if (loc.inventory_items.length === 0) return {
    fill: isDark ? "rgba(30,58,138,0.25)" : "rgba(219,234,254,0.6)",
    stroke: isDark ? "#1e3a8a" : "#93c5fd",
    text: isDark ? "#60a5fa" : "#3b82f6",
  };
  const now = new Date(), d30 = new Date(now.getTime() + 30 * 864e5);
  if (loc.inventory_items.some(i => i.qc_status === "Fail" || i.qc_status === "Hold"))
    return { fill: "#a855f7", stroke: "#9333ea", text: "#fff" };
  if (loc.inventory_items.some(i => i.expiry_date && new Date(i.expiry_date) <= d30 && new Date(i.expiry_date) > now))
    return { fill: "#f97316", stroke: "#ea580c", text: "#fff" };
  // Cảnh báo trộn lô: ô chứa sản phẩm/hạn khác nhau
  if ((loc as any).is_mixed)
    return { fill: "#22c55e", stroke: "#f59e0b", text: "#fff", isMixed: true };
  if (loc.utilization >= 90) return { fill: "#10b981", stroke: "#059669", text: "#fff" };
  return { fill: "#22c55e", stroke: "#16a34a", text: "#fff" };
}

// ── Xây dựng một cấu trúc lưới phân bố lô logic (Build virtual grid) ────────────
function buildGrid(locations: LocationWithInventory[], warehouse: any) {
  const zoneSet = new Set<string>(), rackSet = new Set<string>(), binSet = new Set<string>();
  locations.forEach(l => { zoneSet.add(l.zone); if (l.rack) rackSet.add(l.rack); if (l.bin) binSet.add(l.bin); });
  const nZ = Math.max(zoneSet.size, warehouse.total_zones || 1);
  const nR = Math.max(rackSet.size, warehouse.racks_per_zone || 3);
  const nB = Math.max(binSet.size, warehouse.bins_per_rack || 6);
  const zones = Array.from({ length: nZ }, (_, i) => `Z${i + 1}`);
  const racks = Array.from({ length: nR }, (_, i) => `R${i + 1}`);
  const bins  = Array.from({ length: nB }, (_, i) => `B${i + 1}`);
  const lookup = new Map<string, LocationWithInventory>();
  locations.forEach(l => lookup.set(`${l.zone}-${l.rack || "R1"}-${l.bin || "B1"}`, l));
  return { zones, racks, bins, lookup, nZ, nR, nB };
}

// ── Kết xuất Sơ Đồ Mặt Bằng SVG (SVG Floor Plan) ───────────────────────────────
const BW = 46, BH = 40, BG = 8, RG = 16, ZG = 60;
const HEADER = 46, PICK_W = 90, AISLE = 46, BOTTOM = 60, PAD = 20;

function computeMapDimensions(nZ: number, nR: number, nB: number, zonesPerRow: number | null | undefined) {
  const maxZ = zonesPerRow && zonesPerRow > 0 ? zonesPerRow : Math.max(nZ, 1);
  const numRows = Math.ceil(nZ / maxZ) || 1;
  const cols = Math.min(nZ, maxZ);

  const rackW = nR * (BW + BG) - BG + RG;
  const w = rackW - RG;
  const singleGridW = cols * (w + ZG) - ZG;
  const rowH = BH + BG;
  const singleGridH = HEADER + nB * rowH;
  
  const ROW_GAP = 60; // khoảng cách giữa các hàng khu vực
  const gridW = singleGridW;
  const gridH = numRows * singleGridH + (numRows - 1) * ROW_GAP;
  
  const gridLeft = PAD + PICK_W + AISLE;
  const VW = gridLeft + gridW + AISLE + PAD;
  const VH = PAD + gridH + AISLE + BOTTOM + AISLE;
  
  return { gridLeft, gridW, gridH, singleGridW, singleGridH, ROW_GAP, VW, VH, maxZ, numRows, rackW, rowH };
}

function FloorPlanSVG({ locations, warehouse, isDark, onBin, selectedId, searchSku, sourceId, bulkSelectedIds, bulkMode, destProjectedUsage, zoneLabels }: {
  locations: LocationWithInventory[];
  warehouse: Warehouse;
  isDark: boolean;
  onBin: (loc: LocationWithInventory | null) => void;
  selectedId: string | null;
  searchSku?: string;
  sourceId?: string | null;
  bulkSelectedIds?: Set<string>;
  bulkMode?: "source" | "dest" | null;
  destProjectedUsage?: Map<string, { type: 'full' | 'partial' | 'unused' }>;
  zoneLabels?: Record<string, string>;
}) {
  const { t } = useTranslation();
  const { zones, racks, bins, lookup, nZ, nR, nB } = buildGrid(locations, warehouse);

  // Tính toán chiều rộng
  const { gridLeft, gridW, gridH, singleGridW, singleGridH, ROW_GAP, VW, VH, maxZ, numRows, rackW, rowH } = computeMapDimensions(nZ, nR, nB, warehouse.zones_per_row);

  const bg      = isDark ? "#0d1117" : "#f0f4f8";
  const floor   = isDark ? "#0a0f14" : "#f8fafc";
  const wall    = isDark ? "#161b22" : "#dde3ec";
  const muted   = isDark ? "#4b5563" : "#94a3b8";
  const subtle  = isDark ? "#1e293b" : "#e2e8f0";

  let cx = gridLeft;
  let cy = PAD + 2;
  const zoneBlocks: { x: number; y: number; w: number; name: string }[] = [];
  zones.forEach((z, idx) => {
    if (idx > 0 && idx % maxZ === 0) {
      cx = gridLeft;
      cy += singleGridH + ROW_GAP;
    }
    const w = rackW - RG; // tính toán chiều rộng gốc không có khoảng hở RG trong bản vẽ
    zoneBlocks.push({ x: cx, y: cy, w, name: z });
    cx += w + ZG;
  });
  const uniqueCatNames = useMemo(() => {
    return Array.from(new Set(Object.values(zoneLabels || {}).filter(Boolean)));
  }, [zoneLabels]);

  const catPaths = useMemo(() => {
    if (!zoneLabels) return [];
    
    const labelToIdxs: Record<string, number[]> = {};
    zones.forEach((z, i) => {
       const l = zoneLabels[z];
       if (l) {
          if (!labelToIdxs[l]) labelToIdxs[l] = [];
          labelToIdxs[l].push(i);
       }
    });

    const groups: { pathD: string, label: string, showLabel?: boolean, topX: number, topY: number, catIdx: number }[] = [];

    // Padding vừa sát viền kệ (14px) để LỘ RA LỐI ĐI rộng rãi
    const padX = 14; 
    const padY = 14; 

    Object.entries(labelToIdxs).forEach(([label, idxs]) => {
        let pathD = "";
        let minY = Infinity;

        // Bước 1: Tìm toạ độ đỉnh cao nhất (Y) của toàn bộ block
        idxs.forEach(idx => {
            const b = zoneBlocks[idx];
            const top = b.y - padY;
            if (top < minY) minY = top;
        });

        let topMinX = Infinity, topMaxX = -Infinity;

        // Bước 2: Vẽ hình & Tìm trung điểm cạnh trên cùng
        idxs.forEach(idx => {
            const c = idx % maxZ;
            const b = zoneBlocks[idx];
            
            // Tính toán toạ độ gốc (Outer Box)
            const left = b.x - padX;
            let right = b.x + b.w + padX;
            const top = b.y - padY;
            let bottom = b.y + singleGridH + padY;

            // Kiểm tra xem các block kề cạnh có cùng category không
            const hasTop = idxs.includes(idx - maxZ);
            const hasBottom = idxs.includes(idx + maxZ);
            const hasLeft = c > 0 && idxs.includes(idx - 1);
            const hasRight = c < maxZ - 1 && idxs.includes(idx + 1);

            // NẾU có kệ cùng loại liền nối: kéo giãn toạ độ mép đến chạm vào nhau
            if (hasRight) {
                 const rightZone = zoneBlocks[idx + 1];
                 right = rightZone.x - padX; // Bắt cầu không gian ngang (aisle đứng)
            }
            if (hasBottom) {
                 const bottomZone = zoneBlocks[idx + maxZ];
                 bottom = bottomZone.y - padY; // Bắt cầu không gian dọc (aisle ngang)
            }

            // Ghi tọa độ vẽ Path, NẾU không có kệ cùng loại ở phía đó
            if (!hasTop) pathD += `M ${left} ${top} L ${right} ${top} `;
            if (!hasBottom) pathD += `M ${left} ${bottom} L ${right} ${bottom} `;
            if (!hasLeft) pathD += `M ${left} ${top} L ${left} ${bottom} `;
            if (!hasRight) pathD += `M ${right} ${top} L ${right} ${bottom} `;

            // Nếu block này nằm ở mép trên cùng, gộp khoảng cách X để canh giữa nhãn sau này
            if (top === minY) {
                if (left < topMinX) topMinX = left;
                if (right > topMaxX) topMaxX = right;
            }
        });
        
        let topX = (topMinX + topMaxX) / 2;
        
        // Tránh nhãn label ở hàng 1 bị lọt khỏi vùng hiển thị của canvas vì minY âm
        minY = Math.max(12, minY); 

        const catIdx = uniqueCatNames.indexOf(label);
        groups.push({ pathD, label, topX, topY: minY, catIdx: catIdx >= 0 ? catIdx : 0 });
    });

    const labelTops: Record<string, any> = {};
    groups.forEach(g => {
       if (!labelTops[g.label] || g.topY < labelTops[g.label].topY || (g.topY === labelTops[g.label].topY && g.topX < labelTops[g.label].topX)) {
           labelTops[g.label] = g;
       }
    });
    groups.forEach(g => {
        if (labelTops[g.label] === g) g.showLabel = true;
    });

    return groups;
  }, [zoneBlocks, zoneLabels, singleGridH, maxZ, zones]);

  const CAT_COLORS_MAP = [
    { bg: isDark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.08)", border: isDark ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.4)", text: isDark ? "#60a5fa" : "#2563eb" }, // Blue
    { bg: isDark ? "rgba(16,185,129,0.06)" : "rgba(16,185,129,0.08)", border: isDark ? "rgba(16,185,129,0.3)" : "rgba(16,185,129,0.4)", text: isDark ? "#34d399" : "#059669" }, // Emerald
    { bg: isDark ? "rgba(245,158,11,0.06)" : "rgba(245,158,11,0.08)", border: isDark ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.4)", text: isDark ? "#fbbf24" : "#d97706" }, // Amber
    { bg: isDark ? "rgba(168,85,247,0.06)" : "rgba(168,85,247,0.08)", border: isDark ? "rgba(168,85,247,0.3)" : "rgba(168,85,247,0.4)", text: isDark ? "#c084fc" : "#9333ea" }, // Purple
    { bg: isDark ? "rgba(244,63,94,0.06)"  : "rgba(244,63,94,0.08)",  border: isDark ? "rgba(244,63,94,0.3)"  : "rgba(244,63,94,0.4)",  text: isDark ? "#fb7185" : "#e11d48" }, // Rose
    { bg: isDark ? "rgba(6,182,212,0.06)"  : "rgba(6,182,212,0.08)",  border: isDark ? "rgba(6,182,212,0.3)"  : "rgba(6,182,212,0.4)",  text: isDark ? "#22d3ee" : "#0891b2" }, // Cyan
  ];


  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width={VW} height={VH}
      style={{ display: "block", minWidth: VW }}>
      {/* Floor */}
      <rect width={VW} height={VH} rx={16} fill={bg} />
      <rect x={4} y={4} width={VW - 8} height={VH - 8} rx={12} fill={floor} stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth={2} />

      {/* Picking zone */}
      <rect x={PAD} y={PAD} width={PICK_W - 8} height={gridH - PAD + AISLE / 2}
        rx={7} fill={isDark ? "rgba(5,46,22,0.7)" : "rgba(187,247,208,0.6)"}
        stroke={isDark ? "#16a34a" : "#22c55e"} strokeWidth={0.8} />
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={i}
          x1={PAD} y1={PAD + i * 18}
          x2={PAD + Math.min(i * 18, PICK_W - 8)} y2={PAD}
          stroke={isDark ? "#16a34a" : "#22c55e"} strokeWidth={0.4} opacity={0.3} />
      ))}
      <text x={PAD + (PICK_W - 8) / 2} y={PAD + (gridH - PAD + AISLE / 2) * 0.45}
        textAnchor="middle" fontSize={9} fontWeight="800"
        fill={isDark ? "#4ade80" : "#15803d"} letterSpacing={1}
        transform={`rotate(-90,${PAD + (PICK_W - 8) / 2},${PAD + (gridH - PAD + AISLE / 2) * 0.45})`}>
        {t("picking_area").toUpperCase()}
      </text>

      {/* Pick Aisle */}
      <text x={gridLeft - AISLE / 2} y={PAD + gridH / 2}
        textAnchor="middle" fontSize={8} fontWeight="700" fill={muted} letterSpacing={1}
        transform={`rotate(-90,${gridLeft - AISLE / 2},${PAD + gridH / 2})`}>
        ⟷ {(warehouse.aisle_width_cm || 200) / 100}m ⟷
      </text>

      {/* Right Bound Aisle */}
      <text x={gridLeft + gridW + AISLE / 2} y={PAD + gridH / 2}
        textAnchor="middle" fontSize={8} fontWeight="700" fill={muted} letterSpacing={1}
        transform={`rotate(-90,${gridLeft + gridW + AISLE / 2},${PAD + gridH / 2})`}>
        ⟷ {(warehouse.aisle_width_cm || 200) / 100}m ⟷
      </text>

      {/* Internal Aisle Labels */}
      {(() => {
        const labels: any[] = [];
        const hasV = maxZ > 1;
        const hasH = numRows > 1;
        const val = `${(warehouse.aisle_width_cm || 200) / 100}m`;
        const w = rackW - RG;
        
        if (hasV && hasH) {
          // Render 4-way arrows at intersections
          for (let r = 0; r < numRows - 1; r++) {
            const gapY = PAD + 2 + (r + 1) * singleGridH + r * ROW_GAP + ROW_GAP / 2;
            for (let c = 0; c < maxZ - 1; c++) {
              const gapX = gridLeft + (c + 1) * (w + ZG) - ZG / 2;
              labels.push(
                <g key={`cross-${r}-${c}`} transform={`translate(${gapX},${gapY})`}>
                  <text textAnchor="middle" fontSize={10} fontWeight="800" fill={muted} y={3}>{val}</text>
                  <path d="M 0,-8 L 0,-18 M -3,-15 L 0,-18 L 3,-15" stroke={muted} strokeWidth="1" fill="none" opacity={0.6}/>
                  <path d="M 0,7 L 0,17 M -3,14 L 0,17 L 3,14" stroke={muted} strokeWidth="1" fill="none" opacity={0.6}/>
                  <path d="M -14,-1 L -24,-1 M -21,-4 L -24,-1 L -21,2" stroke={muted} strokeWidth="1" fill="none" opacity={0.6}/>
                  <path d="M 14,-1 L 24,-1 M 21,-4 L 24,-1 L 21,2" stroke={muted} strokeWidth="1" fill="none" opacity={0.6}/>
                </g>
              );
            }
          }
        } else if (hasV) {
          for (let c = 0; c < maxZ - 1; c++) {
            const gapX = gridLeft + (c + 1) * (w + ZG) - ZG / 2;
            const gapY = PAD + gridH / 2;
            labels.push(
              <text key={`v-${c}`} x={gapX} y={gapY} textAnchor="middle" fontSize={8} fontWeight="700" fill={muted} letterSpacing={1} transform={`rotate(-90,${gapX},${gapY})`}>
                ⟷ {val} ⟷
              </text>
            );
          }
        } else if (hasH) {
          for (let r = 0; r < numRows - 1; r++) {
            const gapY = PAD + 2 + (r + 1) * singleGridH + r * ROW_GAP + ROW_GAP / 2;
            const gapX = gridLeft + singleGridW / 2;
            labels.push(
              <text key={`h-${r}`} x={gapX} y={gapY} textAnchor="middle" fontSize={8} fontWeight="700" fill={muted} letterSpacing={1}>
                ⟷ {val} ⟷
              </text>
            );
          }
        }
        return labels;
      })()}

            {/* Dynamic Connecting Paths For Categories */}
            {catPaths.map((g, i) => {
                const catColor = CAT_COLORS_MAP[g.catIdx % CAT_COLORS_MAP.length];
                return (
                <g key={`cat-${g.label}-${i}`}>
                    <path d={g.pathD} fill="none" stroke={catColor.border} strokeWidth={2} strokeDasharray="8 6" strokeLinecap="square" />
                    {g.showLabel && (
                        <g>
                            <rect x={g.topX - 50} y={g.topY - 10} width={100} height={20} rx={10}
                                fill={catColor.bg} />
                            <text x={g.topX} y={g.topY + 3} textAnchor="middle" 
                                fontSize={10} fontWeight="900" fill={catColor.text}>
                                {g.label.length > 25 ? g.label.slice(0, 23) + '...' : g.label}
                            </text>
                        </g>
                    )}
                </g>
                );
            })}

            {/* Zone columns */}
            {zoneBlocks.map(({ x, y, w, name }) => {
              const isZ = zones.indexOf(name);
              const catName = zoneLabels?.[name];
              const catIdx = catName ? uniqueCatNames.indexOf(catName) : -1;
              const catColor = catIdx >= 0 ? CAT_COLORS_MAP[catIdx % CAT_COLORS_MAP.length] : null;

              return (
                <g key={name}>
                  <rect x={x - 4} y={y} width={w + 8} height={singleGridH - 4}
                    rx={6} 
                    fill={catColor ? catColor.bg : (isDark 
                      ? (isZ % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(56,189,248,0.035)") 
                      : (isZ % 2 === 0 ? "rgba(0,0,0,0.02)" : "rgba(14,165,233,0.025)"))}
                    stroke={catColor ? catColor.border : subtle} 
                    strokeWidth={catColor ? 1 : 0.5} 
                    strokeDasharray={catColor ? "none" : "4 3"} />
                  
                  <text x={x + w / 2} y={y + 12} textAnchor="middle"
                    fontSize={10} fontWeight="900" 
                    fill={isDark 
                      ? (isZ % 2 === 0 ? muted : "#bae6fd") 
                      : (isZ % 2 === 0 ? muted : "#0284c7")
                    } letterSpacing={0.5}>{name}</text>

                  {/* Rack headers */}
            {racks.map((rack, ri) => {
              const rx = x + ri * (BW + BG);
              return (
                <text key={rack} x={rx + BW / 2} y={y + HEADER - 8}
                  textAnchor="middle" fontSize={8} fontWeight="700" fill={muted}>{rack}</text>
              );
            })}

            {/* Bins */}
            {bins.map((bin, bi) => {
              const by = y + HEADER + bi * rowH - 2;
              return racks.map((rack, ri) => {
                const bx = x + ri * (BW + BG);
                const key = `${name}-${rack}-${bin}`;
                const loc = lookup.get(key);
                const { fill, stroke, text, isHighlighted, isMixed } = resolveBinColor(loc, isDark, searchSku) as any;
                const selected = !!loc && selectedId === loc.id;
                const isSource = !!loc && sourceId === loc.id;
                const isBulkSelected = !!loc && bulkSelectedIds?.has(loc.id);

                // Trong chế độ điều chuyển hàng loạt, xác định ô xem có thể click không
                const bulkClickable = bulkMode === "source"
                  ? (!!loc && loc.total_quantity > 0)
                  : bulkMode === "dest"
                    ? (!!loc && loc.utilization < 100)
                    : true;

                // Màu tùy chỉnh mô phỏng tương lai của việc đặt hàng đến ô này
                const usageType = bulkMode === "dest" && isBulkSelected && loc ? destProjectedUsage?.get(loc.id)?.type : null;
                
                let bulkFill = fill;
                let bulkStroke = stroke;
                let bulkText = text;

                if (isBulkSelected) {
                  if (bulkMode === "source") {
                    bulkFill = isDark ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.15)";
                    bulkStroke = "#3b82f6";
                    bulkText = "#60a5fa";
                  } else if (bulkMode === "dest") {
                    if (usageType === 'full') {
                      bulkFill = isDark ? "rgba(16,185,129,0.4)" : "rgba(16,185,129,0.2)";
                      bulkStroke = "#10b981"; // emerald
                      bulkText = "#34d399";
                    } else if (usageType === 'partial') {
                      bulkFill = isDark ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.15)";
                      bulkStroke = "#f59e0b"; // amber
                      bulkText = "#fbbf24";
                    } else if (usageType === 'unused') {
                      bulkFill = isDark ? "rgba(107,114,128,0.2)" : "rgba(156,163,175,0.1)";
                      bulkStroke = "#9ca3af"; // neutral
                      bulkText = "#9ca3af";
                    } else {
                      bulkFill = isDark ? "rgba(16,185,129,0.3)" : "rgba(16,185,129,0.15)";
                      bulkStroke = "#10b981"; // emerald
                      bulkText = "#34d399";
                    }
                  }
                }

                return (
                  <g key={key}>
                    {/* Bulk selected highlight */}
                    {isBulkSelected && (
                      <rect x={bx - 3} y={by - 3} width={BW + 6} height={BH + 6}
                        rx={5} fill="none"
                        stroke={usageType === 'unused' ? "#9ca3af" : (bulkMode === "source" ? "#3b82f6" : "#10b981")}
                        strokeWidth={2.5}
                        strokeDasharray={usageType === 'unused' ? "2 3" : "4 2"} />
                    )}
                    {selected && !isSource && !isBulkSelected && (
                      <rect x={bx - 2} y={by - 2} width={BW + 4} height={BH + 4}
                        rx={4} fill="none" stroke="#3b82f6" strokeWidth={1.5}
                        strokeDasharray="3 2" />
                    )}
                    {isSource && (
                      <rect x={bx - 2} y={by - 2} width={BW + 4} height={BH + 4}
                        rx={4} fill="none" stroke="#a855f7" strokeWidth={2}
                        strokeDasharray="3 2" />
                    )}
                    {isHighlighted && (
                      <>
                        <rect x={bx - 5} y={by - 5} width={BW + 10} height={BH + 10}
                          rx={7} fill="rgba(132,204,22,0.15)" stroke="none" />
                        <rect x={bx - 3.5} y={by - 3.5} width={BW + 7} height={BH + 7}
                          rx={6} fill="none" stroke="#a3e635" strokeWidth={3}
                          className="animate-pulse" />
                      </>
                    )}
                    {isMixed && !isHighlighted && !isBulkSelected && !selected && (
                      <rect x={bx - 2} y={by - 2} width={BW + 4} height={BH + 4}
                        rx={5} fill="none" stroke="#f59e0b" strokeWidth={2}
                        strokeDasharray="4 3" className="animate-pulse" />
                    )}
                    <rect x={bx} y={by} width={BW} height={BH} rx={4}
                      fill={isBulkSelected ? bulkFill : fill}
                      stroke={isBulkSelected ? bulkStroke : stroke}
                      strokeWidth={isBulkSelected ? 1.5 : (selected ? 1.5 : 1)}
                      className={bulkMode ? (bulkClickable ? "cursor-pointer" : "cursor-not-allowed opacity-40") : (loc ? "cursor-pointer" : "cursor-default")}
                      onClick={() => {
                        if (bulkMode && !bulkClickable) return;
                        if (loc) onBin(loc);
                      }}
                      style={{ transition: "fill 0.1s" }}
                    />
                    <text x={bx + BW / 2} y={by + BH / 2 + 2.5}
                      textAnchor="middle" fontSize={7.5} fontWeight={isBulkSelected || selected ? "900" : "700"}
                      fill={isBulkSelected ? bulkText : text}
                      className="pointer-events-none select-none">{bin}</text>
                    {loc && loc.utilization > 0 && (
                      <rect x={bx + 2} y={by + BH - 3}
                        width={Math.max(1, (BW - 4) * loc.utilization / 100)} height={2}
                        rx={1} fill="rgba(255,255,255,0.5)" />
                    )}
                  </g>
                );
              });
            })}
          </g>
        );
      })}

      {/* Inbound */}
      <rect x={gridLeft} y={PAD + gridH + AISLE} width={gridW * 0.47} height={BOTTOM - 8}
        rx={6} fill={isDark ? "rgba(7,36,56,0.85)" : "rgba(186,230,253,0.8)"}
        stroke={isDark ? "#0ea5e9" : "#38bdf8"} strokeWidth={0.8} />
      <polygon
        points={`${gridLeft + 20},${PAD + gridH + AISLE - 4} ${gridLeft + 14},${PAD + gridH + AISLE + 4} ${gridLeft + 26},${PAD + gridH + AISLE + 4}`}
        fill={isDark ? "#0ea5e9" : "#38bdf8"} opacity={0.7} />
      <text x={gridLeft + gridW * 0.235} y={PAD + gridH + AISLE + (BOTTOM - 8) / 2 + 3.5}
        textAnchor="middle" fontSize={8} fontWeight="800"
        fill={isDark ? "#38bdf8" : "#0369a1"} letterSpacing={0.5}>
        {t("inbound_staging").toUpperCase()}
      </text>

      {/* Outbound */}
      <rect x={gridLeft + gridW * 0.47 + 6} y={PAD + gridH + AISLE}
        width={gridW * 0.47} height={BOTTOM - 8}
        rx={6} fill={isDark ? "rgba(46,16,101,0.85)" : "rgba(233,213,255,0.8)"}
        stroke={isDark ? "#a855f7" : "#c084fc"} strokeWidth={0.8} />
      <polygon
        points={`${gridLeft + gridW * 0.47 + 6 + 20},${PAD + gridH + AISLE + BOTTOM - 8}
                 ${gridLeft + gridW * 0.47 + 6 + 14},${PAD + gridH + AISLE + BOTTOM - 18}
                 ${gridLeft + gridW * 0.47 + 6 + 26},${PAD + gridH + AISLE + BOTTOM - 18}`}
        fill={isDark ? "#a855f7" : "#c084fc"} opacity={0.7} />
      <text x={gridLeft + gridW * 0.47 + 6 + gridW * 0.235}
        y={PAD + gridH + AISLE + (BOTTOM - 8) / 2 + 3.5}
        textAnchor="middle" fontSize={8} fontWeight="800"
        fill={isDark ? "#c084fc" : "#7c3aed"} letterSpacing={0.5}>
        {t("outbound_staging").toUpperCase()}
      </text>
    </svg>
  );
}

// ── Component Sơ đồ chính (Main) ──────────────────────────────────────────────
const ZOOM_MIN = 0.4, ZOOM_MAX = 3, ZOOM_STEP = 0.2;

/**
 * Component WarehouseMap - Triển khai một Sơ đồ kho tương tác 2D và 3D.
 * Bao gồm hệ thống lọc tìm kiếm theo SKU, phóng to thu nhỏ (Zoom), chế độ điều chuyển hàng loạt.
 * @param {WarehouseMapProps} props
 * @returns {JSX.Element} Giao diện Quản lý Sơ đồ Kho Trực quan.
 */
export default function WarehouseMap({ warehouses, selectedWarehouseId, onSelectWarehouse, onDataChange, bulkMode: bulkModeExternal,
  onBulkModeChange,
  initialSearchSku,
  externalFocusLocationId,
  onClearFocus
}: WarehouseMapProps) {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<LocationWithInventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithInventory | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSource, setTransferSource] = useState<{ location: LocationWithInventory; warehouse: Warehouse } | null>(null);
  const [transferDestLoc, setTransferDestLoc] = useState<LocationWithInventory | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [searchSku, setSearchSku] = useState(initialSearchSku || "");
  const [searchWarehouse, setSearchWarehouse] = useState("");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [categories, setCategories] = useState<any[]>([]);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories).catch(() => null);
  }, []);

  // ── Trạng thái Điều Chuyển Hàng Loạt (Bulk Transfer State) ──
  const [bulkPhase, setBulkPhase] = useState<BulkPhase | null>(null);
  const [bulkSourceLocs, setBulkSourceLocs] = useState<LocationWithInventory[]>([]);
  const [bulkDestLocs, setBulkDestLocs] = useState<LocationWithInventory[]>([]);
  const [bulkDestWarehouseId, setBulkDestWarehouseId] = useState("");
  const [bulkSourceWarehouseId, setBulkSourceWarehouseId] = useState("");

  const bulkSourceIds = useMemo(() => new Set(bulkSourceLocs.map(l => l.id)), [bulkSourceLocs]);
  const bulkDestIds = useMemo(() => new Set(bulkDestLocs.map(l => l.id)), [bulkDestLocs]);

  // Mô phỏng trước sức chứa để tô màu các ô trên bản đồ một cách chính xác
  const destProjectedUsage = useMemo(() => {
    if (bulkPhase !== "select_dest") return undefined;
    const usage = new Map<string, { type: 'full' | 'partial' | 'unused' }>();
    const totalSourceKg = bulkSourceLocs.reduce((sum, loc) => sum + (loc.total_quantity || 0), 0);
    
    const pool = bulkDestLocs.map(loc => ({
      id: loc.id,
      remaining: (loc.capacity || 5000) - (loc.total_quantity || 0)
    })).sort((a, b) => b.remaining - a.remaining);

    let remainingToPlace = totalSourceKg;

    for (const bin of pool) {
      if (remainingToPlace <= 0) {
        usage.set(bin.id, { type: 'unused' });
      } else if (remainingToPlace >= bin.remaining) {
        usage.set(bin.id, { type: 'full' });
        remainingToPlace -= bin.remaining;
      } else {
        usage.set(bin.id, { type: 'partial' });
        remainingToPlace = 0;
      }
    }
    return usage;
  }, [bulkPhase, bulkSourceLocs, bulkDestLocs]);

  // Kích hoạt chế độ chuyển hàng loạt từ bên ngoài
  useEffect(() => {
    if (bulkModeExternal && !bulkPhase) {
      setBulkPhase("select_source");
      setBulkSourceWarehouseId(selectedWarehouseId);
      setBulkSourceLocs([]);
      setBulkDestLocs([]);
    } else if (!bulkModeExternal && bulkPhase) {
      setBulkPhase(null);
      setBulkSourceLocs([]);
      setBulkDestLocs([]);
    }
  }, [bulkModeExternal]);

  const closeBulkMode = useCallback(() => {
    setBulkPhase(null);
    setBulkSourceLocs([]);
    setBulkDestLocs([]);
    if (onBulkModeChange) onBulkModeChange(false);
    // Trở về kho đang chứa nguồn hàng
    if (bulkSourceWarehouseId && bulkSourceWarehouseId !== selectedWarehouseId) {
      onSelectWarehouse(bulkSourceWarehouseId);
    }
  }, [onBulkModeChange, bulkSourceWarehouseId, selectedWarehouseId, onSelectWarehouse]);

  const openTransferModal = useCallback(() => {
    if (selectedLocation && selectedWarehouse) {
      setTransferSource({ location: selectedLocation, warehouse: selectedWarehouse });
      setShowTransferModal(true);
      setSelectedLocation(null);
    }
  }, [selectedLocation]);

  const closeTransferModal = useCallback(() => {
    setShowTransferModal(false);
    setTransferSource(null);
    setTransferDestLoc(null);
  }, []);

  const productsInWarehouse = useMemo(() => {
    const items = new Map();
    locations.forEach(loc => {
      loc.inventory_items?.forEach(item => {
         items.set(item.sku, { sku: item.sku, name: item.product_name });
      });
    });
    return Array.from(items.values());
  }, [locations]);

  useEffect(() => {
    setSearchSku("");
  }, [selectedWarehouseId]);

  // Trạng thái thu phóng & di chuyển bản đồ
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(ZOOM_MIN);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const mapRef = useRef<HTMLDivElement>(null);
  const isInitialFit = useRef(true); // Theo dõi xem đã thiết lập auto-fit lần đầu chưa

  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

  const zoneLabels = useMemo(() => {
    const output: Record<string, string> = {};
    if ((selectedWarehouse as any)?.zone_categories) {
       for (const [z, id] of Object.entries((selectedWarehouse as any).zone_categories)) {
           const c = categories.find((x:any) => x.id === id);
           if (c) output[z] = c.name;
       }
    }
    return output;
  }, [selectedWarehouse, categories]);

  const fetchLocations = useCallback(async (id: string) => {
    if (!id || id === "all") return;
    setLoading(true); setError(null); setSelectedLocation(null);
    try {
      const res = await fetch(`/api/warehouses/${id}/locations`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLocations(await res.json());
      isInitialFit.current = true; // Kích hoạt căn chỉnh khớp khung hình với dữ liệu mới
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLocations(selectedWarehouseId); }, [selectedWarehouseId]);

  // Đặt lại tỷ lệ thu phóng khi chuyển kho
  useEffect(() => { isInitialFit.current = true; }, [selectedWarehouseId]);

  // Tùy chỉnh tự căn giữa bản đồ theo kích thước phần chứa
  const fitView = useCallback(() => {
    if (!mapRef.current || locations.length === 0 || !selectedWarehouse) return;
    
    requestAnimationFrame(() => {
      const { nZ, nR, nB } = buildGrid(locations, selectedWarehouse);
      const { VW, VH } = computeMapDimensions(nZ, nR, nB, selectedWarehouse.zones_per_row);
  
      const containerW = mapRef.current!.clientWidth;
      const containerH = mapRef.current!.clientHeight;
  
      const scaleX = containerW / VW;
      const scaleY = containerH / VH;
  
      // Leave some margin
      const baseScale = Math.min(scaleX, scaleY) * 0.9;
      const boundedScale = parseFloat(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, baseScale)).toFixed(2));
  
      // Calculate auto minZoom to prevent zooming out too far into empty space
      const dynamicMinZoom = Math.max(ZOOM_MIN, Math.min(scaleX, scaleY) * 0.85);
      setMinZoom(parseFloat(dynamicMinZoom.toFixed(2)));
  
      const tx = (containerW - VW * boundedScale) / 2;
      const ty = (containerH - VH * boundedScale) / 2;
  
      setZoom(boundedScale > ZOOM_MAX ? ZOOM_MAX : boundedScale);
      setPan({ x: tx, y: ty });
    });
  }, [locations, selectedWarehouse]);

  // Handle external focus requests
  useEffect(() => {
    if (externalFocusLocationId && locations.length > 0) {
      const loc = locations.find(l => l.id === externalFocusLocationId);
      if (loc) {
        setSelectedLocation(loc);
        if (onClearFocus) onClearFocus();
      }
    }
  }, [externalFocusLocationId, locations, onClearFocus, fitView]);

  // Pan boundary clamp
  const clampPan = useCallback((x: number, y: number, currentZoom: number) => {
    if (!mapRef.current || locations.length === 0 || !selectedWarehouse) return { x, y };
    
    const { nZ, nR, nB } = buildGrid(locations, selectedWarehouse);
    const { VW, VH } = computeMapDimensions(nZ, nR, nB, selectedWarehouse.zones_per_row);

    const containerW = mapRef.current.clientWidth;
    const containerH = mapRef.current.clientHeight;

    const scaledW = VW * currentZoom;
    const scaledH = VH * currentZoom;
    
    // Keep at least 50% of the map visible inside the viewport
    const bufferX = scaledW * 0.5;
    const bufferY = scaledH * 0.5;
    
    return {
      x: Math.min(Math.max(x, bufferX - scaledW), containerW - bufferX),
      y: Math.min(Math.max(y, bufferY - scaledH), containerH - bufferY)
    };
  }, [locations, selectedWarehouse]);

  // Auto-fit when locations are loaded
  useEffect(() => {
    if (locations.length > 0 && isInitialFit.current) {
      // Small timeout to ensure container is fully rendered in flex layout
      setTimeout(() => {
        fitView();
        isInitialFit.current = false;
      }, 50);
    }
  }, [locations, fitView]);

  // Zoom handlers — use native event to avoid passive listener issue
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!mapRef.current) return;
    
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.min(ZOOM_MAX, Math.max(minZoom, zoom + delta));
    
    // Zoom around mouse cursor
    const rect = mapRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const scaleDiff = newZoom / zoom;
    setPan(p => {
      const rawPanX = mouseX - (mouseX - p.x) * scaleDiff;
      const rawPanY = mouseY - (mouseY - p.y) * scaleDiff;
      return clampPan(rawPanX, rawPanY, newZoom);
    });
    
    setZoom(parseFloat(newZoom.toFixed(2)));
  }, [zoom, minZoom, clampPan]);

  // Register wheel with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.preventDefault();
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan(clampPan(dragStart.current.panX + dx, dragStart.current.panY + dy, zoom));
  }, [zoom, clampPan]);

  const handleMouseUp = useCallback(() => { dragging.current = false; }, []);

  const resetView = () => { setRotation(0); fitView(); };

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!mapContainerRef.current) return;
    if (!document.fullscreenElement) {
      mapContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // All-warehouse picker
  if (!selectedWarehouseId || selectedWarehouseId === "all") {
    const filteredWarehouses = warehouses.filter(wh => 
      wh.name.toLowerCase().includes(searchWarehouse.toLowerCase()) || 
      wh.location?.toLowerCase().includes(searchWarehouse.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchWarehouse}
            onChange={(e) => setSearchWarehouse(e.target.value)}
            placeholder={t("search", "Tìm kiếm...")}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-taika-blue text-neutral-900 dark:text-neutral-50"
          />
        </div>
        
        {filteredWarehouses.length === 0 ? (
          <div className="py-12 text-center bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <Search size={32} className="mx-auto text-neutral-300 dark:text-neutral-700 mb-3" />
            <p className="text-neutral-400 text-sm font-medium">{t("no_results", "Không tìm thấy kết quả")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWarehouses.map(wh => (
              <button key={wh.id} onClick={() => onSelectWarehouse(wh.id)}
                className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 text-left hover:border-taika-blue dark:hover:border-blue-500 hover:shadow-lg transition-all group cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-taika-blue-light dark:bg-blue-500/10 rounded-xl flex items-center justify-center text-taika-blue dark:text-blue-400 group-hover:bg-taika-blue group-hover:text-white transition-all">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900 dark:text-neutral-50">{wh.name}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{wh.location}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1"><Thermometer size={12} />{wh.temperature_zone || "N/A"}</span>
                  <span>{wh.total_zones} zones</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={mapContainerRef} className={cn("relative min-h-0", isFullscreen && "bg-white dark:bg-neutral-950 p-4 h-screen flex flex-col")}>
      <div className={cn("flex-1 flex flex-col gap-3 min-w-0", isFullscreen && "h-full")}>
        {/* Warehouse tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {warehouses.map(wh => (
            <button key={wh.id} onClick={() => onSelectWarehouse(wh.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                wh.id === selectedWarehouseId
                  ? "bg-taika-blue text-white shadow-lg shadow-taika-blue/20"
                  : "bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              )}>
              <MapPin size={14} />{wh.name}
            </button>
          ))}
        </div>

        {/* Meta bar */}
        {selectedWarehouse && (
          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2 flex flex-wrap gap-4 text-sm items-center">
            <span className="flex items-center gap-1.5 font-bold text-taika-blue dark:text-blue-400 text-xs">
              <Thermometer size={13} />{selectedWarehouse.temperature_zone || "N/A"}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600 text-xs">|</span>
            <span className="text-neutral-500 dark:text-neutral-400 text-xs">{selectedWarehouse.location}</span>
            <span className="text-neutral-300 dark:text-neutral-600 text-xs">|</span>
            <span className="text-neutral-500 dark:text-neutral-400 text-xs">{locations.length} vị trí</span>

            <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 hidden sm:block"></div>
            
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <select value={searchSku} onChange={e => setSearchSku(e.target.value)}
                className="w-full pl-9 pr-6 py-1.5 text-xs font-bold bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg outline-none focus:ring-1 focus:ring-taika-blue text-neutral-800 dark:text-neutral-200 appearance-none cursor-pointer">
                <option value="">{t("search_product", "Kiểm tra sản phẩm...")}</option>
                {productsInWarehouse.map(p => (
                   <option key={p.sku} value={p.sku}>[{p.sku}] {p.name}</option>
                ))}
              </select>
            </div>

            {/* 2D/3D toggle + Zoom controls in meta bar */}
            <div className="ml-auto flex items-center gap-1">
              {/* 2D/3D toggle */}
              <button
                onClick={() => setViewMode(m => m === "2d" ? "3d" : "2d")}
                className={cn(
                  "h-7 px-2.5 flex items-center justify-center gap-1.5 border rounded-lg transition-all text-xs font-bold mr-1",
                  viewMode === "3d"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-taika-blue hover:text-white hover:border-taika-blue"
                )}
                title={viewMode === "2d" ? t("view_3d", "Chế độ 3D") : t("view_2d", "Chế độ 2D")}
              >
                <Box size={12} />
                <span>{viewMode === "2d" ? "3D" : "2D"}</span>
              </button>

              {viewMode === "2d" && (
                <>
                  <button onClick={() => setZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
                    className="w-7 h-7 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-taika-blue hover:text-white hover:border-taika-blue transition-all text-xs font-bold text-neutral-600 dark:text-neutral-300">
                    <ZoomIn size={13} />
                  </button>
                  <span className="w-12 text-center text-xs font-bold text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button onClick={() => setZoom(z => Math.max(minZoom, parseFloat((z - ZOOM_STEP).toFixed(2))))}
                    className="w-7 h-7 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-taika-blue hover:text-white hover:border-taika-blue transition-all text-xs font-bold text-neutral-600 dark:text-neutral-300">
                    <ZoomOut size={13} />
                  </button>
                  <button onClick={resetView}
                    className="w-7 h-7 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-taika-blue hover:text-white hover:border-taika-blue transition-all text-neutral-500 dark:text-neutral-400"
                    title="Trả sơ đồ về giữa">
                    <Focus size={12} />
                  </button>
                  <button onClick={() => setRotation(r => (r + 90) % 360)}
                    className="w-7 h-7 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-taika-blue hover:text-white hover:border-taika-blue transition-all text-neutral-500 dark:text-neutral-400"
                    title={`Xoay sơ đồ (${rotation}°)`}>
                    <RotateCw size={12} />
                  </button>
                </>
              )}
              <button onClick={toggleFullscreen}
                className="w-7 h-7 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-taika-blue hover:text-white hover:border-taika-blue transition-all text-neutral-500 dark:text-neutral-400"
                title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}>
                {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>
              <div className="relative">
                <button onClick={() => setShowLegend(v => !v)}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center border rounded-lg transition-all text-xs font-bold",
                    showLegend
                      ? "bg-taika-blue text-white border-taika-blue shadow-sm"
                      : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-taika-blue hover:text-white hover:border-taika-blue"
                  )}
                  title="Chú giải hệ màu bản đồ">
                  <Info size={13} />
                </button>
                {showLegend && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowLegend(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl p-3.5 w-[220px] space-y-2 animate-in fade-in slide-in-from-top-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Chú giải màu sắc</p>
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded shrink-0" style={{ background: '#22c55e' }} />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">Đang lưu trữ hàng</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded shrink-0" style={{ background: '#10b981' }} />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">Gần đầy (≥90%)</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded shrink-0" style={{ background: '#a855f7' }} />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">QC Hold / Fail</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded shrink-0" style={{ background: '#f97316' }} />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">Gần hết hạn (≤30 ngày)</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded shrink-0" style={{ background: '#f59e0b' }} />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">Đang bảo trì</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded shrink-0 border border-blue-300 dark:border-blue-700" style={{ background: 'rgba(219,234,254,0.6)' }} />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">Ô trống</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded shrink-0" style={{ background: '#84cc16' }} />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">Đang tìm kiếm (highlight)</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded shrink-0 border border-neutral-400" style={{ background: '#9ca3af' }} />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">Bị khóa / Chặn</span>
                    </div>
                    <div className="border-t border-neutral-200 dark:border-neutral-700 my-1.5" />
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded shrink-0 border-2 border-dashed border-amber-400" style={{ background: '#22c55e' }} />
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">⚠️ Trộn lô (cần tách)</span>
                    </div>
                  </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Map canvas - 2D or 3D */}
        {viewMode === "2d" ? (
        <div
          ref={mapRef}
          className={cn(
            "flex-1 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden relative",
            isFullscreen ? "min-h-0" : "min-h-[60vh] xl:min-h-[calc(100vh-280px)]",
            "select-none"
          )}
          style={{ cursor: dragging.current ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-neutral-950/80 z-10">
              <Loader2 className="w-7 h-7 animate-spin text-taika-blue" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-neutral-500">{error}</p>
              <button onClick={() => fetchLocations(selectedWarehouseId)}
                className="px-4 py-2 bg-taika-blue text-white rounded-xl text-sm font-bold">Thử lại</button>
            </div>
          )}
          {!loading && !error && selectedWarehouse && (
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "top left",
                transition: dragging.current ? "none" : "transform 0.15s ease-out",
                willChange: "transform",
                display: "inline-block",
              }}
            >
              <div
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: dragging.current ? "none" : "transform 0.25s ease-out",
                  padding: "12px",
                  display: "inline-block",
                }}
              >
              {locations.length === 0 ? (
                <div className="py-20 px-10 text-center">
                  <MapPin size={40} className="mx-auto text-neutral-300 dark:text-neutral-700 mb-3" />
                  <p className="text-neutral-400 text-sm font-medium">{t("no_locations_hint")}</p>
                </div>
              ) : (
                <FloorPlanSVG
                  locations={locations}
                  warehouse={selectedWarehouse}
                  isDark={isDark}
                  zoneLabels={zoneLabels}
                  onBin={loc => {
                    // Bulk transfer mode handling
                    if (bulkPhase === "select_source" && loc) {
                      setBulkSourceLocs(prev => {
                        const exists = prev.find(l => l.id === loc.id);
                        if (exists) return prev.filter(l => l.id !== loc.id);
                        if (loc.total_quantity > 0) return [...prev, loc];
                        return prev;
                      });
                      return;
                    }
                    if (bulkPhase === "select_dest" && loc) {
                      setBulkDestLocs(prev => {
                        const exists = prev.find(l => l.id === loc.id);
                        if (exists) return prev.filter(l => l.id !== loc.id);
                        if (loc.utilization < 100) return [...prev, loc];
                        return prev;
                      });
                      return;
                    }
                    // Normal mode
                    if (showTransferModal && transferSource) {
                      if (loc && loc.id !== transferSource.location.id) {
                        setTransferDestLoc(loc);
                      }
                    } else {
                      setSelectedLocation(prev => prev?.id === loc?.id ? null : loc);
                    }
                  }}
                  selectedId={showTransferModal ? transferDestLoc?.id || null : selectedLocation?.id || null}
                  sourceId={showTransferModal && transferSource ? transferSource.location.id : null}
                  searchSku={searchSku}
                  bulkSelectedIds={bulkPhase === "select_source" ? bulkSourceIds : bulkPhase === "select_dest" ? bulkDestIds : undefined}
                  bulkMode={bulkPhase === "select_source" ? "source" : bulkPhase === "select_dest" ? "dest" : null}
                  destProjectedUsage={destProjectedUsage}
                />
              )}
              </div>
            </div>
          )}

          {/* Float zoom indicator bottom-right */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
            <button onClick={() => setZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
              className="w-8 h-8 flex items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-taika-blue hover:text-white hover:border-taika-blue shadow-md transition-all text-neutral-600 dark:text-neutral-300">
              <ZoomIn size={14} />
            </button>
            <button onClick={resetView}
              className="w-8 h-8 flex items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-taika-blue hover:text-white hover:border-taika-blue shadow-md transition-all text-neutral-500 dark:text-neutral-400">
              <Focus size={12} />
            </button>
            <button onClick={() => setZoom(z => Math.max(minZoom, parseFloat((z - ZOOM_STEP).toFixed(2))))}
              className="w-8 h-8 flex items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-taika-blue hover:text-white hover:border-taika-blue shadow-md transition-all text-neutral-600 dark:text-neutral-300">
              <ZoomOut size={14} />
            </button>
          </div>

          {/* Scroll hint */}
          <div className="absolute bottom-3 left-3 text-[10px] text-neutral-400 dark:text-neutral-600 font-medium pointer-events-none">
            {t("map_interaction_hint")}
          </div>

          {/* Detail panel as absolute overlay */}
          <div className="absolute top-4 right-4 bottom-4 z-20 pointer-events-none flex justify-end">
            <>
              {selectedLocation && selectedWarehouse && !showTransferModal && (
                <div className="pointer-events-auto h-full flex flex-col" onMouseDown={e => e.stopPropagation()}>
                  <LocationDetailPanel
                    location={selectedLocation}
                    warehouse={selectedWarehouse}
                    onClose={() => setSelectedLocation(null)}
                    onTransfer={openTransferModal}
                  />
                </div>
              )}
              {showTransferModal && transferSource && (
                 <div className="pointer-events-auto h-full flex flex-col" onMouseDown={e => e.stopPropagation()}>
                   <TransferModal
                     fromLocation={transferSource.location}
                     fromWarehouse={transferSource.warehouse}
                     currentMapWarehouseId={selectedWarehouseId}
                     destLocationFromMap={transferDestLoc}
                     onClose={closeTransferModal}
                     onComplete={() => {
                       closeTransferModal();
                       fetchLocations(selectedWarehouseId);
                       if (onDataChange) onDataChange();
                     }}
                   />
                 </div>
              )}
            </>
          </div>

          {/* Bulk Transfer Wizard */}
          {bulkPhase && bulkPhase !== "done" && (
            <BulkTransferWizard
              phase={bulkPhase}
              setPhase={(p) => {
                setBulkPhase(p);
                if (p === "select_dest") setBulkDestLocs([]);
              }}
              selectedSourceLocs={bulkSourceLocs}
              selectedDestLocs={bulkDestLocs}
              warehouses={warehouses}
              sourceWarehouse={warehouses.find(w => w.id === bulkSourceWarehouseId)}
              destWarehouseId={bulkDestWarehouseId}
              setDestWarehouseId={setBulkDestWarehouseId}
              onClose={closeBulkMode}
              onComplete={() => {
                closeBulkMode();
                fetchLocations(selectedWarehouseId);
                if (onDataChange) onDataChange();
              }}
              onSwitchWarehouse={(id) => onSelectWarehouse(id)}
            />
          )}
        </div>
        ) : (
        /* ── 3D View ── */
        <div className={cn(
          "flex-1 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden relative",
          isFullscreen ? "min-h-0" : "min-h-[60vh] xl:min-h-[calc(100vh-280px)]"
        )}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 z-10">
              <Loader2 className="w-7 h-7 animate-spin text-taika-blue" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-neutral-500">{error}</p>
              <button onClick={() => fetchLocations(selectedWarehouseId)}
                className="px-4 py-2 bg-taika-blue text-white rounded-xl text-sm font-bold">Thử lại</button>
            </div>
          )}
          {!loading && !error && selectedWarehouse && locations.length > 0 && (
            <div className="absolute inset-0 z-0">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full bg-neutral-950">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-taika-blue mx-auto mb-3" />
                    <p className="text-sm text-neutral-400 font-medium">Đang tải mô hình 3D...</p>
                  </div>
                </div>
              }>
                <WarehouseMap3D
                  locations={locations}
                  warehouse={selectedWarehouse}
                  searchSku={searchSku}
                  onBin={loc => {
                    setSelectedLocation(prev => prev?.id === loc?.id ? null : loc);
                  }}
                  selectedId={selectedLocation?.id || null}
                  zoneLabels={zoneLabels}
                />
              </Suspense>
            </div>
          )}
          {!loading && !error && locations.length === 0 && (
            <div className="flex items-center justify-center h-full bg-neutral-950">
              <div className="text-center">
                <MapPin size={40} className="mx-auto text-neutral-700 mb-3" />
                <p className="text-neutral-500 text-sm font-medium">{t("no_locations_hint")}</p>
              </div>
            </div>
          )}

          {/* Detail panel overlay for 3D */}
          <div className="absolute top-4 right-4 bottom-4 z-20 pointer-events-none flex justify-end">
            {selectedLocation && selectedWarehouse && (
              <div className="pointer-events-auto h-full flex flex-col">
                <LocationDetailPanel
                  location={selectedLocation}
                  warehouse={selectedWarehouse}
                  onClose={() => setSelectedLocation(null)}
                  onTransfer={openTransferModal}
                />
              </div>
            )}
          </div>

          {/* 3D interaction hint */}
          <div className="absolute bottom-3 left-3 text-[10px] text-neutral-500 font-medium pointer-events-none">
            🖱️ Chuột trái xoay • Scroll zoom • Chuột phải kéo
          </div>
        </div>
        )}

        {/* Legend */}
        {!loading && !error && locations.length > 0 && (
          <div className="flex flex-wrap gap-3 px-1">
            {[
              { c: "bg-neutral-200 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600", label: t("legend_empty") },
              { c: "bg-green-500", label: t("legend_has_stock") },
              { c: "bg-emerald-500", label: t("legend_full") },
              { c: "bg-orange-500", label: t("legend_expiring") },
              { c: "bg-red-500", label: t("legend_qc_warning") },
              { c: "bg-amber-400", label: t("legend_maintenance") },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={cn("w-3 h-2.5 rounded-sm", item.c)} />
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Dimensions Summary */}
        {!loading && !error && selectedWarehouse && locations.length > 0 && (
          <div className="flex flex-wrap gap-3 px-1 mt-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-800 rounded-lg text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
               📐 Pallet: {selectedWarehouse.pallet_width_cm || 100}×{selectedWarehouse.pallet_depth_cm || 120}cm
               <span className="mx-2 text-neutral-300 dark:text-neutral-600">|</span>
               🚛 Lối đi: {(selectedWarehouse.aisle_width_cm || 200)/100}m
               <span className="mx-2 text-neutral-300 dark:text-neutral-600">|</span>
               📦 {(selectedWarehouse.total_zones||1)*(selectedWarehouse.racks_per_zone||1)*(selectedWarehouse.bins_per_rack||1)} pallet
               <span className="mx-2 text-neutral-300 dark:text-neutral-600">|</span>
               📏 ~{selectedWarehouse.total_floor_area_sqm || Math.round(((selectedWarehouse.total_zones||1)*(selectedWarehouse.racks_per_zone||1)*(selectedWarehouse.bins_per_rack||1)) * ((selectedWarehouse.pallet_width_cm || 100)/100) * ((selectedWarehouse.pallet_depth_cm || 120)/100) * 1.667)} m²
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
