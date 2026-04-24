import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import ErrorBoundary from "./ErrorBoundary";

const DEFAULT_CAMERA_POSITION = [0, 0.22, 7.8];
const DEFAULT_CAMERA_TARGET = [0, -0.18, 0];

const COLOR_MAP = {
  black: "#1e1e22", white: "#f5f1ec", gray: "#7f8793", grey: "#7f8793",
  navy: "#304965", blue: "#4f75c9", red: "#bc4a45", burgundy: "#7f3040",
  maroon: "#7f3040", pink: "#d889a1", purple: "#7a67bf", green: "#5d8d63",
  olive: "#74804e", yellow: "#dfb34f", orange: "#d98645", beige: "#d9c1a0",
  tan: "#b99772", brown: "#775a43", cream: "#ece1d2", denim: "#5976a3",
  charcoal: "#3d4450", silver: "#a8b0bb", teal: "#4a9e9a", coral: "#d96d5a",
};

const CAMERA_ACTIONS = {
  ROTATE_LEFT: "rotate-left", ROTATE_RIGHT: "rotate-right",
  ZOOM_IN: "zoom-in", ZOOM_OUT: "zoom-out", RESET: "reset",
};

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch { return false; }
}

function normalizeText(v) { return (v || "").toString().trim().toLowerCase(); }

function primaryColorHex(rawColor) {
  const first = (rawColor || "").toString().split(",")[0].trim().toLowerCase();
  return COLOR_MAP[first] || "#b48d74";
}

function buildSearchText(item) {
  return [item?.category, item?.clothing_type, item?.clothingType,
    item?.layer_type, item?.layerType, item?.type, item?.name, item?.tags]
    .flat().filter(Boolean).join(" ").toLowerCase();
}

function previewRole(item) {
  const category = normalizeText(item?.category);
  const clothingType = normalizeText(item?.clothing_type || item?.clothingType || item?.type || item?.name);
  const layerType = normalizeText(item?.layer_type || item?.layerType);
  if (clothingType.includes("dress") || clothingType.includes("jumpsuit") || clothingType.includes("romper") || clothingType.includes("overalls")) return "onePiece";
  if (category === "one-piece") return "onePiece";
  if (category === "shoes" || category === "shoe" || clothingType.includes("shoe") || clothingType.includes("sneaker") || clothingType.includes("boot") || clothingType.includes("sandal") || clothingType.includes("heel")) return "shoes";
  if (category === "outerwear" || layerType === "outer" || clothingType.includes("jacket") || clothingType.includes("coat") || clothingType.includes("blazer") || clothingType.includes("cardigan")) return "outerwear";
  if (category === "tops" || category === "top") return "top";
  if (category === "bottoms" || category === "bottom" || clothingType.includes("pants") || clothingType.includes("jeans") || clothingType.includes("skirt") || clothingType.includes("shorts") || clothingType.includes("trousers")) return "bottom";
  return "";
}

function garmentFamily(item, role) {
  const text = buildSearchText(item);
  if (role === "onePiece") {
    if (text.includes("jumpsuit") || text.includes("romper") || text.includes("overalls")) return "jumpsuit";
    return "dress";
  }
  if (role === "outerwear") {
    if (text.includes("coat") || text.includes("trench") || text.includes("parka") || text.includes("puffer")) return "coat";
    if (text.includes("blazer")) return "blazer";
    return "jacket";
  }
  if (role === "top") {
    if (text.includes("tank") || text.includes("cami")) return "fitted-top";
    if (text.includes("sweater") || text.includes("hoodie") || text.includes("crewneck") || text.includes("turtleneck")) return "sweater-top";
    if (text.includes("button") || text.includes("blouse") || text.includes("shirt")) return "structured-top";
    return "tee-top";
  }
  if (role === "bottom") {
    if (text.includes("skirt")) return "skirt";
    if (text.includes("shorts")) return "shorts";
    return "pants";
  }
  if (role === "shoes") {
    if (text.includes("boot")) return "boots";
    return "shoes";
  }
  return "generic";
}

