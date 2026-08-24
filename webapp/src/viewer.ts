// three.js preview: orbit, XY drag-to-move (interlock), a 3-axis gizmo for
// selectable parts (magnets / initial / name), a 10 mm print grid, and soft
// shadows for a more solid look.
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
  private downPos = { x: 0, y: 0 };
  private pendingSelect: string | null = null;

  onDrag: ((id: string, dx: number, dy: number) => void) | null = null;
  onGizmoChange: ((id: string, x: number, y: number, z: number) => void) | null = null;
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

    // Even, shadow-free lighting → smooth, clean surfaces (no self-shadow acne).
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(80, -120, 220);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-90, 90, 70);
    this.scene.add(fill);

    this.grid = new THREE.GridHelper(600, 60, 0x556070, 0x2c333d);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.visible = false;
    this.scene.add(this.grid);

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

  selectGizmo(id: string) {
    this.selectedGizmoId = id;
    const m = this.gizmoMeshes.find((x) => x.userData.gizmoId === id);
    if (m) this.attachTo(m);
  }

  private attachTo(mesh: THREE.Mesh) {
    const axes: string = mesh.userData.gizmoAxes ?? 'xyz';
    this.tc.showX = true;
    this.tc.showY = true;
    this.tc.showZ = axes.includes('z');
    this.tc.attach(mesh);
  }

  private reportGizmo(cb: ((id: string, x: number, y: number, z: number) => void) | null) {
    const m = this.tc.object as THREE.Mesh | undefined;
    if (!m || !m.userData.gizmoId || !cb) return;
    if (m.userData.gizmoMode === 'delta') {
      const base = m.userData.gizmoBase as THREE.Vector3;
      cb(m.userData.gizmoId, m.position.x - base.x, m.position.y - base.y, m.position.z - base.z);
    } else {
      cb(m.userData.gizmoId, m.position.x, m.position.y, m.position.z);
    }
  }
  private liveGizmo() {
    this.reportGizmo(this.onGizmoChange);
  }
  private commitGizmo() {
    this.reportGizmo(this.onGizmoCommit);
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
      (this.onDrag ? this.raycaster.intersectObjects(this.draggable, false).length > 0 : false);
    this.renderer.domElement.style.cursor = hit ? 'grab' : '';
  };

  private onPointerDown = (e: PointerEvent) => {
    // Grabbing a gizmo handle: let TransformControls own it.
    if ((this.tc as any).axis) return;

    this.raycaster.setFromCamera(this.ndc(e), this.camera);

    // Interlock XY drag: immediate drag-to-move.
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

    // Gizmo parts: select on a click (not a drag), so orbit still works on the body.
    this.downPos = { x: e.clientX, y: e.clientY };
    const g = this.gizmoMeshes.length ? this.raycaster.intersectObjects(this.gizmoMeshes, false) : [];
    this.pendingSelect = g.length ? (g[0].object as THREE.Mesh).userData.gizmoId : null;
    window.addEventListener('pointerup', this.onUpSelect, { once: true });
  };

  private onUpSelect = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
    if (moved > 5) return; // it was an orbit/drag, not a click
    if (this.pendingSelect) {
      this.selectGizmo(this.pendingSelect);
    } else if (this.selectedGizmoId && !(this.tc as any).axis) {
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
      const isPreview = p.preview === true;
      const deltaGizmo = !!p.gizmo && !p.gizmoPos;
      // Delta-gizmo parts get a cloned buffer so recentering never mutates the
      // arrays used for the 3MF export.
      const posArr = deltaGizmo ? (p.vertProperties.slice() as Float32Array) : p.vertProperties;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      geo.setIndex(new THREE.BufferAttribute(p.triVerts, 1));
      geo.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(p.colorRgb[0] / 255, p.colorRgb[1] / 255, p.colorRgb[2] / 255),
        roughness: 0.6,
        metalness: 0.0,
        transparent: isPreview,
        opacity: isPreview ? p.opacity ?? 0.7 : 1,
        depthTest: !isPreview,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.preview = isPreview;
      if (isPreview) mesh.renderOrder = 10;

      if (p.gizmo) {
        mesh.userData.gizmoId = p.gizmo;
        mesh.userData.gizmoAxes = p.gizmoAxes ?? (p.gizmoPos ? 'xyz' : 'xy');
        if (p.gizmoPos) {
          mesh.userData.gizmoMode = 'abs';
          mesh.position.set(p.gizmoPos[0], p.gizmoPos[1], p.gizmoPos[2]);
        } else {
          geo.computeBoundingBox();
          const c = new THREE.Vector3();
          geo.boundingBox!.getCenter(c);
          geo.translate(-c.x, -c.y, -c.z); // mutates the cloned array only
          mesh.position.copy(c);
          mesh.userData.gizmoMode = 'delta';
          mesh.userData.gizmoBase = c.clone();
        }
        this.gizmoMeshes.push(mesh);
      }
      if (p.drag) {
        mesh.userData.dragId = p.drag;
        this.draggable.push(mesh);
      }
      group.add(mesh);
    }

    // World bbox of the real geometry (accounting for any per-mesh position).
    const bb = new THREE.Box3();
    let hasReal = false;
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      if (mesh.userData.preview) continue;
      mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) {
        const gb = mesh.geometry.boundingBox.clone();
        gb.translate(mesh.position);
        bb.union(gb);
        hasReal = true;
      }
    }
    if (!hasReal) {
      for (const child of group.children) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.computeBoundingBox();
        if (mesh.geometry.boundingBox) {
          const gb = mesh.geometry.boundingBox.clone();
          gb.translate(mesh.position);
          bb.union(gb);
        }
      }
    }

    const size = new THREE.Vector3();
    bb.getSize(size);
    const maxd = Math.max(size.x, size.y, size.z) || 60;
    if (recenter) {
      const target = new THREE.Vector3(0, 0, 0);
      if (this.gridEnabled) {
        this.centerOffset.set(-bb.min.x, -bb.min.y, -bb.min.z);
        target.set(size.x / 2, size.y / 2, size.z / 2);
      } else {
        const c = new THREE.Vector3();
        bb.getCenter(c);
        this.centerOffset.set(-c.x, -c.y, -c.z);
      }
      group.position.copy(this.centerOffset);
      this.camera.position.set(target.x, target.y - maxd * 1.7, target.z + maxd * 1.3);
      this.controls.target.copy(target);
      this.controls.update();
    } else {
      group.position.copy(this.centerOffset);
    }

    this.scene.add(group);
    this.group = group;

    if (this.selectedGizmoId) {
      const again = this.gizmoMeshes.find((m) => m.userData.gizmoId === this.selectedGizmoId);
      if (again) this.attachTo(again);
      else this.selectedGizmoId = null;
    }
  }
}
