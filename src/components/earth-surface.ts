import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
} from "maplibre-gl";
import { getSolarPosition } from "@/lib/globe-lighting";

export const EARTH_SURFACE_LAYER = "pokeradar-earth-surface";
export const EARTH_SURFACE_FADE_END = 6.25;
const EARTH_SURFACE_FADE_START = 4.25;
const LONGITUDE_SEGMENTS = 144;
const LATITUDE_SEGMENTS = 72;
const RADIANS = Math.PI / 180;

type EarthTextures = [HTMLImageElement, HTMLImageElement];

const fragmentSource = `#version 300 es
precision highp float;
in vec2 v_texture;
out vec4 fragColor;
uniform sampler2D u_day;
uniform sampler2D u_night;
uniform vec3 u_sun;
uniform vec4 u_horizon;
uniform float u_opacity;
uniform float u_projection_transition;
uniform bool u_atmosphere;

void main() {
    float longitude = (v_texture.x * 2.0 - 1.0) * 3.14159265;
    float latitude = (0.5 - v_texture.y) * 3.14159265;
    float cosLat = cos(latitude);
    vec3 normal = vec3(sin(longitude) * cosLat, sin(latitude), cos(longitude) * cosLat);
    float light = dot(normal, u_sun);
    float day = smoothstep(-0.24, 0.18, light);
    float altitude = max(0.0, dot(normal, u_horizon.xyz) + u_horizon.w);
    float blueHour = smoothstep(-0.38, 0.35, light);
    vec3 sky = mix(vec3(0.43, 0.64, 0.82), vec3(0.68, 0.86, 1.0), blueHour);

    if (u_atmosphere) {
        float scattering = exp(-altitude * 58.0) * mix(0.32, 0.62, blueHour);
        float opacity = scattering * u_opacity;
        fragColor = vec4(sky * opacity, opacity);
        return;
    }

    vec3 ground = texture(u_day, v_texture).rgb;
    float ocean = smoothstep(0.012, 0.065, ground.b - max(ground.r, ground.g) * 1.05)
        * (1.0 - smoothstep(0.32, 0.65, ground.r));
    float waterRelief = dot(ground, vec3(0.2126, 0.7152, 0.0722));
    vec3 water = vec3(0.080, 0.157, 0.222) + waterRelief * vec3(0.25, 0.31, 0.34);
    ground = mix(ground, water, ocean * 0.88);
    float radiance = texture(u_night, v_texture).r;
    // A coarser mip level spreads the same light sources into a soft glow.
    float scatteredRadiance = texture(u_night, v_texture, 1.8).r;
    vec3 daylight = pow(ground, vec3(0.89)) * mix(0.83, 1.09, smoothstep(-0.07, 0.78, light));
    vec3 night = ground * vec3(0.25, 0.29, 0.40) + vec3(0.012, 0.018, 0.030);
    float city = pow(max(0.0, radiance - 0.022), 0.86);
    float cityGlow = pow(max(0.0, scatteredRadiance - 0.016), 0.79);
    vec3 cityLights = vec3(1.0, 0.84, 0.56) * city * 1.24
        + vec3(0.82, 0.43, 0.17) * cityGlow * 0.66;
    vec3 color = mix(night, daylight, day);
    color += cityLights * (1.0 - smoothstep(-0.23, 0.06, light));
    float rim = exp(-altitude * 12.0) * mix(0.17, 0.45, blueHour);
    float edge = exp(-altitude * 54.0) * mix(0.47, 0.65, blueHour);
    float atmosphere = clamp(rim + edge, 0.0, 0.96) * u_projection_transition;
    color = mix(color, sky, atmosphere);
    fragColor = vec4(color * u_opacity, u_opacity);
}
`;

