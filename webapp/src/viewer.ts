// three.js preview with optional drag-to-move for tagged parts.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Part } from './types';

export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private group: THREE.Group | null = null;
  private centerOffset = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private draggable: THREE.Mesh[] = [];

  /** Called when a draggable part is released, with the XY delta in mm. */
  onDrag: ((id: string, dx: number, dy: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x15151a);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(0, -160, 120);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(60, -90, 140);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-70, 70, 50);
    this.scene.add(fill);

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Capture-phase so we can pre-empt OrbitControls when starting a drag.
    canvas.addEventListener('pointerdown', this.onPointerDown, true);
    canvas.addEventListener('pointermove', this.onHover);

    const loop = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }

  private ndc(e: PointerEvent): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  }

  private onHover = (e: PointerEvent) => {
    if (!this.draggable.length || !this.onDrag) return;
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hit = this.raycaster.intersectObjects(this.draggable, false).length > 0;
    this.renderer.domElement.style.cursor = hit ? 'grab' : '';
  };

  private onPointerDown = (e: PointerEvent) => {
    if (!this.draggable.length || !this.onDrag) return;
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hits = this.raycaster.intersectObjects(this.draggable, false);
    if (!hits.length) return;

    // We own this gesture — stop OrbitControls from rotating.
    e.stopPropagation();
    e.preventDefault();
    this.renderer.domElement.style.cursor = 'grabbing';

    const mesh = hits[0].object as THREE.Mesh;
    const dragId = mesh.userData.dragId as string;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, 1),
      hits[0].point,
    );
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

    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      this.group = null;
    }
    this.draggable = [];

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
      });
      const mesh = new THREE.Mesh(geo, mat);
      if (p.drag) {
        mesh.userData.dragId = p.drag;
        this.draggable.push(mesh);
      }
      group.add(mesh);
    }

    if (recenter) {
      const bb = new THREE.Box3().setFromObject(group);
      const center = new THREE.Vector3();
      bb.getCenter(center);
      this.centerOffset.set(-center.x, -center.y, -center.z);
      group.position.copy(this.centerOffset);

      const size = new THREE.Vector3();
      bb.getSize(size);
      const maxd = Math.max(size.x, size.y, size.z) || 50;
      this.camera.position.set(0, -maxd * 1.7, maxd * 1.3);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    } else {
      group.position.copy(this.centerOffset);
    }

    this.scene.add(group);
    this.group = group;
  }
}
