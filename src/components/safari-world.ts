import * as THREE from "three";
import type { Encounter } from "@/lib/types";

const FULL_TURN = Math.PI * 2;
const MAX_RENDER_PIXELS = 4_200_000;

const STATIONS = [
  {
    x: -7,
    z: 4,
    yaw: 0.16,
    pitch: -0.066,
    elevation: 1.56,
  },
  {
    x: 0,
    z: -3,
    yaw: 0.02,
    pitch: -0.074,
    elevation: 1.62,
  },
  {
    x: 7,
    z: -4,
    yaw: -0.33,
    pitch: -0.053,
    elevation: 1.53,
  },
] as const;

const SIGHTING_POSITIONS = [
  { bearing: -0.196, distance: 7.3 },
  { bearing: 0.184, distance: 8.4 },
  { bearing: -0.99, distance: 8.1 },
  { bearing: 2.23, distance: 9.2 },
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

export function safariFallbackPanorama(heading: number, width: number, height: number) {
  const size = Math.max(width * 3, height * 2.8);
  const turn = ((heading / FULL_TURN) % 1 + 1) % 1;
  return { size, left: (width - size) / 2 - turn * size };
}

export function isSafariPanorama(source: string) {
  return /-360\.webp(?:[?#]|$)/i.test(source);
}

export function getSafariSignalBearing(zoneIndex: number, slotIndex: number) {
  const station = STATIONS[zoneIndex] ?? STATIONS[0];
  return -station.yaw + (SIGHTING_POSITIONS[slotIndex]?.bearing ?? 0);
}

const panoramaVertex = `
varying vec2 screenPosition;

void main() {
  screenPosition = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const panoramaFragment = `
uniform sampler2D photo;
uniform float daylight;
uniform mat3 cameraRotation;
uniform vec2 projectionScale;
varying vec2 screenPosition;

void main() {
  vec3 ray = cameraRotation * vec3(screenPosition * projectionScale, -1.0);
  vec2 uv = vec2(
    0.5 + atan(ray.x, -ray.z) / 6.28318530,
    0.5 + atan(ray.y, length(ray.xz)) / 3.14159265
  );
  // Longitude wraps at the back of the panorama. Subtract a whole turn from
  // the gradient there so the seam samples the same mip level as its neighbors.
  vec2 across = dFdx(uv);
  vec2 down = dFdy(uv);
  across.x -= round(across.x);
  down.x -= round(down.x);
  vec3 color = textureGrad(photo, uv, across, down).rgb;
  vec3 night = mix(vec3(dot(color, vec3(0.28, 0.57, 0.15))), color, 0.66);
  night *= vec3(0.30, 0.41, 0.57);
  gl_FragColor = vec4(mix(night, color, daylight), 1.0);
  #include <colorspace_fragment>
}
`;

export function createSafariWorld(
  host: HTMLDivElement,
  destination: string,
  onRendererChange: (active: boolean) => void,
  redraw: () => void,
) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.12, 76);
  const projected = new THREE.Vector3();
  const cameraSpace = new THREE.Vector3();
  const skyGeometry = new THREE.BufferGeometry();
  skyGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  const cameraRotation = new THREE.Matrix3();
  const projectionScale = new THREE.Vector2();
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      photo: { value: null as THREE.Texture | null },
      daylight: { value: 1 },
      cameraRotation: { value: cameraRotation },
      projectionScale: { value: projectionScale },
    },
    vertexShader: panoramaVertex,
    fragmentShader: panoramaFragment,
    depthWrite: false,
    depthTest: false,
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.visible = false;
  sky.frustumCulled = false;
  scene.add(sky);
  let renderer: THREE.WebGLRenderer | null = null;
  let panoramaTexture: THREE.Texture<HTMLImageElement> | null = null;
  let preparedTexture: THREE.Texture<HTMLImageElement> | null = null;
  let canRender = false;
  let width = 1;
  let height = 1;
  let cameraPosition = 0;
  let heading = 0;

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

  function preparePanorama(image: HTMLImageElement) {
    if (
      !renderer ||
      !isSafariPanorama(image.src) ||
      panoramaTexture?.image === image ||
      preparedTexture?.image === image
    ) return;
    preparedTexture?.dispose();
    preparedTexture = new THREE.Texture(image);
    preparedTexture.colorSpace = THREE.SRGBColorSpace;
    preparedTexture.wrapS = THREE.RepeatWrapping;
    preparedTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    preparedTexture.needsUpdate = true;
    if (canRender) renderer.initTexture(preparedTexture);
  }

  const canvas = document.createElement("canvas");
  try {
    const context = canvas.getContext("webgl2", {
      alpha: true,
      depth: false,
    });
    if (context) {
      renderer = new THREE.WebGLRenderer({
        context,
        canvas,
      });
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
    get heading() {
      return heading;
    },
    preparePanorama,
    setPanorama(image: HTMLImageElement) {
      if (!renderer || panoramaTexture?.image === image) return;
      preparePanorama(image);
      panoramaTexture?.dispose();
      panoramaTexture = preparedTexture?.image === image ? preparedTexture : null;
      if (!panoramaTexture) preparedTexture?.dispose();
      preparedTexture = null;
      skyMaterial.uniforms.photo.value = panoramaTexture;
      sky.visible = Boolean(panoramaTexture);
    },
    resize(nextWidth: number, nextHeight: number) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      camera.aspect = width / height;
      camera.fov = camera.aspect < 0.75 ? 69 : 55;
      camera.updateProjectionMatrix();
      const projection = camera.projectionMatrix.elements;
      projectionScale.set(1 / projection[0], 1 / projection[5]);
      if (renderer) {
        const pixelRatio = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(MAX_RENDER_PIXELS / (width * height)),
        );
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
      }
    },
    light(isDay: boolean) {
      skyMaterial.uniforms.daylight.value = isDay ? 1 : 0;
    },
    draw(position: number, bearing: number) {
      cameraPosition = position;
      const { from, to, blend } = stationFrames(position);
      heading = bearing;
      camera.position.set(
        THREE.MathUtils.lerp(from.x, to.x, blend),
        THREE.MathUtils.lerp(from.elevation, to.elevation, blend),
        THREE.MathUtils.lerp(from.z, to.z, blend),
      );
      camera.rotation.set(
        THREE.MathUtils.lerp(from.pitch, to.pitch, blend),
        -(heading % FULL_TURN),
        0,
        "YXZ",
      );
      camera.updateMatrixWorld();
      cameraRotation.setFromMatrix4(camera.matrixWorld);
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
      const bearing = getSafariSignalBearing(zoneIndex, slotIndex);
      const suspended =
        destination === "heron" || encounter.types.includes("flying");
      projected.set(
        station.x + Math.sin(bearing) * placement.distance,
        suspended ? 0.58 : 0.19,
        station.z - Math.cos(bearing) * placement.distance,
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
      skyGeometry.dispose();
      skyMaterial.dispose();
      panoramaTexture?.dispose();
      preparedTexture?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      canvas.remove();
    },
  };
}
