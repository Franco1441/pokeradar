import * as THREE from "three";
import type { Encounter } from "@/lib/types";

const PATH_NEAR = 8;
const PATH_LENGTH = 30;

const STATIONS = [
  {
    x: -7,
    z: 4,
    yaw: 0.16,
    pitch: -0.066,
    width: 5.6,
    curve: 0.9,
    cropX: 5,
    cropY: 0,
    scale: 1.18,
  },
  {
    x: 0,
    z: -3,
    yaw: 0.02,
    pitch: -0.11,
    width: 4.2,
    curve: -0.7,
    cropX: 0,
    cropY: -3,
    scale: 1.30,
  },
  {
    x: 7,
    z: -4,
    yaw: -0.33,
    pitch: -0.053,
    width: 6.8,
    curve: 1.45,
    cropX: -8,
    cropY: 2,
    scale: 1.32,
  },
] as const;

const SIGHTING_POSITIONS = [
  { bearing: -0.37, distance: 7.3 },
  { bearing: 0.32, distance: 8.4 },
  { bearing: -0.73, distance: 10.1 },
  { bearing: 0.67, distance: 10.8 },
] as const;

function stationFrames(position: number) {
  const step = THREE.MathUtils.clamp(position, 0, STATIONS.length - 1);
  const index = Math.floor(step);
  return {
    from: STATIONS[index],
    to: STATIONS[Math.min(index + 1, STATIONS.length - 1)],
    blend: step - index,
  };
}

export function safariPanorama(position: number, turn: number) {
  const { from, to, blend } = stationFrames(position);
  const scale = THREE.MathUtils.lerp(from.scale, to.scale, blend);
  const x = THREE.MathUtils.lerp(from.cropX, to.cropX, blend) - turn * 12;
  const margin = (scale - 1) * 49;
  return {
    x: THREE.MathUtils.clamp(x, -margin, margin),
    y: THREE.MathUtils.lerp(from.cropY, to.cropY, blend),
    scale,
  };
}

const PROFILES = {
  nikko: ["#594432", "#aa8765", "#305c38", "#777c65"],
  iguazu: ["#51432c", "#93704c", "#386948", "#77876a"],
  reykjanes: ["#343638", "#777369", "#666e46", "#696b69"],
  namib: ["#915531", "#d09a62", "#9b8860", "#a87851"],
  zermatt: ["#919b9c", "#d8dcda", "#738583", "#697b82"],
  heron: ["#466766", "#a0b798", "#347b73", "#81a6a2"],
  everglades: ["#5d5541", "#a99468", "#778044", "#787963"],
} as const;

const groundVertex = `
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  vUv = uv;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

const groundFragment = `
uniform vec3 soil;
uniform vec3 highlights;
uniform float daylight;
varying vec2 vUv;
varying vec3 vWorld;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 blend = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(cell), hash(cell + vec2(1, 0)), blend.x),
    mix(hash(cell + vec2(0, 1)), hash(cell + vec2(1, 1)), blend.x),
    blend.y
  );
}

void main() {
  float depth = distance(vWorld.xz, cameraPosition.xz);
  float texture = noise(vWorld.xz * 2.0) * 0.43 + noise(vWorld.xz * 12.0) * 0.29
    + noise(vWorld.xz * 42.0) * 0.28;
  float wear = 1.0 - smoothstep(0.0, 0.44, abs(vUv.x - 0.5));
  vec3 color = mix(soil, highlights, smoothstep(0.08, 0.95, texture + wear * 0.12));
  color *= mix(vec3(0.30, 0.48, 0.57), vec3(1.0), daylight);

  float edge = abs(vUv.x - 0.5) + (noise(vWorld.xz * 2.4) - 0.5) * 0.09;
  float opacity = (1.0 - smoothstep(0.16, 0.48, edge))
    * (1.0 - smoothstep(3.2, 17.0, depth)) * 0.72;
  gl_FragColor = vec4(color, opacity);
  #include <colorspace_fragment>
}
`;

const shadowVertex = `
varying vec2 shadowUv;
varying float depth;

