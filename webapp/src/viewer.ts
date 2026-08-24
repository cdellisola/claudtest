// three.js preview: orbit, XY drag-to-move (interlock), a 3-axis gizmo for
// selectable parts (magnets), and an optional 10 mm print grid.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { Part } from './types';

export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private tc: TransformControls;
  private group: THREE.Group | null = null;
  private grid: THREE.GridHelper;
  private gridEnabled = false;
  private centerOffset = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private draggable: THREE.Mesh[] = [];
  private gizmoMeshes: THREE.Mesh[] = [];
  private selectedGizmoId: string | null = null;

  /** XY drag (interlock) released, delta in mm. */
  onDrag: ((id: string, dx: number, dy: number) => void) | null = null;
  /** Gizmo moved (live), absolute mm. */
  onGizmoChange: ((id: string, x: number, y: number, z: number) => void) | null = null;
  /** Gizmo drag finished, absolute mm. */
  onGizmoCommit: ((id: string, x: number, y: number, z: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x15151a);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 40000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(0, -220, 160);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(60, -90, 160);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-70, 70, 60);
    this.scene.add(fill);

    // 10 mm grid on the XY plane (z = 0), hidden until a tool asks for it.
    this.grid = new THREE.GridHelper(600, 60, 0x556070, 0x2c333d);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.visible = false;
    this.scene.add(this.grid);

    // 3-axis translate gizmo for selectable parts.
    this.tc = new TransformControls(this.camera, this.renderer.domElement);
    this.tc.setMode('translate');
    this.tc.setSpace('world');
    this.tc.addEventListener('dragging-changed', (e: any) => {
      this.controls.enabled = !e.value;
      if (!e.value) this.commitGizmo();
    });
    this.tc.addEventListener('objectChange', () => this.liveGizmo());
    const helper = (this.tc as any).getHelper ? (this.tc as any).getHelper() : (this.tc as any);
    this.scene.add(helper);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', this.onPointerDown, true);
    canvas.addEventListener('pointermove', this.onHover);

    const loop = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }

  setGrid(enabled: boolean) {
    this.gridEnabled = enabled;
    this.grid.visible = enabled;
  }

  private selectedMesh(): THREE.Mesh | null {
    return (this.tc.object as THREE.Mesh) ?? null;
  }
  private liveGizmo() {
    const m = this.selectedMesh();
    if (m && m.userData.gizmoId && this.onGizmoChange) {
      this.onGizmoChange(m.userData.gizmoId, m.position.x, m.position.y, m.position.z);
    }
  }
  private commitGizmo() {
    const m = this.selectedMesh();
    if (m && m.userData.gizmoId && this.onGizmoCommit) {
      this.onGizmoCommit(m.userData.gizmoId, m.position.x, m.position.y, m.position.z);
    }
  }

  private ndc(e: PointerEvent): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  }

  private onHover = (e: PointerEvent) => {
    if (!this.draggable.length && !this.gizmoMeshes.length) return;
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hit =
      this.raycaster.intersectObjects(this.gizmoMeshes, false).length > 0 ||
      (this.onDrag && this.raycaster.intersectObjects(this.draggable, false).length > 0);
    this.renderer.domElement.style.cursor = hit ? 'grab' : '';
  };

  private onPointerDown = (e: PointerEvent) => {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);

    // Selectable (magnet) parts → attach the gizmo.
    if (this.gizmoMeshes.length) {
      const g = this.raycaster.intersectObjects(this.gizmoMeshes, false);
      if (g.length) {
        e.stopPropagation();
        const mesh = g[0].object as THREE.Mesh;
        this.selectedGizmoId = mesh.userData.gizmoId;
        this.tc.attach(mesh);
        return;
      }
    }

    // Draggable (interlock) parts → XY drag.
    if (this.draggable.length && this.onDrag) {
      const hits = this.raycaster.intersectObjects(this.draggable, false);
      if (hits.length) {
        e.stopPropagation();
        e.preventDefault();
        this.renderer.domElement.style.cursor = 'grabbing';
        const mesh = hits[0].object as THREE.Mesh;
        const dragId = mesh.userData.dragId as string;
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), hits[0].point);
        const start = hits[0].point.clone();
        const startPos = mesh.position.clone();
        let last = { dx: 0, dy: 0 };
        const move = (ev: PointerEvent) => {
          this.raycaster.setFromCamera(this.ndc(ev), this.camera);
          const pt = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(plane, pt)) {
            last = { dx: pt.x - start.x, dy: pt.y - start.y };
            mesh.position.set(startPos.x + last.dx, startPos.y + last.dy, startPos.z);
          }
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          this.renderer.domElement.style.cursor = 'grab';
          if (last.dx !== 0 || last.dy !== 0) this.onDrag?.(dragId, last.dx, last.dy);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return;
      }
    }

    // Clicking a gizmo handle: let TransformControls handle it, keep selection.
    if ((this.tc as any).axis) return;

    // Empty space → deselect the gizmo.
    if (this.selectedGizmoId) {
      this.selectedGizmoId = null;
      this.tc.detach();
    }
  };

  private resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || 1;
    const h = c.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  show(parts: Part[], opts: { recenter?: boolean } = {}) {
    const recenter = opts.recenter ?? true;

    if (this.tc.object) this.tc.detach();
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      this.group = null;
    }
    this.draggable = [];
    this.gizmoMeshes = [];

    const group = new THREE.Group();
    for (const p of parts) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(p.vertProperties, 3));
      geo.setIndex(new THREE.BufferAttribute(p.triVerts, 1));
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(p.colorRgb[0] / 255, p.colorRgb[1] / 255, p.colorRgb[2] / 255),
        roughness: 0.65,
        metalness: 0.0,
        transparent: p.preview === true,
        opacity: p.preview ? p.opacity ?? 0.6 : 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.preview = p.preview === true;
      if (p.gizmoPos) mesh.position.set(p.gizmoPos[0], p.gizmoPos[1], p.gizmoPos[2]);
      if (p.drag) {
        mesh.userData.dragId = p.drag;
        this.draggable.push(mesh);
      }
      if (p.gizmo) {
        mesh.userData.gizmoId = p.gizmo;
        this.gizmoMeshes.push(mesh);
      }
      group.add(mesh);
    }

    // Position: snap to the 10 mm grid when it's on, else centre. Base the bbox
    // on the real geometry (markers excluded, positions are 0 for real parts).
    const bb = new THREE.Box3();
    let hasReal = false;
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      if (mesh.userData.preview) continue;
      mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) {
        bb.union(mesh.geometry.boundingBox);
        hasReal = true;
      }
    }
    if (!hasReal) {
      for (const child of group.children) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.computeBoundingBox();
        if (mesh.geometry.boundingBox) bb.union(mesh.geometry.boundingBox);
      }
    }
    if (recenter) {
      if (this.gridEnabled) {
        const size = new THREE.Vector3();
        bb.getSize(size);
        const snap = (min: number, span: number) => -min - Math.round(span / 2 / 10) * 10;
        this.centerOffset.set(snap(bb.min.x, size.x), snap(bb.min.y, size.y), -bb.min.z);
      } else {
        const c = new THREE.Vector3();
        bb.getCenter(c);
        this.centerOffset.set(-c.x, -c.y, -c.z);
      }
      group.position.copy(this.centerOffset);

      const size = new THREE.Vector3();
      bb.getSize(size);
      const maxd = Math.max(size.x, size.y, size.z) || 60;
      this.camera.position.set(0, -maxd * 1.7, maxd * 1.3);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    } else {
      group.position.copy(this.centerOffset);
    }

    this.scene.add(group);
    this.group = group;

    // Re-attach the gizmo to the same magnet after a rebuild.
    if (this.selectedGizmoId) {
      const again = this.gizmoMeshes.find((m) => m.userData.gizmoId === this.selectedGizmoId);
      if (again) this.tc.attach(again);
      else this.selectedGizmoId = null;
    }
  }
}