function vertexSource(shader: CustomRenderMethodInput["shaderData"]) {
  return `#version 300 es
${shader.vertexShaderPrelude}
${shader.define}
layout(location = 0) in vec2 a_mercator;
layout(location = 1) in vec2 a_texture;
out vec2 v_texture;
uniform bool u_atmosphere;

void main() {
    v_texture = a_texture;
    float pole = a_texture.y == 0.0 ? -32768.0 : (a_texture.y == 1.0 ? 32767.0 : a_mercator.y);
#ifdef GLOBE
    if (u_atmosphere) {
        gl_Position = projectTileWithElevation(a_mercator, 74000.0);
    } else
#endif
    {
        gl_Position = projectTile(a_mercator, vec2(a_mercator.x, pole));
    }
}`;
}

let texturesPromise: Promise<EarthTextures> | undefined;
export function loadEarthTextures() {
  function loadImage(path: string) {
    const image = new Image();
    image.src = path;
    return image.decode().then(() => image);
  }

  texturesPromise ??= Promise.all([
    loadImage("/map/earth-day.webp"),
    loadImage("/map/earth-night.webp"),
  ]).catch((error: unknown) => {
    texturesPromise = undefined;
    throw error;
  });
  return texturesPromise;
}

function createMesh() {
  const rowLength = LONGITUDE_SEGMENTS + 1;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= LATITUDE_SEGMENTS; row++) {
    const v = row / LATITUDE_SEGMENTS;
    const latitude = (0.5 - v) * Math.PI;
    const mercatorY =
      row === 0
        ? 0
        : row === LATITUDE_SEGMENTS
          ? 1
          : (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2;
    for (let column = 0; column <= LONGITUDE_SEGMENTS; column++) {
      const u = column / LONGITUDE_SEGMENTS;
      vertices.push(u, mercatorY, u, v);
      if (row < LATITUDE_SEGMENTS && column < LONGITUDE_SEGMENTS) {
        const top = row * rowLength + column;
        const bottom = top + rowLength;
        indices.push(top, top + 1, bottom, bottom, top + 1, bottom + 1);
      }
    }
  }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}

const mesh = createMesh();

function uploadTexture(gl: WebGL2RenderingContext, image: HTMLImageElement) {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Could not allocate Earth texture");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  return texture;
}

function createProgram(
  gl: WebGL2RenderingContext,
  shader: CustomRenderMethodInput["shaderData"],
) {
  const program = gl.createProgram();
  if (!program) throw new Error("Could not allocate Earth shader");
  const stages: WebGLShader[] = [];
  try {
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertexSource(shader)],
      [gl.FRAGMENT_SHADER, fragmentSource],
    ] as const) {
      const stage = gl.createShader(type);
      if (!stage) throw new Error("Could not allocate Earth shader stage");
      stages.push(stage);
      gl.shaderSource(stage, source);
      gl.compileShader(stage);
      if (!gl.getShaderParameter(stage, gl.COMPILE_STATUS))
        throw new Error(
          gl.getShaderInfoLog(stage) ?? "Earth shader did not compile",
        );
      gl.attachShader(program, stage);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(
        gl.getProgramInfoLog(program) ?? "Earth shader did not link",
      );
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    return {
      program,
      matrix: uniform("u_projection_matrix"),
      fallback: uniform("u_projection_fallback_matrix"),
      mercator: uniform("u_projection_tile_mercator_coords"),
      clip: uniform("u_projection_clipping_plane"),
      transition: uniform("u_projection_transition"),
      day: uniform("u_day"),
      night: uniform("u_night"),
      sun: uniform("u_sun"),
      horizon: uniform("u_horizon"),
      opacity: uniform("u_opacity"),
      atmosphere: uniform("u_atmosphere"),
    };
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const stage of stages) gl.deleteShader(stage);
  }
}

