#!/usr/bin/env node
/**
 * Draws the achievement badges in src/assets/badges as flat SVG stickers: a striped
 * circle with an ink outline, an illustration, and the goal in a little chip.
 * Everything stays flat (no shadows, gradients or highlights), like the rest of the app.
 *
 * Files are named after what the achievement counts and its goal, e.g.
 * submission_streak-14.svg, which is how Badge.tsx finds them.
 *
 *   node scripts/badges/generate.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/assets/badges',
);

const INK = '#2b2a33';
const W = 5; // icon stroke

const C = {
  butter: '#ffe08a',
  butterDeep: '#ffc233',
  coral: '#ff6b57',
  blush: '#ffd9d2',
  sky: '#dcebff',
  skyDeep: '#8ec3ff',
  mint: '#c9f2dc',
  green: '#5cc48a',
  lilac: '#e6dcff',
  purple: '#8b3fe0',
  orange: '#ff9a3c',
  white: '#ffffff',
  paper: '#fbf8f1',
  cream: '#fff6c9',
  silver: '#c3cad4',
  teal: '#4fcfb9',
  tealLight: '#c9fff5',
  red: '#e5352b',
  brown: '#b9773f',
};

// ---- pieces ---------------------------------------------------------------

const stroke = (w = W) =>
  `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

/** A little face: two dot eyes and a smile, centered on (x, y) */
const face = (x, y, s = 1, mood = 'smile') => {
  const eye = 3.2 * s;
  const dx = 8 * s;
  const mouth = {
    smile: `<path d="M${x - 6 * s} ${y + 6 * s} q${6 * s} ${6 * s} ${12 * s} 0" fill="none" ${stroke(3.5 * s)}/>`,
    open: `<path d="M${x - 6 * s} ${y + 5 * s} q${6 * s} ${11 * s} ${12 * s} 0 z" fill="${INK}" ${stroke(2.5 * s)}/>`,
    flat: `<path d="M${x - 5 * s} ${y + 8 * s} h${10 * s}" ${stroke(3.5 * s)}/>`,
  }[mood];
  return `<circle cx="${x - dx}" cy="${y}" r="${eye}" fill="${INK}"/><circle cx="${x + dx}" cy="${y}" r="${eye}" fill="${INK}"/>${mouth}`;
};

const sparkle = (x, y, r = 9, fill = INK) =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${fill}"/>`;

const heart = (x, y, s = 1, fill = C.coral) =>
  `<path d="M${x} ${y + 9 * s} C${x - 14 * s} ${y} ${x - 12 * s} ${y - 12 * s} ${x - 5 * s} ${y - 11 * s} C${x - 2 * s} ${y - 11 * s} ${x} ${y - 8 * s} ${x} ${y - 6 * s} C${x} ${y - 8 * s} ${x + 2 * s} ${y - 11 * s} ${x + 5 * s} ${y - 11 * s} C${x + 12 * s} ${y - 12 * s} ${x + 14 * s} ${y} ${x} ${y + 9 * s} Z" fill="${fill}" ${stroke(3.5 * s)}/>`;

const star = (x, y, r, fill = C.butterDeep, w = W) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.48 : r;
    pts.push(
      `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`,
    );
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" ${stroke(w)}/>`;
};

/** A friend: round head over shoulders */
const buddy = (x, y, fill, s = 1, mood = 'smile') =>
  `<path d="M${x - 26 * s} ${y + 46 * s} q0 -30 ${26 * s} -30 q${26 * s} 0 ${26 * s} 30 z" fill="${fill}" ${stroke(W * s)}/>` +
  `<circle cx="${x}" cy="${y}" r="${17 * s}" fill="${fill}" ${stroke(W * s)}/>` +
  face(x, y, 0.75 * s, mood);

