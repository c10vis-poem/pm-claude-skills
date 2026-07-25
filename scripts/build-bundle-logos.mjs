#!/usr/bin/env node
// Generates the bundle crest SVGs in web/docs-assets/logos/ — one rounded-square
// badge per flagship bundle, shared geometry, per-bundle gradient + glyph.
// Rerun after editing; the README embeds them at 84px.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'docs-assets', 'logos');
mkdirSync(out, { recursive: true });

// Each glyph is drawn white on the gradient, inside a 120x120 viewBox.
const GLYPHS = {
  'pm-decoders': `
    <g stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round">
      <rect x="30" y="24" width="44" height="58" rx="6"/>
      <line x1="40" y1="40" x2="64" y2="40"/><line x1="40" y1="52" x2="58" y2="52"/>
      <circle cx="70" cy="68" r="18" fill="rgba(255,255,255,.14)"/>
      <line x1="83" y1="81" x2="96" y2="94" stroke-width="9"/>
    </g>`,
  'pm-simulators': `
    <g fill="#fff">
      <path d="M28 34 q16 -8 32 0 q0 26 -16 34 q-16 -8 -16 -34z" opacity=".85"/>
      <path d="M60 50 q16 -8 32 0 q0 26 -16 34 q-16 -8 -16 -34z"/>
      <circle cx="38" cy="46" r="3.4" fill="#8b5cf6"/><circle cx="50" cy="46" r="3.4" fill="#8b5cf6"/>
      <path d="M38 58 q6 6 12 0" stroke="#8b5cf6" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <circle cx="70" cy="62" r="3.4" fill="#8b5cf6"/><circle cx="82" cy="62" r="3.4" fill="#8b5cf6"/>
      <path d="M70 76 q6 -6 12 0" stroke="#8b5cf6" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    </g>`,
  'pm-calculators': `
    <g>
      <rect x="32" y="22" width="56" height="76" rx="10" fill="rgba(255,255,255,.16)" stroke="#fff" stroke-width="6"/>
      <rect x="42" y="32" width="36" height="14" rx="4" fill="#fff"/>
      <g fill="#fff">
        <circle cx="48" cy="60" r="5"/><circle cx="60" cy="60" r="5"/><circle cx="72" cy="60" r="5"/>
        <circle cx="48" cy="74" r="5"/><circle cx="60" cy="74" r="5"/><circle cx="72" cy="74" r="5"/>
        <rect x="43" y="84" width="34" height="7" rx="3.5"/>
      </g>
    </g>`,
  'pm-live': `
    <g stroke="#fff" fill="none" stroke-width="7" stroke-linecap="round">
      <path d="M36 76 a 28 28 0 0 1 48 0" opacity=".45"/>
      <path d="M46 84 a 16 16 0 0 1 28 0" opacity=".75"/>
      <circle cx="60" cy="92" r="7" fill="#fff" stroke="none"/>
      <path d="M26 66 a 40 40 0 0 1 68 0" opacity=".28"/>
    </g>
    <circle cx="88" cy="34" r="6" fill="#fff"><animate attributeName="opacity" values="1;.2;1" dur="1.6s" repeatCount="indefinite"/></circle>`,
  'pm-cowork': `
    <g fill="#fff">
      <circle cx="46" cy="46" r="13" opacity=".85"/>
      <path d="M24 88 q0 -22 22 -22 q22 0 22 22z" opacity=".85"/>
      <circle cx="76" cy="52" r="13"/>
      <path d="M54 94 q0 -22 22 -22 q22 0 22 22z"/>
    </g>`,
  'pm-tokens': `
    <g stroke="#fff" stroke-width="5.5" fill="rgba(255,255,255,.16)">
      <ellipse cx="60" cy="78" rx="26" ry="10"/>
      <ellipse cx="60" cy="64" rx="26" ry="10"/>
      <ellipse cx="60" cy="50" rx="26" ry="10" fill="rgba(255,255,255,.55)"/>
    </g>
    <path d="M44 48 q16 -5 32 0" stroke="#b45309" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".85"/>`,
  'pm-seatbelt': `
    <g>
      <path d="M60 22 l30 10 v24 q0 26 -30 40 q-30 -14 -30 -40 v-24z" fill="rgba(255,255,255,.16)" stroke="#fff" stroke-width="6"/>
      <path d="M46 60 l10 11 l20 -22" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`,
  'pm-essentials': `
    <g>
      <rect x="32" y="26" width="56" height="70" rx="9" fill="rgba(255,255,255,.16)" stroke="#fff" stroke-width="6"/>
      <rect x="46" y="18" width="28" height="14" rx="6" fill="#fff"/>
      <g stroke="#fff" stroke-width="6" stroke-linecap="round">
        <line x1="44" y1="50" x2="76" y2="50"/><line x1="44" y1="64" x2="76" y2="64"/><line x1="44" y1="78" x2="62" y2="78"/>
      </g>
      <path d="M80 76 l3.5 8 8 3.5 -8 3.5 -3.5 8 -3.5 -8 -8 -3.5 8 -3.5z" fill="#fff"/>
    </g>`,
};

const GRADS = {
  'pm-decoders': ['#6366f1', '#22d3ee'],
  'pm-simulators': ['#ec4899', '#8b5cf6'],
  'pm-calculators': ['#10b981', '#0d9488'],
  'pm-live': ['#f59e0b', '#ef4444'],
  'pm-cowork': ['#3b82f6', '#6366f1'],
  'pm-tokens': ['#fbbf24', '#d97706'],
  'pm-seatbelt': ['#22c55e', '#15803d'],
  'pm-essentials': ['#8a5cf5', '#5b21b6'],
};

for (const [name, glyph] of Object.entries(GLYPHS)) {
  const [c1, c2] = GRADS[name];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="${name} bundle logo">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="26" fill="url(#g)"/>
  <rect x="4" y="4" width="112" height="112" rx="22" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2"/>
  <circle cx="22" cy="20" r="2.5" fill="rgba(255,255,255,.7)"/>
  <circle cx="102" cy="102" r="2" fill="rgba(255,255,255,.5)"/>
  ${glyph}
</svg>\n`;
  writeFileSync(join(out, `${name}.svg`), svg);
  console.log(`wrote logos/${name}.svg`);
}