export function createEarthSurface(
  textures: EarthTextures,
  onFailure: (error: unknown) => void,
): CustomLayerInterface {
  type Program = ReturnType<typeof createProgram>;
  let programs = new Map<string, Program>();
  let vertexBuffer: WebGLBuffer | null = null;
  let indexBuffer: WebGLBuffer | null = null;
  let vertexArray: WebGLVertexArrayObject | null = null;
  let dayTexture: WebGLTexture | null = null;
  let nightTexture: WebGLTexture | null = null;
  let failed = false;
  let timer = 0;
  let solarMinute = -1;
  let sunDirection: [number, number, number] = [0, 0, 1];
  let zoom = () => 0;

  return {
    id: EARTH_SURFACE_LAYER,
    type: "custom",
    renderingMode: "2d",
    onAdd(map) {
      zoom = () => map.getZoom();
      timer = window.setInterval(() => {
        if (zoom() < EARTH_SURFACE_FADE_END) map.triggerRepaint();
      }, 60_000);
    },
    render(gl, args) {
      if (failed || gl.isContextLost()) return;
      const opacity = Math.max(
        0,
        Math.min(
          1,
          (EARTH_SURFACE_FADE_END - zoom()) /
            (EARTH_SURFACE_FADE_END - EARTH_SURFACE_FADE_START),
        ),
      );
      if (opacity === 0) return;

      try {
        if (!vertexArray || !gl.isVertexArray(vertexArray)) {
          programs = new Map();
          vertexArray = gl.createVertexArray();
          vertexBuffer = gl.createBuffer();
          indexBuffer = gl.createBuffer();
          if (!vertexArray || !vertexBuffer || !indexBuffer)
            throw new Error("Could not allocate Earth geometry");

          gl.bindVertexArray(vertexArray);
          gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
          gl.enableVertexAttribArray(1);
          gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
          gl.bindVertexArray(null);
          dayTexture = uploadTexture(gl, textures[0]);
          nightTexture = uploadTexture(gl, textures[1]);
        }

        let shader = programs.get(args.shaderData.variantName);
        if (!shader) {
          shader = createProgram(gl, args.shaderData);
          programs.set(args.shaderData.variantName, shader);
        }
        const now = Math.floor(Date.now() / 60_000);
        if (now !== solarMinute) {
          const sun = getSolarPosition(new Date(now * 60_000));
          const latitude = sun.latitude * RADIANS;
          const longitude = sun.longitude * RADIANS;
          const horizontal = Math.cos(latitude);
          sunDirection = [
            Math.sin(longitude) * horizontal,
            Math.sin(latitude),
            Math.cos(longitude) * horizontal,
          ];
          solarMinute = now;
        }

        const projection = args.defaultProjectionData;
        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.matrix, false, projection.mainMatrix);
        gl.uniformMatrix4fv(shader.fallback, false, projection.fallbackMatrix);
        gl.uniform4f(shader.mercator, ...projection.tileMercatorCoords);
        gl.uniform4f(shader.clip, ...projection.clippingPlane);
        gl.uniform4f(shader.horizon, ...projection.clippingPlane);
        gl.uniform1f(shader.transition, projection.projectionTransition);
        gl.uniform3f(shader.sun, ...sunDirection);
        gl.uniform1f(shader.opacity, opacity);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dayTexture);
        gl.uniform1i(shader.day, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, nightTexture);
        gl.uniform1i(shader.night, 1);
        gl.bindVertexArray(vertexArray);
        if (
          args.shaderData.variantName === "globe" &&
          zoom() < EARTH_SURFACE_FADE_START
        ) {
          gl.uniform1i(shader.atmosphere, 1);
          gl.drawElements(
            gl.TRIANGLES,
            mesh.indices.length,
            gl.UNSIGNED_SHORT,
            0,
          );
        }
        gl.uniform1i(shader.atmosphere, 0);
        gl.drawElements(
          gl.TRIANGLES,
          mesh.indices.length,
          gl.UNSIGNED_SHORT,
          0,
        );
        gl.bindVertexArray(null);
        gl.activeTexture(gl.TEXTURE0);
      } catch (error) {
        failed = true;
        queueMicrotask(() => onFailure(error));
      }
    },
    onRemove(_map, gl) {
      window.clearInterval(timer);
      for (const { program } of programs.values()) gl.deleteProgram(program);
      programs.clear();
      gl.deleteVertexArray(vertexArray);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteTexture(dayTexture);
      gl.deleteTexture(nightTexture);
    },
  };
}

