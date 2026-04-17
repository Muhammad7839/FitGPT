// web/src/components/MannequinViewer.js
import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { colorToCss } from "../utils/recommendationEngine";

/* ─── colour helper: reuse the app's CSS_COLOR_MAP via colorToCss ─── */
function itemColor(str) {
  if (!str) return "#888888";
  // pass the full string to colorToCss — it handles splitting, normalization, and lookup
  const css = colorToCss(str);
  // colorToCss may return a gradient for multi-colors; extract first hex
  if (css.startsWith("linear-gradient")) {
    const match = css.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : "#888888";
  }
  return css;
}

function darken(hex, amount = 0.25) {
  return new THREE.Color(hex).multiplyScalar(1 - amount).getStyle();
}

/* detect shorts vs full pants from item name */
function isShorts(item) {
  if (!item?.name) return false;
  return /shorts|short/i.test(item.name);
}

/* detect flannel / plaid button-up from item name */
function isFlannel(item) {
  if (!item?.name) return false;
  return /flannel|plaid|lumberjack/i.test(item.name);
}

/* ═══════════════════════════════════════════════
   MANNEQUIN BODY
   ═══════════════════════════════════════════════ */
const SKIN = "#d4c4b0";
const JOINT = "#c4b4a0";

function MannequinBody({ bodyScale, covered, idleTime }) {
  const sw = bodyScale.shoulders;
  const hw = bodyScale.hips;

  const breathe   = Math.sin(idleTime * 1.2) * 0.008;
  const headTilt  = Math.sin(idleTime * 0.8) * 0.04;
  const armSwayL  = Math.sin(idleTime * 1.0) * 0.06;
  const armSwayR  = Math.sin(idleTime * 1.0 + 0.5) * 0.06;

  return (
    <group position={[0, breathe, 0]}>
      {/* Head */}
      <mesh position={[0, 1.58, 0]} rotation={[headTilt * 0.5, 0, headTilt]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.1, 10]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>

      {/* Torso — visible when no top/outerwear */}
      {!covered.torso && (
        <mesh position={[0, 1.15, 0]} scale={[sw, 1, 0.75]}>
          <capsuleGeometry args={[0.14, 0.35, 8, 14]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      )}

      {/* Shoulders — connect arms to torso */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.18 * sw, 1.33, 0]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color={covered.torso ? JOINT : SKIN} roughness={0.7} />
        </mesh>
      ))}

      {/* Arms */}
      {[[-1, -0.55, armSwayL], [1, 0.55, armSwayR]].map(([side, rotZ, sway]) => (
        <group key={side} position={[side * 0.18 * sw, 1.33, 0]} rotation={[sway * 0.3, 0, rotZ + sway]}>
          {/* Upper arm */}
          <mesh position={[0, -0.14, 0]}>
            <capsuleGeometry args={[0.035, 0.18, 5, 10]} />
            <meshStandardMaterial color={covered.torso ? JOINT : SKIN} roughness={0.7} />
          </mesh>
          {/* Elbow */}
          <mesh position={[0, -0.27, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color={JOINT} roughness={0.6} />
          </mesh>
          {/* Forearm */}
          <group position={[0, -0.27, 0]}>
            <mesh position={[0, -0.13, 0]}>
              <capsuleGeometry args={[0.028, 0.18, 5, 10]} />
              <meshStandardMaterial color={SKIN} roughness={0.7} />
            </mesh>
            {/* Hand */}
            <mesh position={[0, -0.26, 0]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshStandardMaterial color={SKIN} roughness={0.7} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Hips */}
      <group>
        {!covered.legs && (
          <mesh position={[0, 0.88, 0]} scale={[hw, 1, 0.75]}>
            <capsuleGeometry args={[0.15, 0.08, 6, 12]} />
            <meshStandardMaterial color={SKIN} roughness={0.7} />
          </mesh>
        )}

        {/* Legs — pivot at hip joint (y=0.82) so rotation doesn't detach */}
        {(!covered.legs || covered.shortsOnly) && [[-0.09, "L"], [0.09, "R"]].map(([x, k]) => (
          <group key={k} position={[x * hw, 0.82, 0]}>
            {!covered.legs && (
              <>
                <mesh position={[0, -0.17, 0]}>
                  <capsuleGeometry args={[0.055, 0.18, 6, 10]} />
                  <meshStandardMaterial color={SKIN} roughness={0.7} />
                </mesh>
                <mesh position={[0, -0.32, 0]}>
                  <sphereGeometry args={[0.038, 8, 8]} />
                  <meshStandardMaterial color={JOINT} roughness={0.6} />
                </mesh>
              </>
            )}
            {/* Lower leg — starts just below shorts hem */}
            <group position={[0, -0.32, 0]}>
              <mesh position={[0, -0.1, 0]}>
                <capsuleGeometry args={[0.048, 0.28, 6, 10]} />
                <meshStandardMaterial color={SKIN} roughness={0.7} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Feet — visible when no shoes */}
        {!covered.feet && [[-0.09, "L"], [0.09, "R"]].map(([x, k]) => (
          <group key={k} position={[x * hw, 0.19, 0.02]}>
            <mesh>
              <boxGeometry args={[0.07, 0.035, 0.13]} />
              <meshStandardMaterial color={SKIN} roughness={0.7} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ═══════════════════════════════════════════════
   GARMENTS
   ═══════════════════════════════════════════════ */

/* ─── Top / Shirt ─── */
function TopGarment({ color, bodyScale, idleTime }) {
  const col = itemColor(color);
  const colD = darken(col, 0.15);
  const sw = bodyScale.shoulders;

  const armSwayL = Math.sin(idleTime * 1.0) * 0.06;
  const armSwayR = Math.sin(idleTime * 1.0 + 0.5) * 0.06;

  return (
    <group>
      {/* Torso body */}
      <mesh position={[0, 1.15, 0]} scale={[sw * 1.05, 1, 0.78]}>
        <capsuleGeometry args={[0.155, 0.38, 8, 16]} />
        <meshStandardMaterial color={col} roughness={0.72} />
      </mesh>

      {/* Neckline */}
      <mesh position={[0, 1.37, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.06, 0.015, 8, 20]} />
        <meshStandardMaterial color={colD} roughness={0.6} />
      </mesh>

      {/* Hem */}
      <mesh position={[0, 0.91, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[sw * 1.05, 0.78, 1]}>
        <torusGeometry args={[0.15, 0.01, 6, 20]} />
        <meshStandardMaterial color={colD} roughness={0.6} />
      </mesh>

      {/* Sleeves — match arm anchor at 0.18, wrap with larger radius */}
      {[[-1, -0.55, armSwayL], [1, 0.55, armSwayR]].map(([side, rotZ, sway]) => (
        <group key={side} position={[side * 0.18 * sw, 1.33, 0]} rotation={[sway * 0.3, 0, rotZ + sway]}>
          <mesh position={[0, -0.08, 0]}>
            <capsuleGeometry args={[0.05, 0.1, 6, 10]} />
            <meshStandardMaterial color={col} roughness={0.72} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Flannel / Plaid Button-Up ─── */
function FlannelGarment({ color, bodyScale, idleTime }) {
  const col = itemColor(color);
  const colD = darken(col, 0.2);
  const sw = bodyScale.shoulders;

  const armSwayL = Math.sin(idleTime * 1.0) * 0.06;
  const armSwayR = Math.sin(idleTime * 1.0 + 0.5) * 0.06;

  return (
    <group>
      {/* Torso — slightly longer than a tee, open front */}
      <mesh position={[0, 1.12, 0]} scale={[sw * 1.07, 1.04, 0.79]}>
        <capsuleGeometry args={[0.158, 0.42, 8, 16]} />
        <meshStandardMaterial color={col} roughness={0.8} />
      </mesh>

      {/* Open front gap — dark strip showing undershirt/skin */}
      <mesh position={[0, 1.12, 0.13]}>
        <boxGeometry args={[0.04, 0.52, 0.008]} />
        <meshStandardMaterial color="#3a3530" roughness={0.9} />
      </mesh>

      {/* Left front panel edge */}
      <mesh position={[-0.025, 1.12, 0.132]}>
        <boxGeometry args={[0.012, 0.52, 0.006]} />
        <meshStandardMaterial color={colD} roughness={0.7} />
      </mesh>

      {/* Right front panel edge */}
      <mesh position={[0.025, 1.12, 0.132]}>
        <boxGeometry args={[0.012, 0.52, 0.006]} />
        <meshStandardMaterial color={colD} roughness={0.7} />
      </mesh>

      {/* Buttons down right panel */}
      {[1.3, 1.2, 1.1, 1.0, 0.9].map((y) => (
        <mesh key={y} position={[0.022, y, 0.136]}>
          <sphereGeometry args={[0.006, 6, 6]} />
          <meshStandardMaterial color="#c8b8a0" roughness={0.4} metalness={0.1} />
        </mesh>
      ))}

      {/* Collar — pointed spread collar */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.04, 1.37, 0.06]} rotation={[-0.4, side * 0.3, side * 0.15]}>
          <mesh>
            <boxGeometry args={[0.06, 0.035, 0.04]} />
            <meshStandardMaterial color={colD} roughness={0.7} />
          </mesh>
          {/* Collar point */}
          <mesh position={[side * 0.025, -0.01, 0.02]}>
            <boxGeometry args={[0.02, 0.02, 0.02]} />
            <meshStandardMaterial color={colD} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Hem — slightly lower than regular tee */}
      <mesh position={[0, 0.87, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[sw * 1.07, 0.79, 1]}>
        <torusGeometry args={[0.15, 0.008, 6, 20]} />
        <meshStandardMaterial color={colD} roughness={0.6} />
      </mesh>

      {/* Long sleeves — fuller than tee sleeves */}
      {[[-1, -0.55, armSwayL], [1, 0.55, armSwayR]].map(([side, rotZ, sway]) => (
        <group key={side} position={[side * 0.18 * sw, 1.33, 0]} rotation={[sway * 0.3, 0, rotZ + sway]}>
          {/* Upper sleeve */}
          <mesh position={[0, -0.1, 0]}>
            <capsuleGeometry args={[0.052, 0.14, 6, 10]} />
            <meshStandardMaterial color={col} roughness={0.8} />
          </mesh>
          {/* Lower sleeve — rolled up cuff look */}
          <mesh position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.045, 0.08, 6, 10]} />
            <meshStandardMaterial color={col} roughness={0.8} />
          </mesh>
          {/* Rolled cuff band */}
          <mesh position={[0, -0.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.043, 0.006, 6, 12]} />
            <meshStandardMaterial color={colD} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Chest pocket (left side) */}
      <mesh position={[-0.06, 1.22, 0.135]}>
        <boxGeometry args={[0.05, 0.04, 0.004]} />
        <meshStandardMaterial color={colD} roughness={0.75} />
      </mesh>
      {/* Pocket flap */}
      <mesh position={[-0.06, 1.24, 0.136]}>
        <boxGeometry args={[0.052, 0.008, 0.005]} />
        <meshStandardMaterial color={colD} roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ─── Pants (full length) ─── */
function PantsGarment({ color, bodyScale }) {
  const col = itemColor(color);
  const colD = darken(col, 0.15);
  const hw = bodyScale.hips;
  const legX = 0.09;

  return (
    <group>
      {/* Waistband */}
      <mesh position={[0, 0.82, 0]} scale={[hw, 1, 1]}>
        <boxGeometry args={[0.3, 0.12, 0.15]} />
        <meshStandardMaterial color={col} roughness={0.7} />
      </mesh>

      {/* Belt */}
      <mesh position={[0, 0.87, 0]} scale={[hw, 1, 1]}>
        <boxGeometry args={[0.31, 0.018, 0.155]} />
        <meshStandardMaterial color={darken(col, 0.3)} roughness={0.5} />
      </mesh>

      {/* Crotch / inner thigh bridge */}
      <mesh position={[0, 0.73, 0]} scale={[hw, 1, 1]}>
        <boxGeometry args={[0.22, 0.08, 0.14]} />
        <meshStandardMaterial color={col} roughness={0.7} />
      </mesh>

      {/* Legs — start higher to overlap with crotch */}
      {[[-legX, "L"], [legX, "R"]].map(([x, k]) => (
        <group key={k} position={[x * hw, 0, 0]}>
          <mesh position={[0, 0.52, 0]}>
            <capsuleGeometry args={[0.06, 0.52, 8, 12]} />
            <meshStandardMaterial color={col} roughness={0.7} />
          </mesh>
          {/* Ankle cuff */}
          <mesh position={[0, 0.23, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.052, 0.007, 6, 14]} />
            <meshStandardMaterial color={colD} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Shorts ─── */
function ShortsGarment({ color, bodyScale }) {
  const col = itemColor(color);
  const colD = darken(col, 0.15);
  const hw = bodyScale.hips;

  return (
    <group>
      {/* Waistband */}
      <mesh position={[0, 0.82, 0]} scale={[hw, 1, 1]}>
        <boxGeometry args={[0.3, 0.12, 0.15]} />
        <meshStandardMaterial color={col} roughness={0.7} />
      </mesh>

      {/* Belt */}
      <mesh position={[0, 0.87, 0]} scale={[hw, 1, 1]}>
        <boxGeometry args={[0.31, 0.018, 0.155]} />
        <meshStandardMaterial color={darken(col, 0.3)} roughness={0.5} />
      </mesh>

      {/* Short legs — extend down to connect with exposed lower leg at y≈0.45 */}
      {[[-0.09, "L"], [0.09, "R"]].map(([x, k]) => (
        <group key={k} position={[x * hw, 0, 0]}>
          <mesh position={[0, 0.58, 0]}>
            <capsuleGeometry args={[0.062, 0.32, 6, 12]} />
            <meshStandardMaterial color={col} roughness={0.7} />
          </mesh>
          {/* Hem */}
          <mesh position={[0, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.006, 6, 14]} />
            <meshStandardMaterial color={colD} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Jacket / Outerwear ─── */
function OuterwearGarment({ color, bodyScale, idleTime }) {
  const col = itemColor(color);
  const colD = darken(col, 0.2);
  const sw = bodyScale.shoulders;

  const armSwayL = Math.sin(idleTime * 1.0) * 0.06;
  const armSwayR = Math.sin(idleTime * 1.0 + 0.5) * 0.06;

  return (
    <group>
      {/* Body — slightly larger than top, longer */}
      <mesh position={[0, 1.1, 0]} scale={[sw * 1.12, 1.06, 0.82]}>
        <capsuleGeometry args={[0.165, 0.5, 8, 16]} />
        <meshStandardMaterial color={col} roughness={0.6} metalness={0.02} />
      </mesh>

      {/* Collar */}
      <mesh position={[0, 1.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.07, 0.02, 8, 20]} />
        <meshStandardMaterial color={colD} roughness={0.55} />
      </mesh>

      {/* Front zipper line */}
      <mesh position={[0, 1.1, 0.135]}>
        <boxGeometry args={[0.006, 0.55, 0.004]} />
        <meshStandardMaterial color={darken(col, 0.4)} roughness={0.4} metalness={0.15} />
      </mesh>

      {/* Long sleeves */}
      {[[-1, -0.55, armSwayL], [1, 0.55, armSwayR]].map(([side, rotZ, sway]) => (
        <group key={side} position={[side * 0.18 * sw, 1.33, 0]} rotation={[sway * 0.3, 0, rotZ + sway]}>
          <mesh position={[0, -0.12, 0]}>
            <capsuleGeometry args={[0.055, 0.18, 6, 10]} />
            <meshStandardMaterial color={col} roughness={0.6} />
          </mesh>
          {/* Cuff */}
          <mesh position={[0, -0.23, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.044, 0.007, 6, 12]} />
            <meshStandardMaterial color={colD} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Shoes ─── */
function ShoeGarment({ color, bodyScale }) {
  const col = itemColor(color);
  const colD = darken(col, 0.3);
  const hw = bodyScale.hips;

  return (
    <group>
      {[[-0.09 * hw, "L"], [0.09 * hw, "R"]].map(([x, k]) => (
        <group key={k} position={[x, 0.19, 0.01]}>
          {/* Shoe upper */}
          <mesh position={[0, 0.015, 0]}>
            <boxGeometry args={[0.11, 0.08, 0.19]} />
            <meshStandardMaterial color={col} roughness={0.45} />
          </mesh>
          {/* Toe bump */}
          <mesh position={[0, 0.02, 0.085]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.045, 0.035, 6, 8]} />
            <meshStandardMaterial color={col} roughness={0.45} />
          </mesh>
          {/* Sole */}
          <mesh position={[0, -0.025, 0.005]}>
            <boxGeometry args={[0.12, 0.025, 0.21]} />
            <meshStandardMaterial color={colD} roughness={0.85} />
          </mesh>
          {/* Ankle collar */}
          <mesh position={[0, 0.06, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.048, 0.01, 6, 12]} />
            <meshStandardMaterial color={col} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Accessory (hat) ─── */
function AccessoryGarment({ color, idleTime }) {
  const col = itemColor(color);
  const colD = darken(col, 0.2);

  const headTilt = Math.sin(idleTime * 0.8) * 0.04;

  return (
    <group position={[0, 1.68, 0]} rotation={[headTilt * 0.5, 0, headTilt]}>
      {/* Crown */}
      <mesh>
        <sphereGeometry args={[0.14, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={col} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Brim */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.2, 20]} />
        <meshStandardMaterial color={colD} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════
   SCENE
   ═══════════════════════════════════════════════ */

function Platform() {
  return (
    <group position={[0, 0.15, 0]}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 0.025, 32]} />
        <meshStandardMaterial color="#e8e0d8" roughness={0.85} metalness={0.02} />
      </mesh>
      <mesh position={[0, -0.013, 0]}>
        <cylinderGeometry args={[0.53, 0.53, 0.012, 32]} />
        <meshStandardMaterial color="#d4ccc4" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={0.85} />
      <directionalLight position={[-2, 3, -3]} intensity={0.3} />
      <pointLight position={[0, 2, 3]} intensity={0.3} color="#fff5ee" />
      <hemisphereLight args={["#ffeedd", "#8899aa", 0.25]} />
    </>
  );
}

/* ─── Draggable floating image panel pointing at a body zone ─── */
function ClothingPanel({ imageUrl, category, name, onDragStart, onDragEnd }) {
  const groupRef = useRef();
  const meshRef = useRef();
  const lineRef = useRef();
  const [texture, setTexture] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState(null);

  const { defaultPos, bodyPos } = useMemo(() => {
    switch (category) {
      case "Tops":        return { defaultPos: [-0.75, 1.2, 0.5],  bodyPos: [-0.15, 1.15, 0.1] };
      case "Bottoms":     return { defaultPos: [0.75, 0.55, 0.5],  bodyPos: [0.1, 0.65, 0.1] };
      case "Outerwear":   return { defaultPos: [-0.75, 0.7, 0.5],  bodyPos: [-0.18, 1.1, 0.1] };
      case "Shoes":       return { defaultPos: [0.75, 0.15, 0.5],  bodyPos: [0.08, 0.19, 0.1] };
      case "Accessories": return { defaultPos: [-0.75, 1.65, 0.5], bodyPos: [-0.1, 1.6, 0.1] };
      default:            return { defaultPos: [0.75, 1.0, 0.5],   bodyPos: [0.1, 1.0, 0.1] };
    }
  }, [category]);

  const currentPos = pos || defaultPos;

  useEffect(() => {
    if (!imageUrl) return;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(imageUrl, (t) => {
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      setTexture(t);
    });
    return () => { if (tex) tex.dispose(); };
  }, [imageUrl]);

  // gentle float when not dragging
  useFrame((state) => {
    if (meshRef.current && !dragging) {
      meshRef.current.position.y = currentPos[1] + Math.sin(state.clock.elapsedTime * 1.5) * 0.015;
    }
    // update connector line dynamically
    if (lineRef.current && meshRef.current) {
      const p = meshRef.current.position;
      lineRef.current.geometry.setFromPoints([
        new THREE.Vector3(p.x, p.y, p.z),
        new THREE.Vector3(...bodyPos),
      ]);
    }
  });

  const handlePointerDown = (e) => {
    e.stopPropagation();
    setDragging(true);
    onDragStart?.();
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    e.stopPropagation();
    // use the unprojected point on a plane at z=0.5
    const newPos = [e.point.x, e.point.y, 0.5];
    setPos(newPos);
    if (meshRef.current) {
      meshRef.current.position.set(newPos[0], newPos[1], newPos[2]);
    }
  };

  const handlePointerUp = (e) => {
    setDragging(false);
    onDragEnd?.();
  };

  return (
    <group ref={groupRef}>
      {/* Connector line */}
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([...currentPos, ...bodyPos])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" opacity={0.4} transparent />
      </line>

      {/* Image panel — draggable */}
      {texture && (
        <group
          ref={meshRef}
          position={currentPos}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Border/background */}
          <mesh position={[0, 0, -0.005]}>
            <planeGeometry args={[0.38, 0.38]} />
            <meshBasicMaterial color={dragging ? "#ffffff" : "#ffffff"} opacity={dragging ? 0.25 : 0.15} transparent />
          </mesh>
          {/* Image */}
          <mesh>
            <planeGeometry args={[0.35, 0.35]} />
            <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
          </mesh>
          {/* Invisible larger hit area for easier grabbing */}
          <mesh visible={false}>
            <planeGeometry args={[0.45, 0.45]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        </group>
      )}

      {/* Dot at body connection point */}
      <mesh position={bodyPos}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color="#ffffff" opacity={0.6} transparent />
      </mesh>
    </group>
  );
}

function DressedMannequin({ bodyType, outfit }) {
  const group = useRef();
  const [idleTime, setIdleTime] = useState(0);

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

  const bottomIsShorts = isShorts(bottomItem);
  const topIsFlannel = isFlannel(topItem);

  const breathe = Math.sin(idleTime * 1.2) * 0.008;

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.2;
    }
    setIdleTime(state.clock.elapsedTime);
  });

  return (
    <group ref={group}>
      <MannequinBody
        bodyScale={bodyScale}
        idleTime={idleTime}
        covered={{
          torso: !!(topItem || outerItem),
          legs: !!bottomItem,
          feet: !!shoesItem,
          shortsOnly: bottomIsShorts,
        }}
      />
      {/* Garments move with the body */}
      <group position={[0, breathe, 0]}>
        {topItem && (topIsFlannel
          ? <FlannelGarment color={topItem.color} bodyScale={bodyScale} idleTime={idleTime} />
          : <TopGarment color={topItem.color} bodyScale={bodyScale} idleTime={idleTime} />
        )}
        {outerItem && <OuterwearGarment color={outerItem.color} bodyScale={bodyScale} idleTime={idleTime} />}
        <group>
          {bottomItem && (bottomIsShorts
            ? <ShortsGarment color={bottomItem.color} bodyScale={bodyScale} />
            : <PantsGarment color={bottomItem.color} bodyScale={bodyScale} />
          )}
        </group>
        {shoesItem && <ShoeGarment color={shoesItem.color} bodyScale={bodyScale} />}
        {accItem && <AccessoryGarment color={accItem.color} idleTime={idleTime} />}
      </group>
    </group>
  );
}

/* ═══════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════ */
export default function MannequinViewer({ outfit = [], bodyType = "rectangle" }) {
  const [panelDragging, setPanelDragging] = useState(false);

  return (
    <div className="mannequinViewerContainer" style={{ cursor: panelDragging ? "grabbing" : undefined }}>
      <Canvas
        camera={{ position: [0, 0.85, 3.8], fov: 30 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Lighting />
        <DressedMannequin bodyType={bodyType} outfit={outfit} />
        <Platform />

        {/* Draggable floating image panels with connector lines */}
        {outfit.map((item) => (
          <ClothingPanel
            key={item.id}
            imageUrl={item.image_url}
            category={item.category || "Tops"}
            name={item.name}
            onDragStart={() => setPanelDragging(true)}
            onDragEnd={() => setPanelDragging(false)}
          />
        ))}
        <OrbitControls
          target={[0, 0.9, 0]}
          enablePan={false}
          enableZoom={true}
          enabled={!panelDragging}
          minDistance={1.8}
          maxDistance={5}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>

      <div className="mannequinHint">
        Drag images to reposition &middot; Drag background to rotate &middot; Scroll to zoom
      </div>
    </div>
  );
}
