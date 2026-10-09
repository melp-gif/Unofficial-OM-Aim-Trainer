import * as THREE from 'three';

/**
 * The training arena: an OM-flavoured night plaza with stud-marked range
 * rings so every shot's impact distance is visually verifiable.
 * 1 world unit = 1 stud. Range rings are painted at verified stud distances.
 */
export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.obstacles = []; // AABBs for simple collision
    this._build();
  }

  _makeTextSprite(text, { size = 64, color = '#ff4455', font = '700 40px system-ui', scale = 1 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 256, 128);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 8;
    ctx.strokeText(text, 128, 64);
    ctx.fillText(text, 128, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(16 * scale, 8 * scale, 1);
    return sprite;
  }

  _build() {
    // ----- ground -----
    const groundTex = this._proceduralGroundTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 560, 64, 64),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.92, metalness: 0.06 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // ----- grid overlay (subtle) -----
    const grid = new THREE.GridHelper(560, 56, 0x2a2438, 0x1a1626);
    grid.position.y = 0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    this.group.add(grid);

    // ----- range rings with stud labels -----
    const ringDistances = [20, 40, 60, 80, 100, 120, 150, 200, 250];
    const ringColor = new THREE.Color(0xff3344);
    for (const dist of ringDistances) {
      const pts = [];
      const segs = 96;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * dist, 0.06, Math.sin(a) * dist));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: ringColor,
          transparent: true,
          opacity: dist % 50 === 0 ? 0.5 : 0.22
        })
      );
      this.group.add(line);

      // label every ring at the +Z edge
      const label = this._makeTextSprite(`${dist} studs`, {
        color: dist % 50 === 0 ? '#ff5566' : '#aa6670',
        scale: dist % 50 === 0 ? 1.15 : 0.85
      });
      label.position.set(0, 7, dist);
      this.group.add(label);
    }

    // ----- centre pad -----
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 14, 0.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x241c30, roughness: 0.6, metalness: 0.35 })
    );
    pad.position.y = 0.2;
    pad.receiveShadow = true;
    this.group.add(pad);
    const padRing = new THREE.Mesh(
      new THREE.TorusGeometry(14, 0.35, 12, 64),
      new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff2233, emissiveIntensity: 0.7 })
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.y = 0.45;
    this.group.add(padRing);

    // ----- perimeter walls (collision + look) -----
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x191424, roughness: 0.85, metalness: 0.2 });
    const wallH = 18;
    const wallDefs = [
      { x: 0, z: -280, w: 560, d: 4 },
      { x: 0, z: 280, w: 560, d: 4 },
      { x: -280, z: 0, w: 4, d: 560 },
      { x: 280, z: 0, w: 4, d: 560 }
    ];
    for (const w of wallDefs) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, wallH, w.d), wallMat);
      wall.position.set(w.x, wallH / 2, w.z);
      wall.receiveShadow = true;
      wall.castShadow = true;
      this.group.add(wall);
    }

    // ----- pillars / low cover (visual interest + collision) -----
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2b2138, roughness: 0.7, metalness: 0.3 });
    const pillarPositions = [
      [40, -40], [-40, -40], [40, 40], [-40, 40],
      [90, 0], [-90, 0], [0, 90], [0, -90],
      [140, 100], [-140, 100], [140, -100], [-140, -100]
    ];
    for (const [x, z] of pillarPositions) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 22, 12), pillarMat);
      pillar.position.set(x, 11, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.group.add(pillar);
      const glow = new THREE.Mesh(
        new THREE.TorusGeometry(3.4, 0.22, 8, 32),
        new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xff1133, emissiveIntensity: 1.2 })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x, 22.2, z);
      this.group.add(glow);
      this.obstacles.push({ type: 'cylinder', x, z, r: 4.2, height: 22 });
    }

    // ----- low blocks (used as cover in attack drills) -----
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x241a30, roughness: 0.8 });
    const blockDefs = [
      { x: 25, z: -70, w: 16, h: 5, d: 8 },
      { x: -25, z: -70, w: 16, h: 5, d: 8 },
      { x: 70, z: 25, w: 8, h: 5, d: 16 },
      { x: -70, z: 25, w: 8, h: 5, d: 16 }
    ];
    for (const b of blockDefs) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), blockMat);
      block.position.set(b.x, b.h / 2, b.z);
      block.castShadow = true;
      block.receiveShadow = true;
      this.group.add(block);
      this.obstacles.push({
        type: 'box',
        minX: b.x - b.w / 2, maxX: b.x + b.w / 2,
        minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2,
        height: b.h
      });
    }

    // ----- ominous sky shards -----
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0x2a1030, emissive: 0x401028, emissiveIntensity: 0.55, roughness: 0.5
    });
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const r = 230 + (i % 3) * 18;
      const h = 40 + (i % 4) * 22;
      const shard = new THREE.Mesh(new THREE.ConeGeometry(9, h, 5), shardMat);
      shard.position.set(Math.cos(ang) * r, h / 2, Math.sin(ang) * r);
      shard.rotation.y = ang;
      this.group.add(shard);
    }
  }

  _proceduralGroundTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#171222';
    ctx.fillRect(0, 0, 256, 256);
    // subtle checker + noise
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.022)';
          ctx.fillRect(x * 32, y * 32, 32, 32);
        }
      }
    }
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * 0.05;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 14);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Simple collision resolution for a capsule-like mover. */
  collide(pos, radius) {
    for (const ob of this.obstacles) {
      if (ob.type === 'cylinder') {
        const dx = pos.x - ob.x;
        const dz = pos.z - ob.z;
        const d = Math.hypot(dx, dz);
        const min = ob.r + radius;
        if (d < min && d > 0.0001) {
          pos.x = ob.x + (dx / d) * min;
          pos.z = ob.z + (dz / d) * min;
        }
      } else if (ob.type === 'box') {
        if (pos.y > ob.height) continue;
        const cx = Math.max(ob.minX, Math.min(pos.x, ob.maxX));
        const cz = Math.max(ob.minZ, Math.min(pos.z, ob.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < radius) {
          if (d > 0.0001) {
            pos.x = cx + (dx / d) * radius;
            pos.z = cz + (dz / d) * radius;
          } else {
            pos.x += radius;
          }
        }
      }
    }
    // world bounds
    pos.x = Math.max(-272, Math.min(272, pos.x));
    pos.z = Math.max(-272, Math.min(272, pos.z));
  }
}
