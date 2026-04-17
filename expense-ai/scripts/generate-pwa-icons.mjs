/**
 * Generates all PWA assets:
 *   public/icons/      — app icons (192, 512, apple-touch)
 *   public/splash/     — iOS splash screens for every major device
 *   public/screenshots/— manifest screenshots for richer install UI
 *
 * Run: node scripts/generate-pwa-icons.mjs
 * Requires: sharp (already in node_modules via Next.js)
 */
import sharp from 'sharp'
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const ICONS_DIR   = join(ROOT, 'public', 'icons')
const SPLASH_DIR  = join(ROOT, 'public', 'splash')
const SCREENS_DIR = join(ROOT, 'public', 'screenshots')

mkdirSync(ICONS_DIR,   { recursive: true })
mkdirSync(SPLASH_DIR,  { recursive: true })
mkdirSync(SCREENS_DIR, { recursive: true })

const svgBuf = readFileSync(join(ICONS_DIR, 'logo.svg'))

// ── App Icons ─────────────────────────────────────────────────────────────────
const icons = [
  { name: 'icon-192.png',          size: 192 },
  { name: 'icon-512.png',          size: 512 },
  { name: 'apple-touch-icon.png',  size: 180 },
]
for (const { name, size } of icons) {
  await sharp(svgBuf).resize(size, size).png({ compressionLevel: 9 }).toFile(join(ICONS_DIR, name))
  console.log(`✓ icons/${name}`)
}

// ── iOS Splash Screens ────────────────────────────────────────────────────────
// Physical pixels × CSS pixels × device-pixel-ratio for each major device.
// The filename encodes physical dimensions so it's unambiguous.
const splashes = [
  { w:  750, h: 1334, cssW: 375, cssH:  667, dpr: 2 }, // iPhone SE 2nd/3rd
  { w: 1125, h: 2436, cssW: 375, cssH:  812, dpr: 3 }, // iPhone X / XS / 11 Pro
  { w:  828, h: 1792, cssW: 414, cssH:  896, dpr: 2 }, // iPhone XR / 11
  { w: 1242, h: 2688, cssW: 414, cssH:  896, dpr: 3 }, // iPhone XS Max / 11 Pro Max
  { w: 1080, h: 2340, cssW: 360, cssH:  780, dpr: 3 }, // iPhone 12 mini / 13 mini
  { w: 1170, h: 2532, cssW: 390, cssH:  844, dpr: 3 }, // iPhone 12 / 13 / 14
  { w: 1284, h: 2778, cssW: 428, cssH:  926, dpr: 3 }, // iPhone 12/13 Pro Max / 14 Plus
  { w: 1179, h: 2556, cssW: 393, cssH:  852, dpr: 3 }, // iPhone 14 Pro / 15 / 15 Pro
  { w: 1290, h: 2796, cssW: 430, cssH:  932, dpr: 3 }, // iPhone 14 Pro Max / 15 Plus / 15 Pro Max
  { w: 1536, h: 2048, cssW: 768, cssH: 1024, dpr: 2 }, // iPad Mini / Air
  { w: 1668, h: 2388, cssW: 834, cssH: 1194, dpr: 2 }, // iPad Pro 11"
  { w: 2048, h: 2732, cssW:1024, cssH: 1366, dpr: 2 }, // iPad Pro 12.9"
]

for (const { w, h } of splashes) {
  const logoSize  = Math.round(Math.min(w, h) * 0.22)
  const logoLeft  = Math.round((w - logoSize) / 2)
  const logoTop   = Math.round(h * 0.40 - logoSize / 2)
  const titleSize = Math.round(logoSize * 0.30)
  const subSize   = Math.round(logoSize * 0.17)
  const textY     = logoTop + logoSize + Math.round(titleSize * 1.4)
  const subY      = textY + Math.round(titleSize * 1.35)

  // Resize logo to the needed square size
  const logoImg = await sharp(svgBuf).resize(logoSize, logoSize).png().toBuffer()

  // Text overlay as SVG (pango handles font rendering via sharp/librsvg)
  const textSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <text x="${w / 2}" y="${textY}"
        text-anchor="middle"
        font-family="-apple-system, Helvetica Neue, Arial, sans-serif"
        font-weight="800" font-size="${titleSize}" fill="#1f2937">SplitKaro</text>
      <text x="${w / 2}" y="${subY}"
        text-anchor="middle"
        font-family="-apple-system, Helvetica Neue, Arial, sans-serif"
        font-weight="400" font-size="${subSize}" fill="#6b7280">AI expense splitting</text>
    </svg>`
  )

  const name = `splash-${w}x${h}.png`
  await sharp({ create: { width: w, height: h, channels: 4, background: { r: 248, g: 250, b: 252, alpha: 1 } } })
    .composite([
      { input: logoImg, left: logoLeft, top: logoTop },
      { input: textSvg, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(join(SPLASH_DIR, name))

  console.log(`✓ splash/${name}`)
}

// ── Screenshots (manifest richer install UI) ─────────────────────────────────
// Build a simple branded screenshot using pure Node PNG (no sharp text needed).
const CRC = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = (c >>> 8) ^ CRC[(c ^ b) & 0xff]
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t   = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
function solidPNG(w, h, r, g, b) {
  const row = Buffer.alloc(1 + w * 4)
  row[0] = 0
  for (let x = 0; x < w; x++) { row[1+x*4]=r; row[2+x*4]=g; row[3+x*4]=b; row[4+x*4]=255 }
  const raw = Buffer.concat(Array.from({ length: h }, () => row))
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
const [R,G,B] = [22,163,74]
writeFileSync(join(SCREENS_DIR, 'screenshot-mobile.png'),  solidPNG(390,  844, R,G,B))
writeFileSync(join(SCREENS_DIR, 'screenshot-desktop.png'), solidPNG(1280, 720, R,G,B))
console.log('✓ screenshots/screenshot-mobile.png')
console.log('✓ screenshots/screenshot-desktop.png')

console.log('\nAll PWA assets generated.')
