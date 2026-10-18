import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const inputPath =
  "C:/Users/ASUS/.gemini/antigravity-ide/brain/2edd3bb4-ffba-4351-b8e1-879c3f4d0fea/.user_uploaded/media_1792328406839.png";

const publicDir = path.join(dir, "../public");
const markPath = path.join(publicDir, "sandadd-mark.png");
const logoPath = path.join(publicDir, "sandadd-logo.png");
const srcPath = path.join(publicDir, "_logo-src.png");
const faviconPath = path.join(publicDir, "favicon.png");

// 1. Copy source
fs.copyFileSync(inputPath, srcPath);
console.log("Copied raw uploaded image to _logo-src.png");

// 2. Read raw pixels
const img = sharp(inputPath);
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;

// Find bounding box
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const idx = (y * W + x) * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    const isBg =
      (r >= 242 && g >= 242 && b >= 242 && Math.max(r, g, b) - Math.min(r, g, b) <= 4) ||
      (r >= 240 && g >= 240 && b >= 240 && Math.max(r, g, b) - Math.min(r, g, b) <= 2);
    if (!isBg) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

// Add 2px border pad so subpixel edge blends are untouched
const pad = 2;
const cropX = Math.max(0, minX - pad);
const cropY = Math.max(0, minY - pad);
const cropW = Math.min(W - cropX, maxX - minX + 1 + pad * 2);
const cropH = Math.min(H - cropY, maxY - minY + 1 + pad * 2);

console.log("Detected bounds:", { cropX, cropY, cropW, cropH });

const out = Buffer.alloc(cropW * cropH * 4);

for (let cy = 0; cy < cropH; cy++) {
  const y = cropY + cy;
  for (let cx = 0; cx < cropW; cx++) {
    const x = cropX + cx;
    const srcIdx = (y * W + x) * 4;
    const outIdx = (cy * cropW + cx) * 4;

    const r = data[srcIdx];
    const g = data[srcIdx + 1];
    const b = data[srcIdx + 2];
    const colorSpread = Math.max(r, g, b) - Math.min(r, g, b);

    // Background threshold
    if (
      (r >= 242 && g >= 242 && b >= 242 && colorSpread <= 4) ||
      (r >= 240 && g >= 240 && b >= 240 && colorSpread <= 2)
    ) {
      out[outIdx + 3] = 0;
      continue;
    }

    let alpha;
    if (b > r + 10) {
      // Blue channel
      alpha = Math.min(1, Math.max(0, (255 - r) / 245));
    } else {
      // Grey mountain
      const minVal = Math.min(r, g, b);
      alpha = Math.min(1, Math.max(0, (255 - minVal) / 160));
    }

    if (alpha < 0.08) {
      out[outIdx + 3] = 0;
      continue;
    }

    if (alpha >= 0.98) {
      out[outIdx] = r;
      out[outIdx + 1] = g;
      out[outIdx + 2] = b;
      out[outIdx + 3] = 255;
    } else {
      // Un-premultiply against white (255)
      const unR = Math.min(255, Math.max(0, Math.round((r - (1 - alpha) * 255) / alpha)));
      const unG = Math.min(255, Math.max(0, Math.round((g - (1 - alpha) * 255) / alpha)));
      const unB = Math.min(255, Math.max(0, Math.round((b - (1 - alpha) * 255) / alpha)));
      out[outIdx] = unR;
      out[outIdx + 1] = unG;
      out[outIdx + 2] = unB;
      out[outIdx + 3] = Math.round(alpha * 255);
    }
  }
}

const baseSharp = sharp(out, { raw: { width: cropW, height: cropH, channels: 4 } });

// Save sandadd-mark.png at high DPI (e.g. height: 144px for razor sharpness on Retina/4K)
await baseSharp
  .clone()
  .resize({ height: 144, fit: "inside" })
  .png({ compressionLevel: 9 })
  .toFile(markPath);
console.log("Saved sandadd-mark.png (height: 144px)");

// Save sandadd-logo.png (higher resolution, height: 288px)
await baseSharp
  .clone()
  .resize({ height: 288, fit: "inside" })
  .png({ compressionLevel: 9 })
  .toFile(logoPath);
console.log("Saved sandadd-logo.png (height: 288px)");

// Save favicon.png (square, 64x64)
await baseSharp
  .clone()
  .resize({ width: 64, height: 64, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(faviconPath);
console.log("Saved favicon.png (64x64)");

const markMeta = await sharp(markPath).metadata();
const logoMeta = await sharp(logoPath).metadata();
console.log("Finished generating assets:", {
  mark: [markMeta.width, markMeta.height],
  logo: [logoMeta.width, logoMeta.height],
});
