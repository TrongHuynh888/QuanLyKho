import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import {
  Thermometer, Loader2, AlertCircle, MapPin,
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Search,
} from "lucide-react";
import type { Warehouse, LocationWithInventory } from "../../types/supabase";
import LocationDetailPanel from "./LocationDetailPanel";

interface WarehouseMapProps {
  warehouses: Warehouse[];
  selectedWarehouseId: string;
  onSelectWarehouse: (id: string) => void;
}

// ── Bin colour ────────────────────────────────────────────────────────────────
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
    return { fill: "#ef4444", stroke: "#b91c1c", text: "#fff", isHighlighted: true };
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
    return { fill: "#ef4444", stroke: "#dc2626", text: "#fff" };
  if (loc.inventory_items.some(i => i.expiry_date && new Date(i.expiry_date) <= d30 && new Date(i.expiry_date) > now))
    return { fill: "#f97316", stroke: "#ea580c", text: "#fff" };
  if (loc.utilization >= 90) return { fill: "#10b981", stroke: "#059669", text: "#fff" };
  return { fill: "#22c55e", stroke: "#16a34a", text: "#fff" };
}

// ── Build virtual grid ────────────────────────────────────────────────────────
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

// ── SVG Floor Plan ────────────────────────────────────────────────────────────
const BW = 46, BH = 40, BG = 8, RG = 16, ZG = 26;
const HEADER = 46, PICK_W = 90, AISLE = 46, BOTTOM = 130, PAD = 20;

function computeMapDimensions(nZ: number, nR: number, nB: number, zonesPerRow: number | null | undefined) {
  const maxZ = zonesPerRow && zonesPerRow > 0 ? zonesPerRow : Math.max(nZ, 1);
  const numRows = Math.ceil(nZ / maxZ) || 1;
  const cols = Math.min(nZ, maxZ);

  const rackW = nR * (BW + BG) - BG + RG;
  const singleGridW = cols * (rackW + ZG) - ZG;
  const rowH = BH + BG;
  const singleGridH = HEADER + nB * rowH;
  
  const ROW_GAP = 60; // gap between zone rows
  const gridW = singleGridW;
  const gridH = numRows * singleGridH + (numRows - 1) * ROW_GAP;
  
  const gridLeft = PAD + PICK_W + AISLE;
  const VW = gridLeft + gridW + PAD;
  const VH = PAD + gridH + AISLE + BOTTOM + 20;
  
  return { gridLeft, gridW, gridH, singleGridH, ROW_GAP, VW, VH, maxZ, rackW, rowH };
}

