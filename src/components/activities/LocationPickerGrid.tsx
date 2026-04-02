import React, { useState, useMemo } from "react";
import { cn } from "../../lib/utils";
import { Loader2, MapPin } from "lucide-react";

interface AvailableLocation {
  id: string;
  zone: string;
  rack: string | null;
  bin: string | null;
  capacity: number;
  current_quantity: number;
  remaining_capacity: number;
}

interface LocationPickerGridProps {
  locations: AvailableLocation[];
  selectedId: string;
  onSelect: (locId: string) => void;
  loading?: boolean;
  warehouse: { total_zones?: number; racks_per_zone?: number; bins_per_rack?: number; zones_per_row?: number | null } | null;
}

// ── Grid constants ─────────────────────────────────────────────
const BW = 42, BH = 34, BG = 5, RG = 12, ZG = 18;
const HEADER = 36;

export default function LocationPickerGrid({ locations, selectedId, onSelect, loading, warehouse }: LocationPickerGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isDark = document.documentElement.classList.contains("dark");

  // Build the grid structure from available locations + warehouse config
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

  // Layout calculations
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
        <p className="text-xs text-neutral-400 dark:text-neutral-500">Không có vị trí trống</p>
      </div>
    );
  }

  // Get bin color
  function getBinStyle(loc: AvailableLocation | undefined) {
    if (!loc) {
      // Not available (already full or doesn't exist in available list)
      return {
        fill: isDark ? "rgba(30,41,59,0.3)" : "rgba(226,232,240,0.4)",
        stroke: isDark ? "#1e293b" : "#e2e8f0",
        text: isDark ? "rgba(71,85,105,0.3)" : "rgba(148,163,184,0.3)",
        cursor: "default" as const,
        clickable: false,
      };
    }

    const utilization = loc.capacity > 0 ? (loc.current_quantity / loc.capacity) * 100 : 0;

    if (loc.id === selectedId) {
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

    if (utilization > 0) {
      // Partially filled
      return {
        fill: isDark ? "rgba(59,130,246,0.2)" : "rgba(191,219,254,0.7)",
        stroke: isDark ? "#1e40af" : "#93c5fd",
        text: isDark ? "#60a5fa" : "#2563eb",
        cursor: "pointer" as const,
        clickable: true,
      };
    }

    // Empty and available
    return {
      fill: isDark ? "rgba(30,58,138,0.25)" : "rgba(219,234,254,0.6)",
      stroke: isDark ? "#1e3a8a" : "#93c5fd",
      text: isDark ? "#60a5fa" : "#3b82f6",
      cursor: "pointer" as const,
      clickable: true,
    };
  }

  // Render SVG
  const selectedLoc = locations.find(l => l.id === selectedId);
  const hoveredLoc = hoveredId ? locations.find(l => l.id === hoveredId) : null;
  const tooltipLoc = hoveredLoc || selectedLoc;

  const muted = isDark ? "#4b5563" : "#94a3b8";
  const subtle = isDark ? "#1e293b" : "#e2e8f0";

  return (
    <div className="space-y-3">
      {/* Info bar */}
      <div className="flex items-center gap-4 text-[10px] font-bold">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: isDark ? "rgba(30,58,138,0.25)" : "rgba(219,234,254,0.6)", border: `1px solid ${isDark ? "#1e3a8a" : "#93c5fd"}` }} />
          Trống
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: isDark ? "rgba(59,130,246,0.2)" : "rgba(191,219,254,0.7)", border: `1px solid ${isDark ? "#1e40af" : "#93c5fd"}` }} />
          Đang chứa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-500 border border-green-600" />
          Đã chọn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: isDark ? "rgba(30,41,59,0.3)" : "rgba(226,232,240,0.4)", border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}` }} />
          Đầy
        </span>
      </div>

      {/* SVG Grid */}
      <div className="overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50"
        style={{ maxHeight: 350 }}>
        <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`} className="block">
          {zones.map((name, zi) => {
            const row = Math.floor(zi / zonesPerRow);
            const col = zi % zonesPerRow;
            const x = PAD + col * (rackW + ZG);
            const y = PAD + row * (singleGridH + ROW_GAP);
            const w = rackW;
            const h = singleGridH;

            return (
              <g key={name}>
                {/* Zone background */}
                <rect x={x - 4} y={y} width={w + 8} height={h} rx={6}
                  fill={isDark
                    ? (zi % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(56,189,248,0.03)")
                    : (zi % 2 === 0 ? "rgba(0,0,0,0.015)" : "rgba(14,165,233,0.02)")}
                  stroke={subtle} strokeWidth={0.5} strokeDasharray="3 2" />

                {/* Zone label */}
                <text x={x + w / 2} y={y + 12} textAnchor="middle"
                  fontSize={9} fontWeight="900"
                  fill={isDark ? (zi % 2 === 0 ? muted : "#bae6fd") : (zi % 2 === 0 ? muted : "#0284c7")}
                  letterSpacing={0.5}>{name}</text>

                {/* Rack headers */}
                {racks.map((rack, ri) => {
                  const rx = x + ri * (BW + BG);
                  return (
                    <text key={rack} x={rx + BW / 2} y={y + HEADER - 8}
                      textAnchor="middle" fontSize={7} fontWeight="700" fill={muted}>{rack}</text>
                  );
                })}

                {/* Bins */}
                {bins.map((bin, bi) => {
                  const by = y + HEADER + bi * rowH;
                  return racks.map((rack, ri) => {
                    const bx = x + ri * (BW + BG);
                    const key = `${name}-${rack}-${bin}`;
                    const loc = lookup.get(key);
                    const style = getBinStyle(loc);
                    const isSelected = !!loc && loc.id === selectedId;

                    return (
                      <g key={key}>
                        {isSelected && (
                          <rect x={bx - 2} y={by - 2} width={BW + 4} height={BH + 4}
                            rx={5} fill="none" stroke="#22c55e" strokeWidth={2}
                            className="animate-pulse" />
                        )}
                        <rect
                          x={bx} y={by} width={BW} height={BH} rx={4}
                          fill={style.fill} stroke={style.stroke} strokeWidth={isSelected ? 1.5 : 1}
                          style={{ cursor: style.cursor, transition: "fill 0.1s" }}
                          onClick={() => loc && style.clickable ? onSelect(loc.id) : null}
                          onMouseEnter={() => loc && style.clickable ? setHoveredId(loc.id) : null}
                          onMouseLeave={() => setHoveredId(null)}
                        />
                        <text x={bx + BW / 2} y={by + BH / 2 + 2}
                          textAnchor="middle" fontSize={7} fontWeight={isSelected ? "900" : "700"}
                          fill={style.text} className="pointer-events-none select-none">{bin}</text>
                        {/* Utilization bar */}
                        {loc && loc.current_quantity > 0 && (
                          <rect x={bx + 2} y={by + BH - 3}
                            width={Math.max(1, (BW - 4) * (loc.current_quantity / (loc.capacity || 5000)))}
                            height={2} rx={1} fill="rgba(255,255,255,0.5)" />
                        )}
                      </g>
                    );
                  });
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected location info */}
      {tooltipLoc && (
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-xl border text-xs font-bold transition-all",
          tooltipLoc.id === selectedId
            ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400"
            : "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-taika-blue dark:text-blue-400"
        )}>
          <MapPin size={14} />
          <span>{tooltipLoc.zone}-{tooltipLoc.rack}-{tooltipLoc.bin}</span>
          <span className="text-neutral-400 dark:text-neutral-500 font-medium">•</span>
          <span className="font-medium text-neutral-500 dark:text-neutral-400">
            Đang chứa: {tooltipLoc.current_quantity.toLocaleString()} kg
          </span>
          <span className="text-neutral-400 dark:text-neutral-500 font-medium">•</span>
          <span className="font-medium text-neutral-500 dark:text-neutral-400">
            Còn trống: {tooltipLoc.remaining_capacity.toLocaleString()} kg
          </span>
        </div>
      )}
    </div>
  );
}
