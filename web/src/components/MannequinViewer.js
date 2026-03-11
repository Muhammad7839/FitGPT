// web/src/components/MannequinViewer.js
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ─── Parse item colour string → THREE.Color ─── */
function itemColor(str) {
  if (!str) return "#888888";
  const c = str.split(",")[0].trim().toLowerCase();
  // common color names that THREE.Color doesn't know
  const map = {
    navy: "#1b3a5c", cream: "#fffdd0", olive: "#808000", burgundy: "#800020",
    coral: "#ff7f50", mauve: "#e0b0ff", charcoal: "#36454f", taupe: "#483c32",
    mustard: "#ffdb58", blush: "#de5d83", sage: "#bcc8a0", rust: "#b7410e",
    plum: "#8e4585", champagne: "#f7e7ce", denim: "#1560bd", camel: "#c19a6b",
  };
  if (map[c]) return map[c];
  try { new THREE.Color(c); return c; } catch { return "#888888"; }
}

/* ─── Lathe helper: rotate a 2D profile around Y axis ─── */
function lathePoints(profile, segments = 24) {
  return new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    segments
  );
}

/* ═══════════════════════════════════════════════
   3D GARMENT GEOMETRY
   ═══════════════════════════════════════════════ */

/* ─── T-Shirt / Top ─── */
function ShirtGarment({ color, bodyScale }) {
  const sw = bodyScale.shoulders;
  const col = itemColor(color);
  // darken for inside/shadow areas
  const colDark = new THREE.Color(col).multiplyScalar(0.75).getStyle();

  // Torso body — lathe profile for a shirt shape
  const torsoGeo = useMemo(() => {
    return lathePoints([
      [0.01, 1.55],   // neckline top
      [0.10, 1.52],   // collar base
      [0.22 * sw, 1.48], // shoulder seam
      [0.24 * sw, 1.3],  // upper chest
      [0.21 * sw, 1.05], // waist
      [0.22 * sw, 0.85], // lower
      [0.23 * sw, 0.68], // hem flare
      [0.22 * sw, 0.65], // hem edge
    ], 24);
  }, [sw]);

  // Collar ring
  const collarGeo = useMemo(() => {
    return new THREE.TorusGeometry(0.1, 0.025, 8, 24);
  }, []);

  // Sleeve — a tapered cylinder
  const sleeveGeo = useMemo(() => {
    return new THREE.CylinderGeometry(0.055, 0.075, 0.28, 12, 1, true);
  }, []);

  // Sleeve cap (rounded end)
  const sleeveCapGeo = useMemo(() => {
    return new THREE.SphereGeometry(0.065, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  }, []);

  return (
    <group>
      {/* Main shirt body */}
      <mesh geometry={torsoGeo}>
        <meshStandardMaterial color={col} roughness={0.75} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Collar */}
      <mesh geometry={collarGeo} position={[0, 1.54, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={colDark} roughness={0.6} />
      </mesh>

      {/* Left sleeve */}
      <group position={[-0.26 * sw, 1.36, 0]} rotation={[0, 0, Math.PI / 2 + 0.3]}>
        <mesh geometry={sleeveGeo}>
          <meshStandardMaterial color={col} roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={sleeveCapGeo} position={[0, 0.14, 0]}>
          <meshStandardMaterial color={col} roughness={0.75} />
        </mesh>
      </group>

      {/* Right sleeve */}
      <group position={[0.26 * sw, 1.36, 0]} rotation={[0, 0, -(Math.PI / 2 + 0.3)]}>
        <mesh geometry={sleeveGeo}>
          <meshStandardMaterial color={col} roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={sleeveCapGeo} position={[0, 0.14, 0]}>
          <meshStandardMaterial color={col} roughness={0.75} />
        </mesh>
      </group>
    </group>
  );
}

/* ─── Pants / Bottoms ─── */
function PantsGarment({ color, bodyScale }) {
  const hw = bodyScale.hips;
  const col = itemColor(color);

  // Waistband
  const waistGeo = useMemo(() => {
    return lathePoints([
      [0.22 * hw, 0.42],
      [0.23 * hw, 0.38],
      [0.23 * hw, 0.32],
      [0.22 * hw, 0.28],
    ], 24);
  }, [hw]);

  // Crotch bridge — connects the two legs at the top
  const crotchGeo = useMemo(() => {
    return lathePoints([
      [0.22 * hw, 0.28],
      [0.20 * hw, 0.18],
      [0.16 * hw, 0.05],
    ], 24);
  }, [hw]);

  // Single pant leg — tapered cylinder
  const legGeo = useMemo(() => {
    return new THREE.CylinderGeometry(0.075, 0.07, 0.95, 12, 1, true);
  }, []);

  // Leg cuff
  const cuffGeo = useMemo(() => {
    return new THREE.TorusGeometry(0.072, 0.012, 6, 16);
  }, []);

  return (
    <group>
      {/* Waistband */}
      <mesh geometry={waistGeo}>
        <meshStandardMaterial color={col} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Crotch / upper */}
      <mesh geometry={crotchGeo}>
        <meshStandardMaterial color={col} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Left leg */}
      <group position={[-0.12 * hw, 0, 0]}>
        <mesh geometry={legGeo} position={[0, -0.44, 0]}>
          <meshStandardMaterial color={col} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={cuffGeo} position={[0, -0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color={col} roughness={0.6} />
        </mesh>
      </group>

      {/* Right leg */}
      <group position={[0.12 * hw, 0, 0]}>
        <mesh geometry={legGeo} position={[0, -0.44, 0]}>
          <meshStandardMaterial color={col} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={cuffGeo} position={[0, -0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color={col} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/* ─── Jacket / Outerwear ─── */
function JacketGarment({ color, bodyScale }) {
  const sw = bodyScale.shoulders;
  const col = itemColor(color);
  const colDark = new THREE.Color(col).multiplyScalar(0.7).getStyle();

  // Jacket body — slightly larger than shirt, longer
  const bodyGeo = useMemo(() => {
    return lathePoints([
      [0.01, 1.58],
      [0.12, 1.54],
      [0.27 * sw, 1.50],
      [0.29 * sw, 1.3],
      [0.26 * sw, 1.05],
      [0.27 * sw, 0.75],
      [0.28 * sw, 0.55],
      [0.27 * sw, 0.50],
    ], 24);
  }, [sw]);

  // Lapel — flat angled panels
  const lapelGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.08, 0);
    shape.lineTo(0.06, 0.25);
    shape.lineTo(0, 0.22);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false });
  }, []);

  // Long sleeve
  const sleeveGeo = useMemo(() => {
    return new THREE.CylinderGeometry(0.05, 0.07, 0.55, 12, 1, true);
  }, []);

  return (
    <group>
      <mesh geometry={bodyGeo}>
        <meshStandardMaterial color={col} roughness={0.6} metalness={0.02} side={THREE.DoubleSide} />
      </mesh>

      {/* Left lapel */}
      <mesh geometry={lapelGeo} position={[-0.04, 1.28, 0.12]} rotation={[0.1, 0.3, 0]}>
        <meshStandardMaterial color={colDark} roughness={0.5} />
      </mesh>
      {/* Right lapel */}
      <mesh geometry={lapelGeo} position={[0.04, 1.28, 0.12]} rotation={[0.1, -0.3, 0]} scale={[-1, 1, 1]}>
        <meshStandardMaterial color={colDark} roughness={0.5} />
      </mesh>

      {/* Left sleeve */}
      <group position={[-0.30 * sw, 1.32, 0]} rotation={[0, 0, Math.PI / 2 + 0.25]}>
        <mesh geometry={sleeveGeo}>
          <meshStandardMaterial color={col} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Right sleeve */}
      <group position={[0.30 * sw, 1.32, 0]} rotation={[0, 0, -(Math.PI / 2 + 0.25)]}>
        <mesh geometry={sleeveGeo}>
          <meshStandardMaterial color={col} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/* ─── Shoes ─── */
function ShoeGarment({ color, bodyScale }) {
  const hw = bodyScale.hips;
  const col = itemColor(color);
  const colDark = new THREE.Color(col).multiplyScalar(0.65).getStyle();

  // Shoe body — rounded box with a toe cap
  const shoeGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.07, 0);
    shape.lineTo(0.07, 0);
    shape.quadraticCurveTo(0.09, 0, 0.09, 0.04);
    shape.lineTo(0.09, 0.06);
    shape.lineTo(-0.07, 0.06);
    shape.lineTo(-0.07, 0);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
  }, []);

  // Sole
  const soleGeo = useMemo(() => {
    return new THREE.BoxGeometry(0.18, 0.025, 0.26);
  }, []);

  return (
    <group>
      {[[-0.15 * hw, "left"], [0.15 * hw, "right"]].map(([x, side]) => (
        <group key={side} position={[x, -1.05, -0.03]}>
          <mesh geometry={shoeGeo} rotation={[-Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color={col} roughness={0.4} metalness={0.05} />
          </mesh>
          <mesh geometry={soleGeo} position={[0.01, -0.02, 0.08]}>
            <meshStandardMaterial color={colDark} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Accessories (hat) ─── */
function AccessoryGarment({ color }) {
  const col = itemColor(color);
  const colDark = new THREE.Color(col).multiplyScalar(0.7).getStyle();

  // Hat crown
  const crownGeo = useMemo(() => {
    return lathePoints([
      [0.01, 2.45],
      [0.15, 2.42],
      [0.22, 2.35],
      [0.24, 2.28],
      [0.23, 2.22],
    ], 24);
  }, []);

  // Hat brim
  const brimGeo = useMemo(() => {
    return new THREE.RingGeometry(0.22, 0.38, 24);
  }, []);

  return (
    <group>
      <mesh geometry={crownGeo}>
        <meshStandardMaterial color={col} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={brimGeo} position={[0, 2.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={colDark} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════
   MANNEQUIN BODY (bare skin)
   ═══════════════════════════════════════════════ */

function MannequinBody({ bodyScale, hasTop, hasBottom, hasShoes }) {
  const skin = { color: "#d4c4b0", roughness: 0.7, metalness: 0.05 };
  const jointCol = { color: "#bfae98", roughness: 0.6, metalness: 0.1 };
  const sw = bodyScale.shoulders;
  const hw = bodyScale.hips;

  return (
    <group>
      {/* Head */}
      <mesh position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial {...skin} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.18, 12]} />
        <meshStandardMaterial {...skin} />
      </mesh>

      {/* Torso — only visible if no top */}
      {!hasTop && (
        <mesh position={[0, 1.05, 0]} scale={[sw, 1, 1]}>
          <capsuleGeometry args={[0.18, 0.9, 8, 16]} />
          <meshStandardMaterial {...skin} />
        </mesh>
      )}

      {/* Arms — forearms always visible */}
      {[[-1, 0.2], [1, -0.2]].map(([side, rot]) => (
        <group key={side} position={[side * 0.5 * sw, 1.45, 0]} rotation={[0, 0, rot]}>
          {/* Upper arm if no top */}
          {!hasTop && (
            <mesh position={[0, -0.3, 0]}>
              <capsuleGeometry args={[0.06, 0.35, 6, 12]} />
              <meshStandardMaterial {...skin} />
            </mesh>
          )}
          <mesh position={[0, -0.5, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial {...jointCol} />
          </mesh>
          <mesh position={[0, -0.75, 0]}>
            <capsuleGeometry args={[0.05, 0.32, 6, 12]} />
            <meshStandardMaterial {...skin} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.96, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial {...skin} />
          </mesh>
        </group>
      ))}

      {/* Hips — only if no bottom */}
      {!hasBottom && (
        <mesh position={[0, 0.35, 0]} scale={[hw, 1, 1]}>
          <capsuleGeometry args={[0.2, 0.3, 8, 16]} />
          <meshStandardMaterial {...skin} />
        </mesh>
      )}

      {/* Legs — only if no bottom */}
      {!hasBottom && [[-0.15, "l"], [0.15, "r"]].map(([x, k]) => (
        <group key={k} position={[x * hw, 0, 0]}>
          <mesh position={[0, -0.15, 0]}>
            <capsuleGeometry args={[0.09, 0.45, 6, 12]} />
            <meshStandardMaterial {...skin} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial {...jointCol} />
          </mesh>
          <mesh position={[0, -0.72, 0]}>
            <capsuleGeometry args={[0.07, 0.45, 6, 12]} />
            <meshStandardMaterial {...skin} />
          </mesh>
        </group>
      ))}

      {/* Feet — only if no shoes */}
      {!hasShoes && [[-0.15, "l"], [0.15, "r"]].map(([x, k]) => (
        <group key={k} position={[x * hw, 0, 0]}>
          <mesh position={[0, -1.02, 0.06]}>
            <boxGeometry args={[0.12, 0.06, 0.2]} />
            <meshStandardMaterial {...skin} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════
   SCENE COMPONENTS
   ═══════════════════════════════════════════════ */

function Platform() {
  return (
    <group>
      {/* Main disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.12, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.04, 32]} />
        <meshStandardMaterial color="#e8e0d8" roughness={0.85} metalness={0.02} />
      </mesh>
      {/* Rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.14, 0]}>
        <cylinderGeometry args={[0.88, 0.88, 0.02, 32]} />
        <meshStandardMaterial color="#d4ccc4" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} />
      <directionalLight position={[-3, 3, -2]} intensity={0.25} />
      <pointLight position={[0, 2.5, 3]} intensity={0.35} color="#fff5ee" />
      <hemisphereLight args={["#ffeedd", "#8899aa", 0.3]} />
    </>
  );
}

/* ─── Dressed mannequin: body + garments ─── */
function DressedMannequin({ bodyType, outfit }) {
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

  const topItem = outfit.find(i => i.category === "Tops");
  const bottomItem = outfit.find(i => i.category === "Bottoms");
  const outerItem = outfit.find(i => i.category === "Outerwear");
  const shoesItem = outfit.find(i => i.category === "Shoes");
  const accItem = outfit.find(i => i.category === "Accessories");

  // gentle idle rotation
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.18;
  });

  return (
    <group ref={group}>
      <MannequinBody
        bodyScale={bodyScale}
        hasTop={!!topItem || !!outerItem}
        hasBottom={!!bottomItem}
        hasShoes={!!shoesItem}
      />

      {topItem && <ShirtGarment color={topItem.color} bodyScale={bodyScale} />}
      {bottomItem && <PantsGarment color={bottomItem.color} bodyScale={bodyScale} />}
      {outerItem && <JacketGarment color={outerItem.color} bodyScale={bodyScale} />}
      {shoesItem && <ShoeGarment color={shoesItem.color} bodyScale={bodyScale} />}
      {accItem && <AccessoryGarment color={accItem.color} />}
    </group>
  );
}

/* ─── Item legend (HTML overlay) ─── */
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

/* ═══════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════ */

export default function MannequinViewer({ outfit = [], bodyType = "rectangle" }) {
  const containerRef = useRef();

  return (
    <div ref={containerRef} className="mannequinViewerContainer">
      <Canvas
        camera={{ position: [0, 0.8, 4], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Lighting />
        <DressedMannequin bodyType={bodyType} outfit={outfit} />
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
