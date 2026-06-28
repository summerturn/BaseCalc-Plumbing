// Renders BaseCalc Plumbing app-icon CONCEPTS for review.
// Run: node scripts/icon-concepts.mjs   →   design/concepts/*.png
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'design', 'concepts');
mkdirSync(OUT, { recursive: true });

const BRAND_BLUE = '#38BDF8';
const BRAND_BLUE_DEEP = '#0EA5E9';

// MaterialIcons "water-drop" path (24x24).
const DROP = 'M12 22c4.97 0 9-4.03 9-9-4.5 0-9-9-9-9s-4.5 9-9 9c0 4.97 4.03 9 9 9z';

function drop(cx, cy, scale, fill) {
  const tx = cx - 12 * scale;
  const ty = cy - 12 * scale;
  return `<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale})"><path d="${DROP}" fill="${fill}"/></g>`;
}

function grid(step, color) {
  let s = '';
  for (let x = step; x < 1024; x += step) s += `<line x1="${x}" y1="0" x2="${x}" y2="1024" stroke="${color}" stroke-width="2"/>`;
  for (let y = step; y < 1024; y += step) s += `<line x1="0" y1="${y}" x2="1024" y2="${y}" stroke="${color}" stroke-width="2"/>`;
  return s;
}

const defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1A2233"/><stop offset="0.5" stop-color="#0C0F18"/><stop offset="1" stop-color="#05070B"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.30" r="0.62">
    <stop offset="0" stop-color="${BRAND_BLUE}" stop-opacity="0.55"/><stop offset="0.5" stop-color="${BRAND_BLUE_DEEP}" stop-opacity="0.12"/><stop offset="1" stop-color="${BRAND_BLUE_DEEP}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="dropg" x1="0.2" y1="0" x2="0.5" y2="1">
    <stop offset="0" stop-color="#BAE6FD"/><stop offset="0.45" stop-color="${BRAND_BLUE}"/><stop offset="1" stop-color="${BRAND_BLUE_DEEP}"/>
  </linearGradient>
  <radialGradient id="vign" cx="0.5" cy="0.42" r="0.75">
    <stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.40"/>
  </radialGradient>
  <linearGradient id="blug" x1="0" y1="0" x2="0.4" y2="1">
    <stop offset="0" stop-color="#7DD3FC"/><stop offset="0.5" stop-color="${BRAND_BLUE}"/><stop offset="1" stop-color="${BRAND_BLUE_DEEP}"/>
  </linearGradient>`;

// A — Hero drop (minimal, premium)
const A = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <ellipse cx="512" cy="300" rx="560" ry="520" fill="url(#glow)"/>
  ${drop(512, 512, 42, 'url(#dropg)')}
  <rect width="1024" height="1024" fill="url(#vign)"/></svg>`;

// B — Drop + blueprint grid (technical / calculator)
const B = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g opacity="0.6">${grid(128, 'rgba(255,255,255,0.05)')}</g>
  <ellipse cx="512" cy="300" rx="560" ry="520" fill="url(#glow)"/>
  ${drop(512, 512, 40, 'url(#dropg)')}
  <rect width="1024" height="1024" fill="url(#vign)"/></svg>`;

// C — Drop in a gauge ring (field instrument)
function ticks() {
  let s = '';
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 - Math.PI / 2;
    const r1 = 392, r2 = i % 4 === 0 ? 360 : 374;
    const x1 = 512 + Math.cos(a) * r1, y1 = 512 + Math.sin(a) * r1;
    const x2 = 512 + Math.cos(a) * r2, y2 = 512 + Math.sin(a) * r2;
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(56,189,248,0.30)" stroke-width="${i % 4 === 0 ? 7 : 3}" stroke-linecap="round"/>`;
  }
  return s;
}
const C = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <ellipse cx="512" cy="320" rx="540" ry="500" fill="url(#glow)"/>
  <circle cx="512" cy="512" r="420" fill="none" stroke="rgba(56,189,248,0.16)" stroke-width="10"/>
  ${ticks()}
  ${drop(512, 512, 34, 'url(#dropg)')}
  <rect width="1024" height="1024" fill="url(#vign)"/></svg>`;

// D — Blue plate (inverted: dark drop on blue) — bold at small sizes
const D = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}
  <radialGradient id="ag" cx="0.5" cy="0.32" r="0.85"><stop offset="0" stop-color="#7DD3FC"/><stop offset="0.55" stop-color="${BRAND_BLUE}"/><stop offset="1" stop-color="${BRAND_BLUE_DEEP}"/></radialGradient></defs>
  <rect width="1024" height="1024" fill="url(#ag)"/>
  ${drop(512, 512, 42, '#0A0C11')}
  <rect width="1024" height="1024" fill="url(#vign)" opacity="0.5"/></svg>`;

const concepts = { 'A-hero': A, 'B-grid': B, 'C-gauge': C, 'D-plate': D };
for (const [name, svg] of Object.entries(concepts)) {
  await sharp(Buffer.from(svg)).png().resize(360, 360).toFile(join(OUT, `${name}.png`));
  await sharp(Buffer.from(svg)).png().toFile(join(OUT, `${name}-1024.png`));
  console.log(`✓ ${name}`);
}
console.log('Concepts in design/concepts/');
