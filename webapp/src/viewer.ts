// Minimal three.js preview: renders the coloured parts returned by the worker.
// Display only — never used for export.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Part } from './types';

export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private group: THREE.Group | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x15151a);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 8000);
    this.camera.up.set(0, 0, 1); // model is Z-up (extruded along Z)
    this.camera.position.set(0, -140, 110);

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

    const loop = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }

  private resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || 1;
    const h = c.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  show(parts: Part[]) {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      this.group = null;
    }

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
      group.add(new THREE.Mesh(geo, mat));
    }

    const bb = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    bb.getCenter(center);
    group.position.set(-center.x, -center.y, -center.z);

    this.scene.add(group);
    this.group = group;

    const size = new THREE.Vector3();
    bb.getSize(size);
    const maxd = Math.max(size.x, size.y, size.z) || 50;
    this.camera.position.set(0, -maxd * 1.7, maxd * 1.3);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}
