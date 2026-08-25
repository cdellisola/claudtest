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
  /** If set, this part is selectable and moved with a 3-axis gizmo (id passed back). */
  gizmo?: string;
  /** Which axes the gizmo exposes (default 'xyz'). */
  gizmoAxes?: 'xyz' | 'xy';
  /** World position for a gizmo part (its geometry is authored around the origin). */
  gizmoPos?: [number, number, number];
  /** Preview-only marker: shown in the viewer, excluded from the 3MF export. */
  preview?: boolean;
  /** Suggested opacity for preview markers (0..1). */
  opacity?: number;
}

/** One cylindrical magnet pocket (all mm), position relative to the initial. */
export interface Magnet {
  x: number;
  y: number;
  z: number; // centre height above the back (z=0) face
  d: number; // diameter
  h: number; // height
}

/** Parameters for the initial-with-name tool (all mm). */
export interface InitialParams {
  initialThickness: number;
  nameThickness: number;
  pocketDepth: number; // how deep the name sinks into the initial
  clearance: number;
  nameOffsetX: number;
  nameOffsetY: number;
  initialOffsetX: number;
  initialOffsetY: number;
  nameRotate: number; // degrees
  flatBase: boolean; // cut a flat bottom (for curved letters)
  flatBaseCut: number; // mm from the bottom where the flat cut is made
  initialColor: RGB;
  nameColor: RGB;
  magnets: Magnet[];
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
  sfondo: boolean; // add a flat backing plate under the whole phrase
  sfondoSpessore: number; // its thickness, mm
  sfondoMargine: number; // how far it extends past the phrase, mm
  sfondoColor: RGB;
}

/** Parameters for the cookie-cutter tool (all mm). */
export interface CookieParams {
  wall: number; // housing wall thickness
  housingHeight: number;
  patternHeight: number;
  iconThickness: number; // engraved/relief depth of the graphic
  clearance: number; // mating clearance (separated molds)
  unified: boolean; // one piece instead of two
  engraved: boolean; // engrave (true) vs raised relief (false)
  pin: boolean; // add an alignment pin + socket
  pinD: number;
  pinH: number;
  holeD: number;
  holeH: number;
  pinX: number;
  pinY: number;
  housingColor: RGB;
  patternColor: RGB;
}

/** Parameters for the text cookie-cutter tool (word-shaped cutter, all mm). */
export interface TextCutterParams {
  wall: number; // cutting wall thickness
  cutterHeight: number; // height of the cutting wall
  frameMargin: number; // gap between the letters and the outer support frame
  supportHeight: number; // height of the base support (frame + grid)
  supportSpacing: number; // grid spacing of the support bars
  supportGrid: boolean; // add the internal support grid (holds counters/islands)
  color: RGB;
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
    }
  | {
      type: 'build';
      tool: 'initial';
      initialGlyphs: Ring[][];
      nameGlyphs: Ring[][];
      params: InitialParams;
    }
  | {
      type: 'build';
      tool: 'cookie';
      graphic: Ring[][]; // resized graphic silhouette (glyphs), centred, mm
      text: Ring[][]; // optional mirrored text to engrave on the pattern, mm
      params: CookieParams;
    }
  | {
      type: 'build';
      tool: 'textcutter';
      graphic: Ring[][]; // text glyphs at their mm size, centred
      params: TextCutterParams;
    };

export type BuildResponse =
  | { type: 'ready' }
  | { type: 'parts'; parts: Part[] }
  | { type: 'error'; message: string };
