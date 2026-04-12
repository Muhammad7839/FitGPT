import React, { useRef, useMemo, useEffect, useCallback, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";


const noiseGLSL = `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

/* ───────── Mesh gradient shaders ───────── */

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
${noiseGLSL}

uniform float u_time;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  // Multiple noise layers at different scales and speeds for organic blobs
  float n1 = snoise(vec3(uv * 2.0, u_time * 0.15)) * 0.5 + 0.5;
  float n2 = snoise(vec3(uv * 3.0 + 5.0, u_time * 0.12 + 10.0)) * 0.5 + 0.5;
  float n3 = snoise(vec3(uv * 1.5 + 10.0, u_time * 0.18 + 20.0)) * 0.5 + 0.5;

  // Warp UV with noise for fluid movement
  vec2 warpedUv = uv + vec2(
    snoise(vec3(uv * 2.5, u_time * 0.1)) * 0.15,
    snoise(vec3(uv * 2.5 + 50.0, u_time * 0.1)) * 0.15
  );
  float n4 = snoise(vec3(warpedUv * 2.0, u_time * 0.08)) * 0.5 + 0.5;

  // Blend 4 colors using noise fields
  vec3 c12 = mix(u_color1, u_color2, smoothstep(0.3, 0.7, n1));
  vec3 c34 = mix(u_color3, u_color4, smoothstep(0.3, 0.7, n2));
  vec3 color = mix(c12, c34, smoothstep(0.35, 0.65, n3));

  // Extra warped layer for depth
  color = mix(color, u_color1, smoothstep(0.4, 0.6, n4) * 0.3);

  // Soft vignette
  float vig = 1.0 - length((uv - 0.5) * vec2(1.2, 1.6)) * 0.3;
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;



function cssColorToVec3(cssColor) {
  if (!cssColor) return [0.1, 0.1, 0.1];
  const el = document.createElement("div");
  el.style.color = cssColor;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);
  const m = computed.match(/(\d+)/g);
  if (!m || m.length < 3) return [0.1, 0.1, 0.1];
  return [parseInt(m[0]) / 255, parseInt(m[1]) / 255, parseInt(m[2]) / 255];
}


function GradientPlane({ colors }) {
  const meshRef = useRef();
  const { viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_color1: { value: new THREE.Color(...colors[0]) },
      u_color2: { value: new THREE.Color(...colors[1]) },
      u_color3: { value: new THREE.Color(...colors[2]) },
      u_color4: { value: new THREE.Color(...colors[3]) },
    }),
    [colors]
  );

  useEffect(() => {
    uniforms.u_color1.value.setRGB(...colors[0]);
    uniforms.u_color2.value.setRGB(...colors[1]);
    uniforms.u_color3.value.setRGB(...colors[2]);
    uniforms.u_color4.value.setRGB(...colors[3]);
  }, [colors, uniforms]);

  useFrame((state) => {
    uniforms.u_time.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}


function MeshGradient({ className, style }) {
  const [colors, setColors] = useState(() => readThemeColors());

  const updateColors = useCallback(() => {
    setColors(readThemeColors());
  }, []);

  useEffect(() => {
    
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });
    return () => observer.disconnect();
  }, [updateColors]);

  return (
    <div className={className} style={style}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 100 }}
        style={{ position: "absolute", inset: 0 }}
        gl={{ alpha: false, antialias: false, powerPreference: "low-power" }}
        dpr={[1, 1.5]}
      >
        <GradientPlane colors={colors} />
      </Canvas>
    </div>
  );
}

export default React.memo(MeshGradient);

function readThemeColors() {
  const s = getComputedStyle(document.documentElement);
  return [
    cssColorToVec3(s.getPropertyValue("--accent").trim() || "#8b1e1e"),
    cssColorToVec3(s.getPropertyValue("--accent-deep").trim() || "#5a0f0f"),
    cssColorToVec3(s.getPropertyValue("--bg").trim() || "#141418"),
    cssColorToVec3(s.getPropertyValue("--accent-hover").trim() || "#6e1616"),
  ];
}