const EARTH_LABELS = "pokeradar-earth-labels";
const GEOGRAPHY = [
  ["AMÉRICA DEL NORTE", -105, 44, false],
  ["AMÉRICA DEL SUR", -60, -15, false],
  ["EUROPA", 18, 51, false],
  ["ÁFRICA", 19, 7, false],
  ["ASIA", 94, 46, false],
  ["AUSTRALIA", 134, -25, false],
  ["ANTÁRTIDA", -36, -78, false],
  ["Océano Atlántico Norte", -41, 32, true],
  ["Océano Atlántico Sur", -24, -28, true],
  ["Océano Pacífico Norte", -148, 26, true],
  ["Océano Pacífico Sur", -132, -25, true],
  ["Océano Índico", 83, -20, true],
] as const;

function addEarthLabels(map: import("maplibre-gl").Map) {
  map.addSource(EARTH_LABELS, {
    type: "geojson",
    attribution:
      '<a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/" target="_blank" rel="noreferrer">NASA Earth Observatory</a>',
    data: {
      type: "FeatureCollection",
      features: GEOGRAPHY.map(([name, longitude, latitude, ocean]) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [longitude, latitude] },
        properties: { name, ocean },
      })),
    },
  });
  map.addLayer({
    id: EARTH_LABELS,
    type: "symbol",
    source: EARTH_LABELS,
    maxzoom: 5.5,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["case", ["get", "ocean"], 10, 11],
      "text-max-width": ["case", ["get", "ocean"], 9, 12],
      "text-letter-spacing": ["case", ["get", "ocean"], 0.06, 0.18],
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": ["case", ["get", "ocean"], "#c9dfef", "#f5f2e5"],
      "text-halo-color": "#07151d",
      "text-halo-width": 1,
      "text-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        0.92,
        4.6,
        0.92,
        5.5,
        0,
      ],
    },
  });
}

function deferStreetLabels(map: import("maplibre-gl").Map) {
  const changes: Array<() => void> = [];
  for (const layer of map.getStyle().layers) {
    if (layer.type !== "symbol" || !layer.layout?.["text-field"]) continue;
    const minimum = layer.minzoom ?? 0;
    const maximum = layer.maxzoom ?? 24;
    if (minimum >= 5.15) continue;

    if (maximum <= 5.15) {
      const visibility = layer.layout.visibility ?? "visible";
      map.setLayoutProperty(layer.id, "visibility", "none");
      changes.push(() =>
        map.setLayoutProperty(layer.id, "visibility", visibility),
      );
    } else {
      map.setLayerZoomRange(layer.id, 5.15, maximum);
      changes.push(() => map.setLayerZoomRange(layer.id, minimum, maximum));
    }
  }
  return () => changes.forEach((restore) => restore());
}

export function mountPhotographicGlobe(
  map: import("maplibre-gl").Map,
  mountFallback: () => () => void,
) {
  let disposed = false;
  let disposeFallback: (() => void) | undefined;
  let restoreStreetLabels: (() => void) | undefined;

  function removePhotographicLayers() {
    if (!map.getStyle()) return;
    for (const id of [EARTH_LABELS, EARTH_SURFACE_LAYER])
      if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(EARTH_LABELS)) map.removeSource(EARTH_LABELS);
    restoreStreetLabels?.();
    restoreStreetLabels = undefined;
  }

  function useFallback() {
    if (disposed || disposeFallback) return;
    removePhotographicLayers();
    disposeFallback = mountFallback();
  }

  void loadEarthTextures()
    .then((textures) => {
      if (disposed) return;
      map.addLayer(createEarthSurface(textures, useFallback));
      restoreStreetLabels = deferStreetLabels(map);
      addEarthLabels(map);
    })
    .catch(useFallback);

  return () => {
    disposed = true;
    removePhotographicLayers();
    disposeFallback?.();
  };
}
