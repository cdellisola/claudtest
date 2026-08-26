// GlowLab3D brand marks — faithful vector recreations of the original logo
// (outlined isometric cube with a liquid drop + the "GlowLab3D" wordmark).
// Rebuilt as SVG so they stay crisp at any size and in both the sidebar and
// the home hero.

const GRAD = `
  <linearGradient id="glowgrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#45d6d2"/>
    <stop offset="1" stop-color="#16b3ba"/>
  </linearGradient>`;

// The cube + drop mark on its own (used in the small sidebar slot).
// Outer hexagon T–UR–LR–B–LL–UL with a central Y (three visible cube edges),
// and a droplet dripping off the top-right edge.
const CUBE = `
  <g stroke="url(#glowgrad)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" fill="none">
    <polygon points="60,8 108,34 108,90 60,116 12,90 12,34"/>
    <path d="M60,62 L60,8 M60,62 L108,90 M60,62 L12,90"/>
  </g>
  <g fill="url(#glowgrad)">
    <path d="M96,40 c7,1 11,7 8,13 c-3,5 -12,5 -14,-1 c-2,-5 1,-11 6,-12 z"/>
    <path d="M95,60 c4,6 4,11 0,14 c-4,-3 -4,-8 0,-14 z"/>
  </g>`;

export const LOGO_MARK_SVG = `
<svg viewBox="0 0 120 124" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>${GRAD}</defs>
  ${CUBE}
</svg>`;

// Full horizontal lockup: cube mark + "GlowLab" wordmark + "3D" tag.
// The wordmark uses a rounded geometric stack to echo the original type.
export const LOGO_LOCKUP_SVG = `
<svg viewBox="0 0 560 150" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GlowLab3D">
  <defs>${GRAD}</defs>
  <g transform="translate(4,14)">${CUBE}</g>
  <g fill="url(#glowgrad)" font-family="'Baloo 2','Nunito','Quicksand','Varela Round',system-ui,sans-serif" font-weight="800">
    <text x="150" y="104" font-size="118" letter-spacing="-3">GlowLab</text>
    <text x="500" y="104" font-size="60" letter-spacing="-1">3D</text>
  </g>
</svg>`;

// Back-compat alias for existing imports.
export const LOGO_SVG = LOGO_MARK_SVG;
