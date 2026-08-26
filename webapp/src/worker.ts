// Geometry worker: owns the Manifold WASM kernel so all CSG happens off the main
// thread. Handles two tools: name tags and interlocking text.
import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { BuildRequest, Part, RGB, Ring } from './types';

let wasmPromise: Promise<any> | null = null;
async function getWasm(): Promise<any> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const w = await (Module as any)({ locateFile: () => wasmUrl });
      w.setup();
      return w;
    })();
  }
  return wasmPromise;
}

function meshToPart(solid: any, name: string, color: RGB): Part {
  const m = solid.getMesh();
  return {
    name,
    colorRgb: color,
    numProp: m.numProp,
    vertProperties: m.vertProperties as Float32Array,
    triVerts: m.triVerts as Uint32Array,
  };
}

function glyphsBBox(glyphs: Ring[][]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const g of glyphs) {
    for (const r of g) {
      for (const [x, y] of r) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// Name tag
// ---------------------------------------------------------------------------
function buildNametag(w: any, msg: Extract<BuildRequest, { tool: 'nametag' }>): Part[] {
  const { CrossSection, Manifold } = w;
  const { glyphs, params } = msg;
  if (!glyphs.length) throw new Error('Nessun contorno di testo.');

  const parts: Part[] = [];
  const cleanup: any[] = [];
  const track = <T,>(o: T): T => {
    cleanup.push(o);
    return o;
  };

  // Union each glyph so overlapping cursive letters fuse instead of cancelling.
  let textCS: any = null;
  for (const glyph of glyphs) {
    const cs = track(new CrossSection(glyph, 'EvenOdd'));
    textCS = textCS ? track(textCS.add(cs)) : cs;
  }
  if (!textCS) throw new Error('Nessun contorno di testo.');

  const border = params.borderSize;
  const baseCS = track(textCS.offset(border, 'Round', 2, 0));

  let baseSolid: any = params.useBase ? track(Manifold.extrude(baseCS, params.plateHeight)) : null;

  let keychainMarker: { cx: number; cy: number } | null = null;
  if (params.keychain) {
    const bb = glyphsBBox(glyphs);
    const R = Math.max(1, params.keychainRing / 2);
    const hR = Math.max(0.5, Math.min(R - 0.8, params.keychainHole / 2));
    const gap = 1;
    // Loop centre: auto (top-left) until the user drags/edits it.
    const cx = params.keychainAuto ? bb.minX - R * 0.3 : params.keychainX;
    const cy = params.keychainAuto ? bb.maxY + border + gap + R : params.keychainY;
    keychainMarker = { cx, cy };

    // Build the hook around the origin: disc + a bridge pointing -Y, long enough
    // to reach into the base; then subtract the hole LAST so it's always clear.
    const reach = R + border + gap + params.fontSizeMm * 0.6;
    const bridgeW = Math.max(2, R * 0.9);
    const disc = track(CrossSection.circle(R, 64));
    const bridge = track(CrossSection.square([bridgeW, reach], true).translate([0, R * 0.4 - reach / 2]));
    let hook = track(disc.add(bridge));
    hook = track(hook.subtract(track(CrossSection.circle(hR, 48))));
    hook = track(track(hook.rotate(params.keychainAngle)).translate([cx, cy]));
    const loopSolid = track(Manifold.extrude(hook, params.plateHeight));
    baseSolid = baseSolid ? track(baseSolid.add(loopSolid)) : loopSolid;
  }

  if (baseSolid) parts.push(meshToPart(baseSolid, 'base', params.baseColor));

  if (params.useOutline) {
    const innerCS = track(baseCS.offset(-params.outlineSize, 'Round', 2, 0));
    const outlineCS = track(baseCS.subtract(innerCS));
    const raw = track(Manifold.extrude(outlineCS, Math.max(0.01, params.outlineHeight)));
    const outlineSolid = track(raw.translate([0, 0, params.plateHeight]));
    parts.push(meshToPart(outlineSolid, 'outline', params.outlineColor));
  }

  const textRaw = track(Manifold.extrude(textCS, Math.max(0.01, params.textHeight)));
  const textSolid = track(textRaw.translate([0, 0, params.plateHeight]));
  parts.push(meshToPart(textSolid, 'text', params.textColor));

  // Preview-only draggable marker over the keychain loop.
  if (keychainMarker) {
    const R = Math.max(1, params.keychainRing / 2);
    const disc = track(track(Manifold.extrude(track(CrossSection.circle(R, 48)), 2)).translate([0, 0, -1]));
    parts.push({
      ...meshToPart(disc, 'gancio', [230, 170, 90]),
      gizmo: 'keychain',
      gizmoAxes: 'xy',
      gizmoPos: [keychainMarker.cx, keychainMarker.cy, params.plateHeight + 1.5],
      preview: true,
      opacity: 0.85,
    });
  }

  for (const o of cleanup) o?.delete?.();
  return parts;
}

// ---------------------------------------------------------------------------
// Interlocking text (Insult3D)
// ---------------------------------------------------------------------------
function buildInterlock(w: any, msg: Extract<BuildRequest, { tool: 'interlock' }>): Part[] {
  const { CrossSection, Manifold } = w;
  const p = msg.params;
  const cleanup: any[] = [];
  const track = <T,>(o: T): T => {
    cleanup.push(o);
    return o;
  };

  const union = (glyphs: Ring[][]): any => {
    let cs: any = null;
    for (const g of glyphs) {
      const c = track(new CrossSection(g, 'EvenOdd'));
      cs = cs ? track(cs.add(c)) : c;
    }
    return cs;
  };

  const t2 = msg.g2.length ? union(msg.g2) : null;
  if (!t2) throw new Error('Manca il testo centrale.');
  const t1 = msg.g1.length ? union(msg.g1) : null;
  const t3 = msg.g3.length ? union(msg.g3) : null;

  const zTop = p.spessore2 - p.profondita; // where the small texts sit

  let base = track(Manifold.extrude(t2, p.spessore2));

  const carve = (t: any, px: number, py: number, sp: number): any => {
    const off = track(t.offset(p.tolleranza, 'Round', 2, 0));
    const moved = track(off.translate([px, py]));
    const sol = track(Manifold.extrude(moved, sp + 1));
    return track(sol.translate([0, 0, zTop - 0.1]));
  };
  if (t1) base = track(base.subtract(carve(t1, p.posX1, p.posY1, p.spessore1)));
  if (t3) base = track(base.subtract(carve(t3, p.posX3, p.posY3, p.spessore3)));

  const parts: Part[] = [meshToPart(base, 'testo_centrale', p.color2)];

  // Optional flat backing plate (just the background, no raised border) under
  // the whole phrase.
  if (p.sfondo) {
    let sil: any = t2;
    if (t1) sil = track(sil.add(track(t1.translate([p.posX1, p.posY1]))));
    if (t3) sil = track(sil.add(track(t3.translate([p.posX3, p.posY3]))));
    const plateCS = track(sil.offset(p.sfondoMargine, 'Round', 2, 0));
    const th = Math.max(0.2, p.sfondoSpessore);
    const plate = track(track(Manifold.extrude(plateCS, th)).translate([0, 0, -th + 0.02]));
    parts.unshift(meshToPart(plate, 'sfondo', p.sfondoColor));
  }

  const solid = (t: any, px: number, py: number, sp: number): any => {
    const moved = track(t.translate([px, py]));
    const sol = track(Manifold.extrude(moved, sp));
    return track(sol.translate([0, 0, zTop]));
  };
  if (t1) parts.push({ ...meshToPart(solid(t1, p.posX1, p.posY1, p.spessore1), 'testo_1', p.color1), drag: 'text1' });
  if (t3) parts.push({ ...meshToPart(solid(t3, p.posX3, p.posY3, p.spessore3), 'testo_3', p.color3), drag: 'text3' });

  for (const o of cleanup) o?.delete?.();
  return parts;
}

// ---------------------------------------------------------------------------
// Initial with name (GlowLab Letter 3D)
// ---------------------------------------------------------------------------
function buildInitial(w: any, msg: Extract<BuildRequest, { tool: 'initial' }>): Part[] {
  const { CrossSection, Manifold } = w;
  const p = msg.params;
  const cleanup: any[] = [];
  const track = <T,>(o: T): T => {
    cleanup.push(o);
    return o;
  };
  const union = (glyphs: Ring[][]): any => {
    let cs: any = null;
    for (const g of glyphs) {
      const c = track(new CrossSection(g, 'EvenOdd'));
      cs = cs ? track(cs.add(c)) : c;
    }
    return cs;
  };

  const initialCS0 = union(msg.initialGlyphs);
  if (!initialCS0) throw new Error("Manca l'iniziale.");
  let initialCS = track(initialCS0.translate([p.initialOffsetX, p.initialOffsetY]));

  // Flat base: keep only material above a horizontal cut (for curved letters).
  if (p.flatBase) {
    const bb = glyphsBBox(msg.initialGlyphs);
    const cutY = bb.minY + p.initialOffsetY + Math.max(0, p.flatBaseCut);
    const big = 100000;
    const rectRing: Ring = [
      [-big, cutY],
      [big, cutY],
      [big, cutY + big],
      [-big, cutY + big],
    ];
    const rect = track(new CrossSection([rectRing], 'NonZero'));
    initialCS = track(initialCS.intersect(rect));
  }

  let initial = track(Manifold.extrude(initialCS, p.initialThickness));

  // Name pocket + protruding piece.
  const nameCS = msg.nameGlyphs.length ? union(msg.nameGlyphs) : null;
  let namePiece: any = null;
  if (nameCS) {
    const place = (cs: any) =>
      track(track(cs.rotate(p.nameRotate)).translate([p.nameOffsetX, p.nameOffsetY]));
    const pocketZ = p.initialThickness - p.pocketDepth;
    const pocketCS = place(track(nameCS.offset(p.clearance, 'Round', 2, 0)));
    const pocket = track(track(Manifold.extrude(pocketCS, p.pocketDepth + 0.2)).translate([0, 0, pocketZ - 0.1]));
    initial = track(initial.subtract(pocket));
    const pieceCS = place(track(nameCS.offset(-p.clearance, 'Round', 2, 0)));
    namePiece = track(track(Manifold.extrude(pieceCS, p.nameThickness)).translate([0, 0, pocketZ]));
  }

  // Magnet pockets: cylindrical voids carved into the initial. m.z is measured
  // from the TOP surface of the initial (0 = surface, negative = into material).
  const worldZ = (m: (typeof p.magnets)[number]) => p.initialThickness + m.z;
  const voidOf = (m: (typeof p.magnets)[number]) =>
    track(
      track(
        Manifold.extrude(track(CrossSection.circle(Math.max(0.5, m.d / 2), 40).translate([m.x, m.y])), Math.max(0.2, m.h)),
      ).translate([0, 0, worldZ(m) - m.h / 2]),
    );
  for (const m of p.magnets) initial = track(initial.subtract(voidOf(m)));

  const parts: Part[] = [
    { ...meshToPart(initial, 'iniziale', p.initialColor), gizmo: 'initial', gizmoAxes: 'xy' },
  ];
  if (namePiece) {
    parts.push({ ...meshToPart(namePiece, 'nome', p.nameColor), gizmo: 'name', gizmoAxes: 'xy' });
  }

  // Preview-only magnet markers, authored around the origin and placed via
  // gizmoPos so the 3-axis gizmo yields absolute coordinates.
  p.magnets.forEach((m, i) => {
    const r = Math.max(0.5, m.d / 2);
    const h = Math.max(0.2, m.h);
    const marker = track(track(Manifold.extrude(track(CrossSection.circle(r, 40)), h)).translate([0, 0, -h / 2]));
    parts.push({
      ...meshToPart(marker, `magnete_${i + 1}`, [150, 150, 165]),
      gizmo: `magnet:${i}`,
      gizmoPos: [m.x, m.y, worldZ(m)],
      preview: true,
      opacity: 0.7,
    });
  });

  for (const o of cleanup) o?.delete?.();
  return parts;
}

// ---------------------------------------------------------------------------
// Cookie cutter (housing mold + pattern mold)
// ---------------------------------------------------------------------------
function buildCookie(w: any, msg: Extract<BuildRequest, { tool: 'cookie' }>): Part[] {
  const { CrossSection, Manifold } = w;
  const p = msg.params;
  const cleanup: any[] = [];
  const track = <T,>(o: T): T => {
    cleanup.push(o);
    return o;
  };

  if (!msg.graphic.length) throw new Error('Nessuna grafica.');

  // Filled silhouette (holes filled) and the detailed graphic (holes kept).
  const allRings = msg.graphic.flat();
  let fill: any = null;
  for (const r of allRings) {
    const c = track(new CrossSection([r], 'NonZero'));
    fill = fill ? track(fill.add(c)) : c;
  }
  let detail: any = null;
  for (const g of msg.graphic) {
    const c = track(new CrossSection(g, 'EvenOdd'));
    detail = detail ? track(detail.add(c)) : c;
  }
  // Optional mirrored text merged into the engraving.
  for (const g of msg.text) {
    const c = track(new CrossSection(g, 'EvenOdd'));
    detail = detail ? track(detail.add(c)) : c;
  }
  const bb = glyphsBBox(msg.graphic);
  const halfW = (bb.maxX - bb.minX) / 2;
  const halfH = (bb.maxY - bb.minY) / 2;

  const gap = p.unified ? 0 : p.clearance;

  // Housing mold: a wall following the silhouette.
  const inner = track(fill.offset(gap, 'Round', 2, 0));
  const outer = track(fill.offset(gap + p.wall, 'Round', 2, 0));
  const wallCS = track(outer.subtract(inner));
  let housing = track(Manifold.extrude(wallCS, p.housingHeight));

  // Pattern mold: solid silhouette with the graphic engraved (or raised).
  let pattern = track(Manifold.extrude(fill, p.patternHeight));
  if (p.engraved) {
    const eng = track(
      track(Manifold.extrude(detail, p.iconThickness + 0.1)).translate([0, 0, p.patternHeight - p.iconThickness]),
    );
    pattern = track(pattern.subtract(eng));
  } else {
    const relief = track(track(Manifold.extrude(detail, p.iconThickness)).translate([0, 0, p.patternHeight]));
    pattern = track(pattern.add(relief));
  }

  // Optional alignment pin: a socket hole in the pattern + a SEPARATE cylinder
  // (printed apart and inserted later — never overlapping the other objects).
  let pinPart: any = null;
  if (p.pin) {
    const hole = track(
      track(Manifold.extrude(track(CrossSection.circle(Math.max(0.5, p.holeD / 2), 48).translate([p.pinX, p.pinY])), Math.max(0.2, p.holeH) + 0.1)).translate(
        [0, 0, -0.05],
      ),
    );
    pattern = track(pattern.subtract(hole));
    pinPart = track(Manifold.extrude(track(CrossSection.circle(Math.max(0.5, p.pinD / 2), 48)), Math.max(0.2, p.pinH)));
  }

  // Lay the parts out side by side (unless unified) so nothing overlaps.
  if (!p.unified) {
    housing = track(housing.translate([-(halfW + p.wall + 15), 0, 0]));
    pattern = track(pattern.translate([halfW + 15, 0, 0]));
  }
  if (pinPart) {
    pinPart = track(pinPart.translate([0, halfH + Math.max(0.5, p.pinD / 2) + 20, 0]));
  }

  const parts: Part[] = [
    meshToPart(housing, 'stampo_esterno', p.housingColor),
    meshToPart(pattern, 'stampo_pattern', p.patternColor),
  ];
  if (pinPart) parts.push(meshToPart(pinPart, 'perno', p.patternColor));
  for (const o of cleanup) o?.delete?.();
  return parts;
}

// ---------------------------------------------------------------------------
// Text cookie cutter (word-shaped cutting wall + base handle flange)
// ---------------------------------------------------------------------------
function buildTextCutter(w: any, msg: Extract<BuildRequest, { tool: 'textcutter' }>): Part[] {
  const { CrossSection, Manifold } = w;
  const p = msg.params;
  const cleanup: any[] = [];
  const track = <T,>(o: T): T => {
    cleanup.push(o);
    return o;
  };
  if (!msg.graphic.length) throw new Error('Nessun testo.');

  const wall = Math.max(0.4, p.wall);

  // True glyph shape (keeps counters like O/a/A) and its filled footprint.
  let shape: any = null;
  for (const g of msg.graphic) {
    const c = track(new CrossSection(g, 'EvenOdd'));
    shape = shape ? track(shape.add(c)) : c;
  }
  let fill: any = null;
  for (const r of msg.graphic.flat()) {
    const c = track(new CrossSection([r], 'NonZero'));
    fill = fill ? track(fill.add(c)) : c;
  }

  // Cutting walls along every contour (outer + inner counters).
  const wallBand = track(shape.subtract(track(shape.offset(-wall, 'Round', 2, 0))));
  let solid = track(Manifold.extrude(wallBand, p.cutterHeight));

  // Outer border / flange following the letters (as before).
  if (p.borderExt > 0 && p.borderHeight > 0) {
    const flange = track(track(fill.offset(p.borderExt, 'Round', 2, 0)).subtract(track(fill.offset(-wall, 'Round', 2, 0))));
    solid = track(solid.add(track(Manifold.extrude(flange, p.borderHeight))));
  }

  // Support bars ONLY inside the counters (the empty inner regions), wider and
  // shallower — they never run through the cutting walls or outside.
  if (p.supportGrid && p.gridHeight > 0) {
    const bb = glyphsBBox(msg.graphic);
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;
    const W = bb.maxX - bb.minX + 4;
    const H = bb.maxY - bb.minY + 4;
    const bw = Math.max(0.6, p.gridWidth);
    const spacing = Math.max(3, p.gridSpacing);

    let grid: any = null;
    for (let x = cx - W / 2 + spacing; x < cx + W / 2; x += spacing) {
      const b = track(CrossSection.square([bw, H], true).translate([x, cy]));
      grid = grid ? track(grid.add(b)) : b;
    }
    for (let y = cy - H / 2 + spacing; y < cy + H / 2; y += spacing) {
      const b = track(CrossSection.square([W, bw], true).translate([cx, y]));
      grid = grid ? track(grid.add(b)) : b;
    }
    if (grid) {
      // Keep the bars within the letters' footprint (excludes the flange) so
      // they cross the interior and tie inner islands (O/a/A centres) to the
      // outer wall, while staying low (they never reach the cutting edge).
      const inside = track(grid.intersect(fill));
      solid = track(solid.add(track(Manifold.extrude(inside, p.gridHeight))));
    }
  }

  const parts: Part[] = [meshToPart(solid, 'taglierina', p.color)];
  for (const o of cleanup) o?.delete?.();
  return parts;
}

self.onmessage = async (e: MessageEvent<BuildRequest>) => {
  const msg = e.data;
  if (msg.type !== 'build') return;
  try {
    const w = await getWasm();
    const parts =
      msg.tool === 'interlock'
        ? buildInterlock(w, msg)
        : msg.tool === 'initial'
          ? buildInitial(w, msg)
          : msg.tool === 'cookie'
            ? buildCookie(w, msg)
            : msg.tool === 'textcutter'
              ? buildTextCutter(w, msg)
              : buildNametag(w, msg);
    const transfer: Transferable[] = [];
    for (const part of parts) transfer.push(part.vertProperties.buffer, part.triVerts.buffer);
    (self as unknown as Worker).postMessage({ type: 'parts', parts }, transfer);
  } catch (err: any) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: err?.stack ?? err?.message ?? String(err),
    });
  }
};

(self as unknown as Worker).postMessage({ type: 'ready' });
