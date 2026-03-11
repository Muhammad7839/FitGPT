// web/src/components/MannequinViewer.js
import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/* ─── colour helpers ─── */
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function themeAccent() {
  return getCSSVar("--accent") || "#8b1e1e";
}

/* ─── Mannequin body built from primitives ─── */
function Body({ bodyType }) {
  const group = useRef();

  // body type scaling
  const scale = useMemo(() => {
    const base = { shoulders: 1, torso: 1, hips: 1 };
    switch (bodyType) {
      case "inverted_triangle": return { shoulders: 1.2, torso: 1, hips: 0.85 };
      case "triangle":         return { shoulders: 0.85, torso: 1, hips: 1.15 };
      case "hourglass":        return { shoulders: 1.1, torso: 0.85, hips: 1.1 };
      case "oval":             return { shoulders: 1, torso: 1.15, hips: 1.05 };
      case "rectangle":
      default:                 return base;
    }
  }, [bodyType]);

  // gentle idle sway
  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.15;
    }
  });

  const matProps = { color: "#d4c4b0", roughness: 0.7, metalness: 0.05 };
  const jointMat = { color: "#bfae98", roughness: 0.6, metalness: 0.1 };

  return (
    <group ref={group}>
      {/* Head */}
      <mesh position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.2, 12]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 1.05, 0]} scale={[scale.shoulders, 1, 1]}>
        <capsuleGeometry args={[0.18, 0.9, 8, 16]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Hips/waist */}
      <mesh position={[0, 0.35, 0]} scale={[scale.hips, 1, 1]}>
        <capsuleGeometry args={[0.2, 0.3, 8, 16]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Left arm */}
      <group position={[-0.5 * scale.shoulders, 1.45, 0]} rotation={[0, 0, 0.2]}>
        <mesh position={[0, -0.3, 0]}>
          <capsuleGeometry args={[0.06, 0.35, 6, 12]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        <mesh position={[0, -0.5, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial {...jointMat} />
        </mesh>
        <mesh position={[0, -0.75, 0]}>
          <capsuleGeometry args={[0.05, 0.35, 6, 12]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      </group>

      {/* Right arm */}
      <group position={[0.5 * scale.shoulders, 1.45, 0]} rotation={[0, 0, -0.2]}>
        <mesh position={[0, -0.3, 0]}>
          <capsuleGeometry args={[0.06, 0.35, 6, 12]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        <mesh position={[0, -0.5, 0]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial {...jointMat} />
        </mesh>
        <mesh position={[0, -0.75, 0]}>
          <capsuleGeometry args={[0.05, 0.35, 6, 12]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      </group>

      {/* Left leg */}
      <group position={[-0.15 * scale.hips, 0, 0]}>
        <mesh position={[0, -0.15, 0]}>
          <capsuleGeometry args={[0.09, 0.45, 6, 12]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <sphereGeometry args={[0.065, 8, 8]} />
          <meshStandardMaterial {...jointMat} />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <capsuleGeometry args={[0.07, 0.45, 6, 12]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        {/* Foot */}
        <mesh position={[0, -1.02, 0.06]}>
          <boxGeometry args={[0.14, 0.08, 0.22]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      </group>

      {/* Right leg */}
      <group position={[0.15 * scale.hips, 0, 0]}>
        <mesh position={[0, -0.15, 0]}>
          <capsuleGeometry args={[0.09, 0.45, 6, 12]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <sphereGeometry args={[0.065, 8, 8]} />
          <meshStandardMaterial {...jointMat} />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <capsuleGeometry args={[0.07, 0.45, 6, 12]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
        {/* Foot */}
        <mesh position={[0, -1.02, 0.06]}>
          <boxGeometry args={[0.14, 0.08, 0.22]} />
          <meshStandardMaterial {...matProps} />
        </mesh>
      </group>
    </group>
  );
}

/* ─── Floating clothing panel at a body zone ─── */
function ClothingPanel({ imageUrl, category, index }) {
  const meshRef = useRef();
  const [texture, setTexture] = useState(null);

  // position map: category → [x, y, z]
  const position = useMemo(() => {
    const offset = index * 0.05; // slight stagger if multiple same-category
    switch (category) {
      case "Tops":       return [-0.85, 1.15 + offset, 0.3];
      case "Bottoms":    return [0.85, 0.0 + offset, 0.3];
      case "Outerwear":  return [-0.85, 0.3 + offset, 0.3];
      case "Shoes":      return [0.85, -0.85 + offset, 0.3];
      case "Accessories":return [-0.85, 2.0 + offset, 0.3];
      default:           return [0.85, 0.6 + offset, 0.3];
    }
  }, [category, index]);

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

  // gentle float animation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.2 + index) * 0.03;
    }
  });

  if (!texture) return null;

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[0.55, 0.55]} />
      <meshStandardMaterial
        map={texture}
        transparent
        roughness={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ─── Connector line from panel to body zone ─── */
function ConnectorLine({ category, index }) {
  const lineRef = useRef();

  const points = useMemo(() => {
    const offset = index * 0.05;
    let panelPos, bodyPos;
    switch (category) {
      case "Tops":
        panelPos = [-0.58, 1.15 + offset, 0.3];
        bodyPos = [-0.2, 1.15, 0];
        break;
      case "Bottoms":
        panelPos = [0.58, 0.0 + offset, 0.3];
        bodyPos = [0.15, 0.0, 0];
        break;
      case "Outerwear":
        panelPos = [-0.58, 0.3 + offset, 0.3];
        bodyPos = [-0.3, 0.5, 0];
        break;
      case "Shoes":
        panelPos = [0.58, -0.85 + offset, 0.3];
        bodyPos = [0.1, -0.95, 0];
        break;
      case "Accessories":
        panelPos = [-0.58, 2.0 + offset, 0.3];
        bodyPos = [0, 1.8, 0];
        break;
      default:
        panelPos = [0.58, 0.6 + offset, 0.3];
        bodyPos = [0.1, 0.6, 0];
    }
    return [new THREE.Vector3(...panelPos), new THREE.Vector3(...bodyPos)];
  }, [category, index]);

  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial color="#8b1e1e" opacity={0.35} transparent linewidth={1} />
    </line>
  );
}

/* ─── Platform / ground disc ─── */
function Platform() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.12, 0]} receiveShadow>
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

/* ─── Category label sprite ─── */
function CategoryLabel({ category, position }) {
  const canvasTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#555";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(category, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, [category]);

  return (
    <sprite position={position} scale={[0.6, 0.15, 1]}>
      <spriteMaterial map={canvasTexture} transparent opacity={0.7} />
    </sprite>
  );
}

/* ─── Main viewer component ─── */
export default function MannequinViewer({ outfit = [], bodyType = "rectangle" }) {
  const containerRef = useRef();

  // group items by category to assign panel index offsets
  const panels = useMemo(() => {
    const catCount = {};
    return outfit.map((item) => {
      const cat = item.category || "Tops";
      catCount[cat] = (catCount[cat] || 0);
      const idx = catCount[cat]++;
      return { ...item, panelIndex: idx };
    });
  }, [outfit]);

  // category labels positions
  const labelPositions = useMemo(() => ({
    Tops:        [-0.85, 1.5, 0.3],
    Bottoms:     [0.85, 0.35, 0.3],
    Outerwear:   [-0.85, 0.65, 0.3],
    Shoes:       [0.85, -0.55, 0.3],
    Accessories: [-0.85, 2.35, 0.3],
  }), []);

  // unique categories in this outfit for labels
  const categories = useMemo(() => {
    return [...new Set(panels.map(p => p.category || "Tops"))];
  }, [panels]);

  return (
    <div ref={containerRef} className="mannequinViewerContainer">
      <Canvas
        camera={{ position: [0, 0.8, 4], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Lighting />
        <Body bodyType={bodyType} />
        <Platform />

        {panels.map((item, i) => (
          <React.Fragment key={item.id || i}>
            <ClothingPanel
              imageUrl={item.image_url}
              category={item.category || "Tops"}
              index={item.panelIndex}
            />
            <ConnectorLine
              category={item.category || "Tops"}
              index={item.panelIndex}
            />
          </React.Fragment>
        ))}

        {categories.map((cat) => (
          <CategoryLabel key={cat} category={cat} position={labelPositions[cat] || [0.85, 0.6, 0.3]} />
        ))}

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={2.5}
          maxDistance={7}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 1.8}
          autoRotate={false}
        />
      </Canvas>

      <div className="mannequinHint">
        Drag to rotate &middot; Scroll to zoom
      </div>
    </div>
  );
}
