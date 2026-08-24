import type { BuildRequest, Part } from './types';

export interface Tool {
  id: string;
  name: string;
  subtitle: string;
  available: boolean;
  /** Build the controls into `body` and wire them to `onChange`. */
  mount(body: HTMLElement, onChange: () => void): void;
  /** Read the current UI into a worker request (or null if incomplete). */
  buildRequest(): BuildRequest | null;
  /** Suggested download file name (without extension). */
  downloadName(): string;
  /** A draggable preview part was moved by dx/dy mm — update state accordingly. */
  onDrag?(dragId: string, dxMm: number, dyMm: number): void;
  /** Optional hook when new geometry arrives. */
  onParts?(parts: Part[]): void;
  /** Tear down (remove font pickers etc.). */
  destroy?(): void;
}
