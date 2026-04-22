// 3D mannequin preview modal for visualizing outfit combinations.
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import ErrorBoundary from "./ErrorBoundary";

const DEFAULT_CAMERA_POSITION = [0, 0.22, 7.8];
const DEFAULT_CAMERA_TARGET = [0, -0.18, 0];

const COLOR_MAP = {
  black: "#1e1e22",
  white: "#f5f1ec",
  gray: "#7f8793",
  grey: "#7f8793",
  navy: "#304965",
  blue: "#4f75c9",
  red: "#bc4a45",
  burgundy: "#7f3040",
  maroon: "#7f3040",
  pink: "#d889a1",
  purple: "#7a67bf",
  green: "#5d8d63",
  olive: "#74804e",
  yellow: "#dfb34f",
  orange: "#d98645",
  beige: "#d9c1a0",
  tan: "#b99772",
  brown: "#775a43",
  cream: "#ece1d2",
  denim: "#5976a3",
};

const CAMERA_ACTIONS = {
  ROTATE_LEFT: "rotate-left",
  ROTATE_RIGHT: "rotate-right",
  ZOOM_IN: "zoom-in",
  ZOOM_OUT: "zoom-out",
  RESET: "reset",
};

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function primaryColorHex(rawColor) {
  const first = (rawColor || "").toString().split(",")[0].trim().toLowerCase();
  return COLOR_MAP[first] || "#b48d74";
}

