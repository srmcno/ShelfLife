import { glyph } from './mayhem-glyphs.js';
import { curioSVG } from './curios.js';

/* Procedural art for the Almanac: every chapter gets a banner, four limited
   curios and a badge, drawn from the chapter’s three colours and a handful of
   shapes. Nothing is a file; nothing a player types ever becomes markup. */

const channels = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mix = (x, y, t) => '#' + channels(x).map((v, i) => Math.round(v + (channels(y)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const hashText = text => { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const INK = '#150d1c';
let uid = 0;
const gid = () => 'alm' + (++uid).toString(36);

/* ---- the shape of the object ---------------------------------------------------
   Each form draws a silhouette in the chapter’s colours inside an 80 by 80 box and
   says where the mark goes: [x, y, size]. */
function palette(chapter) {
  const { a, b, glow } = chapter.colors;
  return { body: mix(a, glow, 0.38), deep: mix(a, b, 0.5), light: mix(glow, '#ffffff', 0.35), glow, a, b, trim: mix(glow, a, 0.35) };
}
const FORMS = {
  medal: (p, g) => ({ mark: [25, 31, 30], svg:
    `<path d="M26 6h12l6 22H32z" fill="${p.trim}"/><path d="M54 6H42l-6 22h12z" fill="${p.glow}" opacity=".85"/>` +
    `<circle cx="40" cy="47" r="23" fill="url(#${g})"/><circle cx="40" cy="47" r="23" fill="none" stroke="${p.light}" stroke-width="2"/><circle cx="40" cy="47" r="17" fill="none" stroke="${p.glow}" stroke-width="1" stroke-dasharray="2 3"/>` }),
  jar: (p, g) => ({ mark: [27, 38, 26], svg:
    `<path d="M26 14h28v8l6 8v36a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V30l6-8z" fill="${p.deep}" fill-opacity=".55"/><path d="M20 44h40v22a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6z" fill="url(#${g})"/>` +
    `<path d="M24 8h32v8H24z" fill="${p.trim}"/><path d="M26 28v36" stroke="${p.light}" stroke-width="3" opacity=".55"/>` }),
  tag: (p, g) => ({ mark: [27, 34, 26], svg:
    `<path d="M40 4q10 0 10 9" fill="none" stroke="${p.trim}" stroke-width="2.5"/><path d="M24 20l16-6 16 6v46a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6z" fill="url(#${g})"/>` +
    `<circle cx="40" cy="25" r="3.2" fill="${INK}"/><path d="M29 69h22" stroke="${p.light}" stroke-width="1.4" opacity=".7"/>` }),
  card: (p, g) => ({ mark: [26, 25, 28], svg:
    `<rect x="16" y="8" width="48" height="64" rx="6" fill="url(#${g})"/><rect x="21" y="13" width="38" height="54" rx="3" fill="none" stroke="${p.light}" stroke-width="1.5"/>` +
    `<path d="M24 16l4 4m24-4l-4 4M24 64l4-4m24 4l-4-4" stroke="${p.glow}" stroke-width="1.6"/>` }),
  lantern: (p, g) => ({ mark: [28, 30, 24], svg:
    `<path d="M34 6a6 6 0 0 1 12 0" fill="none" stroke="${p.trim}" stroke-width="3"/><path d="M26 16h28l4 8H22z" fill="${p.trim}"/>` +
    `<path d="M24 24h32l-3 38H27z" fill="url(#${g})"/><path d="M24 24h32l-3 38H27z" fill="none" stroke="${p.light}" stroke-width="1.5" opacity=".7"/><path d="M24 64h32v6H24z" fill="${p.trim}"/>` }),
  cloche: (p, g) => ({ mark: [28, 28, 24], svg:
    `<path d="M10 62h60v6H10z" fill="${p.trim}"/><path d="M14 60C14 30 28 16 40 16s26 14 26 44z" fill="url(#${g})"/><circle cx="40" cy="12" r="5" fill="${p.light}"/><path d="M22 54c0-14 6-24 14-30" stroke="${p.light}" stroke-width="2.4" fill="none" opacity=".5"/>` }),
  coin: (p, g) => ({ mark: [27, 28, 26], svg:
    `<circle cx="40" cy="40" r="30" fill="url(#${g})"/><circle cx="40" cy="40" r="30" fill="none" stroke="${p.light}" stroke-width="3" stroke-dasharray="1.6 2.6"/><circle cx="40" cy="40" r="22" fill="none" stroke="${p.glow}" stroke-width="1.4"/>` }),
  bottle: (p, g) => ({ mark: [28, 44, 24], svg:
    `<path d="M33 4h14v14l12 14v32a8 8 0 0 1-8 8H29a8 8 0 0 1-8-8V32l12-14z" fill="${p.deep}" fill-opacity=".55"/><path d="M21 44h38v20a8 8 0 0 1-8 8H29a8 8 0 0 1-8-8z" fill="url(#${g})"/><path d="M32 4h16v6H32z" fill="${p.trim}"/>` }),
  book: (p, g) => ({ mark: [27, 24, 28], svg:
    `<path d="M14 10h46a6 6 0 0 1 6 6v50a6 6 0 0 1-6 6H14z" fill="url(#${g})"/><path d="M14 10v62" stroke="${p.deep}" stroke-width="7"/><path d="M20 22h40M20 60h40" stroke="${p.glow}" stroke-width="1.6" opacity=".8"/><path d="M62 10v62" stroke="${p.light}" stroke-width="1" opacity=".4"/>` }),
  frame: (p, g) => ({ mark: [28, 28, 24], svg:
    `<rect x="10" y="10" width="60" height="60" rx="5" fill="url(#${g})"/><rect x="19" y="19" width="42" height="42" rx="2" fill="${p.b}" fill-opacity=".8"/><path d="M10 10l10 10M70 10L60 20M10 70l10-10M70 70L60 60" stroke="${p.light}" stroke-width="2"/>` }),
  seal: (p, g) => ({ mark: [27, 24, 26], svg:
    `<path d="M30 54l-6 18 10-6 6 8 4-14M50 54l6 18-10-6-6 8" fill="${p.trim}" opacity=".9"/>` +
    `<path d="M40 8l7 5 9-1 3 8 8 4-3 9 3 9-8 4-3 8-9-1-7 5-7-5-9 1-3-8-8-4 3-9-3-9 8-4 3-8 9 1z" fill="url(#${g})"/>` }),
  plate: (p, g) => ({ mark: [27, 30, 26], svg:
    `<ellipse cx="40" cy="44" rx="33" ry="27" fill="url(#${g})"/><ellipse cx="40" cy="44" rx="33" ry="27" fill="none" stroke="${p.light}" stroke-width="2"/><ellipse cx="40" cy="44" rx="23" ry="18" fill="none" stroke="${p.glow}" stroke-width="1.2" stroke-dasharray="3 3"/>` }),
  pouch: (p, g) => ({ mark: [28, 38, 24], svg:
    `<path d="M30 14c-6 0-8 4-8 8l-8 28c-3 14 8 22 26 22s29-8 26-22l-8-28c0-4-2-8-8-8z" fill="url(#${g})"/><path d="M28 24c8 6 16 6 24 0" fill="none" stroke="${p.trim}" stroke-width="4"/><path d="M26 18c-6-8 0-12 6-8M54 18c6-8 0-12-6-8" stroke="${p.glow}" stroke-width="2.2" fill="none"/>` }),
  shard: (p, g) => ({ mark: [28, 28, 24], svg:
    `<path d="M40 4l22 20-6 34-16 18-20-14-8-30z" fill="url(#${g})"/><path d="M40 4l-4 30-18-10M36 34l6 40M36 34l20 24M62 24L36 34" stroke="${p.light}" stroke-width="1.3" opacity=".6" fill="none"/>` })
};
export const CURIO_FORMS = Object.keys(FORMS);

function nested(mark, [x, y, size], p) {
  if (mark.startsWith('c:')) return curioSVG(mark.slice(2)).replace('<svg viewBox="0 0 80 80" class="curio-art"', `<svg x="${x - 1}" y="${y - 1}" width="${size + 2}" height="${size + 2}" viewBox="0 0 80 80" class="curio-art"`);
  return glyph(mark.slice(2)).replace('<svg class="mh-glyph"', `<svg x="${x}" y="${y}" width="${size}" height="${size}" style="color:${p.light}" class="alm-emblem"`);
}

// One limited curio, drawn in its chapter’s colours. `locked` draws the silhouette only.
export function almanacCurioSVG(curio, chapter, { locked = false } = {}) {
  const p = palette(chapter), g = gid(), form = FORMS[curio.form] || FORMS.medal;
  const { svg, mark } = form(p, g);
  const defs = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.body}"/><stop offset="1" stop-color="${p.deep}"/></linearGradient></defs>`;
  const inner = locked ? `<g opacity=".22" style="filter:grayscale(1)">${svg}</g>` : `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">${svg}</g>${nested(curio.mark, mark, p)}`;
  return `<svg viewBox="0 0 80 80" class="alm-curio-art${locked ? ' locked' : ''}" aria-hidden="true" focusable="false">${defs}${inner}</svg>`;
}

// The chapter’s badge: a rosette in its colours with its number.
export function badgeSVG(chapter, { earned = true } = {}) {
  const p = palette(chapter), g = gid();
  const petals = Array.from({ length: 12 }, (_, i) => `<ellipse cx="40" cy="14" rx="5" ry="11" transform="rotate(${i * 30} 40 40)" fill="${i % 2 ? p.glow : p.trim}"/>`).join('');
  return `<svg viewBox="0 0 80 80" class="alm-badge-art${earned ? '' : ' locked'}" aria-hidden="true" focusable="false"><defs><radialGradient id="${g}" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="${p.light}"/><stop offset="1" stop-color="${p.deep}"/></radialGradient></defs>` +
    `<g opacity="${earned ? 1 : 0.25}">${petals}<circle cx="40" cy="40" r="19" fill="url(#${g})" stroke="${INK}" stroke-width="1.6"/><circle cx="40" cy="40" r="14" fill="none" stroke="${p.glow}" stroke-width="1"/>` +
    `<text x="40" y="46" text-anchor="middle" font-family="Georgia,serif" font-size="${String(chapter.no).length > 1 ? 16 : 19}" font-weight="700" fill="${INK}">${chapter.no}</text></g></svg>`;
}

/* ---- the banner: a strip of themed scenery behind the chapter’s name ---------------- */
const MOTIFS = {
  moon: (r, p) => {
    const bats = Array.from({ length: 4 }, () => { const x = 40 + r() * 280, y = 14 + r() * 50, s = 0.6 + r() * 0.8; return `<path d="M${x} ${y}q${6 * s} ${-8 * s} ${12 * s} 0q${6 * s} ${-8 * s} ${12 * s} 0q${-6 * s} ${3 * s} ${-12 * s} ${8 * s}q${-6 * s} ${-5 * s} ${-12 * s} ${-8 * s}z" fill="${p.deep}" opacity=".9"/>`; }).join('');
    return `<circle cx="282" cy="46" r="30" fill="${p.glow}" opacity=".92"/><circle cx="294" cy="38" r="26" fill="${p.a}"/>${stars(r, p, 18)}${bats}`;
  },
  fullmoon: (r, p) => `<circle cx="276" cy="52" r="38" fill="${p.glow}" opacity=".9"/><circle cx="262" cy="44" r="6" fill="${p.a}" opacity=".25"/><circle cx="288" cy="62" r="9" fill="${p.a}" opacity=".2"/><circle cx="283" cy="36" r="4" fill="${p.a}" opacity=".25"/>${stars(r, p, 10)}`,
  fog: (r, p) => Array.from({ length: 6 }, (_, i) => `<rect x="${-20 + r() * 120}" y="${10 + i * 18}" width="${180 + r() * 220}" height="10" rx="5" fill="${p.glow}" opacity="${0.12 + r() * 0.16}"/>`).join(''),
  snow: (r, p) => stars(r, p, 14) + Array.from({ length: 36 }, () => `<circle cx="${r() * 360}" cy="${r() * 120}" r="${0.8 + r() * 2.2}" fill="#fff" opacity="${0.35 + r() * 0.5}"/>`).join(''),
  calendar: (r, p) => Array.from({ length: 28 }, (_, i) => { const x = 16 + (i % 14) * 24, y = 18 + Math.floor(i / 14) * 34, cross = r() > 0.5; return `<rect x="${x}" y="${y}" width="18" height="24" rx="3" fill="none" stroke="${p.glow}" opacity=".35"/>` + (cross ? `<path d="M${x + 3} ${y + 4}l12 16m0-16L${x + 3} ${y + 20}" stroke="${p.glow}" stroke-width="2" opacity=".6"/>` : ''); }).join(''),
  hearts: (r, p) => Array.from({ length: 14 }, () => { const x = r() * 340, y = 8 + r() * 90, s = 0.5 + r() * 1.1; return `<path transform="translate(${x} ${y}) scale(${s})" d="M10 18C2 11 0 7 0 4a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3-2 7-10 14z" fill="${p.glow}" opacity="${0.25 + r() * 0.5}"/>`; }).join(''),
  drip: (r, p) => Array.from({ length: 16 }, () => { const x = 8 + r() * 344, h = 14 + r() * 56; return `<rect x="${x}" y="0" width="5" height="${h}" rx="2.5" fill="${p.glow}" opacity=".3"/><circle cx="${x + 2.5}" cy="${h + 3}" r="4.4" fill="${p.glow}" opacity=".5"/>`; }).join(''),
  confetti: (r, p) => Array.from({ length: 46 }, () => `<rect transform="rotate(${r() * 180} ${r() * 360} ${r() * 120})" x="${r() * 350}" y="${r() * 110}" width="${5 + r() * 6}" height="${2 + r() * 3}" fill="${['#FFD166', '#FF8FB8', '#7FD8C0', '#C49BFF', '#fff'][Math.floor(r() * 5)]}" opacity=".8"/>`).join(''),
  sprouts: (r, p) => Array.from({ length: 16 }, () => { const x = 10 + r() * 340, h = 20 + r() * 50; return `<path d="M${x} 120V${120 - h}" stroke="${p.glow}" stroke-width="2.2" opacity=".5"/><ellipse cx="${x + 5}" cy="${120 - h}" rx="8" ry="4" transform="rotate(-25 ${x + 5} ${120 - h})" fill="${p.glow}" opacity=".6"/><ellipse cx="${x - 5}" cy="${120 - h * 0.7}" rx="7" ry="3.5" transform="rotate(25 ${x - 5} ${120 - h * 0.7})" fill="${p.glow}" opacity=".45"/>`; }).join(''),
  sun: (r, p) => `<circle cx="280" cy="46" r="22" fill="${p.glow}"/>` + Array.from({ length: 14 }, (_, i) => `<path d="M280 46l${Math.cos(i / 14 * 6.2832) * 56} ${Math.sin(i / 14 * 6.2832) * 56}" stroke="${p.glow}" stroke-width="2" opacity=".35"/>`).join(''),
  heat: (r, p) => Array.from({ length: 7 }, (_, i) => `<path d="M0 ${16 + i * 15}q22 -10 45 0t45 0t45 0t45 0t45 0t45 0t45 0t45 0" fill="none" stroke="${p.glow}" stroke-width="2" opacity="${0.15 + r() * 0.3}"/>`).join(''),
  chalk: (r, p) => Array.from({ length: 22 }, () => { const x = 8 + r() * 330, y = 10 + r() * 90; return r() > 0.5 ? `<path d="M${x} ${y}l${6 + r() * 14} ${r() * 6 - 3}" stroke="${p.glow}" stroke-width="2" opacity=".5"/>` : `<path d="M${x} ${y}v14M${x + 4} ${y}v14M${x + 8} ${y}v14M${x - 2} ${y + 11}l14 -8" stroke="${p.glow}" stroke-width="1.6" opacity=".5"/>`; }).join(''),
  steam: (r, p) => Array.from({ length: 9 }, () => { const x = 10 + r() * 340; return `<path d="M${x} 120c-10 -16 10 -26 0 -42s10 -26 0 -42" fill="none" stroke="${p.glow}" stroke-width="3" stroke-linecap="round" opacity="${0.15 + r() * 0.25}"/>`; }).join('')
};
function stars(r, p, n) { return Array.from({ length: n }, () => `<circle cx="${r() * 360}" cy="${r() * 80}" r="${0.7 + r() * 1.4}" fill="${p.light}" opacity="${0.4 + r() * 0.5}"/>`).join(''); }

export function chapterBannerSVG(chapter) {
  const p = palette(chapter), g = gid(), r = rng(hashText(chapter.id));
  const motif = (MOTIFS[chapter.motif] || MOTIFS.moon)(r, p);
  return `<svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" class="alm-banner-art" aria-hidden="true" focusable="false"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${chapter.colors.a}"/><stop offset="1" stop-color="${chapter.colors.b}"/></linearGradient></defs>` +
    `<rect width="360" height="120" fill="url(#${g})"/>${motif}<rect y="96" width="360" height="24" fill="${chapter.colors.b}" opacity=".55"/></svg>`;
}