/** A flame with a little face */
const flame = (x, y, s, outer, inner) =>
  `<path d="M${x} ${y - 62 * s} C${x + 12 * s} ${y - 36 * s} ${x + 44 * s} ${y - 22 * s} ${x + 40 * s} ${y + 14 * s} C${x + 37 * s} ${y + 44 * s} ${x + 16 * s} ${y + 56 * s} ${x} ${y + 56 * s} C${x - 18 * s} ${y + 56 * s} ${x - 40 * s} ${y + 42 * s} ${x - 40 * s} ${y + 14 * s} C${x - 40 * s} ${y - 8 * s} ${x - 26 * s} ${y - 18 * s} ${x - 20 * s} ${y - 30 * s} C${x - 12 * s} ${y - 16 * s} ${x - 4 * s} ${y - 14 * s} ${x - 4 * s} ${y - 14 * s} C${x - 6 * s} ${y - 32 * s} ${x - 6 * s} ${y - 46 * s} ${x} ${y - 62 * s} Z" fill="${outer}" ${stroke(W)}/>` +
  `<path d="M${x} ${y - 4 * s} C${x + 8 * s} ${y + 8 * s} ${x + 22 * s} ${y + 14 * s} ${x + 20 * s} ${y + 32 * s} C${x + 18 * s} ${y + 46 * s} ${x + 8 * s} ${y + 52 * s} ${x} ${y + 52 * s} C${x - 10 * s} ${y + 52 * s} ${x - 20 * s} ${y + 46 * s} ${x - 20 * s} ${y + 32 * s} C${x - 20 * s} ${y + 18 * s} ${x - 8 * s} ${y + 10 * s} ${x} ${y - 4 * s} Z" fill="${inner}" ${stroke(W * 0.8)}/>` +
  face(x, y + 32 * s, 0.6 * s);

/** The goal, in a chip at the bottom right */
const chip = (label, fill = C.white) => {
  const text = String(label);
  const w = Math.max(40, 14 + text.length * 15);
  const x = 182 - w / 2;
  return (
    `<rect x="${x}" y="158" width="${w}" height="40" rx="20" fill="${fill}" ${stroke(5)}/>` +
    `<text x="182" y="186.5" text-anchor="middle" font-family="'Nunito','Arial Rounded MT Bold','Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="25" fill="${INK}">${text}</text>`
  );
};