function describeUnsupported(item) {
  if (item?.not_rendered_reason) return `${item?.name || "Item"} (${item.not_rendered_reason})`;
  const role = previewRole(item);
  if (role) return item?.name || "Item";
  return `${item?.name || "Item"} (Accessory preview coming soon)`;
}

function groupPreviewItems(outfit) {
  const buckets = { top: [], outerwear: [], bottom: [], shoes: [], onePiece: [] };
  const unsupported = [], skipped = [], conflicts = [];
  (Array.isArray(outfit) ? outfit : []).forEach((item) => {
    const role = previewRole(item);
    if (!role) { unsupported.push(item); return; }
    buckets[role].push(item);
  });
  const grouped = {
    top: buckets.top[0] || null, outerwear: buckets.outerwear[0] || null,
    bottom: buckets.bottom[0] || null, shoes: buckets.shoes[0] || null,
    onePiece: buckets.onePiece[0] || null,
  };
  ["top", "outerwear", "bottom", "shoes", "onePiece"].forEach((role) => {
    if (buckets[role].length > 1) {
      conflicts.push({ role, kept: buckets[role][0], skipped: buckets[role].slice(1) });
      skipped.push(...buckets[role].slice(1));
    }
  });
  if (grouped.onePiece) {
    if (grouped.top) { skipped.push(grouped.top); conflicts.push({ role: "top", kept: grouped.onePiece, skipped: [grouped.top], reason: "One-piece styling takes over the base outfit silhouette." }); }
    if (grouped.bottom) { skipped.push(grouped.bottom); conflicts.push({ role: "bottom", kept: grouped.onePiece, skipped: [grouped.bottom], reason: "One-piece styling takes over the base outfit silhouette." }); }
    grouped.top = null; grouped.bottom = null;
  }
  return { grouped, unsupported, skipped, conflicts, supportedCount: Object.values(grouped).filter(Boolean).length };
}

// ── Improved mannequin body ────────────────────────────────────────

function MannequinBase() {
  return (
    <group>
      <mesh position={[0, 2.62, 0]}>
        <sphereGeometry args={[0.34, 36, 36]} />
        <meshStandardMaterial color="#e3d5ca" roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <capsuleGeometry args={[0.12, 0.26, 8, 20]} />
        <meshStandardMaterial color="#dfd0c4" roughness={0.92} metalness={0.02} />
      </mesh>
      {/* Chest */}
      <mesh position={[0, 1.72, 0]}>
        <cylinderGeometry args={[0.66, 0.6, 0.82, 32]} />
        <meshStandardMaterial color="#d8cab8" roughness={0.97} metalness={0.02} />
      </mesh>
      {/* Waist — narrower for definition */}
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.5, 0.58, 0.64, 32]} />
        <meshStandardMaterial color="#d2c3b7" roughness={0.98} metalness={0.02} />
      </mesh>
      {/* Hips */}
      <mesh position={[0, 0.44, 0]}>
        <cylinderGeometry args={[0.62, 0.66, 0.6, 32]} />
        <meshStandardMaterial color="#cbbdaf" roughness={0.98} metalness={0.02} />
      </mesh>
      {/* Pelvis bridge */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.92, 0.38, 0.46]} />
        <meshStandardMaterial color="#c7b8ab" roughness={0.98} metalness={0.02} />
      </mesh>
      {/* Arms — capsule for smooth silhouette */}
      <mesh position={[-0.88, 1.48, 0]} rotation={[0, 0, -0.18]}>
        <capsuleGeometry args={[0.11, 1.18, 8, 20]} />
        <meshStandardMaterial color="#d2c3b7" roughness={0.97} metalness={0.02} />
      </mesh>
      <mesh position={[0.88, 1.48, 0]} rotation={[0, 0, 0.18]}>
        <capsuleGeometry args={[0.11, 1.18, 8, 20]} />
        <meshStandardMaterial color="#d2c3b7" roughness={0.97} metalness={0.02} />
      </mesh>
      {/* Hands */}
      <mesh position={[-0.94, 0.76, 0.04]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#d4c5b8" roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh position={[0.94, 0.76, 0.04]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#d4c5b8" roughness={0.95} metalness={0.02} />
      </mesh>
      {/* Legs — capsule */}
      <mesh position={[-0.28, -1.05, 0]}>
        <capsuleGeometry args={[0.14, 1.52, 8, 20]} />
        <meshStandardMaterial color="#cec0b4" roughness={0.98} metalness={0.02} />
      </mesh>
      <mesh position={[0.28, -1.05, 0]}>
        <capsuleGeometry args={[0.14, 1.52, 8, 20]} />
        <meshStandardMaterial color="#cec0b4" roughness={0.98} metalness={0.02} />
      </mesh>
      {/* Feet */}
      <mesh position={[-0.28, -2.18, 0.14]}>
        <boxGeometry args={[0.34, 0.18, 0.72]} />
        <meshStandardMaterial color="#b6a79a" roughness={0.99} metalness={0.01} />
      </mesh>
      <mesh position={[0.28, -2.18, 0.14]}>
        <boxGeometry args={[0.34, 0.18, 0.72]} />
        <meshStandardMaterial color="#b6a79a" roughness={0.99} metalness={0.01} />
      </mesh>
    </group>
  );
}

