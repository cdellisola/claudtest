// GlowLab3D mark — an isometric wireframe cube with a liquid drop, recreated as
// scalable SVG (teal brand gradient). Swap for the exact PNG if provided.
export const LOGO_SVG = `
<svg viewBox="0 0 104 108" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="glowgrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#63e3da"/>
      <stop offset="1" stop-color="#1fb6bd"/>
    </linearGradient>
  </defs>
  <g stroke="url(#glowgrad)" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round" fill="none">
    <polygon points="50,8 88,30 88,74 50,96 12,74 12,30"/>
    <path d="M50,52 L50,8 M50,52 L12,74 M50,52 L88,74"/>
  </g>
  <g fill="url(#glowgrad)">
    <path d="M71,26 c7,1 11,7 8,13 c-3,5 -12,5 -14,-1 c-2,-5 1,-11 6,-12 z"/>
    <path d="M70,44 c4,5 4,9 0,12 c-4,-3 -4,-7 0,-12 z"/>
    <path d="M84,66 c6,8 6,15 0,19 c-6,-4 -6,-11 0,-19 z"/>
  </g>
</svg>`;
