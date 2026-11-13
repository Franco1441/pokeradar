import * as THREE from "three";
import type { Encounter } from "@/lib/types";

const FULL_TURN = Math.PI * 2;

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

export function safariPanorama(heading: number) {
  const rear = (1 - Math.cos(heading)) / 2;
  return {
    x: -17 * Math.sin(heading) + rear * 5,
    y: rear * -8,
    scale: 1.46 + rear * 0.15,
  };
}

export function getSafariSignalBearing(zoneIndex: number, slotIndex: number) {
  const station = STATIONS[zoneIndex] ?? STATIONS[0];
  return -station.yaw + (SIGHTING_POSITIONS[slotIndex]?.bearing ?? 0);
}

const panoramaVertex = `
varying vec3 vRay;

void main() {
  vRay = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const panoramaFragment = `
uniform sampler2D photo;
uniform float daylight;
uniform vec2 photoExtent;
uniform bool equirectangular;
varying vec3 vRay;

// Fold the photo at its edges to make the full turn continuous. Round the
// fold over a small interval so it does not create a hard crease while turning.
float mirror(float coordinate) {
  float distanceToCenter = abs(mod(coordinate, 2.0) - 1.0);
  float edgeDistance = min(distanceToCenter, 1.0 - distanceToCenter);
  float feather = 0.022;
  if (edgeDistance >= feather) return 1.0 - distanceToCenter;
  float edge = edgeDistance / feather;
  float rounded = feather * (0.5 + edge * edge * 0.5);
  return distanceToCenter < 0.5 ? 1.0 - rounded : rounded;
}

void main() {
  vec3 ray = normalize(vRay);
  float angle = atan(ray.x, -ray.z);
  float elevation = atan(ray.y, length(ray.xz));
  float x = equirectangular
    ? angle / 6.28318530
    : mirror(0.5 + angle / photoExtent.x);
  float y = equirectangular
    ? 0.5 + elevation / 3.14159265
    : clamp(0.54 + elevation / photoExtent.y, 0.001, 0.999);
  vec3 color = texture2D(photo, vec2(x, y)).rgb;
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
  const skyGeometry = new THREE.SphereGeometry(58, 48, 24);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      photo: { value: null as THREE.Texture | null },
      daylight: { value: 1 },
      photoExtent: { value: new THREE.Vector2() },
      equirectangular: { value: false },
    },
    vertexShader: panoramaVertex,
    fragmentShader: panoramaFragment,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.visible = false;
  sky.renderOrder = -10;
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
    if (!renderer || panoramaTexture?.image === image || preparedTexture?.image === image) return;
    preparedTexture?.dispose();
    preparedTexture = new THREE.Texture(image);
    preparedTexture.colorSpace = THREE.SRGBColorSpace;
    if (/-360\.webp(?:[?#]|$)/i.test(image.src)) {
      preparedTexture.wrapS = THREE.RepeatWrapping;
    }
    preparedTexture.needsUpdate = true;
    if (canRender) renderer.initTexture(preparedTexture);
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
    get heading() {
      return heading;
    },
    preparePanorama,
    setPanorama(image: HTMLImageElement) {
      if (!renderer || panoramaTexture?.image === image) return;
      preparePanorama(image);
      panoramaTexture?.dispose();
      panoramaTexture = preparedTexture;
      preparedTexture = null;
      skyMaterial.uniforms.photo.value = panoramaTexture;
      skyMaterial.uniforms.equirectangular.value =
        panoramaTexture?.wrapS === THREE.RepeatWrapping;

      // Each repeated half-turn covers a whole landscape. The angular extent
      // in each axis follows the source aspect ratio, with extra vertical room
      // for narrow, tall viewports and wide fallback images.
      const aspect = image.naturalWidth / image.naturalHeight;
      const verticalExtent = Math.max(1.5, Math.PI / aspect);
      skyMaterial.uniforms.photoExtent.value.set(Math.PI, verticalExtent);
      sky.visible = true;
    },
    resize(nextWidth: number, nextHeight: number) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      camera.aspect = width / height;
      camera.fov = camera.aspect < 0.75 ? 69 : 55;
      camera.updateProjectionMatrix();
      renderer?.setSize(width, height, false);
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
      sky.position.copy(camera.position);
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