// ── Garment geometry (used when no photo texture available) ────────

function GarmentMaterial({ color, texture, opacity = 0.98 }) {
  return (
    <meshStandardMaterial color={color} map={texture || null}
      transparent={Boolean(texture)} alphaTest={texture ? 0.22 : 0}
      opacity={opacity} roughness={0.92} metalness={0.04} />
  );
}
function BoxPart({ args, position, rotation = [0, 0, 0], color, texture, opacity }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <GarmentMaterial color={color} texture={texture} opacity={opacity} />
    </mesh>
  );
}
function CylinderPart({ args, position, rotation = [0, 0, 0], color, texture, opacity }) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={args} />
      <GarmentMaterial color={color} texture={texture} opacity={opacity} />
    </mesh>
  );
}

function TopGarment({ item, texture, zOffset = 0.03 }) {
  const color = primaryColorHex(item?.color);
  const family = garmentFamily(item, "top");
  if (family === "fitted-top") return (
    <group>
      <CylinderPart args={[0.5, 0.62, 1.2, 24]} position={[0, 1.56, zOffset]} color={color} texture={texture} />
      <CylinderPart args={[0.11, 0.13, 0.82, 20]} position={[-0.82, 1.56, zOffset]} rotation={[0, 0, -0.24]} color={color} texture={texture} />
      <CylinderPart args={[0.11, 0.13, 0.82, 20]} position={[0.82, 1.56, zOffset]} rotation={[0, 0, 0.24]} color={color} texture={texture} />
    </group>
  );
  if (family === "structured-top") return (
    <group>
      <BoxPart args={[1.05, 1.34, 0.42]} position={[0, 1.55, zOffset]} color={color} texture={texture} />
      <BoxPart args={[0.14, 0.4, 0.1]} position={[-0.12, 2.13, zOffset + 0.03]} rotation={[0, 0, 0.18]} color="#efe7dd" />
      <BoxPart args={[0.14, 0.4, 0.1]} position={[0.12, 2.13, zOffset + 0.03]} rotation={[0, 0, -0.18]} color="#efe7dd" />
      <BoxPart args={[0.18, 1.08, 0.22]} position={[-0.82, 1.55, zOffset]} rotation={[0, 0, -0.14]} color={color} texture={texture} />
      <BoxPart args={[0.18, 1.08, 0.22]} position={[0.82, 1.55, zOffset]} rotation={[0, 0, 0.14]} color={color} texture={texture} />
    </group>
  );
  if (family === "sweater-top") return (
    <group>
      <BoxPart args={[1.16, 1.46, 0.48]} position={[0, 1.5, zOffset]} color={color} texture={texture} />
      <BoxPart args={[0.24, 1.18, 0.26]} position={[-0.84, 1.48, zOffset]} rotation={[0, 0, -0.13]} color={color} texture={texture} />
      <BoxPart args={[0.24, 1.18, 0.26]} position={[0.84, 1.48, zOffset]} rotation={[0, 0, 0.13]} color={color} texture={texture} />
    </group>
  );
  return (
    <group>
      <BoxPart args={[1.08, 1.28, 0.4]} position={[0, 1.57, zOffset]} color={color} texture={texture} />
      <BoxPart args={[0.2, 0.96, 0.22]} position={[-0.82, 1.57, zOffset]} rotation={[0, 0, -0.16]} color={color} texture={texture} />
      <BoxPart args={[0.2, 0.96, 0.22]} position={[0.82, 1.57, zOffset]} rotation={[0, 0, 0.16]} color={color} texture={texture} />
    </group>
  );
}

