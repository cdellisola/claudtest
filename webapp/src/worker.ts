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

  if (params.keychain) {
    const bb = glyphsBBox(glyphs);
    const R = Math.max(1, params.keychainRing / 2);
    const hR = Math.max(0.5, Math.min(R - 0.8, params.keychainHole / 2));
    const gap = 1;
    const cxLoop = bb.minX - R * 0.3;
    const cyLoop = bb.maxY + border + gap + R;
    const outer = track(CrossSection.circle(R, 64).translate([cxLoop, cyLoop]));
    const inner = track(CrossSection.circle(hR, 48).translate([cxLoop, cyLoop]));
    const annulus = track(outer.subtract(inner));
    const bridgeTop = cyLoop;
    const bridgeBottom = bb.maxY - params.fontSizeMm * 0.3;
    const bridgeLen = Math.max(1, bridgeTop - bridgeBottom);
    const bridgeW = Math.max(2, R * 0.9);
    const bridge = track(
      CrossSection.square([bridgeW, bridgeLen], true).translate([cxLoop, (bridgeTop + bridgeBottom) / 2]),
    );
    const loopCS = track(annulus.add(bridge));
    const loopSolid = track(Manifold.extrude(loopCS, params.plateHeight));
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

self.onmessage = async (e: MessageEvent<BuildRequest>) => {
  const msg = e.data;
  if (msg.type !== 'build') return;
  try {
    const w = await getWasm();
    const parts = msg.tool === 'interlock' ? buildInterlock(w, msg) : buildNametag(w, msg);
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
