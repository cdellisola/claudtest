import type { BuildRequest, Part } from './types';

/** Portal-provided helpers a tool can call. */
export interface ToolApi {
  /** Select a gizmo part (e.g. a magnet) in the preview to show its axes. */
  selectGizmo(id: string): void;
}

export interface Tool {
  id: string;
  name: string;
  subtitle: string;
  available: boolean;
  /** Build the controls into `body` and wire them to `onChange`. */
  mount(body: HTMLElement, onChange: () => void, api: ToolApi): void;
  /** Read the current UI into a worker request (or null if incomplete). */
  buildRequest(): BuildRequest | null;
  /** Suggested download file name (without extension). */
  downloadName(): string;
  /** A draggable preview part was moved by dx/dy mm — update state accordingly. */
  onDrag?(dragId: string, dxMm: number, dyMm: number): void;
  /** Show the 10 mm print grid for this tool. */
  usesGrid?: boolean;
  /** A gizmo part is being dragged (live absolute mm) — update inputs, no rebuild. */
  onGizmoLive?(id: string, x: number, y: number, z: number): void;
  /** A gizmo drag finished (absolute mm) — commit state; the portal rebuilds. */
  onGizmoMove?(id: string, x: number, y: number, z: number): void;
  /** Optional hook when new geometry arrives. */
  onParts?(parts: Part[]): void;
  /** Tear down (remove font pickers etc.). */
  destroy?(): void;
}
