import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const [mode, input, output] = process.argv.slice(2);
if (!["clean", "encode"].includes(mode) || !input || !output) {
  throw new Error("Usage: node scripts/prepare-safari-panoramas.mjs clean|encode <png dir> <output dir>");
}

function seamGain(edge, target) {
  const difference = target - edge;
  if (difference === 0) return 0;
  return difference / (difference > 0 ? 255 - edge : edge);
}

function grade(value, gain, weight) {
  const room = gain > 0 ? 255 - value : value;
  return Math.min(255, Math.max(0, Math.round(value + room * gain * weight)));
}

function matchSeam(pixels, { width, height, channels }, edgeFraction) {
  const margin = Math.max(1, Math.round(width * edgeFraction));
  const taper = Array.from({ length: margin }, (_, x) => (1 + Math.cos(Math.PI * x / margin)) / 2);
  for (let y = 0; y < height; y++) {
    const left = y * width * channels;
    const right = left + (width - 1) * channels;
    for (let channel = 0; channel < channels; channel++) {
      const l = left + channel;
      const r = right + channel;
      const middle = Math.round((pixels[l] + pixels[r]) / 2);
      const leftGain = seamGain(pixels[l], middle);
      const rightGain = seamGain(pixels[r], middle);
      for (let x = 0; x < margin; x++) {
        const offset = x * channels;
        pixels[l + offset] = grade(pixels[l + offset], leftGain, taper[x]);
        pixels[r - offset] = grade(pixels[r - offset], rightGain, taper[x]);
      }
    }
  }
}

await mkdir(output, { recursive: true });
const inputs = (await readdir(input)).filter((name) => /^[a-z]+-[a-z]+\.png$/.test(name));
if (!inputs.length) throw new Error("No named panorama PNGs found");

for (const name of inputs) {
  const path = join(input, name);
  const { width, height } = await sharp(path).metadata();
  if (width !== height * 2) throw new Error(`Expected a 2:1 panorama: ${name}`);
  if (mode === "encode" && width < 4096) throw new Error(`Expected a restored source at least 4096 pixels wide: ${name}`);
  const sizes = mode === "clean" ? [width] : [2560, 4096];
  for (const size of sizes) {
    const { data, info } = await sharp(path)
      .toColourspace("srgb").removeAlpha()
      .resize(size, size / 2, { kernel: "lanczos3" })
      .raw().toBuffer({ resolveWithObject: true });
    // First equalize the original edges before restoration, then match the
    // narrow strip left by the model or resampling on the final texture.
    matchSeam(data, info, mode === "clean" ? 0.044 : 0.009);
    const result = sharp(data, { raw: info });
    const stem = name.slice(0, -4);
    if (mode === "clean") {
      await result.png({ compressionLevel: 3 }).toFile(join(output, name));
    } else {
      await result.webp({ quality: size === 4096 ? 87 : 86, smartSubsample: true, effort: 6 })
        .toFile(join(output, `${stem}-360-${size}.webp`));
    }
  }
}