function buildSearchText(item) {
  return [
    item?.category,
    item?.clothing_type,
    item?.clothingType,
    item?.layer_type,
    item?.layerType,
    item?.type,
    item?.name,
    item?.tags,
  ]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function previewRole(item) {
  const category = normalizeText(item?.category);
  const clothingType = normalizeText(item?.clothing_type || item?.clothingType || item?.type || item?.name);
  const layerType = normalizeText(item?.layer_type || item?.layerType);

  if (clothingType.includes("dress") || clothingType.includes("jumpsuit") || clothingType.includes("romper")) return "onePiece";
  if (category === "shoes" || category === "shoe" || clothingType.includes("shoe") || clothingType.includes("sneaker") || clothingType.includes("boot")) return "shoes";
  if (category === "outerwear" || layerType === "outer" || clothingType.includes("jacket") || clothingType.includes("coat") || clothingType.includes("blazer") || clothingType.includes("cardigan")) return "outerwear";
  if (category === "tops" || category === "top") return "top";
  if (category === "bottoms" || category === "bottom" || clothingType.includes("pants") || clothingType.includes("jeans") || clothingType.includes("skirt") || clothingType.includes("shorts")) return "bottom";
  return "";
}

function garmentFamily(item, role) {
  const text = buildSearchText(item);

  if (role === "onePiece") {
    if (text.includes("jumpsuit") || text.includes("romper")) return "jumpsuit";
    return "dress";
  }
  if (role === "outerwear") {
    if (text.includes("coat") || text.includes("trench")) return "coat";
    if (text.includes("blazer")) return "blazer";
    return "jacket";
  }
  if (role === "top") {
    if (text.includes("tank") || text.includes("cami")) return "fitted-top";
    if (text.includes("sweater") || text.includes("hoodie") || text.includes("crewneck")) return "sweater-top";
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
  if (item?.not_rendered_reason) {
    return `${item?.name || "Item"} (${item.not_rendered_reason})`;
  }
  const role = previewRole(item);
  if (role) return item?.name || "Item";
  return `${item?.name || "Item"} (Accessory preview coming soon)`;
}

function groupPreviewItems(outfit) {
  const roles = ["top", "outerwear", "bottom", "shoes", "onePiece"];
  const buckets = {
    top: [],
    outerwear: [],
    bottom: [],
    shoes: [],
    onePiece: [],
  };
  const unsupported = [];
  const skipped = [];
  const conflicts = [];

  (Array.isArray(outfit) ? outfit : []).forEach((item) => {
    const role = previewRole(item);
    if (!role) {
      unsupported.push(item);
      return;
    }
    buckets[role].push(item);
  });

  const grouped = {
    top: buckets.top[0] || null,
    outerwear: buckets.outerwear[0] || null,
    bottom: buckets.bottom[0] || null,
    shoes: buckets.shoes[0] || null,
    onePiece: buckets.onePiece[0] || null,
  };

  roles.forEach((role) => {
    if (buckets[role].length > 1) {
      conflicts.push({
        role,
        kept: buckets[role][0],
        skipped: buckets[role].slice(1),
      });
      skipped.push(...buckets[role].slice(1));
    }
  });

  if (grouped.onePiece) {
    if (grouped.top) {
      skipped.push(grouped.top);
      conflicts.push({
        role: "top",
        kept: grouped.onePiece,
        skipped: [grouped.top],
        reason: "One-piece styling takes over the base outfit silhouette.",
      });
    }
    if (grouped.bottom) {
      skipped.push(grouped.bottom);
      conflicts.push({
        role: "bottom",
        kept: grouped.onePiece,
        skipped: [grouped.bottom],
        reason: "One-piece styling takes over the base outfit silhouette.",
      });
    }
    grouped.top = null;
    grouped.bottom = null;
  }

  return {
    grouped,
    unsupported,
    skipped,
    conflicts,
    supportedCount: Object.values(grouped).filter(Boolean).length,
  };
}

function GarmentMaterial({ color, texture, opacity = 0.98 }) {
  return (
    <meshStandardMaterial
      color={color}
      map={texture || null}
      transparent={Boolean(texture)}
      alphaTest={texture ? 0.22 : 0}
      opacity={opacity}
      roughness={0.92}
      metalness={0.04}
    />
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

function MannequinBase() {
  return (
    <group>
      <mesh position={[0, 2.62, 0]}>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshStandardMaterial color="#e3d5ca" roughness={0.96} metalness={0.02} />
      </mesh>

      <mesh position={[0, 1.48, 0]}>
        <cylinderGeometry args={[0.58, 0.76, 1.72, 24]} />
        <meshStandardMaterial color="#d2c3b7" roughness={0.98} metalness={0.02} />
      </mesh>

      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.92, 0.82, 0.46]} />
        <meshStandardMaterial color="#c7b8ab" roughness={0.98} metalness={0.02} />
      </mesh>

      <mesh position={[-0.86, 1.52, 0]} rotation={[0, 0, -0.18]}>
        <cylinderGeometry args={[0.13, 0.16, 1.38, 20]} />
        <meshStandardMaterial color="#d2c3b7" roughness={0.98} metalness={0.02} />
      </mesh>
      <mesh position={[0.86, 1.52, 0]} rotation={[0, 0, 0.18]}>
        <cylinderGeometry args={[0.13, 0.16, 1.38, 20]} />
        <meshStandardMaterial color="#d2c3b7" roughness={0.98} metalness={0.02} />
      </mesh>

      <mesh position={[-0.28, -1.05, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 1.9, 20]} />
        <meshStandardMaterial color="#cec0b4" roughness={0.98} metalness={0.02} />
      </mesh>
      <mesh position={[0.28, -1.05, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 1.9, 20]} />
        <meshStandardMaterial color="#cec0b4" roughness={0.98} metalness={0.02} />
      </mesh>

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

function TopGarment({ item, texture, zOffset = 0.03 }) {
  const color = primaryColorHex(item?.color);
  const family = garmentFamily(item, "top");

  if (family === "fitted-top") {
    return (
      <group>
        <CylinderPart args={[0.5, 0.62, 1.2, 24]} position={[0, 1.56, zOffset]} color={color} texture={texture} />
        <CylinderPart args={[0.11, 0.13, 0.82, 20]} position={[-0.82, 1.56, zOffset]} rotation={[0, 0, -0.24]} color={color} texture={texture} />
        <CylinderPart args={[0.11, 0.13, 0.82, 20]} position={[0.82, 1.56, zOffset]} rotation={[0, 0, 0.24]} color={color} texture={texture} />
      </group>
    );
  }

  if (family === "structured-top") {
    return (
      <group>
        <BoxPart args={[1.05, 1.34, 0.42]} position={[0, 1.55, zOffset]} color={color} texture={texture} />
        <BoxPart args={[0.14, 0.4, 0.1]} position={[-0.12, 2.13, zOffset + 0.03]} rotation={[0, 0, 0.18]} color="#efe7dd" texture={null} />
        <BoxPart args={[0.14, 0.4, 0.1]} position={[0.12, 2.13, zOffset + 0.03]} rotation={[0, 0, -0.18]} color="#efe7dd" texture={null} />
        <BoxPart args={[0.18, 1.08, 0.22]} position={[-0.82, 1.55, zOffset]} rotation={[0, 0, -0.14]} color={color} texture={texture} />
        <BoxPart args={[0.18, 1.08, 0.22]} position={[0.82, 1.55, zOffset]} rotation={[0, 0, 0.14]} color={color} texture={texture} />
      </group>
    );
  }

  if (family === "sweater-top") {
    return (
      <group>
        <BoxPart args={[1.16, 1.46, 0.48]} position={[0, 1.5, zOffset]} color={color} texture={texture} />
        <BoxPart args={[0.24, 1.18, 0.26]} position={[-0.84, 1.48, zOffset]} rotation={[0, 0, -0.13]} color={color} texture={texture} />
        <BoxPart args={[0.24, 1.18, 0.26]} position={[0.84, 1.48, zOffset]} rotation={[0, 0, 0.13]} color={color} texture={texture} />
      </group>
    );
  }

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
  const torsoHeight = longLength ? 1.9 : 1.56;
  const sleeveHeight = longLength ? 1.42 : 1.22;
  const hemY = longLength ? 1.22 : 1.46;

  return (
    <group>
      <BoxPart args={[1.22, torsoHeight, 0.58]} position={[0, hemY, zOffset]} color={color} texture={texture} opacity={0.99} />
      <BoxPart args={[0.28, sleeveHeight, 0.3]} position={[-0.87, 1.46, zOffset]} rotation={[0, 0, -0.14]} color={color} texture={texture} opacity={0.99} />
      <BoxPart args={[0.28, sleeveHeight, 0.3]} position={[0.87, 1.46, zOffset]} rotation={[0, 0, 0.14]} color={color} texture={texture} opacity={0.99} />
      {family === "blazer" ? (
        <>
          <BoxPart args={[0.12, 0.5, 0.1]} position={[-0.16, 2.02, zOffset + 0.04]} rotation={[0, 0, 0.28]} color="#ece2d6" texture={null} />
          <BoxPart args={[0.12, 0.5, 0.1]} position={[0.16, 2.02, zOffset + 0.04]} rotation={[0, 0, -0.28]} color="#ece2d6" texture={null} />
        </>
      ) : null}
    </group>
  );
}

function BottomGarment({ item, texture, zOffset = 0.03 }) {
  const color = primaryColorHex(item?.color);
  const family = garmentFamily(item, "bottom");

  if (family === "skirt") {
    return (
      <group>
        <CylinderPart args={[0.52, 0.3, 1.1, 24]} position={[0, -0.18, zOffset]} color={color} texture={texture} />
      </group>
    );
  }

  if (family === "shorts") {
    return (
      <group>
        <BoxPart args={[0.46, 0.92, 0.5]} position={[-0.28, -0.48, zOffset]} color={color} texture={texture} />
        <BoxPart args={[0.46, 0.92, 0.5]} position={[0.28, -0.48, zOffset]} color={color} texture={texture} />
      </group>
    );
  }

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

  if (family === "jumpsuit") {
    return (
      <group>
        <BoxPart args={[1.14, 1.45, 0.48]} position={[0, 1.46, 0.03]} color={color} texture={texture} />
        <BoxPart args={[0.44, 1.72, 0.5]} position={[-0.28, -0.92, 0.03]} color={color} texture={texture} />
        <BoxPart args={[0.44, 1.72, 0.5]} position={[0.28, -0.92, 0.03]} color={color} texture={texture} />
      </group>
    );
  }

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

function MannequinClothing({ grouped, textures }) {
  const top = grouped.top;
  const outerwear = grouped.outerwear;
  const bottom = grouped.bottom;
  const shoes = grouped.shoes;
  const onePiece = grouped.onePiece;

  return (
    <group>
      {onePiece ? <OnePieceGarment item={onePiece} texture={textures[onePiece?.id] || null} /> : null}
      {!onePiece && top ? <TopGarment item={top} texture={textures[top?.id] || null} /> : null}
      {!onePiece && bottom ? <BottomGarment item={bottom} texture={textures[bottom?.id] || null} /> : null}
      {outerwear ? <OuterwearGarment item={outerwear} texture={textures[outerwear?.id] || null} /> : null}
      {shoes ? <ShoeGarment item={shoes} texture={textures[shoes?.id] || null} /> : null}
    </group>
  );
}

function MannequinCanvas({ grouped, textures, actionToken }) {
  const controlsRef = useRef(null);

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

    if (actionToken.type === CAMERA_ACTIONS.RESET) {
      controls.reset();
      controls.update();
      return;
    }

    // three-stdlib's OrbitControls doesn't expose rotateLeft/rotateUp on
    // its public API (only dollyIn/dollyOut). Rotate via spherical math
    // around the target so we stay on supported methods.
    const step = Math.PI / 8;
    const camera = controls.object;
    const target = controls.target;

    if (actionToken.type === CAMERA_ACTIONS.ROTATE_LEFT
      || actionToken.type === CAMERA_ACTIONS.ROTATE_RIGHT) {
      const delta = actionToken.type === CAMERA_ACTIONS.ROTATE_LEFT ? step : -step;
      const offset = new THREE.Vector3().subVectors(camera.position, target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += delta;
      offset.setFromSpherical(spherical);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
    }

    if (actionToken.type === CAMERA_ACTIONS.ZOOM_IN
      && typeof controls.dollyIn === "function") controls.dollyIn(1.18);
    if (actionToken.type === CAMERA_ACTIONS.ZOOM_OUT
      && typeof controls.dollyOut === "function") controls.dollyOut(1.18);

    controls.update();
  }, [actionToken]);

  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: DEFAULT_CAMERA_POSITION, fov: 29 }}>
      <color attach="background" args={["#121219"]} />
      <ambientLight intensity={1.55} />
      <directionalLight position={[4.5, 6.5, 5.5]} intensity={1.4} />
      <directionalLight position={[-3, 2, 2]} intensity={0.7} />
      <group position={[0, -0.18, 0]}>
        <MannequinBase />
        <MannequinClothing grouped={grouped} textures={textures} />
      </group>
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={6.6}
        maxDistance={12.5}
        minPolarAngle={0.9}
        maxPolarAngle={2.2}
        target={DEFAULT_CAMERA_TARGET}
      />
    </Canvas>
  );
}

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
            {item?.image_url ? (
              <img className="mannequinPreviewThumbImg" src={item.image_url} alt={item?.name || "Outfit item"} />
            ) : (
              <div className="mannequinPreviewThumbPh" aria-hidden="true" />
            )}
            <div className="mannequinPreviewThumbName">{item?.name || "Item"}</div>
          </div>
        ))}
      </div>
      {unsupported.length ? (
        <div className="mannequinPreviewUnsupported">
          Skipped from 3D preview: {unsupported.map(describeUnsupported).join(", ")}.
        </div>
      ) : null}
      {skipped.length ? (
        <div className="mannequinPreviewUnsupported">
          Styling note: {skipped.map((item) => item?.name || "Item").join(", ")} did not fit the same mannequin layer and was summarized here instead.
        </div>
      ) : null}
    </div>
  );
}

