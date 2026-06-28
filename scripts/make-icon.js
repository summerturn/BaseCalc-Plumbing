// Generates BaseCalc Plumbing app icons from an SVG "field instrument" mark:
// a blue water drop sitting on a meter dial of tick marks.
// Run: node scripts/make-icon.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');

// MaterialIcons "water-drop" path (24x24).
const DROP = 'M12 22c4.97 0 9-4.03 9-9-4.5 0-9-9-9-9s-4.5 9-9 9c0 4.97 4.03 9 9 9z';

const BRAND_BLUE = '#38BDF8';
const BRAND_BLUE_DEEP = '#0EA5E9';

// Build a ring of dial ticks centered at (cx,cy).
function ticks(cx, cy, radius, { count = 60, len = 20, major = 5, color = BRAND_BLUE, opacity = 0.30 } = {}) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const isMajor = i % major === 0;
    const l = isMajor ? len * 1.7 : len;
    const w = isMajor ? 5 : 3;
    const op = isMajor ? Math.min(1, opacity + 0.25) : opacity;
    const x1 = cx + Math.cos(a) * radius;
    const y1 = cy + Math.sin(a) * radius;
    const x2 = cx + Math.cos(a) * (radius - l);
    const y2 = cy + Math.sin(a) * (radius - l);
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
  }
  return out;
}

// dropGroup at center (cx,cy) scaled by `scale`, filled with `fill`.
function drop(cx, cy, scale, fill) {
  const tx = cx - 12 * scale;
  const ty = cy - 12 * scale;
  return `<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale})"><path d="${DROP}" fill="${fill}"/></g>`;
}

function iconSvg({ size = 1024, bleed = true, glow = true, content = true } = {}) {
  const cx = size / 2, cy = size / 2;
  const ringR = bleed ? size * 0.42 : size * 0.40;
  const dropScale = (bleed ? size * 0.030 : size * 0.028);
  const defs = `
    <defs>
      <radialGradient id="bg" cx="50%" cy="42%" r="75%">
        <stop offset="0%" stop-color="#161B26"/>
        <stop offset="55%" stop-color="#0C0F16"/>
        <stop offset="100%" stop-color="#06080C"/>
      </radialGradient>
      <radialGradient id="halo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${BRAND_BLUE}" stop-opacity="0.55"/>
        <stop offset="45%" stop-color="${BRAND_BLUE_DEEP}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${BRAND_BLUE_DEEP}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#BAE6FD"/>
        <stop offset="48%" stop-color="${BRAND_BLUE}"/>
        <stop offset="100%" stop-color="${BRAND_BLUE_DEEP}"/>
      </linearGradient>
    </defs>`;
  const bgRect = bleed ? `<rect width="${size}" height="${size}" fill="url(#bg)"/>` : '';
  const haloEl = glow ? `<circle cx="${cx}" cy="${cy}" r="${size * 0.34}" fill="url(#halo)"/>` : '';
  const ringEl = content
    ? `<circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${BRAND_BLUE}" stroke-width="2.5" opacity="0.16"/>${ticks(cx, cy, ringR, { len: size * 0.022 })}`
    : '';
  const dropEl = content ? drop(cx, cy, dropScale, 'url(#dropGrad)') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${defs}${bgRect}${ringEl}${haloEl}${dropEl}</svg>`;
}

function monoSvg(size = 1024) {
  const cx = size / 2, cy = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${drop(cx, cy, size * 0.028, '#ffffff')}</svg>`;
}

async function render(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(OUT, file));
  console.log('wrote', file);
}

(async () => {
  // Full-bleed iOS / store icon
  await render(iconSvg({ size: 1024, bleed: true }), 'icon.png', 1024);
  // Splash mark — transparent bg (splash bg color comes from app config)
  await render(iconSvg({ size: 1024, bleed: false, glow: true }), 'splash-icon.png', 1024);
  // Android adaptive foreground — padded inside safe zone, transparent bg
  const fg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <g transform="translate(512 512) scale(0.62) translate(-512 -512)">${iconSvg({ size: 1024, bleed: false, glow: true }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g></svg>`;
  await render(fg, 'android-icon-foreground.png', 1024);
  // Android adaptive background — gradient only
  await render(iconSvg({ size: 1024, bleed: true, glow: false, content: false }), 'android-icon-background.png', 1024);
  // Android monochrome — white silhouette
  await render(monoSvg(1024), 'android-icon-monochrome.png', 1024);
  // Web favicon
  await render(iconSvg({ size: 256, bleed: true }), 'favicon.png', 64);
})();
