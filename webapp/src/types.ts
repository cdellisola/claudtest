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
}

export type BuildRequest = { type: 'build'; rings: Ring[]; params: TagParams };

export type BuildResponse =
  | { type: 'ready' }
  | { type: 'parts'; parts: Part[] }
  | { type: 'error'; message: string };
