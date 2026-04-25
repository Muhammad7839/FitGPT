import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { colorToCss, normalizeCategory } from "../utils/recommendationEngine";
import { getItemSlot, slotLabel, SLOTS, validateOutfit } from "../utils/outfitLayering";

function isWebGLAvailable() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch { return false; }
}

class MannequinCanvasBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { if (typeof this.props.onError === "function") this.props.onError(); }
  render() { return this.state.hasError ? (this.props.fallback ?? null) : this.props.children; }
}

function normalizeDisplayColor(value) {
  const css = colorToCss(value || "");
  if (typeof css === "string" && css.startsWith("linear-gradient")) {
    const match = css.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : "#9ca3af";
  }
  try { new THREE.Color(css || "#9ca3af"); return css || "#9ca3af"; }
  catch { return "#9ca3af"; }
}

function bodyScaleForType(bodyType) {
  switch ((bodyType || "").toString().trim().toLowerCase()) {
    case "triangle": case "pear":        return { shoulders: 0.93, hips: 1.11 };
    case "inverted triangle":            return { shoulders: 1.11, hips: 0.92 };
    case "hourglass":                    return { shoulders: 1.03, hips: 1.02 };
    case "apple": case "oval":           return { shoulders: 1.02, hips: 1.0 };
    default:                             return { shoulders: 1, hips: 1 };
  }
}

function SlowSpin({ children }) {
  const groupRef = useRef(null);
  useFrame((_state, delta) => { if (groupRef.current) groupRef.current.rotation.y += delta * 0.12; });
  return <group ref={groupRef}>{children}</group>;
}

// ── Improved body with waist definition and smooth limbs ────────────

function Body({ scale }) {
  return (
    <group position={[0, -0.25, 0]}>
      {/* Head */}
      <mesh position={[0, 1.46, 0]}>
        <sphereGeometry args={[0.165, 32, 32]} />
        <meshStandardMaterial color="#e0d2c2" roughness={0.88} metalness={0.02} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.24, 0]}>
        <capsuleGeometry args={[0.065, 0.12, 8, 16]} />
        <meshStandardMaterial color="#ddd0be" roughness={0.9} metalness={0.02} />
      </mesh>
      {/* Chest */}
      <mesh position={[0, 1.11, 0]} scale={[scale.shoulders, 1, 0.82]}>
        <cylinderGeometry args={[0.22, 0.2, 0.38, 28]} />
        <meshStandardMaterial color="#cebfa9" roughness={0.95} metalness={0.02} />
      </mesh>
      {/* Waist — narrower */}
      <mesh position={[0, 0.86, 0]} scale={[scale.shoulders * 0.88, 1, 0.78]}>
        <cylinderGeometry args={[0.17, 0.19, 0.28, 28]} />
        <meshStandardMaterial color="#c8b9a3" roughness={0.96} metalness={0.02} />
      </mesh>
      {/* Hips */}
      <mesh position={[0, 0.68, 0]} scale={[scale.hips, 1, 0.85]}>
        <cylinderGeometry args={[0.21, 0.22, 0.28, 28]} />
        <meshStandardMaterial color="#c4b49d" roughness={0.97} metalness={0.02} />
      </mesh>
      {/* Pelvis bridge */}
      <mesh position={[0, 0.54, 0]} scale={[scale.hips, 1, 0.82]}>
        <boxGeometry args={[0.36, 0.14, 0.2]} />
        <meshStandardMaterial color="#c0b099" roughness={0.97} metalness={0.02} />
      </mesh>
      {/* Arms */}
      {[-0.31 * scale.shoulders, 0.31 * scale.shoulders].map((x, i) => (
        <mesh key={`arm-${i}`} position={[x, 1.06, 0]} rotation={[0, 0, x < 0 ? 0.22 : -0.22]}>
          <capsuleGeometry args={[0.058, 0.52, 8, 16]} />
          <meshStandardMaterial color="#cbb9a4" roughness={0.92} metalness={0.02} />
        </mesh>
      ))}
      {/* Hands */}
      {[-0.335 * scale.shoulders, 0.335 * scale.shoulders].map((x, i) => (
        <mesh key={`hand-${i}`} position={[x, 0.72, 0.02]}>
          <sphereGeometry args={[0.062, 14, 14]} />
          <meshStandardMaterial color="#cfc0ac" roughness={0.9} metalness={0.02} />
        </mesh>
      ))}
      {/* Legs */}
      {[-0.115 * scale.hips, 0.115 * scale.hips].map((x, i) => (
        <mesh key={`leg-${i}`} position={[x, 0.24, 0]}>
          <capsuleGeometry args={[0.075, 0.72, 8, 16]} />
          <meshStandardMaterial color="#bfb09a" roughness={0.97} metalness={0.02} />
        </mesh>
      ))}
      {/* Feet */}
      {[-0.115 * scale.hips, 0.115 * scale.hips].map((x, i) => (
        <mesh key={`foot-${i}`} position={[x, -0.21, 0.07]}>
          <boxGeometry args={[0.14, 0.07, 0.3]} />
          <meshStandardMaterial color="#b0a18c" roughness={0.99} metalness={0.01} />
        </mesh>
      ))}
    </group>
  );
}

