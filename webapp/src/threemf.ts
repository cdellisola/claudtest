// Author a multicolor 3MF that loads as a SINGLE object with N pre-coloured
// mating parts, each mapped to its own filament slot — so Bambu Studio /
// OrcaSlicer / MakerWorld import it already coloured.
import { zipSync, strToU8 } from 'fflate';
import type { Part, RGB } from './types';

const f = (n: number): string => String(Math.round(n * 1e4) / 1e4);

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hex(c: RGB): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(c[0])}${h(c[1])}${h(c[2])}FF`;
}

export function buildThreeMF(allParts: Part[]): Uint8Array {
  // Preview-only markers (e.g. magnet placeholders) never go into the file.
  const parts = allParts.filter((p) => !p.preview);
  // Drop the assembly onto the plate (min Z -> 0).
  let minZ = Infinity;
  for (const p of parts) {
    const vp = p.vertProperties;
    for (let i = 2; i < vp.length; i += p.numProp) {
      if (vp[i] < minZ) minZ = vp[i];
    }
  }
  if (!isFinite(minZ)) minZ = 0;

  // One filament slot per unique colour, in first-seen order.
  const slotByColor = new Map<string, number>();
  const extruders = parts.map((p) => {
    const key = p.colorRgb.join(',');
    let slot = slotByColor.get(key);
    if (slot === undefined) {
      slot = slotByColor.size + 1;
      slotByColor.set(key, slot);
    }
    return slot;
  });

  const meshXml = (p: Part): string => {
    const vp = p.vertProperties;
    const tv = p.triVerts;
    const np = p.numProp;
    let v = '';
    for (let i = 0; i < vp.length; i += np) {
      v += `<vertex x="${f(vp[i])}" y="${f(vp[i + 1])}" z="${f(vp[i + 2] - minZ)}"/>`;
    }
    let t = '';
    for (let i = 0; i < tv.length; i += 3) {
      t += `<triangle v1="${tv[i]}" v2="${tv[i + 1]}" v3="${tv[i + 2]}"/>`;
    }
    return `<mesh><vertices>${v}</vertices><triangles>${t}</triangles></mesh>`;
  };

  const baseMaterials = parts
    .map((p) => `<base name="${esc(p.name)}" displaycolor="${hex(p.colorRgb)}"/>`)
    .join('');
  const leafObjects = parts
    .map((p, i) => `<object id="${i + 2}" type="model" pid="1" pindex="${i}">${meshXml(p)}</object>`)
    .join('');
  const wrapperId = parts.length + 2;
  const components = parts.map((_, i) => `<component objectid="${i + 2}"/>`).join('');
  const wrapper = `<object id="${wrapperId}" type="model"><components>${components}</components></object>`;

  const metadata =
    `<metadata name="Title">Name Tag</metadata>` +
    `<metadata name="Application">Name Tag Generator</metadata>` +
    `<metadata name="CreationDate">${new Date().toISOString().slice(0, 10)}</metadata>`;

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US"` +
    ` xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"` +
    ` xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">` +
    metadata +
    `<resources>` +
    `<basematerials id="1">${baseMaterials}</basematerials>` +
    leafObjects +
    wrapper +
    `</resources>` +
    `<build><item objectid="${wrapperId}"/></build>` +
    `</model>`;

  const objectCfg =
    `<object id="${wrapperId}">` +
    `<metadata key="name" value="name_tag"/>` +
    `<metadata key="extruder" value="1"/>` +
    parts
      .map(
        (p, i) =>
          `<part id="${i + 2}" subtype="normal_part">` +
          `<metadata key="name" value="${esc(p.name)}"/>` +
          `<metadata key="extruder" value="${extruders[i]}"/>` +
          `</part>`,
      )
      .join('') +
    `</object>`;
  const modelSettings = `<?xml version="1.0" encoding="UTF-8"?>\n<config>${objectCfg}</config>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    `<Default Extension="config" ContentType="text/xml"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel0"` +
    ` Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
    `</Relationships>`;

  return zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rels),
      '3D/3dmodel.model': strToU8(model),
      'Metadata/model_settings.config': strToU8(modelSettings),
    },
    { level: 6 },
  );
}

export function downloadThreeMF(parts: Part[], fileName = 'name-tag.3mf') {
  const bytes = buildThreeMF(parts);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'model/3mf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
