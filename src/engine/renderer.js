import * as THREE from 'three';

/** Scene, camera, lighting and render loop plumbing. */
export class RendererEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a12);
    this.scene.fog = new THREE.Fog(0x0a0a12, 120, 620);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 1200);
    this.camera.position.set(0, 8, 14);

    this._setupLights();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0x6a74b8, 0x14101c, 0.85);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff0e0, 1.25);
    key.position.set(60, 110, 40);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const d = 160;
    key.shadow.camera.left = -d;
    key.shadow.camera.right = d;
    key.shadow.camera.top = d;
    key.shadow.camera.bottom = -d;
    key.shadow.camera.far = 400;
    key.shadow.bias = -0.0006;
    this.scene.add(key);
    this.keyLight = key;

    const rim = new THREE.DirectionalLight(0xff2244, 0.5);
    rim.position.set(-80, 40, -70);
    this.scene.add(rim);

    const fill = new THREE.DirectionalLight(0x3344aa, 0.35);
    fill.position.set(-40, 30, 80);
    this.scene.add(fill);
  }

  setFov(fov) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
