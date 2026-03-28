import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ───────────────── GLSL Shaders ───────────────── */

const clothVertex = `
uniform float u_time;
uniform float u_settle;
uniform vec2 u_mouse;
uniform float u_hover;

varying vec2 vUv;
varying vec3 vPos;

void main() {
  vUv = uv;
  vec3 pos = position;

  // Pin at top edge, free at bottom
  float freedom = smoothstep(0.0, 0.25, 1.0 - uv.y);

  // Multi-frequency sine waves for cloth-like deformation
  float w1 = sin(pos.x * 5.0 + u_time * 2.5) * cos(pos.y * 4.0 + u_time * 1.8);
  float w2 = sin(pos.x * 9.0 - u_time * 1.5) * sin(pos.y * 7.0 + u_time) * 0.4;
  float w3 = cos(pos.x * 3.5 + pos.y * 2.5 + u_time * 2.2) * 0.25;

  // Combined displacement, damped by settle progress
  float amplitude = 0.12 * (1.0 - u_settle);
  pos.z += (w1 + w2 + w3) * amplitude * freedom;

  // Gravity drape - bottom sags more
  pos.z -= freedom * 0.08 * (1.0 - u_settle);

  // Subtle ambient breeze (always active, even when settled)
  pos.z += sin(pos.x * 2.0 + u_time * 0.5) * cos(pos.y * 1.5 + u_time * 0.3) * 0.006 * freedom;

  // Ripple from mouse hover
  float dist = distance(uv, u_mouse);
  float ripple = sin(dist * 20.0 - u_time * 8.0) * exp(-dist * 4.0) * u_hover * 0.04;
  pos.z += ripple * freedom;

  vPos = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const clothFragment = `
uniform sampler2D u_texture;
uniform bool u_hasTexture;
uniform float u_time;

varying vec2 vUv;
varying vec3 vPos;

void main() {
  // Surface normal from displaced position derivatives (cloth folds catch light)
  vec3 dx = dFdx(vPos);
  vec3 dy = dFdy(vPos);
  vec3 n = normalize(cross(dx, dy));

  // Two-point lighting for fabric depth
  vec3 light1 = normalize(vec3(0.3, 0.8, 0.5));
  vec3 light2 = normalize(vec3(-0.5, 0.3, 0.8));
  float diff = max(dot(n, light1), 0.0) * 0.7 + max(dot(n, light2), 0.0) * 0.2;
  float lighting = 0.85 + 0.3 * diff;

  vec4 color;
  if (u_hasTexture) {
    color = texture2D(u_texture, vUv);
  } else {
    // Gradient placeholder matching the app accent
    vec3 c1 = vec3(0.545, 0.118, 0.118);
    vec3 c2 = vec3(0.12, 0.12, 0.15);
    color = vec4(mix(c2, c1, vUv.y * 0.5 + 0.3), 1.0);
  }

  gl_FragColor = vec4(color.rgb * lighting, color.a);
}
`;

/* ───────────────── Cloth Mesh ───────────────── */

function ClothMesh({ texture, mouseRef }) {
  const meshRef = useRef();
  const startRef = useRef(null);

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_settle: { value: 0 },
      u_texture: { value: texture },
      u_hasTexture: { value: !!texture },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_hover: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    uniforms.u_texture.value = texture;
    uniforms.u_hasTexture.value = !!texture;
  }, [texture, uniforms]);

  useFrame((state) => {
    if (!meshRef.current) return;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startRef.current;

    uniforms.u_time.value = state.clock.elapsedTime;
    uniforms.u_settle.value = Math.min(1, elapsed / 2);

    // Smooth hover fade (lerp toward target)
    const target = mouseRef.current.hovering ? 1 : 0;
    uniforms.u_hover.value += (target - uniforms.u_hover.value) * 0.08;
    uniforms.u_mouse.value.set(mouseRef.current.x, mouseRef.current.y);
  });

  const { viewport } = useThree();

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, 32, 32]} />
      <shaderMaterial
        vertexShader={clothVertex}
        fragmentShader={clothFragment}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent
        extensions={{ derivatives: true }}
      />
    </mesh>
  );
}

/* ───────────────── Texture loader ───────────────── */

function TexturedClothMesh({ imageUrl, mouseRef }) {
  const [texture, setTexture] = useState(null);
  const textureRef = useRef(null);

  useEffect(() => {
    if (!imageUrl) {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
      setTexture(null);
      return;
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (tex) => {
      if (cancelled) {
        tex.dispose();
        return;
      }
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      setTexture((current) => {
        if (current) current.dispose();
        textureRef.current = tex;
        return tex;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, []);

  return <ClothMesh texture={texture} mouseRef={mouseRef} />;
}

/* ───────────────── Public component ───────────────── */

function ClothCard({ imageUrl, className, style }) {
  const mouseRef = useRef({ x: 0.5, y: 0.5, hovering: false });
  const containerRef = useRef(null);

  const onPointerMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current.x = (e.clientX - rect.left) / rect.width;
    mouseRef.current.y = 1 - (e.clientY - rect.top) / rect.height; // flip Y for UV space
  }, []);

  const onPointerEnter = useCallback(() => {
    mouseRef.current.hovering = true;
  }, []);

  const onPointerLeave = useCallback(() => {
    mouseRef.current.hovering = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        position: "relative",
        overflow: "hidden",
      }}
      onPointerMove={onPointerMove}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 100 }}
        style={{ position: "absolute", inset: 0, borderRadius: "inherit" }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        dpr={[1, 2]}
      >
        {imageUrl ? (
          <TexturedClothMesh imageUrl={imageUrl} mouseRef={mouseRef} />
        ) : (
          <ClothMesh texture={null} mouseRef={mouseRef} />
        )}
      </Canvas>
    </div>
  );
}

export default React.memo(ClothCard);
