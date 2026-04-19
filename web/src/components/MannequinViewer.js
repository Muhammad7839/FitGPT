import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { colorToCss, normalizeCategory } from "../utils/recommendationEngine";
import { getItemSlot, slotLabel, SLOTS, validateOutfit } from "../utils/outfitLayering";

function normalizeDisplayColor(value) {
  const css = colorToCss(value || "");
  if (typeof css === "string" && css.startsWith("linear-gradient")) {
    const match = css.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : "#9ca3af";
  }

  try {
    // Validate that Three.js can parse the color before returning it.
    new THREE.Color(css || "#9ca3af");
    return css || "#9ca3af";
  } catch {
    return "#9ca3af";
  }
}

function bodyScaleForType(bodyType) {
  const key = (bodyType || "").toString().trim().toLowerCase();

  switch (key) {
    case "triangle":
    case "pear":
      return { shoulders: 0.94, hips: 1.12 };
    case "inverted triangle":
      return { shoulders: 1.12, hips: 0.92 };
    case "hourglass":
      return { shoulders: 1.03, hips: 1.02 };
    case "apple":
    case "oval":
      return { shoulders: 1.02, hips: 1.0 };
    default:
      return { shoulders: 1, hips: 1 };
  }
}

function SlowSpin({ children }) {
  const groupRef = useRef(null);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.12;
  });

  return <group ref={groupRef}>{children}</group>;
}

function Body({ scale }) {
  return (
    <group position={[0, -0.25, 0]}>
      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshStandardMaterial color="#d4c4b0" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.18, 0]} scale={[scale.shoulders, 1.15, 0.82]}>
        <capsuleGeometry args={[0.18, 0.46, 8, 18]} />
        <meshStandardMaterial color="#cbb8a2" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.78, 0]} scale={[scale.hips, 1, 0.85]}>
        <capsuleGeometry args={[0.17, 0.16, 8, 14]} />
        <meshStandardMaterial color="#c6b29b" roughness={0.88} />
      </mesh>
      {[-0.28, 0.28].map((x) => (
        <mesh key={`arm-${x}`} position={[x * scale.shoulders, 1.16, 0]} rotation={[0, 0, x < 0 ? 0.22 : -0.22]}>
          <capsuleGeometry args={[0.05, 0.54, 8, 14]} />
          <meshStandardMaterial color="#cbb8a2" roughness={0.88} />
        </mesh>
      ))}
      {[-0.11, 0.11].map((x) => (
        <mesh key={`leg-${x}`} position={[x * scale.hips, 0.28, 0]}>
          <capsuleGeometry args={[0.07, 0.72, 8, 14]} />
          <meshStandardMaterial color="#c1ab93" roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

function OutfitMeshes({ slots, scale }) {
  const top = slots[SLOTS.OUTER_TOP] || slots[SLOTS.MID_TOP] || slots[SLOTS.BASE_TOP];
  const onePiece = slots[SLOTS.ONE_PIECE];
  const bottom = slots[SLOTS.BOTTOM];
  const shoes = slots[SLOTS.SHOES];
  const headwear = slots[SLOTS.HEADWEAR];
  const accessories = Array.isArray(slots.accessories) ? slots.accessories : [];

  return (
    <group position={[0, -0.25, 0]}>
      {top ? (
        <mesh position={[0, 1.18, 0.04]} scale={[scale.shoulders * 1.08, 1.08, 0.88]}>
          <capsuleGeometry args={[0.2, 0.42, 8, 18]} />
          <meshStandardMaterial color={normalizeDisplayColor(top.color)} roughness={0.72} />
        </mesh>
      ) : null}

      {onePiece ? (
        <mesh position={[0, 0.92, 0.05]} scale={[scale.shoulders * 1.05, 1.42, 0.9]}>
          <capsuleGeometry args={[0.2, 0.72, 8, 18]} />
          <meshStandardMaterial color={normalizeDisplayColor(onePiece.color)} roughness={0.72} />
        </mesh>
      ) : null}

      {!onePiece && bottom ? (
        <group>
          {[-0.11, 0.11].map((x) => (
            <mesh key={`bottom-${x}`} position={[x * scale.hips, 0.3, 0.03]}>
              <capsuleGeometry args={[0.078, 0.68, 8, 14]} />
              <meshStandardMaterial color={normalizeDisplayColor(bottom.color)} roughness={0.74} />
            </mesh>
          ))}
          <mesh position={[0, 0.74, 0.04]} scale={[scale.hips, 1, 1]}>
            <boxGeometry args={[0.34, 0.18, 0.18]} />
            <meshStandardMaterial color={normalizeDisplayColor(bottom.color)} roughness={0.74} />
          </mesh>
        </group>
      ) : null}

      {shoes ? (
        <>
          {[-0.11, 0.11].map((x) => (
            <mesh key={`shoe-${x}`} position={[x * scale.hips, -0.17, 0.05]}>
              <boxGeometry args={[0.14, 0.08, 0.28]} />
              <meshStandardMaterial color={normalizeDisplayColor(shoes.color)} roughness={0.65} />
            </mesh>
          ))}
        </>
      ) : null}

      {headwear ? (
        <mesh position={[0, 1.67, 0]}>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color={normalizeDisplayColor(headwear.color)} roughness={0.7} />
        </mesh>
      ) : null}

      {accessories.slice(0, 2).map((item, index) => (
        <mesh key={`accessory-${item.id ?? index}`} position={[index === 0 ? -0.18 : 0.18, 0.98, 0.16]}>
          <torusGeometry args={[0.07, 0.014, 10, 28]} />
          <meshStandardMaterial color={normalizeDisplayColor(item.color)} roughness={0.58} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function ViewerScene({ outfit, bodyType }) {
  const scale = useMemo(() => bodyScaleForType(bodyType), [bodyType]);
  const validation = useMemo(() => validateOutfit(outfit), [outfit]);

  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[4, 5, 4]} intensity={1.35} />
      <directionalLight position={[-3, 2, 1]} intensity={0.45} />
      <SlowSpin>
        <Body scale={scale} />
        <OutfitMeshes
          scale={scale}
          slots={{
            ...validation.bySlot,
            accessories: validation.accessories,
          }}
        />
      </SlowSpin>
      <OrbitControls enablePan={false} minDistance={3.2} maxDistance={6.2} />
    </>
  );
}

function legendEntries(outfit) {
  return (Array.isArray(outfit) ? outfit : [])
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      name: item.name || "Unnamed item",
      category: slotLabel(getItemSlot(item)) || normalizeCategory(item.category) || "item",
      imageUrl: item.image_url || "",
    }));
}

export default function MannequinViewer({ outfit = [], bodyType = "rectangle" }) {
  const validation = useMemo(() => validateOutfit(outfit), [outfit]);
  const entries = useMemo(() => legendEntries(outfit).slice(0, 4), [outfit]);

  return (
    <div className="mannequinViewerContainer">
      <Canvas camera={{ position: [0, 1.2, 4.2], fov: 34 }}>
        <ViewerScene outfit={outfit} bodyType={bodyType} />
      </Canvas>

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
              {entry.imageUrl ? (
                <img className="mannequinLegendThumb" src={entry.imageUrl} alt="" />
              ) : (
                <div className="mannequinLegendThumb mannequinLegendPlaceholder" />
              )}
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