function OuterwearGarment({ item, texture, zOffset = 0.08 }) {
  const color = primaryColorHex(item?.color);
  const family = garmentFamily(item, "outerwear");
  const longLength = family === "coat";
  const torsoH = longLength ? 1.9 : 1.56;
  const sleeveH = longLength ? 1.42 : 1.22;
  const hemY = longLength ? 1.22 : 1.46;
  return (
    <group>
      <BoxPart args={[1.22, torsoH, 0.58]} position={[0, hemY, zOffset]} color={color} texture={texture} opacity={0.99} />
      <BoxPart args={[0.28, sleeveH, 0.3]} position={[-0.87, 1.46, zOffset]} rotation={[0, 0, -0.14]} color={color} texture={texture} opacity={0.99} />
      <BoxPart args={[0.28, sleeveH, 0.3]} position={[0.87, 1.46, zOffset]} rotation={[0, 0, 0.14]} color={color} texture={texture} opacity={0.99} />
      {family === "blazer" ? (
        <>
          <BoxPart args={[0.12, 0.5, 0.1]} position={[-0.16, 2.02, zOffset + 0.04]} rotation={[0, 0, 0.28]} color="#ece2d6" />
          <BoxPart args={[0.12, 0.5, 0.1]} position={[0.16, 2.02, zOffset + 0.04]} rotation={[0, 0, -0.28]} color="#ece2d6" />
        </>
      ) : null}
    </group>
  );
}

function BottomGarment({ item, texture, zOffset = 0.03 }) {
  const color = primaryColorHex(item?.color);
  const family = garmentFamily(item, "bottom");
  if (family === "skirt") return (
    <group>
      <CylinderPart args={[0.52, 0.3, 1.1, 24]} position={[0, -0.18, zOffset]} color={color} texture={texture} />
    </group>
  );
  if (family === "shorts") return (
    <group>
      <BoxPart args={[0.46, 0.92, 0.5]} position={[-0.28, -0.48, zOffset]} color={color} texture={texture} />
      <BoxPart args={[0.46, 0.92, 0.5]} position={[0.28, -0.48, zOffset]} color={color} texture={texture} />
    </group>
  );
  return (
    <group>
      <BoxPart args={[0.42, 1.74, 0.52]} position={[-0.28, -0.95, zOffset]} color={color} texture={texture} />
      <BoxPart args={[0.42, 1.74, 0.52]} position={[0.28, -0.95, zOffset]} color={color} texture={texture} />
    </group>
  );
}

function OnePieceGarment({ item, texture }) {
  const color = primaryColorHex(item?.color);
  const family = garmentFamily(item, "onePiece");
  if (family === "jumpsuit") return (
    <group>
      <BoxPart args={[1.14, 1.45, 0.48]} position={[0, 1.46, 0.03]} color={color} texture={texture} />
      <BoxPart args={[0.44, 1.72, 0.5]} position={[-0.28, -0.92, 0.03]} color={color} texture={texture} />
      <BoxPart args={[0.44, 1.72, 0.5]} position={[0.28, -0.92, 0.03]} color={color} texture={texture} />
    </group>
  );
  return (
    <group>
      <BoxPart args={[1.1, 1.48, 0.5]} position={[0, 1.48, 0.03]} color={color} texture={texture} />
      <CylinderPart args={[0.72, 0.24, 1.4, 28]} position={[0, -0.16, 0.03]} color={color} texture={texture} />
    </group>
  );
}