/** The sticker: a striped circle with an ink outline */
const frame = (
  id,
  bg,
  stripe,
  angle,
  art,
  extras = '',
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <defs>
    <pattern id="s-${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
      <rect width="14" height="14" fill="${bg}"/>
      <rect width="14" height="5" fill="${stripe}"/>
    </pattern>
    <clipPath id="c-${id}"><circle cx="120" cy="120" r="100"/></clipPath>
  </defs>
  <circle cx="120" cy="120" r="100" fill="url(#s-${id})"/>
  <g clip-path="url(#c-${id})">${extras}</g>
  <circle cx="120" cy="120" r="100" fill="none" stroke="${INK}" stroke-width="6"/>
  ${art}
</svg>
`;

// ---- the badges -----------------------------------------------------------

const pencil = (x, y, angle, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${s})">
    <rect x="-16" y="-62" width="32" height="88" rx="4" fill="${C.butterDeep}" ${stroke()}/>
    <path d="M-16 -44 h32" ${stroke(4)}/>
    <rect x="-16" y="-74" width="32" height="18" rx="6" fill="${C.blush}" ${stroke()}/>
    <path d="M-16 26 L0 60 L16 26 Z" fill="${C.paper}" ${stroke()}/>
    <path d="M-6 47 L0 60 L6 47 Z" fill="${INK}"/>
  </g>`;

const sketchbook = (x, y, fill, tilt) =>
  `<g transform="translate(${x} ${y}) rotate(${tilt})">
    <rect x="-46" y="-14" width="92" height="28" rx="5" fill="${fill}" ${stroke()}/>
    <path d="M-30 -14 v28 M-38 -14 v28" ${stroke(3)}/>
  </g>`;

const polaroid = (x, y, tilt, fill, pin) =>
  `<g transform="translate(${x} ${y}) rotate(${tilt})">
    <rect x="-26" y="-30" width="52" height="60" rx="3" fill="${C.white}" ${stroke(4.5)}/>
    <rect x="-18" y="-22" width="36" height="34" fill="${fill}" ${stroke(3.5)}/>
    <circle cx="0" cy="-30" r="7" fill="${pin}" ${stroke(3.5)}/>
  </g>`;

const bubble = (x, y, w, h, fill, tailLeft = true) => {
  const tail = tailLeft
    ? `M${x - w / 2 + 14} ${y + h / 2 - 2} l-10 18 l24 -16`
    : `M${x + w / 2 - 14} ${y + h / 2 - 2} l10 18 l-24 -16`;
  return `<path d="${tail}" fill="${fill}" ${stroke()}/><rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" ${stroke()}/>`;
};

const medal = (fill, ring, label, textFill) =>
  `<path d="M92 40 L80 92 L104 84 L120 104 L136 84 L160 92 L148 40 Z" fill="${C.coral}" ${stroke()}/>
   <path d="M108 40 L120 76 L132 40" fill="none" ${stroke(4)}/>
   <circle cx="120" cy="128" r="50" fill="${ring}" ${stroke()}/>
   <circle cx="120" cy="128" r="36" fill="${fill}" ${stroke(4)}/>
   <text x="120" y="${label.length > 1 ? 141 : 143}" text-anchor="middle" font-family="'Nunito','Arial Rounded MT Bold','Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="${label.length > 1 ? 36 : 42}" fill="${textFill}">${label}</text>`;

const judgeHead = (x, y, fill, card, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-24 46 q0 -26 24 -26 q24 0 24 26 z" fill="${fill}" ${stroke()}/>
    <circle cx="0" cy="0" r="17" fill="${fill}" ${stroke()}/>
    ${face(0, 0, 0.7)}
    <rect x="10" y="10" width="30" height="24" rx="3" fill="${C.white}" ${stroke(4)}/>
    <text x="25" y="29" text-anchor="middle" font-family="'Nunito','Arial Rounded MT Bold',Arial,sans-serif" font-weight="900" font-size="17" fill="${INK}">${card}</text>
  </g>`;

const badges = {
  // drawing
  'submission_total-25': frame(
    'd25',
    C.sky,
    '#cfe2ff',
    45,
    pencil(112, 112, 30) + sparkle(64, 70, 10) + sparkle(160, 56, 7) + chip(25),
  ),
  'submission_total-250': frame(
    'd250',
    C.lilac,
    '#d9ccfa',
    -45,
    sketchbook(116, 150, C.coral, -3) +
      sketchbook(120, 122, C.butter, 4) +
      sketchbook(114, 94, C.skyDeep, -5) +
      sketchbook(122, 66, C.green, 3) +
      sparkle(56, 90, 9) +
      chip(250),
  ),
  'submission_total-365': frame(
    'd365',
    C.mint,
    '#b5ead0',
    0,
    `<rect x="62" y="58" width="116" height="110" rx="14" fill="${C.white}" ${stroke()}/>
     <path d="M62 72 a14 14 0 0 1 14 -14 h88 a14 14 0 0 1 14 14 v16 h-116 z" fill="${C.coral}" ${stroke()}/>
     <path d="M90 46 v22 M150 46 v22" ${stroke(6)}/>
     ${heart(120, 126, 1.6)}
     ${sparkle(190, 66, 9)}` + chip(365),
  ),
  'favorite_total-3': frame(
    'pin3',
    C.blush,
    '#ffcabf',
    90,
    polaroid(74, 116, -10, C.skyDeep, C.coral) +
      polaroid(166, 116, 9, C.green, C.skyDeep) +
      polaroid(120, 104, 0, C.butter, C.butterDeep) +
      chip(3),
  ),

  // streaks
  'submission_streak-3': frame(
    's3',
    C.cream,
    '#fff0a8',
    0,
    flame(116, 118, 0.85, C.butterDeep, C.cream) + sparkle(62, 72, 9) + chip(3),
  ),
  'submission_streak-14': frame(
    's14',
    C.blush,
    '#ffcabf',
    0,
    flame(112, 116, 1.05, C.orange, C.butter) + sparkle(178, 64, 9) + chip(14),
  ),
  'submission_streak-30': frame(
    's30',
    C.sky,
    '#cfe2ff',
    0,
    flame(112, 122, 1.0, C.coral, C.butter) +
      `<path d="M86 52 L92 30 L106 44 L114 24 L124 44 L138 30 L142 52 Z" fill="${C.butterDeep}" ${stroke(4.5)}/>` +
      sparkle(60, 96, 8) +
      chip(30),
  ),
  'submission_streak-100': frame(
    's100',
    '#2f2a45',
    '#3a3456',
    45,
    flame(112, 116, 1.05, C.purple, '#7ad7ff') +
      sparkle(56, 76, 10, C.butter) +
      sparkle(176, 58, 7, C.white) +
      sparkle(72, 160, 6, C.white) +
      chip(100, C.butter),
  ),

  // friends
  'friend_total-1': frame(
    'f1',
    C.mint,
    '#b5ead0',
    45,
    buddy(90, 104, C.skyDeep) +
      buddy(152, 104, C.blush) +
      `<circle cx="121" cy="66" r="15" fill="${C.butter}" ${stroke(4.5)}/><path d="M121 58 v16 M113 66 h16" ${stroke(4.5)}/>`,
  ),
  'friend_total-10': frame(
    'f10',
    C.butter,
    '#ffd56b',
    45,
    buddy(72, 96, C.mint, 0.75) +
      buddy(168, 96, C.lilac, 0.75) +
      buddy(96, 112, C.skyDeep, 0.85) +
      buddy(144, 112, C.blush, 0.85) +
      buddy(120, 122, C.white, 0.95) +
      chip(10),
  ),
  'comment_total-25': frame(
    'c25',
    C.lilac,
    '#d9ccfa',
    -45,
    bubble(104, 84, 104, 50, C.white) +
      `<circle cx="84" cy="84" r="5" fill="${INK}"/><circle cx="104" cy="84" r="5" fill="${INK}"/><circle cx="124" cy="84" r="5" fill="${INK}"/>` +
      bubble(140, 136, 88, 44, C.butter, false) +
      `<path d="M116 136 h48" ${stroke(4.5)}/>` +
      chip(25),
  ),
  'comment_total-100': frame(
    'c100',
    C.paper,
    '#f1ead9',
    45,
    bubble(118, 92, 136, 64, C.white) +
      star(78, 92, 14, C.butterDeep, 4) +
      star(118, 92, 14, C.butterDeep, 4) +
      star(158, 92, 14, C.white, 4) +
      `<ellipse cx="78" cy="56" rx="34" ry="12" fill="${C.coral}" ${stroke(4.5)} transform="rotate(-10 78 56)"/>` +
      `<circle cx="76" cy="46" r="4" fill="${INK}"/>` +
      chip(100),
  ),
  'reaction_total-100': frame(
    'r100',
    C.blush,
    '#ffcabf',
    0,
    `<path d="M62 104 L130 70 L130 158 L62 124 Z" fill="${C.butterDeep}" ${stroke()}/>
     <rect x="48" y="100" width="18" height="28" rx="5" fill="${C.coral}" ${stroke()}/>
     <path d="M78 128 l8 30 h16 l-6 -24" fill="${C.white}" ${stroke()}/>
     ${heart(162, 78, 1.0)}${heart(176, 122, 0.8, C.butter)}${sparkle(150, 160, 8)}` +
      chip(100),
  ),
  'reaction_received_total-50': frame(
    'rr50',
    C.sky,
    '#cfe2ff',
    -45,
    heart(120, 120, 3.3) +
      face(120, 108, 1.1) +
      sparkle(60, 70, 10) +
      sparkle(182, 70, 7) +
      chip(50),
  ),
  'reaction_received_total-250': frame(
    'rr250',
    C.butter,
    '#ffd56b',
    -45,
    heart(120, 128, 3.0, C.coral) +
      face(120, 118, 1.0) +
      `<path d="M88 72 L94 42 L110 60 L120 34 L130 60 L146 42 L152 72 Z" fill="${C.butterDeep}" ${stroke(4.5)}/>` +
      `<circle cx="120" cy="34" r="5" fill="${C.coral}" ${stroke(3)}/>` +
      chip(250),
  ),
  'cry_laugh_received_total-10': frame(
    'cl10',
    C.mint,
    '#b5ead0',
    45,
    `<circle cx="120" cy="116" r="56" fill="${C.butter}" ${stroke()}/>
     <path d="M88 100 q10 -12 20 0 M132 100 q10 -12 20 0" fill="none" ${stroke(5)}/>
     <path d="M90 122 q30 40 60 0 z" fill="${INK}" ${stroke(4)}/>
     <path d="M100 134 q20 12 40 0" fill="none" stroke="${C.coral}" stroke-width="7" stroke-linecap="round"/>
     <path d="M78 104 q-18 8 -14 30 q16 -4 18 -22" fill="${C.skyDeep}" ${stroke(4)}/>
     <path d="M162 104 q18 8 14 30 q-16 -4 -18 -22" fill="${C.skyDeep}" ${stroke(4)}/>` +
      chip(10),
  ),
  'poke_total-1': frame(
    'poke',
    C.lilac,
    '#d9ccfa',
    0,
    // A finger poking a sleepy friend who hasn't doodled yet
    `<circle cx="160" cy="108" r="36" fill="${C.butter}" ${stroke()}/>
     <path d="M146 104 q6 4 12 0 M166 104 q6 4 12 0" fill="none" ${stroke(4)}/>
     <circle cx="162" cy="124" r="5" fill="${INK}"/>
     <text x="186" y="70" font-family="'Nunito','Arial Rounded MT Bold',Arial,sans-serif" font-weight="900" font-size="22" fill="${INK}">z</text>
     <rect x="40" y="118" width="58" height="40" rx="14" fill="${C.blush}" ${stroke()}/>
     <rect x="84" y="118" width="46" height="18" rx="9" fill="${C.blush}" ${stroke()}/>
     <path d="M58 136 h26 M58 148 h24" ${stroke(3.5)}/>
     <path d="M118 96 l6 -10 M126 110 l12 -4 M110 88 l0 -12" ${stroke(4.5)}/>`,
  ),
  'prompt_picked_total-1': frame(
    'idea',
    C.cream,
    '#fff0a8',
    45,
    `<path d="M120 46 a46 46 0 0 1 28 82 q-6 6 -6 16 h-44 q0 -10 -6 -16 a46 46 0 0 1 28 -82 z" fill="${C.butter}" ${stroke()}/>
     <rect x="96" y="150" width="48" height="14" rx="4" fill="${C.silver}" ${stroke(4.5)}/>
     <rect x="102" y="168" width="36" height="12" rx="5" fill="${C.silver}" ${stroke(4.5)}/>
     ${face(120, 92, 1)}
     <path d="M54 66 l-14 -8 M50 104 h-16 M186 66 l14 -8 M190 104 h16 M120 22 v-8" ${stroke(5)}/>`,
  ),

  // AI judges
  'ai_review_total-1': frame(
    'j1',
    C.sky,
    '#cfe2ff',
    45,
    `<rect x="70" y="52" width="100" height="128" rx="10" fill="${C.brown}" ${stroke()}/>
     <rect x="82" y="68" width="76" height="100" rx="4" fill="${C.white}" ${stroke(4)}/>
     <rect x="98" y="42" width="44" height="22" rx="6" fill="${C.silver}" ${stroke(4.5)}/>
     <path d="M94 94 l8 8 l14 -16 M94 130 l8 8 l14 -16" fill="none" stroke="${C.green}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M126 96 h22 M126 132 h22" ${stroke(4)}/>` + chip(1),
  ),
  'ai_review_total-25': frame(
    'j25',
    C.blush,
    '#ffcabf',
    -45,
    `<path d="M120 42 L176 62 Q176 142 120 180 Q64 142 64 62 Z" fill="${C.teal}" ${stroke()}/>
     <path d="M120 42 V180" ${stroke(4)}/>
     ${face(120, 108, 1.1)}
     <circle cx="160" cy="58" r="12" fill="${C.coral}" ${stroke(4)}/><path d="M152 46 l-4 -8 M168 48 l6 -6" ${stroke(3.5)}/>` +
      chip(25),
  ),
  'ai_best_score-8': frame(
    'jb8',
    C.mint,
    '#b5ead0',
    0,
    `<path d="M120 70 q-10 -24 4 -32" fill="none" ${stroke(5)}/>
     <path d="M124 52 q20 -16 34 -2 q-18 14 -34 2 z" fill="${C.green}" ${stroke(4)}/>
     <path d="M120 74 q-24 -14 -44 2 q-22 22 -6 62 q16 34 38 24 q12 -6 24 0 q22 10 38 -24 q16 -40 -6 -62 q-20 -16 -44 -2 z" fill="${C.coral}" ${stroke()}/>
     ${face(120, 116, 1)}` + chip(8),
  ),
  'ai_best_score-9': frame(
    'jb9',
    C.lilac,
    '#d9ccfa',
    45,
    `<rect x="58" y="54" width="124" height="104" rx="6" fill="${C.butterDeep}" ${stroke()}/>
     <rect x="74" y="70" width="92" height="72" fill="${C.white}" ${stroke(4)}/>
     <path d="M74 142 l26 -30 l18 18 l14 -12 l34 24" fill="${C.green}" ${stroke(4)}/>
     <circle cx="144" cy="90" r="9" fill="${C.coral}" ${stroke(3.5)}/>
     ${star(60, 56, 18, C.butter, 4.5)}` + chip(9),
  ),
  'ai_great_total-5': frame(
    'jg5',
    C.sky,
    '#cfe2ff',
    0,
    star(74, 92, 22) +
      star(120, 74, 26) +
      star(166, 92, 22) +
      star(94, 140, 20) +
      star(146, 140, 20) +
      chip(5),
  ),
  'ai_best_score-10': frame(
    'jb10',
    '#2f2a45',
    '#3a3456',
    -45,
    `<rect x="64" y="52" width="112" height="96" rx="10" fill="${C.white}" ${stroke()}/>
     <text x="120" y="122" text-anchor="middle" font-family="'Nunito','Arial Rounded MT Bold','Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="56" fill="${C.coral}">10</text>
     <path d="M92 148 v24 M148 148 v24" ${stroke(6)}/>
     ${sparkle(52, 64, 10, C.butter)}${sparkle(186, 72, 8, C.white)}${sparkle(178, 168, 7, C.butter)}${sparkle(60, 166, 6, C.white)}`,
  ),
  'ai_low_total-1': frame(
    'jl1',
    C.paper,
    '#f1ead9',
    -45,
    `<g transform="rotate(-12 120 116)">
       <rect x="62" y="62" width="116" height="104" rx="6" fill="${C.butterDeep}" ${stroke()}/>
       <rect x="76" y="76" width="88" height="76" fill="${C.white}" ${stroke(4)}/>
       <path d="M86 132 q10 -40 24 -10 q12 26 22 -16 q8 -30 22 6" fill="none" stroke="${C.purple}" stroke-width="6" stroke-linecap="round"/>
       <circle cx="98" cy="96" r="8" fill="${C.coral}" ${stroke(3)}/>
       <rect x="132" y="120" width="16" height="16" fill="${C.skyDeep}" ${stroke(3)} transform="rotate(20 140 128)"/>
     </g>
     <text x="182" y="62" text-anchor="middle" font-family="'Nunito','Arial Rounded MT Bold',Arial,sans-serif" font-weight="900" font-size="34" fill="${INK}">?</text>`,
  ),
  'ai_judges_met-3': frame(
    'jm3',
    C.butter,
    '#ffd56b',
    45,
    judgeHead(70, 100, C.skyDeep, '7', 0.85) +
      judgeHead(170, 100, C.blush, '9', 0.85) +
      judgeHead(116, 112, C.mint, '8', 0.95) +
      chip(3),
  ),

  // levels, colored like their rank
  'level-5': frame(
    'l5',
    C.sky,
    '#cfe2ff',
    45,
    medal(C.silver, C.white, '5', INK),
  ),
  'level-10': frame(
    'l10',
    C.mint,
    '#b5ead0',
    45,
    medal(C.teal, C.tealLight, '10', '#073b35'),
  ),
  'level-20': frame(
    'l20',
    C.cream,
    '#fff0a8',
    45,
    medal(C.red, C.butterDeep, '20', '#fff3e0') +
      sparkle(60, 70, 9) +
      sparkle(182, 76, 7),
  ),
  'level-30': frame(
    'l30',
    '#2f2a45',
    '#3a3456',
    45,
    medal(C.purple, C.butter, '30', C.white) +
      sparkle(56, 72, 10, C.butter) +
      sparkle(186, 70, 8, C.white) +
      sparkle(64, 170, 7, C.white),
    // rainbow bands behind the medal, flat like the Mythic rank
    ['#ff6b57', '#ffc233', '#5cc48a', '#8ec3ff', '#8b3fe0']
      .map(
        (fill, i) =>
          `<rect x="0" y="${196 - i * 8}" width="240" height="8" fill="${fill}"/>`,
      )
      .join(''),
  ),
};

mkdirSync(OUT, { recursive: true });
for (const [name, svg] of Object.entries(badges)) {
  writeFileSync(join(OUT, `${name}.svg`), svg);
}
console.log(`Drew ${Object.keys(badges).length} badges into ${OUT}`);