// ── Outfit meshes — image plane when photo available, colored shape fallback ──

function GarmentPlane({ texture, position, width, height }) {
  if (!texture) return null;
  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} transparent alphaTest={0.06} roughness={0.88} />
    </mesh>
  );
}

function OutfitMeshes({ slots, scale, textures }) {
  const top      = slots[SLOTS.OUTER_TOP] || slots[SLOTS.MID_TOP] || slots[SLOTS.BASE_TOP];
  const onePiece = slots[SLOTS.ONE_PIECE];
  const bottom   = slots[SLOTS.BOTTOM];
  const shoes    = slots[SLOTS.SHOES];
  const headwear = slots[SLOTS.HEADWEAR];
  const accessories = Array.isArray(slots.accessories) ? slots.accessories : [];

  return (
    <group position={[0, -0.25, 0]}>
      {/* One-piece */}
      {onePiece ? (
        textures[onePiece.id]
          ? <GarmentPlane texture={textures[onePiece.id]} position={[0, 0.82, 0.22]} width={0.44} height={1.12} />
          : (
            <mesh position={[0, 0.88, 0.05]} scale={[scale.shoulders * 1.06, 1.46, 0.92]}>
              <capsuleGeometry args={[0.2, 0.72, 8, 18]} />
              <meshStandardMaterial color={normalizeDisplayColor(onePiece.color)} roughness={0.72} />
            </mesh>
          )
      ) : null}

      {/* Top */}
      {!onePiece && top ? (
        textures[top.id]
          ? <GarmentPlane texture={textures[top.id]} position={[0, 1.08, 0.22]} width={0.46} height={0.52} />
          : (
            <mesh position={[0, 1.11, 0.04]} scale={[scale.shoulders * 1.08, 1.08, 0.9]}>
              <capsuleGeometry args={[0.2, 0.38, 8, 18]} />
              <meshStandardMaterial color={normalizeDisplayColor(top.color)} roughness={0.72} />
            </mesh>
          )
      ) : null}

      {/* Bottom */}
      {!onePiece && bottom ? (
        textures[bottom.id]
          ? <GarmentPlane texture={textures[bottom.id]} position={[0, 0.46, 0.22]} width={0.38} height={0.7} />
          : (
            <group>
              {[-0.115 * scale.hips, 0.115 * scale.hips].map((x, i) => (
                <mesh key={`bot-${i}`} position={[x, 0.28, 0.03]}>
                  <capsuleGeometry args={[0.082, 0.68, 8, 14]} />
                  <meshStandardMaterial color={normalizeDisplayColor(bottom.color)} roughness={0.74} />
                </mesh>
              ))}
              <mesh position={[0, 0.72, 0.04]} scale={[scale.hips, 1, 1]}>
                <boxGeometry args={[0.36, 0.18, 0.18]} />
                <meshStandardMaterial color={normalizeDisplayColor(bottom.color)} roughness={0.74} />
              </mesh>
            </group>
          )
      ) : null}

      {/* Shoes */}
      {shoes ? (
        textures[shoes.id]
          ? <GarmentPlane texture={textures[shoes.id]} position={[0, -0.2, 0.15]} width={0.32} height={0.13} />
          : (
            <>
              {[-0.115 * scale.hips, 0.115 * scale.hips].map((x, i) => (
                <mesh key={`shoe-${i}`} position={[x, -0.2, 0.07]}>
                  <boxGeometry args={[0.14, 0.08, 0.3]} />
                  <meshStandardMaterial color={normalizeDisplayColor(shoes.color)} roughness={0.65} />
                </mesh>
              ))}
            </>
          )
      ) : null}

      {headwear ? (
        <mesh position={[0, 1.64, 0]}>
          <sphereGeometry args={[0.185, 24, 24]} />
          <meshStandardMaterial color={normalizeDisplayColor(headwear.color)} roughness={0.7} />
        </mesh>
      ) : null}

      {accessories.slice(0, 2).map((item, index) => (
        <mesh key={`acc-${item.id ?? index}`} position={[index === 0 ? -0.18 : 0.18, 0.96, 0.16]}>
          <torusGeometry args={[0.07, 0.014, 10, 28]} />
          <meshStandardMaterial color={normalizeDisplayColor(item.color)} roughness={0.58} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function ViewerScene({ outfit, bodyType, textures }) {
  const scale = useMemo(() => bodyScaleForType(bodyType), [bodyType]);
  const validation = useMemo(() => validateOutfit(outfit), [outfit]);

  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[4, 5, 4]} intensity={1.4} />
      <directionalLight position={[-3, 2, 1]} intensity={0.5} />
      <directionalLight position={[0, -1, 2]} intensity={0.2} />
      <SlowSpin>
        <Body scale={scale} />
        <OutfitMeshes scale={scale} slots={{ ...validation.bySlot, accessories: validation.accessories }} textures={textures} />
      </SlowSpin>
      <OrbitControls enablePan={false} minDistance={3.2} maxDistance={6.2} />
    </>
  );
}

function legendEntries(outfit) {
  return (Array.isArray(outfit) ? outfit : []).filter(Boolean).map((item) => ({
    id: item.id,
    name: item.name || "Unnamed item",
    category: slotLabel(getItemSlot(item)) || normalizeCategory(item.category) || "item",
    imageUrl: item.image_url || "",
  }));
}

function MannequinFallback() {
  return (
    <div className="mannequinViewerContainer">
      <div className="noteBox" style={{ marginTop: 0 }} role="status" aria-live="polite">
        3D preview not supported on this device
      </div>
    </div>
  );
}

export default function MannequinViewer({ outfit = [], bodyType = "rectangle" }) {
  const validation = useMemo(() => validateOutfit(outfit), [outfit]);
  const entries = useMemo(() => legendEntries(outfit).slice(0, 4), [outfit]);
  const [webglSupported, setWebglSupported] = useState(() => isWebGLAvailable());
  const [textures, setTextures] = useState({});

  // Load clothing photos as textures
  useEffect(() => {
    const imageItems = (Array.isArray(outfit) ? outfit : []).filter((item) => item?.image_url);
    if (!imageItems.length) { setTextures({}); return; }

    let cancelled = false;
    const loader = new THREE.TextureLoader();
    Promise.all(imageItems.map((item) => new Promise((resolve) => {
      loader.load(item.image_url, (tex) => {
        if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        resolve([item.id, tex]);
      }, undefined, () => resolve([item.id, null]));
    }))).then((pairs) => {
      if (cancelled) return;
      const next = {};
      pairs.forEach(([id, tex]) => { if (tex) next[id] = tex; });
      setTextures(next);
    });
    return () => { cancelled = true; };
  }, [outfit]);

  const createRenderer = useCallback((defaults) => {
    if (!isWebGLAvailable()) { setWebglSupported(false); throw new Error("WebGL not supported"); }
    try { return new THREE.WebGLRenderer({ ...defaults, antialias: true }); }
    catch (error) { setWebglSupported(false); throw error; }
  }, []);

  if (!webglSupported) return <MannequinFallback />;

  return (
    <div className="mannequinViewerContainer">
      <MannequinCanvasBoundary fallback={<MannequinFallback />} onError={() => setWebglSupported(false)}>
        <Canvas camera={{ position: [0, 1.2, 4.2], fov: 34 }} gl={createRenderer}>
          <ViewerScene outfit={outfit} bodyType={bodyType} textures={textures} />
        </Canvas>
      </MannequinCanvasBoundary>

      {validation.conflicts.length > 0 ? (
        <div className="mannequinConflictBanner" role="status">
          <div className="mannequinConflictIcon">!</div>
          <ul className="mannequinConflictList">
            {validation.conflicts.slice(0, 2).map((conflict, index) => (
              <li key={`${conflict.type}-${index}`}>{conflict.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="mannequinLegend" aria-hidden="true">
          {entries.map((entry) => (
            <div key={entry.id || entry.name} className="mannequinLegendItem">
              {entry.imageUrl
                ? <img className="mannequinLegendThumb" src={entry.imageUrl} alt="" />
                : <div className="mannequinLegendThumb mannequinLegendPlaceholder" />}
              <div className="mannequinLegendInfo">
                <div className="mannequinLegendName">{entry.name}</div>
                <div className="mannequinLegendCat">{entry.category}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mannequinHint">Drag to rotate</div>
    </div>
  );
}
