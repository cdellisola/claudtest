// Geometry worker: owns the Manifold WASM kernel so all CSG happens off the main
// thread. Text rings in -> three coloured, watertight mesh parts out.
import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { BuildRequest, Part, RGB } from './types';

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
    const track = <T>(o: T): T => {
      cleanup.push(o);
      return o;
    };

    // 2D sections (EvenOdd handles letter holes like "o", "a", "e").
    const textCS = track(new CrossSection(rings, 'EvenOdd'));
    const border = params.borderSize;
    const baseCS = track(textCS.offset(border, 'Round', 2, 0));

    // BASE (grown outline, full plate height, from Z=0).
    if (params.useBase) {
      const baseSolid = track(Manifold.extrude(baseCS, params.plateHeight));
      parts.push(meshToPart(baseSolid, 'base', params.baseColor));
    }

    // RAISED OUTLINE ring on top of the base.
    if (params.useOutline) {
      const innerCS = track(textCS.offset(border - params.outlineSize, 'Round', 2, 0));
      const outlineCS = track(baseCS.subtract(innerCS));
      const raw = track(Manifold.extrude(outlineCS, Math.max(0.01, params.outlineHeight)));
      const outlineSolid = track(raw.translate([0, 0, params.plateHeight]));
      parts.push(meshToPart(outlineSolid, 'outline', params.outlineColor));
    }

    // TEXT on top of the base.
    const textRaw = track(Manifold.extrude(textCS, Math.max(0.01, params.textHeight)));
    const textSolid = track(textRaw.translate([0, 0, params.plateHeight]));
    parts.push(meshToPart(textSolid, 'text', params.textColor));

    // Free WASM handles.
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