void main() {
  vec4 view = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  shadowUv = 2.0 * uv - 1.0;
  depth = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

const shadowFragment = `
varying vec2 shadowUv;
varying float depth;

void main() {
  float edge = 1.0 - smoothstep(0.24, 1.0, length(shadowUv));
  float fade = smoothstep(0.85, 2.9, depth) * (1.0 - smoothstep(6.0, 13.5, depth));
  gl_FragColor = vec4(0.08, 0.06, 0.05, edge * fade * 0.34);
}
`;

function pathCenter(z: number, curve: number) {
  return (
    (Math.sin(-z * 0.16) * 1.22 + Math.sin(-z * 0.068) * 0.56) * curve
  );
}

function pathHeight(z: number) {
  return Math.sin(z * 0.24) * 0.13;
}

function pathGeometry(station: (typeof STATIONS)[number]) {
  const rows = 42;
  const geometry = new THREE.PlaneGeometry(station.width, PATH_LENGTH, 4, rows);
  const points = geometry.getAttribute("position");
  for (let i = 0; i < points.count; i++) {
    const z = PATH_NEAR - (PATH_LENGTH * ((i / 5) | 0)) / rows;
    const offset = points.getX(i);
    points.setXYZ(i, pathCenter(z, station.curve) + offset, pathHeight(z), z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function grassGeometry() {
  const points: number[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.39996;
    const lean = 0.28 + i * 0.051;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    const height = 0.51 + (i % 3) * 0.16;
    points.push(
      -z * 0.065,
      0,
      x * 0.065,
      z * 0.065,
      0,
      -x * 0.065,
      x * lean,
      height,
      z * lean,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function scatter(
  station: (typeof STATIONS)[number],
  random: () => number,
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  count: number,
  baseColor: THREE.Color,
  size: [number, number],
  edgeSpread: number,
  shadows?: THREE.InstancedMesh,
) {
  const object = new THREE.Object3D();
  const instances = new THREE.InstancedMesh(geometry, material, count);
  for (let i = 0; i < count; i++) {
    const z = 5 - (PATH_LENGTH - 3) * random();
    const lateral = station.width * 0.3 + edgeSpread * random();
    const side = i % 2 ? 1 : -1;
    const scale = size[0] + (size[1] - size[0]) * random();
    object.position.set(
      pathCenter(z, station.curve) + lateral * side,
      pathHeight(z),
      z,
    );
    object.rotation.set(0, random() * Math.PI * 2, 0);
    object.scale.set(scale, scale * (0.64 + random() * 0.52), scale);
    object.updateMatrix();
    instances.setMatrixAt(i, object.matrix);
    instances.setColorAt(
      i,
      baseColor.clone().multiplyScalar(0.72 + random() * 0.6),
    );
    if (shadows) {
      object.position.y += 0.015;
      object.scale.set(scale * 1.19, 1, scale * 0.98);
      object.updateMatrix();
      shadows.setMatrixAt(i, object.matrix);
    }
  }
  return instances;
}

function rockGeometry() {
  const geometry = new THREE.IcosahedronGeometry(0.34, 1);
  const points = geometry.getAttribute("position");
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i);
    const y = points.getY(i);
    const z = points.getZ(i);
    const shape = 1 + Math.sin(x * 19 + y * 14) * Math.cos(z * 17) * 0.19;
    points.setXYZ(i, x * shape, y * shape * 0.66 + 0.12, z * shape);
  }
  return geometry;
}

function blendScenery(material: THREE.MeshStandardMaterial, isRock: boolean) {
  material.onBeforeCompile = (shader) => {
    if (isRock) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vStone;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvStone = position;",
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vStone;",
      );
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      diffuseColor.a *= smoothstep(0.85, 2.9, vViewPosition.z)
        * (1.0 - smoothstep(6.0, 13.5, vViewPosition.z));
      ${isRock ? "float grain = fract(sin(dot(floor(vStone * 145.0), vec3(13.21, 71.7, 9.85))) * 4375.28); diffuseColor.rgb *= 0.80 + grain * 0.34;" : ""}`,
    );
  };
  material.customProgramCacheKey = () =>
    isRock ? "safari-stone" : "safari-grass";
}

function createScene(destination: string) {
  const palette =
    PROFILES[destination as keyof typeof PROFILES] ?? PROFILES.nikko;
  const scene = new THREE.Scene();
  let seed =
    [...destination].reduce(
      (value, letter) => 31 * value + letter.charCodeAt(0),
      69,
    ) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const fog = new THREE.Fog("#53665e", 3, 28);
  scene.fog = fog;
  const ground = new THREE.ShaderMaterial({
    vertexShader: groundVertex,
    fragmentShader: groundFragment,
    uniforms: {
      soil: { value: new THREE.Color(palette[0]) },
      highlights: { value: new THREE.Color(palette[1]) },
      daylight: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plant = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    roughness: 1,
    flatShading: true,
    transparent: true,
    depthWrite: false,
  });
  const stone = new THREE.MeshStandardMaterial({
    roughness: 1,
    transparent: true,
    depthWrite: false,
  });
  const contactShadow = new THREE.ShaderMaterial({
    vertexShader: shadowVertex,
    fragmentShader: shadowFragment,
    transparent: true,
    depthWrite: false,
  });
  blendScenery(plant, false);
  blendScenery(stone, true);
  const open =
    destination === "namib" ||
    destination === "zermatt" ||
    destination === "reykjanes";
  const grass = grassGeometry();
  const rock = rockGeometry();
  const shadow = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const plantColor = new THREE.Color(palette[2]);
  const stoneColor = new THREE.Color(palette[3]);
  for (const [index, station] of STATIONS.entries()) {
    const group = new THREE.Group();
    group.position.set(station.x, 0, station.z);
    group.rotation.y = station.yaw;
    const stones = 23 - index * 4;
    const shadows = new THREE.InstancedMesh(shadow, contactShadow, stones);
    shadows.renderOrder = 1;
    const boulders = scatter(
      station,
      random,
      rock,
      stone,
      stones,
      stoneColor,
      [0.13, open ? 0.94 : 0.75],
      index === 2 ? 2.75 : 1.55,
      shadows,
    );
    boulders.renderOrder = 2;
    group.add(
      new THREE.Mesh(pathGeometry(station), ground),
      scatter(
        station,
        random,
        grass,
        plant,
        (open ? 14 : 45) + index * 8,
        plantColor,
        [0.17, 0.72],
        index === 1 ? 1.55 : 2.3,
      ),
      shadows,
      boulders,
    );
    scene.add(group);
  }
  const ambient = new THREE.HemisphereLight("#f2edd7", "#37473f", 1.65);
  const sun = new THREE.DirectionalLight("#fff5d7", 2);
  sun.position.set(-8, 12, -10);
  scene.add(ambient, sun);
  return { scene, ground, plant, stone, contactShadow, fog, ambient, sun };
}

export function createSafariWorld(
  host: HTMLDivElement,
  destination: string,
  onRendererChange: (active: boolean) => void,
  redraw: () => void,
) {
  const { scene, ground, plant, stone, contactShadow, fog, ambient, sun } =
    createScene(destination);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.12, 76);
  const projected = new THREE.Vector3();
  const cameraSpace = new THREE.Vector3();
  let renderer: THREE.WebGLRenderer | null = null;
  let canRender = false;
  let width = 1;
  let height = 1;
  let cameraPosition = 0;

  function loseContext(event: Event) {
    event.preventDefault();
    canRender = false;
    onRendererChange(false);
  }
  function restoreContext() {
    canRender = true;
    onRendererChange(true);
    redraw();
  }

  const canvas = document.createElement("canvas");
  try {
    const context = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
    });
    if (context) {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        context,
        canvas,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor("#000000", 0);
      renderer.setSize(1, 1, false);
      host.append(canvas);
      canvas.addEventListener("webglcontextlost", loseContext);
      canvas.addEventListener("webglcontextrestored", restoreContext);
      canRender = true;
    }
  } catch {
    renderer?.dispose();
    renderer = null;
    canvas.remove();
  }

  return {
    active: canRender,
    resize(nextWidth: number, nextHeight: number) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      camera.aspect = width / height;
      camera.fov = camera.aspect < 0.75 ? 65 : 55;
      camera.updateProjectionMatrix();
      renderer?.setSize(width, height, false);
    },
    light(isDay: boolean) {
      ground.uniforms.daylight.value = isDay ? 1 : 0;
      ambient.intensity = isDay ? 1.65 : 0.88;
      ambient.color.set(isDay ? "#f2edd7" : "#a3c5ee");
      sun.intensity = isDay ? 2 : 0.38;
      sun.color.set(isDay ? "#fff5d7" : "#b1c9ff");
      fog.color.set(isDay ? "#53665e" : "#273f52");
    },
    draw(position: number, turn: number, moving: boolean) {
      cameraPosition = position;
      const { from, to, blend } = stationFrames(position);
      const slide = moving ? Math.sin(blend * Math.PI) : 0;
      camera.position.set(
        THREE.MathUtils.lerp(from.x, to.x, blend),
        1.52 + slide * 0.12,
        THREE.MathUtils.lerp(from.z, to.z, blend) + slide * 0.65,
      );
      camera.rotation.set(
        THREE.MathUtils.lerp(from.pitch, to.pitch, blend),
        THREE.MathUtils.lerp(from.yaw, to.yaw, blend) - turn * 0.73,
        0,
        "YXZ",
      );
      camera.updateMatrixWorld();
      if (canRender) renderer?.render(scene, camera);
    },
    locate(
      encounter: Encounter,
      zoneIndex: number,
      slotIndex: number,
      activeZone: number,
    ) {
      if (zoneIndex !== activeZone) return null;
      const station = STATIONS[zoneIndex];
      const placement = SIGHTING_POSITIONS[slotIndex];
      const arrival = Math.abs(cameraPosition - activeZone);
      if (!station || !placement || arrival >= 0.52) return null;
      const halfWidth =
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      const yaw = station.yaw - Math.atan(placement.bearing * halfWidth);
      const suspended =
        destination === "heron" || encounter.types.includes("flying");
      projected.set(
        station.x - Math.sin(yaw) * placement.distance,
        suspended ? 0.58 : 0.19,
        station.z - Math.cos(yaw) * placement.distance,
      );
      cameraSpace.copy(projected).applyMatrix4(camera.matrixWorldInverse);
      const depth = -cameraSpace.z;
      if (depth < 0.8 || depth > 15) return null;
      projected.project(camera);
      if (Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.08)
        return null;
      const widthLimit = Math.min(
        width * (slotIndex < 2 ? 0.265 : 0.175),
        width < 600 ? 126 : 176,
      );
      return {
        x: ((projected.x + 1) * width) / 2,
        y: ((1 - projected.y) * height) / 2,
        size: Math.max(42, Math.min(widthLimit, (height * 1.1) / depth)),
        opacity: 1 - arrival / 0.52,
      };
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", loseContext);
      canvas.removeEventListener("webglcontextrestored", restoreContext);
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) geometries.add(node.geometry);
        if (node instanceof THREE.InstancedMesh) node.dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      ground.dispose();
      plant.dispose();
      stone.dispose();
      contactShadow.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      canvas.remove();
    },
  };
}