function ShoeGarment({ item, texture }) {
  const color = primaryColorHex(item?.color);
  const family = garmentFamily(item, "shoes");
  const depth = family === "boots" ? 0.96 : 0.86;
  const height = family === "boots" ? 0.42 : 0.22;
  const y = family === "boots" ? -2.06 : -2.18;
  return (
    <group>
      <BoxPart args={[0.4, height, depth]} position={[-0.28, y, 0.2]} color={color} texture={texture} />
      <BoxPart args={[0.4, height, depth]} position={[0.28, y, 0.2]} color={color} texture={texture} />
    </group>
  );
}

// ── Clothing image plane (shows actual photo on mannequin) ─────────

function GarmentImagePlane({ texture, position, width, height }) {
  if (!texture) return null;
  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} transparent alphaTest={0.06} roughness={0.88} metalness={0.02} />
    </mesh>
  );
}

function MannequinClothing({ grouped, textures }) {
  const { top, outerwear, bottom, shoes, onePiece } = grouped;
  return (
    <group>
      {onePiece ? (
        textures[onePiece.id]
          ? <GarmentImagePlane texture={textures[onePiece.id]} position={[0, 0.6, 0.3]} width={1.22} height={3.4} />
          : <OnePieceGarment item={onePiece} texture={null} />
      ) : null}
      {!onePiece && top ? (
        textures[top.id]
          ? <GarmentImagePlane texture={textures[top.id]} position={[0, 1.56, 0.3]} width={1.22} height={1.55} />
          : <TopGarment item={top} texture={null} />
      ) : null}
      {!onePiece && bottom ? (
        textures[bottom.id]
          ? <GarmentImagePlane texture={textures[bottom.id]} position={[0, -0.62, 0.3]} width={1.02} height={1.88} />
          : <BottomGarment item={bottom} texture={null} />
      ) : null}
      {outerwear ? (
        textures[outerwear.id]
          ? <GarmentImagePlane texture={textures[outerwear.id]} position={[0, 1.5, 0.36]} width={1.44} height={2.0} />
          : <OuterwearGarment item={outerwear} texture={null} />
      ) : null}
      {shoes ? (
        textures[shoes.id]
          ? <GarmentImagePlane texture={textures[shoes.id]} position={[0, -2.08, 0.24]} width={0.9} height={0.42} />
          : <ShoeGarment item={shoes} texture={null} />
      ) : null}
    </group>
  );
}

// ── Callout annotations (dot → line → draggable card) ─────────────

const CALLOUT_CFG = {
  top:      { dot: [0.66, 1.56, 0.64], tip: [1.72, 1.9,  0.1] },
  outerwear:{ dot: [0.8,  1.56, 0.7],  tip: [1.9,  2.1,  0.1] },
  bottom:   { dot: [0.66, -0.5, 0.58], tip: [1.72, -0.28, 0.1] },
  shoes:    { dot: [0.44, -2.14, 0.34],tip: [1.52, -1.88, 0.1] },
  onePiece: { dot: [0.66, 0.56, 0.58], tip: [1.72, 0.72, 0.1] },
};

function CalloutCard({ item, role, onDragChange }) {
  const cfg = CALLOUT_CFG[role];
  if (!cfg || !item) return null;

  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation();
    setIsDragging(true);
    onDragChange?.(true);
    dragRef.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    const onMove = (me) => {
      const d = dragRef.current;
      if (!d) return;
      setOffset({ x: d.ox + (me.clientX - d.mx), y: d.oy + (me.clientY - d.my) });
    };
    const onUp = () => {
      setIsDragging(false);
      onDragChange?.(false);
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [offset.x, offset.y, onDragChange]);

  return (
    <>
      <mesh position={cfg.dot}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.9} />
      </mesh>
      <Line points={[cfg.dot, cfg.tip]} color="#ffffff" lineWidth={1.4} transparent opacity={0.48} />
      <Html position={cfg.tip} zIndexRange={[10, 20]} style={{ pointerEvents: "none" }}>
        <div
          className="mannequinCalloutCard"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, cursor: isDragging ? "grabbing" : "grab", pointerEvents: "auto" }}
          onPointerDown={handlePointerDown}
        >
          {item.image_url
            ? <img className="mannequinCalloutImg" src={item.image_url} alt={item.name || ""} draggable={false} />
            : <div className="mannequinCalloutPlaceholder" />}
          <div className="mannequinCalloutLabel">{item.name || "Item"}</div>
        </div>
      </Html>
    </>
  );
}

