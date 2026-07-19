// Geometry worker: owns the Manifold WASM kernel so all CSG happens off the main
// thread. Text rings in -> coloured, watertight mesh parts out.
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

function ringsBBox(rings: Ring[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) {
    for (const [x, y] of r) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

self.onmessage = async (e: MessageEvent<BuildRequest>) => {
  const msg = e.data;
  if (msg.type !== 'build') return;
  try {
    const w = await getWasm();
    const { CrossSection, Manifold } = w;
    const { rings, params } = msg;

    if (!rings.length) throw new Error('Nessun contorno di testo.');

    const parts: Part[] = [];
    const cleanup: any[] = [];
    const track = <T,>(o: T): T => {
      cleanup.push(o);
      return o;
    };

    // 2D sections (EvenOdd handles letter holes like "o", "a", "e").
    const textCS = track(new CrossSection(rings, 'EvenOdd'));
    const border = params.borderSize;
    const baseCS = track(textCS.offset(border, 'Round', 2, 0));

    // BASE (grown outline, full plate height, from Z=0).
    let baseSolid: any = params.useBase ? track(Manifold.extrude(baseCS, params.plateHeight)) : null;

    // KEYCHAIN loop at the top-left, fused to the base.
    if (params.keychain) {
      const bb = ringsBBox(rings);
      const R = Math.max(1, params.keychainRing / 2);
      const hR = Math.max(0.5, Math.min(R - 0.8, params.keychainHole / 2));
      const gap = 1;
      // Loop centre: up and slightly left of the top-left of the text block.
      const cxLoop = bb.minX - R * 0.3;
      const cyLoop = bb.maxY + border + gap + R;
      // Annulus (ring).
      const outer = track(CrossSection.circle(R, 64).translate([cxLoop, cyLoop]));
      const inner = track(CrossSection.circle(hR, 48).translate([cxLoop, cyLoop]));
      const annulus = track(outer.subtract(inner));
      // Bridge connecting the loop down into the base material (the top-left letters).
      const bridgeTop = cyLoop;
      const bridgeBottom = bb.maxY - params.fontSizeMm * 0.3; // reach into the first line
      const bridgeLen = Math.max(1, bridgeTop - bridgeBottom);
      const bridgeW = Math.max(2, R * 0.9);
      const bridge = track(
        CrossSection.square([bridgeW, bridgeLen], true).translate([
          cxLoop,
          (bridgeTop + bridgeBottom) / 2,
        ]),
      );
      const loopCS = track(annulus.add(bridge));
      const loopSolid = track(Manifold.extrude(loopCS, params.plateHeight));
      if (baseSolid) {
        baseSolid = track(baseSolid.add(loopSolid));
      } else {
        baseSolid = loopSolid;
      }
    }

    if (baseSolid) parts.push(meshToPart(baseSolid, 'base', params.baseColor));

    // RAISED OUTLINE: a uniform band along the OUTER perimeter of the base only.
    // Shrinking the base inward (instead of following the text) keeps the outline
    // on the external contour and never traces around the individual letters.
    if (params.useOutline) {
      const innerCS = track(baseCS.offset(-params.outlineSize, 'Round', 2, 0));
      const outlineCS = track(baseCS.subtract(innerCS));
      const raw = track(Manifold.extrude(outlineCS, Math.max(0.01, params.outlineHeight)));
      const outlineSolid = track(raw.translate([0, 0, params.plateHeight]));
      parts.push(meshToPart(outlineSolid, 'outline', params.outlineColor));
    }

    // TEXT on top of the base.
    const textRaw = track(Manifold.extrude(textCS, Math.max(0.01, params.textHeight)));
    const textSolid = track(textRaw.translate([0, 0, params.plateHeight]));
    parts.push(meshToPart(textSolid, 'text', params.textColor));

    for (const o of cleanup) o?.delete?.();

    const transfer: Transferable[] = [];
    for (const p of parts) transfer.push(p.vertProperties.buffer, p.triVerts.buffer);
    (self as unknown as Worker).postMessage({ type: 'parts', parts }, transfer);
  } catch (err: any) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: err?.stack ?? err?.message ?? String(err),
    });
  }
};

(self as unknown as Worker).postMessage({ type: 'ready' });
