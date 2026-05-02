import React, { useState, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import type { Warehouse, LocationWithInventory } from "../../types/supabase";

// ── Cấu trúc dạng (Types) ─────────────────────────────────────────────────────
interface WarehouseMap3DProps {
  locations: LocationWithInventory[];
  warehouse: Warehouse;
  searchSku?: string;
  onBin: (loc: LocationWithInventory | null) => void;
  selectedId: string | null;
  zoneLabels?: Record<string, string>;
}

interface GridData {
  zones: string[];
  racks: string[];
  bins: string[];
  lookup: Map<string, LocationWithInventory>;
  nZ: number;
  nR: number;
  nB: number;
}

// ── Biến Hằng Số (Constants) ─────────────────────────────────────────────────
const BIN_W = 0.9;
const BIN_D = 0.7;
const BIN_MAX_H = 2.0;
const BIN_MIN_H = 0.08;
const BIN_GAP = 0.15;
const RACK_GAP = 1.6;   // Khoảng cách rộng hơn giữa các kệ
const ZONE_GAP = 3.0;   // Khoảng cách rộng hơn giữa các khu vực
const FLOOR_Y = 0;
const SHELF_H = 0.03;
const POST_R = 0.04;
const RACK_POST_COLOR = "#64748b";
const SHELF_COLOR = "#475569";

// ── Hàm Quy đổi Màu sắc Trực quan (Color resolver) ───────────────────────────
function resolveBinColor3D(
  loc: LocationWithInventory | undefined,
  searchSku?: string
): { color: string; emissive: string; opacity: number; isHighlighted: boolean } {
  if (!loc)
    return { color: "#1e293b", emissive: "#000000", opacity: 0.25, isHighlighted: false };

  const hasSearchProduct =
    searchSku && loc.inventory_items.some((i) => i.sku === searchSku);

  if (searchSku && !hasSearchProduct)
    return { color: "#1e293b", emissive: "#000000", opacity: 0.1, isHighlighted: false };

  if (hasSearchProduct)
    return { color: "#84cc16", emissive: "#65a30d", opacity: 1, isHighlighted: true };

  if (loc.status === "maintenance")
    return { color: "#f59e0b", emissive: "#92400e", opacity: 0.9, isHighlighted: false };
  if (loc.status === "blocked")
    return { color: "#6b7280", emissive: "#374151", opacity: 0.7, isHighlighted: false };

  if (loc.inventory_items.length === 0)
    return { color: "#334155", emissive: "#000000", opacity: 0.35, isHighlighted: false };

  const now = new Date();
  const d30 = new Date(now.getTime() + 30 * 864e5);
  if (
    loc.inventory_items.some(
      (i) => i.qc_status === "Fail" || i.qc_status === "Hold"
    )
  )
    return { color: "#ef4444", emissive: "#7f1d1d", opacity: 1, isHighlighted: false };
  if (
    loc.inventory_items.some(
      (i) =>
        i.expiry_date &&
        new Date(i.expiry_date) <= d30 &&
        new Date(i.expiry_date) > now
    )
  )
    return { color: "#f97316", emissive: "#7c2d12", opacity: 1, isHighlighted: false };
  if (loc.utilization >= 90)
    return { color: "#10b981", emissive: "#064e3b", opacity: 1, isHighlighted: false };
  return { color: "#22c55e", emissive: "#14532d", opacity: 1, isHighlighted: false };
}

// ── Xây dựng hệ thống lưới tương tự bản 2D (Build grid) ──────────────────────
function buildGrid(
  locations: LocationWithInventory[],
  warehouse: Warehouse
): GridData {
  const zoneSet = new Set<string>();
  const rackSet = new Set<string>();
  const binSet = new Set<string>();
  locations.forEach((l) => {
    zoneSet.add(l.zone);
    if (l.rack) rackSet.add(l.rack);
    if (l.bin) binSet.add(l.bin);
  });
  const nZ = Math.max(zoneSet.size, warehouse.total_zones || 1);
  const nR = Math.max(rackSet.size, warehouse.racks_per_zone || 3);
  const nB = Math.max(binSet.size, warehouse.bins_per_rack || 6);
  const zones = Array.from({ length: nZ }, (_, i) => `Z${i + 1}`);
  const racks = Array.from({ length: nR }, (_, i) => `R${i + 1}`);
  const bins = Array.from({ length: nB }, (_, i) => `B${i + 1}`);
  const lookup = new Map<string, LocationWithInventory>();
  locations.forEach((l) => {
    const key = `${l.zone}-${l.rack || ""}-${l.bin || ""}`;
    lookup.set(key, l);
  });
  return { zones, racks, bins, lookup, nZ, nR, nB };
}

// ── Đối tượng 3D Khối Ô Hàng Nhỏ Nhất (BinBox) ───────────────────────────────
function BinBox({
  position,
  loc,
  binLabel,
  searchSku,
  isSelected,
  onBin,
}: {
  position: [number, number, number];
  loc: LocationWithInventory | undefined;
  binLabel: string;
  searchSku?: string;
  isSelected: boolean;
  onBin: (loc: LocationWithInventory | null) => void;
}) {
  const utilization = loc?.utilization ?? 0;
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { color, emissive, opacity, isHighlighted } = resolveBinColor3D(
    loc,
    searchSku
  );

  const targetH = loc
    ? BIN_MIN_H + (loc.utilization / 100) * (BIN_MAX_H - BIN_MIN_H)
    : BIN_MIN_H;

  const animatedH = useRef(BIN_MIN_H);
  const animatedColor = useRef(new THREE.Color(color));
  const animatedEmissive = useRef(new THREE.Color(emissive));

  const topTextRef = useRef<any>(null);

  useFrame((_, delta) => {
    animatedH.current += (targetH - animatedH.current) * Math.min(1, delta * 5);
    if (meshRef.current) {
      meshRef.current.scale.y = animatedH.current / BIN_MAX_H;
      meshRef.current.position.y = position[1] + (animatedH.current * 0.5);
    }
    if (topTextRef.current) {
      topTextRef.current.position.y = position[1] + animatedH.current + 0.02;
    }

    const mat = meshRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) {
      animatedColor.current.lerp(new THREE.Color(color), Math.min(1, delta * 4));
      animatedEmissive.current.lerp(new THREE.Color(emissive), Math.min(1, delta * 4));
      mat.color.copy(animatedColor.current);
      mat.emissive.copy(animatedEmissive.current);
      mat.emissiveIntensity = hovered ? 0.6 : isSelected ? 0.5 : isHighlighted ? 0.4 : 0.15;
      mat.opacity = hovered ? 1 : opacity;
    }
  });

  const tooltipContent = useMemo(() => {
    if (!loc) return null;
    return {
      label: `${loc.zone}-${loc.rack || "—"}-${loc.bin || "—"}`,
      qty: `${loc.total_quantity.toLocaleString()} kg`,
      util: `${loc.utilization}%`,
      items: loc.inventory_items.length,
      capacity: `${(loc.capacity || 5000).toLocaleString()} kg`,
    };
  }, [loc]);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[position[0], position[1] + BIN_MIN_H * 0.5, position[2]]}
        scale={[1, BIN_MIN_H / BIN_MAX_H, 1]}
        onClick={(e) => {
          e.stopPropagation();
          if (loc) onBin(loc);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = loc ? "pointer" : "default";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        <boxGeometry args={[BIN_W, BIN_MAX_H, BIN_D]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.15}
          transparent
          opacity={opacity}
          roughness={0.3}
          metalness={0.15}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh
          position={[position[0], FLOOR_Y + 0.02, position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.55, 0.65, 32]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Highlighted glow ring */}
      {isHighlighted && !isSelected && (
        <mesh
          position={[position[0], FLOOR_Y + 0.02, position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.55, 0.65, 32]} />
          <meshBasicMaterial color="#84cc16" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Bin label + % flat on the roof */}
      <Text
        ref={topTextRef}
        position={[position[0], position[1] + BIN_MIN_H + 0.02, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.18}
        color="#e0f2fe"
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        lineHeight={1.3}
        outlineWidth={0.015}
        outlineColor="#000000"
      >
        {loc && loc.utilization > 0 ? `${binLabel}\n${loc.utilization}%` : binLabel}
      </Text>

      {/* Hover tooltip */}
      {hovered && tooltipContent && (
        <Html
          position={[position[0], FLOOR_Y + animatedH.current + 0.6, position[2]]}
          center
          distanceFactor={8}
          zIndexRange={[100, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="bg-neutral-900/95 backdrop-blur-md border border-neutral-700 rounded-xl px-3 py-2.5 shadow-2xl min-w-[160px] pointer-events-none">
            <p className="text-xs font-black text-blue-400 mb-1.5">
              📍 {tooltipContent.label}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
              <span className="text-neutral-400">Tồn kho:</span>
              <span className="text-white font-bold text-right">
                {tooltipContent.qty}
              </span>
              <span className="text-neutral-400">Sức chứa:</span>
              <span className="text-white font-medium text-right">
                {tooltipContent.capacity}
              </span>
              <span className="text-neutral-400">Sử dụng:</span>
              <span className="text-white font-bold text-right">
                {tooltipContent.util}
              </span>
              <span className="text-neutral-400">Sản phẩm:</span>
              <span className="text-white font-medium text-right">
                {tooltipContent.items}
              </span>
            </div>
            <div className="mt-2 w-full h-1.5 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${tooltipContent.util}`,
                  backgroundColor:
                    parseInt(tooltipContent.util) >= 90
                      ? "#ef4444"
                      : parseInt(tooltipContent.util) >= 70
                      ? "#f97316"
                      : parseInt(tooltipContent.util) >= 30
                      ? "#3b82f6"
                      : "#22c55e",
                }}
              />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Khung Racks dạng dây kẽm tầng (Rack Frame) ────────────────────────────────
function RackFrame({
  position,
  width,
  depth,
  height,
  shelfCount,
}: {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  shelfCount: number;
}) {
  const hw = width / 2;
  const hd = depth / 2;

  // Vị trí 4 cột góc
  const postPositions: [number, number, number][] = [
    [position[0] - hw, position[1], position[2] - hd],
    [position[0] + hw, position[1], position[2] - hd],
    [position[0] - hw, position[1], position[2] + hd],
    [position[0] + hw, position[1], position[2] + hd],
  ];

  // Khoảng cách giữa các tầng kệ (bao gồm mặt đáy và đỉnh)
  const shelfHeights: number[] = [];
  for (let i = 0; i <= shelfCount; i++) {
    shelfHeights.push((i / shelfCount) * height);
  }

  const railThickness = 0.025;

  return (
    <group>
      {/* 4 vertical corner posts */}
      {postPositions.map((pp, i) => (
        <mesh
          key={`post-${i}`}
          position={[pp[0], pp[1] + height / 2, pp[2]]}
        >
          <boxGeometry args={[0.045, height, 0.045]} />
          <meshStandardMaterial
            color={RACK_POST_COLOR}
            metalness={0.75}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* Horizontal rails at each shelf level */}
      {shelfHeights.map((sy, i) => (
        <group key={`shelf-rails-${i}`}>
          {/* Front rail (width direction) */}
          <mesh position={[position[0], position[1] + sy, position[2] - hd]}>
            <boxGeometry args={[width, railThickness, railThickness]} />
            <meshStandardMaterial color={SHELF_COLOR} metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Back rail */}
          <mesh position={[position[0], position[1] + sy, position[2] + hd]}>
            <boxGeometry args={[width, railThickness, railThickness]} />
            <meshStandardMaterial color={SHELF_COLOR} metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Left side rail (depth direction) */}
          <mesh position={[position[0] - hw, position[1] + sy, position[2]]}>
            <boxGeometry args={[railThickness, railThickness, depth]} />
            <meshStandardMaterial color={SHELF_COLOR} metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Right side rail */}
          <mesh position={[position[0] + hw, position[1] + sy, position[2]]}>
            <boxGeometry args={[railThickness, railThickness, depth]} />
            <meshStandardMaterial color={SHELF_COLOR} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Đĩa nền cho toàn Zone chứa (Zone floor plate) ─────────────────────────────
function ZoneFloorPlate({
  position,
  width,
  depth,
  color,
}: {
  position: [number, number, number];
  width: number;
  depth: number;
  color: string;
}) {
  return (
    <group>
      {/* Slightly raised floor plate for the zone */}
      <mesh
        position={[position[0], 0.005, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width + 0.6, depth + 1.4]} />
        <meshStandardMaterial
          color="#0f1a2e"
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      {/* Border outline */}
      <mesh
        position={[position[0], 0.008, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width + 0.7, depth + 1.5]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} />
      </mesh>

      {/* Left edge stripe */}
      <mesh
        position={[position[0] - width / 2 - 0.32, 0.01, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.06, depth + 1.4]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// ── Tên Khu (Zone) ở định dạng không gian ảo 3D ──────────────────────────────
function ZoneLabel3D({
  position,
  label,
  color,
}: {
  position: [number, number, number];
  label: string;
  color: string;
}) {
  return (
    <Text
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={0.5}
      color={color}
      anchorX="center"
      anchorY="middle"
      letterSpacing={0.08}
      outlineWidth={0.02}
      outlineColor="#000000"
    >
      {label}
    </Text>
  );
}

// ── Tên Kệ (Rack) ở định dạng không gian ảo 3D ───────────────────────────────
function RackLabel3D({
  position,
  label,
}: {
  position: [number, number, number];
  label: string;
}) {
  return (
    <Text
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={0.22}
      color="#94a3b8"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.01}
      outlineColor="#000000"
    >
      {label}
    </Text>
  );
}

// ── Nền Nhà Kho dưới sàn tổng (Floor) ────────────────────────────────────────
function Floor({ width, depth }: { width: number; depth: number }) {
  const fw = width + 10;
  const fd = depth + 10;
  return (
    <group>
      {/* Concrete floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[fw, fd]} />
        <meshStandardMaterial
          color="#1a1f2e"
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
      {/* Floor grid lines */}
      <gridHelper
        args={[Math.max(fw, fd), Math.floor(Math.max(fw, fd) / 2), "#252d40", "#1a2030"]}
        position={[0, 0.001, 0]}
      />
      {/* Safety line markings on floor edges */}
      {[-1, 1].map((side) => (
        <mesh
          key={`safety-w-${side}`}
          position={[0, 0.005, side * (depth / 2 + 3)]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[width + 6, 0.1]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`safety-d-${side}`}
          position={[side * (width / 2 + 3), 0.005, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.1, depth + 6]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

// ── Cấu trúc Đèn và Trần Nhà (Ẩn đi khi view thẳng từ trên xuống) ────────────
function CeilingGroup({ roofY, children }: { roofY: number; children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = camera.position.y < roofY - 0.5;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

// ── Khung Tường Xây Dựng Ngoài Cùng Bản đồ (Warehouse Building Shell) ────────
function WarehouseBuilding({ width, depth }: { width: number; depth: number }) {
  const bw = width + 14;
  const bd = depth + 14;
  const wallH = 6;
  const wallThickness = 0.15;
  const wallColor = "#1a2238";
  const beamColor = "#374151";
  const roofY = wallH;

  const numBeamsW = Math.max(3, Math.floor(bw / 4));
  const numBeamsD = Math.max(2, Math.floor(bd / 6));

  return (
    <group>
      {/* ── Walls ── */}
      {/* Back wall */}
      <mesh position={[0, wallH / 2, -bd / 2]}>
        <boxGeometry args={[bw, wallH, wallThickness]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* Front wall — with door opening */}
      {(() => {
        const doorW = 4;
        const doorH = 4.5;
        const sideW = (bw - doorW) / 2;
        const topH = wallH - doorH;
        const fz = bd / 2;
        return (
          <group>
            {/* Left section */}
            <mesh position={[-bw / 2 + sideW / 2, wallH / 2, fz]}>
              <boxGeometry args={[sideW, wallH, wallThickness]} />
              <meshStandardMaterial color={wallColor} roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
            </mesh>
            {/* Right section */}
            <mesh position={[bw / 2 - sideW / 2, wallH / 2, fz]}>
              <boxGeometry args={[sideW, wallH, wallThickness]} />
              <meshStandardMaterial color={wallColor} roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
            </mesh>
            {/* Top section above door */}
            <mesh position={[0, doorH + topH / 2, fz]}>
              <boxGeometry args={[doorW, topH, wallThickness]} />
              <meshStandardMaterial color={wallColor} roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
            </mesh>

            {/* Door frame */}
            {/* Left frame */}
            <mesh position={[-doorW / 2 - 0.06, doorH / 2, fz]}>
              <boxGeometry args={[0.12, doorH, 0.2]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.3} roughness={0.4} />
            </mesh>
            {/* Right frame */}
            <mesh position={[doorW / 2 + 0.06, doorH / 2, fz]}>
              <boxGeometry args={[0.12, doorH, 0.2]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.3} roughness={0.4} />
            </mesh>
            {/* Top frame */}
            <mesh position={[0, doorH + 0.06, fz]}>
              <boxGeometry args={[doorW + 0.24, 0.12, 0.2]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.3} roughness={0.4} />
            </mesh>

            {/* Roller shutter (partially open — rolled up at top) */}
            <mesh position={[0, doorH - 0.15, fz + 0.05]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.18, 0.18, doorW - 0.1, 12]} />
              <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.3} />
            </mesh>

            {/* Floor threshold */}
            <mesh position={[0, 0.03, fz]}>
              <boxGeometry args={[doorW + 0.3, 0.06, 0.3]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.2} roughness={0.5} transparent opacity={0.7} />
            </mesh>
          </group>
        );
      })()}

      {/* Left wall */}
      <mesh position={[-bw / 2, wallH / 2, 0]}>
        <boxGeometry args={[wallThickness, wallH, bd]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      {/* Right wall */}
      <mesh position={[bw / 2, wallH / 2, 0]}>
        <boxGeometry args={[wallThickness, wallH, bd]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Ceiling elements (simplified for performance) ── */}
      <CeilingGroup roofY={roofY}>
        {/* Ceiling beams (cross direction) */}
        {Array.from({ length: Math.min(numBeamsW, 6) }).map((_, i) => {
          const x = -bw / 2 + (i + 0.5) * (bw / Math.min(numBeamsW, 6));
          return (
            <mesh key={`beam-w-${i}`} position={[x, roofY - 0.2, 0]}>
              <boxGeometry args={[0.12, 0.35, bd - 0.3]} />
              <meshStandardMaterial color={beamColor} metalness={0.6} roughness={0.3} />
            </mesh>
          );
        })}

        {/* Ceiling beams (length direction) */}
        {Array.from({ length: Math.min(numBeamsD, 4) }).map((_, i) => {
          const z = -bd / 2 + (i + 0.5) * (bd / Math.min(numBeamsD, 4));
          return (
            <mesh key={`beam-d-${i}`} position={[0, roofY - 0.15, z]}>
              <boxGeometry args={[bw - 0.3, 0.2, 0.1]} />
              <meshStandardMaterial color={beamColor} metalness={0.6} roughness={0.3} />
            </mesh>
          );
        })}
      </CeilingGroup>

      {/* ── Wall base stripe (industrial) ── */}
      {/* Back */}
      <mesh position={[0, 0.15, -bd / 2 + wallThickness / 2 + 0.01]}>
        <boxGeometry args={[bw - wallThickness * 2, 0.3, 0.02]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.2} />
      </mesh>
      {/* Front */}
      <mesh position={[0, 0.15, bd / 2 - wallThickness / 2 - 0.01]}>
        <boxGeometry args={[bw - wallThickness * 2, 0.3, 0.02]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// ── Điều Chỉnh Tự Động Định Vị Camera trung tâm ──────────────────────────────
function CameraSetup({ totalWidth, totalDepth }: { totalWidth: number; totalDepth: number }) {
  const { camera } = useThree();
  const hasSetup = useRef(false);

  useEffect(() => {
    if (hasSetup.current) return;
    hasSetup.current = true;
    
    // Đặt camera quan sát thẳng từ trên xuống
    const span = Math.max(totalWidth, totalDepth);
    const camH = Math.min(span * 0.8, 20);
    camera.position.set(0, camH, 0.1);
    camera.lookAt(0, 0, 0);
    (camera as THREE.PerspectiveCamera).near = 0.1;
    (camera as THREE.PerspectiveCamera).far = 500;
    camera.updateProjectionMatrix();
  }, [camera, totalWidth, totalDepth]);

  return null;
}

// ── Giới hạn tọa độ Di chuyển Camera của người dùng ──────────────────────────
function CameraClamp({ totalWidth, totalDepth }: { totalWidth: number; totalDepth: number }) {
  const { controls, camera } = useThree();
  const halfW = (totalWidth + 12) / 2;
  const halfD = (totalDepth + 12) / 2;
  const maxY = 5.5;

  useFrame(() => {
    if (!controls) return;
    const orbitControls = controls as any;
    const target = orbitControls.target as THREE.Vector3;

    // Giới hạn mục tiêu xoay camera
    target.x = THREE.MathUtils.clamp(target.x, -halfW, halfW);
    target.y = THREE.MathUtils.clamp(target.y, 0, maxY);
    target.z = THREE.MathUtils.clamp(target.z, -halfD, halfD);

    // Giới hạn vị trí camera
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -halfW, halfW);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.5, maxY + 20);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -halfD, halfD);
  });

  return null;
}

// ── Xây dựng khung hình Scene Main 3D (Main 3D Scene) ────────────────────────
function WarehouseScene({
  locations,
  warehouse,
  searchSku,
  onBin,
  selectedId,
  zoneLabels,
}: WarehouseMap3DProps) {
  const grid = useMemo(
    () => buildGrid(locations, warehouse),
    [locations, warehouse]
  );

  const zonesPerRow = warehouse.zones_per_row && warehouse.zones_per_row > 0
    ? warehouse.zones_per_row
    : grid.nZ;

  const { binPositions, zonePositions, rackPositions, rackFrames, zonePlates, totalWidth, totalDepth } =
    useMemo(() => {
      const rackWidth = BIN_W;
      const rackDepth = grid.nB * (BIN_D + BIN_GAP) - BIN_GAP;
      const zoneWidth = grid.nR * (rackWidth + RACK_GAP) - RACK_GAP;
      const zoneDepth = rackDepth;

      const numCols = Math.min(grid.nZ, zonesPerRow);
      const numRows = Math.ceil(grid.nZ / zonesPerRow);

      const totalW = numCols * (zoneWidth + ZONE_GAP) - ZONE_GAP;
      const totalD = numRows * (zoneDepth + ZONE_GAP + 1.5) - ZONE_GAP;

      const bins: {
        key: string;
        pos: [number, number, number];
        loc: LocationWithInventory | undefined;
        binLabel: string;
      }[] = [];

      const zoneLabelPositions: { pos: [number, number, number]; label: string; color: string }[] = [];
      const rackLabelPositions: { pos: [number, number, number]; label: string }[] = [];
      const rackFrameData: {
        pos: [number, number, number];
        w: number;
        d: number;
        h: number;
        shelfCount: number;
      }[] = [];
      const zonePlateData: {
        pos: [number, number, number];
        w: number;
        d: number;
        color: string;
      }[] = [];

      grid.zones.forEach((zone, zi) => {
        const col = zi % zonesPerRow;
        const row = Math.floor(zi / zonesPerRow);

        const zoneX = col * (zoneWidth + ZONE_GAP) - totalW / 2 + zoneWidth / 2;
        const zoneZ = row * (zoneDepth + ZONE_GAP + 1.5) - totalD / 2 + zoneDepth / 2;

        const zoneColor = zi % 2 === 0 ? "#3b82f6" : "#06b6d4";

        // Nền khu (zone floor)
        zonePlateData.push({
          pos: [zoneX, 0, zoneZ],
          w: zoneWidth,
          d: zoneDepth,
          color: zoneColor,
        });

        // Nhãn khu (zone label)
        zoneLabelPositions.push({
          pos: [zoneX, 0.015, zoneZ - zoneDepth / 2 - 0.85],
          label: zone,
          color: zoneColor,
        });

        grid.racks.forEach((rack, ri) => {
          const rackX = zoneX - zoneWidth / 2 + ri * (rackWidth + RACK_GAP) + rackWidth / 2;

          // Nhãn kệ (rack label)
          rackLabelPositions.push({
            pos: [rackX, 0.015, zoneZ - zoneDepth / 2 - 0.35],
            label: rack,
          });

          // Khung kệ (rack frame)
          rackFrameData.push({
            pos: [rackX, FLOOR_Y, zoneZ],
            w: rackWidth + 0.15,
            d: rackDepth + 0.15,
            h: BIN_MAX_H + 0.1,
            shelfCount: Math.min(grid.nB, 6),
          });

          grid.bins.forEach((bin, bi) => {
            const binZ =
              zoneZ - zoneDepth / 2 + bi * (BIN_D + BIN_GAP) + BIN_D / 2;
            const key = `${zone}-${rack}-${bin}`;
            const loc = grid.lookup.get(key);

            bins.push({
              key,
              pos: [rackX, FLOOR_Y, binZ],
              loc,
              binLabel: bin,
            });
          });
        });
      });

      return {
        binPositions: bins,
        zonePositions: zoneLabelPositions,
        rackPositions: rackLabelPositions,
        rackFrames: rackFrameData,
        zonePlates: zonePlateData,
        totalWidth: totalW,
        totalDepth: totalD,
      };
    }, [grid, zonesPerRow]);

  const categoryGroups = useMemo(() => {
    if (!zoneLabels) return [];
    const groups: Record<string, { minX: number; minZ: number; maxX: number; maxZ: number; label: string }> = {};

    zonePlates.forEach((zp, i) => {
      const zoneName = grid.zones[i];
      const label = zoneLabels[zoneName];
      if (!label) return;

      // Expand bounding box slightly around the zone floor plate
      const minX = zp.pos[0] - zp.w / 2 - 0.5;
      const maxX = zp.pos[0] + zp.w / 2 + 0.5;
      const minZ = zp.pos[2] - zp.d / 2 - 1.2;
      const maxZ = zp.pos[2] + zp.d / 2 + 0.8;

      if (!groups[label]) {
        groups[label] = { minX, minZ, maxX, maxZ, label };
      } else {
        const g = groups[label];
        g.minX = Math.min(g.minX, minX);
        g.minZ = Math.min(g.minZ, minZ);
        g.maxX = Math.max(g.maxX, maxX);
        g.maxZ = Math.max(g.maxZ, maxZ);
      }
    });
    return Object.values(groups);
  }, [zonePlates, grid.zones, zoneLabels]);

  return (
    <>
      <CameraSetup totalWidth={totalWidth} totalDepth={totalDepth} />
      <CameraClamp totalWidth={totalWidth} totalDepth={totalDepth} />

      {/* Lighting — brighter and more fills */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[12, 18, 12]} intensity={1.2} />
      <directionalLight position={[-8, 10, -6]} intensity={0.3} />
      <hemisphereLight args={["#1e40af", "#0f172a", 0.5]} />

      {/* Fog */}
      <fog attach="fog" args={["#0c1220", 30, 100]} />

      {/* Floor */}
      <Floor width={totalWidth} depth={totalDepth} />

      {/* Warehouse building shell */}
      <WarehouseBuilding width={totalWidth} depth={totalDepth} />

      {/* Zone floor plates */}
      {zonePlates.map((zp, i) => (
        <ZoneFloorPlate key={`zplate-${i}`} position={zp.pos} width={zp.w} depth={zp.d} color={zp.color} />
      ))}

      {/* Zone labels */}
      {zonePositions.map((z, i) => (
        <ZoneLabel3D key={`zone-${i}`} position={z.pos} label={z.label} color={z.color} />
      ))}

      {/* Rack labels */}
      {rackPositions.map((r, i) => (
        <RackLabel3D key={`rack-${i}`} position={r.pos} label={r.label} />
      ))}

      {/* Rack frames */}
      {rackFrames.map((rf, i) => (
        <RackFrame
          key={`rframe-${i}`}
          position={rf.pos}
          width={rf.w}
          depth={rf.d}
          height={rf.h}
          shelfCount={rf.shelfCount}
        />
      ))}

      {/* Category Group Outlines */}
      {categoryGroups.map((g, i) => {
        const pts: [number, number, number][] = [
          [g.minX, 0.02, g.minZ],
          [g.maxX, 0.02, g.minZ],
          [g.maxX, 0.02, g.maxZ],
          [g.minX, 0.02, g.maxZ],
          [g.minX, 0.02, g.minZ]
        ];
        return (
          <group key={`catline-${i}`}>
            <Line points={pts} color="#f59e0b" lineWidth={3.5} dashed dashSize={0.6} gapSize={0.4} />
            
            {/* Label background plate */}
            <mesh position={[(g.minX + g.maxX)/2, 0.018, g.minZ - 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[Math.min(g.label.length * 0.4 + 1, g.maxX - g.minX), 1.2]} />
              <meshBasicMaterial color="#fef3c7" />
            </mesh>
            
            <Text
              position={[(g.minX + g.maxX)/2, 0.02, g.minZ - 0.4]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.55}
              color="#d97706"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {g.label.length > 30 ? g.label.slice(0, 28) + '...' : g.label}
            </Text>
          </group>
        );
      })}

      {/* Bins */}
      {binPositions.map((b) => (
        <BinBox
          key={b.key}
          position={b.pos}
          loc={b.loc}
          binLabel={b.binLabel}
          searchSku={searchSku}
          isSelected={!!b.loc && selectedId === b.loc.id}
          onBin={onBin}
        />
      ))}

      {/* Click empty to deselect */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.005, 0]}
        onClick={() => onBin(null)}
        visible={false}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial />
      </mesh>
    </>
  );
}

// ── Trình hỗ trợ thiết lập lại Camera (Camera reset helper) ────────────
function CameraReset({
  resetRef,
}: {
  resetRef: React.MutableRefObject<(() => void) | null>;
}) {
  const { camera, controls } = useThree();

  useEffect(() => {
    resetRef.current = () => {
      const targetPos = new THREE.Vector3(0, 15, 0.1);
      const targetLook = new THREE.Vector3(0, 0, 0);

      const startPos = camera.position.clone();
      const orbitControls = controls as any;
      const startTarget = orbitControls?.target?.clone() || new THREE.Vector3(0, 0.5, 0);
      let progress = 0;

      const animate = () => {
        progress += 0.04;
        if (progress >= 1) {
          camera.position.copy(targetPos);
          if (orbitControls) orbitControls.target.copy(targetLook);
          return;
        }
        const t = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(startPos, targetPos, t);
        if (orbitControls) {
          orbitControls.target.lerpVectors(startTarget, targetLook, t);
        }
        requestAnimationFrame(animate);
      };
      animate();
    };
  }, [camera, controls, resetRef]);

  return null;
}

// ── Xuất Component (Exported component) ───────────────────────────────
export default function WarehouseMap3D(props: WarehouseMap3DProps) {
  const resetRef = useRef<(() => void) | null>(null);

  const [glError, setGlError] = useState(false);

  if (glError) {
    return (
      <div className="absolute inset-0 rounded-2xl overflow-hidden w-full h-full flex items-center justify-center bg-neutral-950">
        <div className="text-center">
          <p className="text-neutral-400 text-sm mb-3">⚠️ GPU không hỗ trợ chế độ 3D</p>
          <button onClick={() => setGlError(false)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-500 transition-all">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden w-full h-full">
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
        }}
        camera={{ fov: 55, near: 0.1, far: 500 }}
        style={{ background: "#0c1220" }}
        onPointerMissed={() => props.onBin(null)}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setGlError(true);
          });
        }}
      >
        <WarehouseScene {...props} />
        <CameraReset resetRef={resetRef} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          panSpeed={2.5}
          minDistance={2}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2.05}
          minPolarAngle={0.05}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      {/* Reset camera button */}
      <button
        onClick={() => resetRef.current?.()}
        className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 px-3 py-2 
          rounded-lg bg-neutral-800/80 hover:bg-neutral-700/90 backdrop-blur-md border border-neutral-600/50 
          text-neutral-300 hover:text-white text-xs font-medium 
          transition-all duration-200 shadow-lg hover:shadow-xl"
        title="Reset góc nhìn"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Reset
      </button>
    </div>
  );
}
