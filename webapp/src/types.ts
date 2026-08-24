export type RGB = [number, number, number];

/** A closed 2D ring: list of [x, y] points, in millimetres. */
export type Ring = [number, number][];

/** Everything the geometry worker needs to build a tag (all mm). */
export interface TagParams {
  fontSizeMm: number;
  textHeight: number;
  plateHeight: number;
  borderSize: number;
  outlineSize: number;
  outlineHeight: number;
  useBase: boolean;
  useOutline: boolean;
  keychain: boolean;
  keychainRing: number; // outer diameter of the loop, mm
  keychainHole: number; // hole diameter, mm
  baseColor: RGB;
  outlineColor: RGB;
  textColor: RGB;
}

/** One coloured, watertight mesh part ready for preview / 3MF export. */
export interface Part {
  name: string;
  colorRgb: RGB;
  numProp: number;
  vertProperties: Float32Array;
  triVerts: Uint32Array;
  /** If set, this part can be dragged in the preview (id passed back on drop). */
  drag?: string;
}

/** Parameters for the interlocking-text tool (Insult3D style, all mm). */
export interface InterlockParams {
  spessore2: number; // central block thickness (base)
  spessore1: number; // top text thickness
  spessore3: number; // bottom text thickness
  profondita: number; // how deep texts 1/3 sink into text 2
  tolleranza: number; // extra offset so parts interlock with a gap
  size1: number;
  size2: number;
  size3: number;
  posX1: number;
  posY1: number;
  posX3: number;
  posY3: number;
  color1: RGB;
  color2: RGB;
  color3: RGB;
}

// glyphs: one entry per glyph, each a group of rings (outer contour + holes).
// Keeping glyphs grouped lets the worker union them so overlapping cursive
// letters fuse instead of cancelling out.
export type BuildRequest =
  | { type: 'build'; tool: 'nametag'; glyphs: Ring[][]; params: TagParams }
  | {
      type: 'build';
      tool: 'interlock';
      g1: Ring[][];
      g2: Ring[][];
      g3: Ring[][];
      params: InterlockParams;
    };

export type BuildResponse =
  | { type: 'ready' }
  | { type: 'parts'; parts: Part[] }
  | { type: 'error'; message: string };