function roleName(role) {
  return (
    {
      top: "Top",
      outerwear: "Outerwear",
      bottom: "Bottom",
      shoes: "Shoes",
      onePiece: "One-piece",
    }[role] || "Layer"
  );
}

export default function OutfitMannequinPreview({
  isOpen,
  onClose,
  outfit = [],
  title = "3D Outfit Preview",
  subtitle = "View on mannequin",
}) {
  const [textures, setTextures] = useState({});
  const [loading, setLoading] = useState(false);
  const [textureError, setTextureError] = useState("");
  const [actionToken, setActionToken] = useState({ type: "", tick: 0 });
  const canUseWebGL = useMemo(() => supportsWebGL(), []);

  const previewData = useMemo(() => groupPreviewItems(outfit), [outfit]);
  const supportedItems = useMemo(
    () => Object.values(previewData.grouped).filter(Boolean),
    [previewData]
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
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

    if (!imageItems.length) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    Promise.all(
      imageItems.map((item) =>
        new Promise((resolve) => {
          loader.load(
            item.image_url,
            (texture) => {
              if ("colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
              texture.wrapS = THREE.ClampToEdgeWrapping;
              texture.wrapT = THREE.ClampToEdgeWrapping;
              texture.minFilter = THREE.LinearFilter;
              texture.magFilter = THREE.LinearFilter;
              resolve([item.id, texture]);
            },
            undefined,
            () => resolve([item.id, null])
          );
        })
      )
    ).then((pairs) => {
      if (cancelled) return;
      const nextTextures = {};
      let failed = 0;
      pairs.forEach(([id, texture]) => {
        if (texture) nextTextures[id] = texture;
        else failed += 1;
      });
      setTextures(nextTextures);
      if (failed > 0) {
        setTextureError("Some clothing images could not load, so a few layers are shown with polished fallback colors.");
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, supportedItems]);

  if (!isOpen) return null;

  const triggerAction = (type) => setActionToken({ type, tick: Date.now() });
  const conflictNote = previewData.conflicts[0];

  return ReactDOM.createPortal(
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="mannequin-preview-title" onClick={onClose}>
      <div className="modalCard mannequinPreviewModalCard" onClick={(event) => event.stopPropagation()}>
        <div className="mannequinPreviewHeader">
          <div>
            <div className="mannequinPreviewEyebrow">{subtitle}</div>
            <h2 id="mannequin-preview-title" className="modalTitle mannequinPreviewTitle">{title}</h2>
            <div className="modalSub mannequinPreviewSub">
              Drag to rotate, scroll to zoom, or use the controls below to inspect the full look.
            </div>
          </div>
          <button type="button" className="btnSecondary mannequinPreviewClose" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mannequinPreviewBody">
          <div className="mannequinPreviewCanvasCard" aria-label="3D mannequin preview area">
            {loading ? <div className="mannequinPreviewLoading">Preparing 3D preview...</div> : null}
            {!canUseWebGL ? (
              <FallbackPreview outfit={outfit} unsupported={previewData.unsupported} skipped={previewData.skipped} />
            ) : (
              <ErrorBoundary
                resetKey={`${supportedItems.map((item) => item?.id).join("|")}|${loading}|${actionToken.tick}`}
                fallback={<FallbackPreview outfit={outfit} unsupported={previewData.unsupported} skipped={previewData.skipped} />}
              >
                <div className={"mannequinPreviewCanvasWrap" + (loading ? " isLoading" : "")}>
                  <MannequinCanvas grouped={previewData.grouped} textures={textures} actionToken={actionToken} />
                </div>
              </ErrorBoundary>
            )}
            <div className="mannequinPreviewControls" aria-label="Preview controls">
              <button
                type="button"
                className="mannequinPreviewControlBtn"
                onClick={() => triggerAction(CAMERA_ACTIONS.ROTATE_LEFT)}
                title="Rotate left"
                aria-label="Rotate left"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <polyline points="3 4 3 9 8 9" />
                </svg>
                <span>Rotate L</span>
              </button>
              <button
                type="button"
                className="mannequinPreviewControlBtn"
                onClick={() => triggerAction(CAMERA_ACTIONS.ROTATE_RIGHT)}
                title="Rotate right"
                aria-label="Rotate right"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-3-6.7" />
                  <polyline points="21 4 21 9 16 9" />
                </svg>
                <span>Rotate R</span>
              </button>
              <button
                type="button"
                className="mannequinPreviewControlBtn"
                onClick={() => triggerAction(CAMERA_ACTIONS.ZOOM_IN)}
                title="Zoom in"
                aria-label="Zoom in"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
                <span>Zoom in</span>
              </button>
              <button
                type="button"
                className="mannequinPreviewControlBtn"
                onClick={() => triggerAction(CAMERA_ACTIONS.ZOOM_OUT)}
                title="Zoom out"
                aria-label="Zoom out"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
                <span>Zoom out</span>
              </button>
              <button
                type="button"
                className="mannequinPreviewControlBtn isAccent"
                onClick={() => triggerAction(CAMERA_ACTIONS.RESET)}
                title="Reset view"
                aria-label="Reset view"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                <span>Reset</span>
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
              {previewData.supportedCount === 0 ? (
                <div className="mannequinPreviewNotice">
                  This look does not include a supported top, bottom, outerwear, one-piece, or shoes item yet, so the mannequin can only show the summary view.
                </div>
              ) : null}
              {conflictNote ? (
                <div className="mannequinPreviewNotice">
                  {roleName(conflictNote.role)} layering was simplified for this preview. {conflictNote.reason || `${conflictNote.kept?.name || "One item"} takes priority over ${conflictNote.skipped.map((item) => item?.name || "another item").join(", ")}.`}
                </div>
              ) : null}
            </div>

            <div className="mannequinPreviewSection">
              <div className="mannequinPreviewSectionTitle">Applied to mannequin</div>
              <div className="mannequinPreviewRoleList">
                {[
                  { key: "top", label: "Top" },
                  { key: "bottom", label: "Bottom" },
                  { key: "onePiece", label: "One-piece" },
                  { key: "outerwear", label: "Outerwear" },
                  { key: "shoes", label: "Shoes" },
                ].map((entry) => {
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
                <div className="mannequinPreviewNotice mannequinPreviewNoticeSubtle">
                  Everything in this outfit maps cleanly into the current mannequin preview.
                </div>
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