function ClothingCallouts({ grouped, onDragChange }) {
  return (
    <group>
      {Object.keys(CALLOUT_CFG).map((role) => {
        const item = grouped[role];
        if (!item) return null;
        return <CalloutCard key={role} item={item} role={role} onDragChange={onDragChange} />;
      })}
    </group>
  );
}

// ── Scene ──────────────────────────────────────────────────────────

function MannequinCanvas({ grouped, textures, actionToken, showCallouts, onDragChange }) {
  const controlsRef = useRef(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  const handleDrag = useCallback((dragging) => {
    setOrbitEnabled(!dragging);
    onDragChange?.(dragging);
  }, [onDragChange]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.set(...DEFAULT_CAMERA_TARGET);
    controls.object.position.set(...DEFAULT_CAMERA_POSITION);
    controls.object.lookAt(...DEFAULT_CAMERA_TARGET);
    controls.update();
    controls.saveState();
  }, []);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !actionToken?.type) return;
    if (actionToken.type === CAMERA_ACTIONS.RESET) { controls.reset(); controls.update(); return; }
    const step = Math.PI / 8;
    if (actionToken.type === CAMERA_ACTIONS.ROTATE_LEFT) controls.rotateLeft(step);
    if (actionToken.type === CAMERA_ACTIONS.ROTATE_RIGHT) controls.rotateLeft(-step);
    if (actionToken.type === CAMERA_ACTIONS.ZOOM_IN) controls.dollyIn(1.18);
    if (actionToken.type === CAMERA_ACTIONS.ZOOM_OUT) controls.dollyOut(1.18);
    controls.update();
  }, [actionToken]);

  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: DEFAULT_CAMERA_POSITION, fov: 29 }}>
      <color attach="background" args={["#0f0f16"]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[4.5, 6.5, 5.5]} intensity={1.45} />
      <directionalLight position={[-3, 2, 2]} intensity={0.7} />
      <directionalLight position={[0, -2, 3]} intensity={0.25} />
      <group position={[0, -0.18, 0]}>
        <MannequinBase />
        <MannequinClothing grouped={grouped} textures={textures} />
        {showCallouts && <ClothingCallouts grouped={grouped} onDragChange={handleDrag} />}
      </group>
      <OrbitControls ref={controlsRef} enabled={orbitEnabled} enablePan={false}
        minDistance={6.6} maxDistance={12.5} minPolarAngle={0.9} maxPolarAngle={2.2}
        target={DEFAULT_CAMERA_TARGET} />
    </Canvas>
  );
}

// ── Fallback ───────────────────────────────────────────────────────

function FallbackPreview({ outfit, unsupported, skipped }) {
  return (
    <div className="mannequinPreviewFallback">
      <div className="mannequinPreviewFallbackTitle">2D outfit summary</div>
      <div className="mannequinPreviewFallbackText">
        The live mannequin is unavailable here, so FitGPT is showing a styled summary of the outfit pieces instead.
      </div>
      <div className="mannequinPreviewThumbGrid">
        {(Array.isArray(outfit) ? outfit : []).map((item) => (
          <div key={item?.id || item?.name} className="mannequinPreviewThumbTile">
            {item?.image_url
              ? <img className="mannequinPreviewThumbImg" src={item.image_url} alt={item?.name || "Outfit item"} />
              : <div className="mannequinPreviewThumbPh" aria-hidden="true" />}
            <div className="mannequinPreviewThumbName">{item?.name || "Item"}</div>
          </div>
        ))}
      </div>
      {unsupported.length ? <div className="mannequinPreviewUnsupported">Skipped: {unsupported.map(describeUnsupported).join(", ")}.</div> : null}
      {skipped.length ? <div className="mannequinPreviewUnsupported">Styling note: {skipped.map((i) => i?.name || "Item").join(", ")} did not fit the same mannequin layer.</div> : null}
    </div>
  );
}