function FloorPlanSVG({ locations, warehouse, isDark, onBin, selectedId, searchSku }: {
  locations: LocationWithInventory[];
  warehouse: Warehouse;
  isDark: boolean;
  onBin: (loc: LocationWithInventory | null) => void;
  selectedId: string | null;
  searchSku?: string;
}) {
  const { t } = useTranslation();
  const { zones, racks, bins, lookup, nZ, nR, nB } = buildGrid(locations, warehouse);

  // Compute widths
  const { gridLeft, gridW, gridH, singleGridH, ROW_GAP, VW, VH, maxZ, rackW, rowH } = computeMapDimensions(nZ, nR, nB, warehouse.zones_per_row);

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
    const w = rackW - RG; // original width calculation without RG in zone drawing
    zoneBlocks.push({ x: cx, y: cy, w, name: z });
    cx += w + ZG;
  });

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width={VW} height={VH}
      style={{ display: "block", minWidth: VW }}>
      {/* Floor */}
      <rect width={VW} height={VH} rx={10} fill={bg} />
      <rect x={4} y={4} width={VW - 8} height={VH - 8} rx={8} fill={floor} />

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

      {/* Aisle */}
      <text x={PAD + PICK_W + AISLE / 2} y={PAD + gridH / 2}
        textAnchor="middle" fontSize={6} fontWeight="700" fill={muted} letterSpacing={2}
        transform={`rotate(-90,${PAD + PICK_W + AISLE / 2},${PAD + gridH / 2})`}>AISLE</text>

      {/* Zone columns */}
      {zoneBlocks.map(({ x, y, w, name }) => {
        const isZ = zones.indexOf(name);
        return (
          <g key={name}>
            <rect x={x - 4} y={y} width={w + 8} height={singleGridH - 4}
              rx={6} 
              fill={isDark 
                ? (isZ % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(56,189,248,0.035)") 
                : (isZ % 2 === 0 ? "rgba(0,0,0,0.02)" : "rgba(14,165,233,0.025)")}
              stroke={subtle} strokeWidth={0.5} strokeDasharray="4 3" />
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
                const { fill, stroke, text, isHighlighted } = resolveBinColor(loc, isDark, searchSku) as any;
                const selected = !!loc && selectedId === loc.id;

                return (
                  <g key={key}>
                    {selected && (
                      <rect x={bx - 2} y={by - 2} width={BW + 4} height={BH + 4}
                        rx={4} fill="none" stroke="#3b82f6" strokeWidth={1.5}
                        strokeDasharray="3 2" />
                    )}
                    {isHighlighted && (
                      <rect x={bx - 2.5} y={by - 2.5} width={BW + 5} height={BH + 5}
                        rx={5} fill="none" stroke="#ef4444" strokeWidth={2.5}
                        className="animate-pulse" />
                    )}
                    <rect x={bx} y={by} width={BW} height={BH} rx={4}
                      fill={fill} stroke={stroke} strokeWidth={selected ? 1.5 : 1}
                      className={loc ? "cursor-pointer" : "cursor-default"}
                      onClick={() => loc ? onBin(loc) : null}
                      style={{ transition: "fill 0.1s" }}
                    />
                    <text x={bx + BW / 2} y={by + BH / 2 + 2.5}
                      textAnchor="middle" fontSize={7.5} fontWeight={selected ? "900" : "700"}
                      fill={text} className="pointer-events-none select-none">{bin}</text>
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
      <rect x={gridLeft} y={PAD + gridH + 6} width={gridW * 0.47} height={BOTTOM - 8}
        rx={6} fill={isDark ? "rgba(7,36,56,0.85)" : "rgba(186,230,253,0.8)"}
        stroke={isDark ? "#0ea5e9" : "#38bdf8"} strokeWidth={0.8} />
      <polygon
        points={`${gridLeft + 20},${PAD + gridH + 2} ${gridLeft + 14},${PAD + gridH + 10} ${gridLeft + 26},${PAD + gridH + 10}`}
        fill={isDark ? "#0ea5e9" : "#38bdf8"} opacity={0.7} />
      <text x={gridLeft + gridW * 0.235} y={PAD + gridH + 6 + (BOTTOM - 8) / 2 + 3.5}
        textAnchor="middle" fontSize={8} fontWeight="800"
        fill={isDark ? "#38bdf8" : "#0369a1"} letterSpacing={0.5}>
        {t("inbound_staging").toUpperCase()}
      </text>

      {/* Outbound */}
      <rect x={gridLeft + gridW * 0.47 + 6} y={PAD + gridH + 6}
        width={gridW * 0.47} height={BOTTOM - 8}
        rx={6} fill={isDark ? "rgba(46,16,101,0.85)" : "rgba(233,213,255,0.8)"}
        stroke={isDark ? "#a855f7" : "#c084fc"} strokeWidth={0.8} />
      <polygon
        points={`${gridLeft + gridW * 0.47 + 6 + 20},${PAD + gridH + BOTTOM - 8}
                 ${gridLeft + gridW * 0.47 + 6 + 14},${PAD + gridH + BOTTOM - 18}
                 ${gridLeft + gridW * 0.47 + 6 + 26},${PAD + gridH + BOTTOM - 18}`}
        fill={isDark ? "#a855f7" : "#c084fc"} opacity={0.7} />
      <text x={gridLeft + gridW * 0.47 + 6 + gridW * 0.235}
        y={PAD + gridH + 6 + (BOTTOM - 8) / 2 + 3.5}
        textAnchor="middle" fontSize={8} fontWeight="800"
        fill={isDark ? "#c084fc" : "#7c3aed"} letterSpacing={0.5}>
        {t("outbound_staging").toUpperCase()}
      </text>
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const ZOOM_MIN = 0.4, ZOOM_MAX = 3, ZOOM_STEP = 0.2;

export default function WarehouseMap({ warehouses, selectedWarehouseId, onSelectWarehouse }: WarehouseMapProps) {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<LocationWithInventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithInventory | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [searchSku, setSearchSku] = useState("");

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

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(ZOOM_MIN);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const mapRef = useRef<HTMLDivElement>(null);
  const isInitialFit = useRef(true); // Track if we've done the initial auto-fit

  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

  const fetchLocations = useCallback(async (id: string) => {
    if (!id || id === "all") return;
    setLoading(true); setError(null); setSelectedLocation(null);
    try {
      const res = await fetch(`/api/warehouses/${id}/locations`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLocations(await res.json());
      isInitialFit.current = true; // Trigger fit on new data
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLocations(selectedWarehouseId); }, [selectedWarehouseId]);

  // Reset zoom when warehouse changes
  useEffect(() => { isInitialFit.current = true; }, [selectedWarehouseId]);

  // Fit view to container dynamically
  const fitView = useCallback(() => {
    if (!mapRef.current || locations.length === 0 || !selectedWarehouse) return;
    
    // Calculate the dimensions from the buildGrid output
    // Calculate the dimensions using constants
    const { nZ, nR, nB } = buildGrid(locations, selectedWarehouse);
    const { VW, VH } = computeMapDimensions(nZ, nR, nB, selectedWarehouse.zones_per_row);

    const containerW = mapRef.current.clientWidth;
    const containerH = mapRef.current.clientHeight;

    // Calculate scale to "contain" the screen (ensure entire grid fits in view)
    const scaleW = containerW / VW;
    const scaleH = containerH / VH;
    const scale = Math.min(scaleW, scaleH) * 0.95;
    const boundedScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));
    const dynamicMinZoom = parseFloat(boundedScale.toFixed(2));
    
    setMinZoom(dynamicMinZoom);

    // Center it
    const tx = (containerW - VW * boundedScale) / 2;
    const ty = (containerH - VH * boundedScale) / 2;

    setZoom(dynamicMinZoom);
    setPan({ x: tx, y: ty });
  }, [locations, selectedWarehouse]);

  // Pan boundary clamp
  const clampPan = useCallback((x: number, y: number, currentZoom: number) => {
    if (!mapRef.current || locations.length === 0 || !selectedWarehouse) return { x, y };
    
    const { nZ, nR, nB } = buildGrid(locations, selectedWarehouse);
    const { VW, VH } = computeMapDimensions(nZ, nR, nB, selectedWarehouse.zones_per_row);

    const containerW = mapRef.current.clientWidth;
    const containerH = mapRef.current.clientHeight;

    const scaledW = VW * currentZoom;
    const scaledH = VH * currentZoom;
    
    const buffer = 100; // at least 100px remains visible
    
    return {
      x: Math.min(Math.max(x, buffer - scaledW), containerW - buffer),
      y: Math.min(Math.max(y, buffer - scaledH), containerH - buffer)
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

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
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
  }, [zoom]);

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

  const resetView = () => { fitView(); };

  // All-warehouse picker
  if (!selectedWarehouseId || selectedWarehouseId === "all") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map(wh => (
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
    );
  }

  return (
    <div className="relative min-h-0">
      <div className="flex-1 flex flex-col gap-3 min-w-0">
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
                <option value="">Kiểm tra sản phẩm...</option>
                {productsInWarehouse.map(p => (
                   <option key={p.sku} value={p.sku}>[{p.sku}] {p.name}</option>
                ))}
              </select>
            </div>

            {/* Zoom controls in meta bar */}
            <div className="ml-auto flex items-center gap-1">
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
                title="Reset view">
                <Maximize2 size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Map canvas */}
        <div
          ref={mapRef}
          className={cn(
            "flex-1 bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden relative",
            "min-h-[60vh] xl:min-h-[calc(100vh-280px)] select-none"
          )}
          style={{ cursor: dragging.current ? "grabbing" : "grab" }}
          onWheel={handleWheel}
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
                transition: dragging.current ? "none" : "transform 0.05s ease-out",
                willChange: "transform",
                padding: "12px",
                display: "inline-block",
              }}
            >
              {locations.length === 0 ? (
                <div className="py-20 px-10 text-center">
                  <MapPin size={40} className="mx-auto text-neutral-300 dark:text-neutral-700 mb-3" />
                  <p className="text-neutral-400 text-sm font-medium">Chưa có vị trí. Vào Cài đặt → Tạo lưới.</p>
                </div>
              ) : (
                <FloorPlanSVG
                  locations={locations}
                  warehouse={selectedWarehouse}
                  isDark={isDark}
                  onBin={loc => setSelectedLocation(prev => prev?.id === loc?.id ? null : loc)}
                  selectedId={selectedLocation?.id || null}
                  searchSku={searchSku}
                />
              )}
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
              <RotateCcw size={12} />
            </button>
            <button onClick={() => setZoom(z => Math.max(minZoom, parseFloat((z - ZOOM_STEP).toFixed(2))))}
              className="w-8 h-8 flex items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-taika-blue hover:text-white hover:border-taika-blue shadow-md transition-all text-neutral-600 dark:text-neutral-300">
              <ZoomOut size={14} />
            </button>
          </div>

          {/* Scroll hint */}
          <div className="absolute bottom-3 left-3 text-[10px] text-neutral-400 dark:text-neutral-600 font-medium pointer-events-none">
            Scroll để zoom • Kéo để di chuyển
          </div>

          {/* Detail panel as absolute overlay */}
          <div className="absolute top-4 right-4 bottom-4 z-20 pointer-events-none flex justify-end">
            <AnimatePresence>
              {selectedLocation && selectedWarehouse && (
                <div className="pointer-events-auto h-full flex flex-col">
                  <LocationDetailPanel
                    location={selectedLocation}
                    warehouse={selectedWarehouse}
                    onClose={() => setSelectedLocation(null)}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Legend */}
        {!loading && !error && locations.length > 0 && (
          <div className="flex flex-wrap gap-3 px-1">
            {[
              { c: "bg-neutral-200 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600", label: "Trống" },
              { c: "bg-green-500", label: "Có hàng" },
              { c: "bg-emerald-500", label: "Đầy (≥90%)" },
              { c: "bg-orange-500", label: "Sắp hết hạn" },
              { c: "bg-red-500", label: "Cảnh báo QC" },
              { c: "bg-amber-400", label: "Bảo trì" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={cn("w-3 h-2.5 rounded-sm", item.c)} />
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
