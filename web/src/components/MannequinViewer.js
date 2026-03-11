// web/src/components/MannequinViewer.js
import React, { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ─── Load a texture from a data-url / src ─── */
function useClothingTexture(imageUrl) {
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    if (!imageUrl) { setTexture(null); return; }
    const loader = new THREE.TextureLoader();
    const tex = loader.load(imageUrl, (t) => {
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      setTexture(t);
    });
    return () => { if (tex) tex.dispose(); };
  }, [imageUrl]);
  return texture;
}

/* ─── Parse a css-ish colour name to a THREE.Color (best effort) ─── */
function colorToThree(colorStr) {
  if (!colorStr) return new THREE.Color("#888");
  const c = colorStr.split(",")[0].trim().toLowerCase();
  try { return new THREE.Color(c); } catch { return new THREE.Color("#888"); }
}

/* ─── Clothing shell: a slightly-larger mesh over a body zone ─── */
function ClothingShell({ geometry, position, scale, rotation, texture, fallbackColor }) {
  const mat = useMemo(() => {
    if (texture) {
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.65,
        metalness: 0,
        side: THREE.DoubleSide,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: fallbackColor || "#888",
      roughness: 0.6,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }, [texture, fallbackColor]);

  return (
    <mesh position={position} scale={scale} rotation={rotation} material={mat}>
      {geometry}
    </mesh>
  );
}

/* ─── Mannequin with clothes ON the body ─── */
function DressedMannequin({ bodyType, clothingMap }) {
  const group = useRef();

  const bodyScale = useMemo(() => {
    switch (bodyType) {
      case "inverted_triangle": return { shoulders: 1.2, torso: 1, hips: 0.85 };
      case "triangle":         return { shoulders: 0.85, torso: 1, hips: 1.15 };
      case "hourglass":        return { shoulders: 1.1, torso: 0.85, hips: 1.1 };
      case "oval":             return { shoulders: 1, torso: 1.15, hips: 1.05 };
      default:                 return { shoulders: 1, torso: 1, hips: 1 };
    }
  }, [bodyType]);

  // gentle idle rotation
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.18;
  });

  const skin = { color: "#d4c4b0", roughness: 0.7, metalness: 0.05 };
  const joint = { color: "#bfae98", roughness: 0.6, metalness: 0.1 };

  const top = clothingMap.Tops;
  const bottom = clothingMap.Bottoms;
  const outer = clothingMap.Outerwear;
  const shoes = clothingMap.Shoes;
  const acc = clothingMap.Accessories;

  // Clothing shell offset (slightly larger than body)
  const S = 1.08;

  return (
    <group ref={group}>
      {/* ── Head ── */}
      <mesh position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial {...skin} />
      </mesh>

      {/* Accessory on head (hat/scarf/glasses — wraps around head) */}
      {acc && (
        <mesh position={[0, 2.2, 0]}>
          <sphereGeometry args={[0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {acc.texture ? (
            <meshStandardMaterial map={acc.texture} roughness={0.55} side={THREE.DoubleSide} />
          ) : (
            <meshStandardMaterial color={acc.color} roughness={0.55} side={THREE.DoubleSide} />
          )}
        </mesh>
      )}

      {/* ── Neck ── */}
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.2, 12]} />
        <meshStandardMaterial {...skin} />
      </mesh>

      {/* ── Torso (bare skin underneath) ── */}
      <mesh position={[0, 1.05, 0]} scale={[bodyScale.shoulders, 1, 1]}>
        <capsuleGeometry args={[0.18, 0.9, 8, 16]} />
        <meshStandardMaterial {...skin} />
      </mesh>

      {/* Top clothing shell over torso */}
      {top && (
        <mesh position={[0, 1.05, 0]} scale={[bodyScale.shoulders * S, S, S]}>
          <capsuleGeometry args={[0.19, 0.92, 8, 16]} />
          {top.texture ? (
            <meshStandardMaterial map={top.texture} roughness={0.6} metalness={0} />
          ) : (
            <meshStandardMaterial color={top.color} roughness={0.6} metalness={0} />
          )}
        </mesh>
      )}

      {/* Outerwear shell (even larger, over the top) */}
      {outer && (
        <mesh position={[0, 1.0, 0]} scale={[bodyScale.shoulders * 1.18, 1.14, 1.18]}>
          <capsuleGeometry args={[0.21, 1.0, 8, 16]} />
          {outer.texture ? (
            <meshStandardMaterial map={outer.texture} roughness={0.5} metalness={0} transparent opacity={0.92} />
          ) : (
            <meshStandardMaterial color={outer.color} roughness={0.5} metalness={0} transparent opacity={0.92} />
          )}
        </mesh>
      )}

      {/* Sleeve shells (if top exists, cover upper arms) */}
      {top && (
        <>
          {/* Left sleeve */}
          <group position={[-0.5 * bodyScale.shoulders, 1.45, 0]} rotation={[0, 0, 0.2]}>
            <mesh position={[0, -0.3, 0]}>
              <capsuleGeometry args={[0.07, 0.37, 6, 12]} />
              {top.texture ? (
                <meshStandardMaterial map={top.texture} roughness={0.6} />
              ) : (
                <meshStandardMaterial color={top.color} roughness={0.6} />
              )}
            </mesh>
          </group>
          {/* Right sleeve */}
          <group position={[0.5 * bodyScale.shoulders, 1.45, 0]} rotation={[0, 0, -0.2]}>
            <mesh position={[0, -0.3, 0]}>
              <capsuleGeometry args={[0.07, 0.37, 6, 12]} />
              {top.texture ? (
                <meshStandardMaterial map={top.texture} roughness={0.6} />
              ) : (
                <meshStandardMaterial color={top.color} roughness={0.6} />
              )}
            </mesh>
          </group>
        </>
      )}

      {/* ── Arms (bare skin for forearms) ── */}
      <group position={[-0.5 * bodyScale.shoulders, 1.45, 0]} rotation={[0, 0, 0.2]}>
        {!top && (
          <mesh position={[0, -0.3, 0]}>
            <capsuleGeometry args={[0.06, 0.35, 6, 12]} />
            <meshStandardMaterial {...skin} />
          </mesh>
        )}
        <mesh position={[0, -0.5, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial {...joint} />
        </mesh>
        <mesh position={[0, -0.75, 0]}>
          <capsuleGeometry args={[0.05, 0.35, 6, 12]} />
          <meshStandardMaterial {...skin} />
        </mesh>
      </group>

      <group position={[0.5 * bodyScale.shoulders, 1.45, 0]} rotation={[0, 0, -0.2]}>
        {!top && (
          <mesh position={[0, -0.3, 0]}>
            <capsuleGeometry args={[0.06, 0.35, 6, 12]} />
            <meshStandardMaterial {...skin} />
          </mesh>
        )}
        <mesh position={[0, -0.5, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial {...joint} />
        </mesh>
        <mesh position={[0, -0.75, 0]}>
          <capsuleGeometry args={[0.05, 0.35, 6, 12]} />
          <meshStandardMaterial {...skin} />
        </mesh>
      </group>

      {/* ── Hips (bare skin) ── */}
      <mesh position={[0, 0.35, 0]} scale={[bodyScale.hips, 1, 1]}>
        <capsuleGeometry args={[0.2, 0.3, 8, 16]} />
        <meshStandardMaterial {...skin} />
      </mesh>

      {/* Bottom clothing shell over hips */}
      {bottom && (
        <mesh position={[0, 0.35, 0]} scale={[bodyScale.hips * S, S, S]}>
          <capsuleGeometry args={[0.21, 0.32, 8, 16]} />
          {bottom.texture ? (
            <meshStandardMaterial map={bottom.texture} roughness={0.6} />
          ) : (
            <meshStandardMaterial color={bottom.color} roughness={0.6} />
          )}
        </mesh>
      )}

      {/* ── Legs ── */}
      {[[-1, -0.15], [1, 0.15]].map(([side, xOff]) => (
        <group key={side} position={[xOff * bodyScale.hips, 0, 0]}>
          {/* Upper leg */}
          <mesh position={[0, -0.15, 0]}>
            <capsuleGeometry args={[0.09, 0.45, 6, 12]} />
            <meshStandardMaterial {...skin} />
          </mesh>
          {/* Bottom clothing on upper legs (pants) */}
          {bottom && (
            <mesh position={[0, -0.15, 0]}>
              <capsuleGeometry args={[0.1, 0.47, 6, 12]} />
              {bottom.texture ? (
                <meshStandardMaterial map={bottom.texture} roughness={0.6} />
              ) : (
                <meshStandardMaterial color={bottom.color} roughness={0.6} />
              )}
            </mesh>
          )}

          {/* Knee joint */}
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial {...joint} />
          </mesh>

          {/* Lower leg */}
          <mesh position={[0, -0.72, 0]}>
            <capsuleGeometry args={[0.07, 0.45, 6, 12]} />
            <meshStandardMaterial {...skin} />
          </mesh>
          {/* Bottom clothing on lower legs */}
          {bottom && (
            <mesh position={[0, -0.72, 0]}>
              <capsuleGeometry args={[0.078, 0.47, 6, 12]} />
              {bottom.texture ? (
                <meshStandardMaterial map={bottom.texture} roughness={0.6} />
              ) : (
                <meshStandardMaterial color={bottom.color} roughness={0.6} />
              )}
            </mesh>
          )}

          {/* Foot */}
          <mesh position={[0, -1.02, 0.06]}>
            <boxGeometry args={[0.14, 0.08, 0.22]} />
            <meshStandardMaterial {...skin} />
          </mesh>
          {/* Shoe shell */}
          {shoes && (
            <mesh position={[0, -1.01, 0.06]}>
              <boxGeometry args={[0.16, 0.11, 0.26]} />
              {shoes.texture ? (
                <meshStandardMaterial map={shoes.texture} roughness={0.5} />
              ) : (
                <meshStandardMaterial color={shoes.color} roughness={0.5} />
              )}
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/* ─── Platform / ground disc ─── */
function Platform() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.12, 0]}>
      <circleGeometry args={[0.8, 32]} />
      <meshStandardMaterial color="#e8e0d8" roughness={0.9} metalness={0} />
    </mesh>
  );
}

/* ─── Scene lighting ─── */
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={0.8} />
      <directionalLight position={[-2, 3, -3]} intensity={0.3} />
      <pointLight position={[0, 2, 3]} intensity={0.4} color="#fff5ee" />
    </>
  );
}

/* ─── Item legend overlay (HTML, outside canvas) ─── */
function ItemLegend({ outfit }) {
  if (!outfit.length) return null;
  return (
    <div className="mannequinLegend">
      {outfit.map((item) => (
        <div key={item.id} className="mannequinLegendItem">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="mannequinLegendThumb" />
          ) : (
            <div className="mannequinLegendThumb mannequinLegendPlaceholder" />
          )}
          <div className="mannequinLegendInfo">
            <span className="mannequinLegendName">{item.name}</span>
            <span className="mannequinLegendCat">{item.category}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main viewer component ─── */
export default function MannequinViewer({ outfit = [], bodyType = "rectangle" }) {
  const containerRef = useRef();

  // Load textures for each category (first item per category wins)
  const topItem = outfit.find(i => i.category === "Tops");
  const bottomItem = outfit.find(i => i.category === "Bottoms");
  const outerItem = outfit.find(i => i.category === "Outerwear");
  const shoesItem = outfit.find(i => i.category === "Shoes");
  const accItem = outfit.find(i => i.category === "Accessories");

  const topTex = useClothingTexture(topItem?.image_url);
  const bottomTex = useClothingTexture(bottomItem?.image_url);
  const outerTex = useClothingTexture(outerItem?.image_url);
  const shoesTex = useClothingTexture(shoesItem?.image_url);
  const accTex = useClothingTexture(accItem?.image_url);

  const clothingMap = useMemo(() => ({
    Tops: topItem ? { texture: topTex, color: colorToThree(topItem.color) } : null,
    Bottoms: bottomItem ? { texture: bottomTex, color: colorToThree(bottomItem.color) } : null,
    Outerwear: outerItem ? { texture: outerTex, color: colorToThree(outerItem.color) } : null,
    Shoes: shoesItem ? { texture: shoesTex, color: colorToThree(shoesItem.color) } : null,
    Accessories: accItem ? { texture: accTex, color: colorToThree(accItem.color) } : null,
  }), [topItem, bottomItem, outerItem, shoesItem, accItem, topTex, bottomTex, outerTex, shoesTex, accTex]);

  return (
    <div ref={containerRef} className="mannequinViewerContainer">
      <Canvas
        camera={{ position: [0, 0.8, 4], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Lighting />
        <DressedMannequin bodyType={bodyType} clothingMap={clothingMap} />
        <Platform />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={2.5}
          maxDistance={7}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>

      <ItemLegend outfit={outfit} />

      <div className="mannequinHint">
        Drag to rotate &middot; Scroll to zoom
      </div>
    </div>
  );
}