function roleName(role) {
  return { top: "Top", outerwear: "Outerwear", bottom: "Bottom", shoes: "Shoes", onePiece: "One-piece" }[role] || "Layer";
}

// ── Main export ────────────────────────────────────────────────────

export default function OutfitMannequinPreview({ isOpen, onClose, outfit = [], title = "3D Outfit Preview", subtitle = "View on mannequin" }) {
  const [textures, setTextures] = useState({});
  const [loading, setLoading] = useState(false);
  const [textureError, setTextureError] = useState("");
  const [actionToken, setActionToken] = useState({ type: "", tick: 0 });
  const [showCallouts, setShowCallouts] = useState(true);
  const canUseWebGL = useMemo(() => supportsWebGL(), []);

  const previewData = useMemo(() => groupPreviewItems(outfit), [outfit]);
  const supportedItems = useMemo(() => Object.values(previewData.grouped).filter(Boolean), [previewData]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const imageItems = supportedItems.filter((item) => item?.image_url);
    setTextures({});
    setTextureError("");
    if (!imageItems.length) { setLoading(false); return undefined; }
    setLoading(true);
    Promise.all(imageItems.map((item) => new Promise((resolve) => {
      loader.load(item.image_url, (texture) => {
        if ("colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        resolve([item.id, texture]);
      }, undefined, () => resolve([item.id, null]));
    }))).then((pairs) => {
      if (cancelled) return;
      const next = {};
      let failed = 0;
      pairs.forEach(([id, tex]) => { if (tex) next[id] = tex; else failed += 1; });
      setTextures(next);
      if (failed > 0) setTextureError("Some clothing images could not load — those layers use fallback colors.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, supportedItems]);

  if (!isOpen) return null;

  const triggerAction = (type) => setActionToken({ type, tick: Date.now() });
  const conflictNote = previewData.conflicts[0];

  return ReactDOM.createPortal(
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="mannequin-preview-title" onClick={onClose}>
      <div className="modalCard mannequinPreviewModalCard" onClick={(e) => e.stopPropagation()}>
        <div className="mannequinPreviewHeader">
          <div>
            <div className="mannequinPreviewEyebrow">{subtitle}</div>
            <h2 id="mannequin-preview-title" className="modalTitle mannequinPreviewTitle">{title}</h2>
            <div className="modalSub mannequinPreviewSub">Drag to rotate · Scroll to zoom · Use controls below.</div>
          </div>
          <button type="button" className="btnSecondary mannequinPreviewClose" onClick={onClose}>Close</button>
        </div>

        <div className="mannequinPreviewBody">
          <div className="mannequinPreviewCanvasCard" aria-label="3D mannequin preview area">
            {loading ? <div className="mannequinPreviewLoading">Preparing 3D preview...</div> : null}
            {!canUseWebGL ? (
              <FallbackPreview outfit={outfit} unsupported={previewData.unsupported} skipped={previewData.skipped} />
            ) : (
              <ErrorBoundary
                resetKey={`${supportedItems.map((i) => i?.id).join("|")}|${loading}|${actionToken.tick}`}
                fallback={<FallbackPreview outfit={outfit} unsupported={previewData.unsupported} skipped={previewData.skipped} />}
              >
                <div className={"mannequinPreviewCanvasWrap" + (loading ? " isLoading" : "")}>
                  <MannequinCanvas grouped={previewData.grouped} textures={textures} actionToken={actionToken} showCallouts={showCallouts} />
                </div>
              </ErrorBoundary>
            )}

            <div className="mannequinPreviewControls" aria-label="Preview controls">
              <button type="button" className="mannequinPreviewControlBtn" onClick={() => triggerAction(CAMERA_ACTIONS.ROTATE_LEFT)}>Rotate left</button>
              <button type="button" className="mannequinPreviewControlBtn" onClick={() => triggerAction(CAMERA_ACTIONS.ROTATE_RIGHT)}>Rotate right</button>
              <button type="button" className="mannequinPreviewControlBtn" onClick={() => triggerAction(CAMERA_ACTIONS.ZOOM_IN)}>Zoom in</button>
              <button type="button" className="mannequinPreviewControlBtn" onClick={() => triggerAction(CAMERA_ACTIONS.ZOOM_OUT)}>Zoom out</button>
              <button type="button" className="mannequinPreviewControlBtn isAccent" onClick={() => triggerAction(CAMERA_ACTIONS.RESET)}>Reset view</button>
              <button type="button" className="mannequinPreviewControlBtn" onClick={() => setShowCallouts((p) => !p)}>
                {showCallouts ? "Hide labels" : "Show labels"}
              </button>
            </div>
          </div>

          <aside className="mannequinPreviewInfoCard">
            <div className="mannequinPreviewSection">
              <div className="mannequinPreviewSectionTitle">Preview status</div>
              <div className="mannequinPreviewStatusRow">
                <span className="mannequinPreviewStatusPill">{supportedItems.length} styled layer{supportedItems.length === 1 ? "" : "s"}</span>
                <span className="mannequinPreviewStatusPill muted">{previewData.unsupported.length + previewData.skipped.length} summarized</span>
              </div>
              {textureError ? <div className="mannequinPreviewNotice">{textureError}</div> : null}
              {previewData.supportedCount === 0 ? <div className="mannequinPreviewNotice">No supported garment layers yet — add a top, bottom, one-piece, outerwear, or shoes.</div> : null}
              {conflictNote ? <div className="mannequinPreviewNotice">{roleName(conflictNote.role)} layering was simplified. {conflictNote.reason || `${conflictNote.kept?.name || "One item"} takes priority.`}</div> : null}
            </div>

            <div className="mannequinPreviewSection">
              <div className="mannequinPreviewSectionTitle">Applied to mannequin</div>
              <div className="mannequinPreviewRoleList">
                {[{ key: "top", label: "Top" }, { key: "bottom", label: "Bottom" }, { key: "onePiece", label: "One-piece" }, { key: "outerwear", label: "Outerwear" }, { key: "shoes", label: "Shoes" }].map((entry) => {
                  const item = previewData.grouped[entry.key];
                  return (
                    <div key={entry.key} className="mannequinPreviewRoleRow">
                      <span className="mannequinPreviewRoleLabel">{entry.label}</span>
                      <span className="mannequinPreviewRoleValue">{item?.name || "Not used"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mannequinPreviewSection">
              <div className="mannequinPreviewSectionTitle">Skipped from 3D view</div>
              {previewData.unsupported.length || previewData.skipped.length ? (
                <div className="mannequinPreviewItemList">
                  {[...previewData.skipped, ...previewData.unsupported].map((item) => (
                    <div key={item?.id || item?.name} className="mannequinPreviewItemRow">
                      <span className="mannequinPreviewItemDot isMuted" />
                      <span className="mannequinPreviewItemText">{describeUnsupported(item)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mannequinPreviewNotice mannequinPreviewNoticeSubtle">Everything maps cleanly into the current preview.</div>
              )}
            </div>

            <div className="mannequinPreviewSection">
              <div className="mannequinPreviewSectionTitle">Full outfit</div>
              <div className="mannequinPreviewItemList">
                {(Array.isArray(outfit) ? outfit : []).map((item) => (
                  <div key={item?.id || item?.name} className="mannequinPreviewItemRow">
                    <span className="mannequinPreviewItemDot" style={{ background: primaryColorHex(item?.color) }} />
                    <span className="mannequinPreviewItemText">{item?.name || "Item"}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
}
