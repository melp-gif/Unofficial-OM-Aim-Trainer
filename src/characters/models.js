import * as THREE from 'three';

/**
 * Procedural 3D character builders.
 *
 * NOTE ON ASSETS: The original Outcome Memories / Roblox models and animations
 * are not redistributable, so every model here is an ORIGINAL stylized
 * replacement built from primitives at runtime — matching each character's
 * silhouette, colours and signature weapon so the trainer reads correctly in
 * 3D. Swap-in points for licensed models are documented in README.md.
 */

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.15,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1
  });
}

function sphere(r, m, x = 0, y = 0, z = 0, seg = 18) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function cone(r, h, m, x = 0, y = 0, z = 0, seg = 12) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function cylinder(rTop, rBot, h, m, x = 0, y = 0, z = 0, seg = 14) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function makeGroupSkeleton(group) {
  const parts = {
    root: group,
    torso: group.getObjectByName('torso'),
    head: group.getObjectByName('head'),
    armL: group.getObjectByName('armL'),
    armR: group.getObjectByName('armR'),
    legL: group.getObjectByName('legL'),
    legR: group.getObjectByName('legR'),
    weapon: group.getObjectByName('weapon'),
    muzzle: group.getObjectByName('muzzle'),
    aura: group.getObjectByName('aura')
  };
  group.userData.parts = parts;
  return parts;
}

function humanoid({ skin, quill, belly, shoe, glove, height = 1 }) {
  const g = new THREE.Group();
  const skinM = mat(skin);
  const bellyM = mat(belly, { roughness: 0.7 });
  const gloveM = mat(glove, { roughness: 0.5 });
  const shoeM = mat(shoe, { roughness: 0.45 });

  const torso = sphere(0.62, skinM, 0, 1.15, 0);
  torso.name = 'torso';
  torso.scale.set(1, 1.15, 0.85);
  g.add(torso);
  g.add(sphere(0.42, bellyM, 0, 1.05, 0.32));

  const head = sphere(0.72, skinM, 0, 2.15, 0.05);
  head.name = 'head';
  g.add(head);

  // eyes
  const eyeWhite = mat(0xffffff, { roughness: 0.3 });
  const pupil = mat(0x141018, { roughness: 0.35 });
  const e1 = sphere(0.17, eyeWhite, -0.24, 2.28, 0.62); e1.scale.set(0.8, 1.15, 0.55);
  const e2 = sphere(0.17, eyeWhite, 0.24, 2.28, 0.62); e2.scale.set(0.8, 1.15, 0.55);
  const p1 = sphere(0.09, pupil, -0.22, 2.27, 0.72);
  const p2 = sphere(0.09, pupil, 0.22, 2.27, 0.72);
  g.add(e1, e2, p1, p2);

  // muzzle + nose
  const muzzle = sphere(0.3, mat(belly, { roughness: 0.6 }), 0, 2.02, 0.58);
  muzzle.scale.set(1.15, 0.8, 0.8);
  g.add(muzzle);
  g.add(sphere(0.11, mat(0x1a1018, { roughness: 0.35 }), 0, 2.08, 0.84));

  // quills (cone fan on back of head)
  const quillM = mat(quill);
  for (let i = 0; i < 3; i++) {
    const q = cone(0.26 - i * 0.03, 1.15 + i * 0.12, quillM, 0, 2.2 - i * 0.18, -0.55 - i * 0.12);
    q.rotation.x = -0.9 - i * 0.12;
    g.add(q);
    if (i < 2) {
      const ql = cone(0.2, 0.95, quillM, -0.38 - i * 0.1, 2.14 - i * 0.16, -0.5 - i * 0.1);
      ql.rotation.x = -0.85; ql.rotation.z = 0.5;
      const qr = cone(0.2, 0.95, quillM, 0.38 + i * 0.1, 2.14 - i * 0.16, -0.5 - i * 0.1);
      qr.rotation.x = -0.85; qr.rotation.z = -0.5;
      g.add(ql, qr);
    }
  }

  // ears
  const earL = cone(0.16, 0.42, skinM, -0.42, 2.82, 0);
  const earR = cone(0.16, 0.42, skinM, 0.42, 2.82, 0);
  g.add(earL, earR);

  // arms
  const armL = new THREE.Group();
  armL.name = 'armL';
  armL.position.set(-0.72, 1.55, 0);
  armL.add(cylinder(0.13, 0.11, 0.85, skinM, 0, -0.35, 0));
  armL.add(sphere(0.19, gloveM, 0, -0.85, 0));
  g.add(armL);

  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(0.72, 1.55, 0);
  armR.add(cylinder(0.13, 0.11, 0.85, skinM, 0, -0.35, 0));
  armR.add(sphere(0.19, gloveM, 0, -0.85, 0));
  g.add(armR);

  // legs
  const legL = new THREE.Group();
  legL.name = 'legL';
  legL.position.set(-0.3, 0.72, 0);
  legL.add(cylinder(0.14, 0.12, 0.62, skinM, 0, -0.28, 0));
  const shoeL = sphere(0.24, shoeM, 0, -0.62, 0.1);
  shoeL.scale.set(1, 0.75, 1.5);
  legL.add(shoeL);
  g.add(legL);

  const legR = new THREE.Group();
  legR.name = 'legR';
  legR.position.set(0.3, 0.72, 0);
  legR.add(cylinder(0.14, 0.12, 0.62, skinM, 0, -0.28, 0));
  const shoeR = sphere(0.24, shoeM, 0, -0.62, 0.1);
  shoeR.scale.set(1, 0.75, 1.5);
  legR.add(shoeR);
  g.add(legR);

  if (height !== 1) g.scale.setScalar(height);
  return g;
}

/* ============================ SURVIVORS ============================ */

export function buildAmy() {
  const g = humanoid({
    skin: 0xff6fae,      // pink
    quill: 0xff5fa8,
    belly: 0xffd9e8,
    shoe: 0xd93a4a,
    glove: 0xffffff
  });

  // red dress
  const dress = cone(0.85, 1.1, mat(0xd93a4a, { roughness: 0.6 }), 0, 1.05, 0, 20);
  dress.rotation.x = Math.PI;
  g.add(dress);
  // hair ties / headband
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 10, 24), mat(0xffffff, { roughness: 0.5 }));
  band.position.set(0, 2.55, 0.1);
  band.rotation.x = Math.PI / 2 - 0.35;
  g.add(band);

  // Piko Piko Hammer (attached to right hand; hidden when thrown)
  const weapon = new THREE.Group();
  weapon.name = 'weapon';
  const handle = cylinder(0.09, 0.09, 1.5, mat(0x8a4a2a, { roughness: 0.6 }), 0, 0, 0);
  handle.rotation.x = Math.PI / 2;
  weapon.add(handle);
  const headM = mat(0xd93a4a, { roughness: 0.4, metalness: 0.25 });
  const h1 = cylinder(0.52, 0.52, 0.9, headM, 0, 0, 0.95);
  h1.rotation.x = Math.PI / 2;
  weapon.add(h1);
  weapon.add(sphere(0.52, mat(0xffd23e, { roughness: 0.35, metalness: 0.3 }), 0, 0, 1.42));
  weapon.position.set(0.95, 1.05, 0.35);
  weapon.rotation.set(0.35, 0, -0.5);
  g.add(weapon);

  makeGroupSkeleton(g);
  return g;
}

export function buildTails() {
  const g = humanoid({
    skin: 0xffc233,      // yellow
    quill: 0xffb31a,
    belly: 0xfff4dc,
    shoe: 0xd93a3a,
    glove: 0xffffff
  });

  // twin tails
  const tailM = mat(0xffc233, { roughness: 0.65 });
  const tipM = mat(0xfff4dc, { roughness: 0.7 });
  for (const side of [-1, 1]) {
    const tail = new THREE.Group();
    const t1 = sphere(0.3, tailM, 0, 0, 0);
    t1.scale.set(0.75, 0.55, 1.9);
    tail.add(t1);
    const t2 = sphere(0.26, tipM, 0, 0, -1.05);
    t2.scale.set(0.7, 0.5, 1.5);
    tail.add(t2);
    tail.position.set(side * 0.35, 1.05, -0.75);
    tail.rotation.y = side * 0.55;
    tail.rotation.x = -0.35;
    g.add(tail);
  }

  // Arm cannon on right hand (signature!)
  const weapon = new THREE.Group();
  weapon.name = 'weapon';
  const barrel = cylinder(0.17, 0.2, 1.15, mat(0xc22b2b, { roughness: 0.35, metalness: 0.5 }), 0, 0, 0.45);
  barrel.rotation.x = Math.PI / 2;
  weapon.add(barrel);
  weapon.add(sphere(0.22, mat(0x333344, { roughness: 0.4, metalness: 0.6 }), 0, 0, -0.15));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 18), mat(0xff2233, { emissive: 0xff2233, emissiveIntensity: 1.4 }));
  ring.position.set(0, 0, 1.0);
  weapon.add(ring);
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, 0, 1.15);
  weapon.add(muzzle);
  weapon.position.set(0.95, 1.15, 0.45);
  g.add(weapon);

  makeGroupSkeleton(g);
  return g;
}

export function buildSilver() {
  const g = humanoid({
    skin: 0xe8e8f2,      // white-silver
    quill: 0xd8d8ea,
    belly: 0xf8f8ff,
    shoe: 0x2b7fd9,
    glove: 0x2b7fd9
  });

  // floating psychic glow
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.1 })
  );
  aura.name = 'aura';
  aura.position.y = 1.5;
  g.add(aura);

  // forehead quill sweep
  const sweep = cone(0.18, 1.1, mat(0xd8d8ea), 0, 2.85, 0.35);
  sweep.rotation.x = 1.15;
  g.add(sweep);

  // floating rock in hand (signature)
  const weapon = new THREE.Group();
  weapon.name = 'weapon';
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(0x6a6a7a, { roughness: 0.95 }));
  rock.castShadow = true;
  weapon.add(rock);
  const rockGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.18 })
  );
  weapon.add(rockGlow);
  weapon.position.set(1.05, 1.75, 0.35);
  g.add(weapon);

  makeGroupSkeleton(g);
  return g;
}

export function buildBlaze() {
  const g = humanoid({
    skin: 0xa25bd6,      // purple
    quill: 0x8a3fc0,
    belly: 0xf2c6e8,
    shoe: 0xd9a13a,
    glove: 0xffffff
  });

  // cape
  const cape = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 1.7, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x7a2fc0, roughness: 0.7, side: THREE.DoubleSide })
  );
  cape.position.set(0, 1.35, -0.5);
  cape.rotation.x = 0.22;
  g.add(cape);

  // Sol Javelin
  const weapon = new THREE.Group();
  weapon.name = 'weapon';
  const shaft = cylinder(0.07, 0.07, 2.4, mat(0x4a2a6a, { roughness: 0.5, metalness: 0.3 }), 0, 0, 0);
  shaft.rotation.x = Math.PI / 2;
  weapon.add(shaft);
  const tip = cone(0.22, 0.75, mat(0xffb347, { emissive: 0xff8822, emissiveIntensity: 1.1, metalness: 0.4 }), 0, 0, 1.45);
  tip.rotation.x = Math.PI / 2;
  weapon.add(tip);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xff9944, transparent: true, opacity: 0.55 })
  );
  flame.position.set(0, 0, 1.7);
  weapon.add(flame);
  weapon.position.set(1.0, 1.25, 0.2);
  weapon.rotation.set(0.2, 0, -0.35);
  g.add(weapon);

  makeGroupSkeleton(g);
  return g;
}

const SURVIVOR_BUILDERS = { amy: buildAmy, tails: buildTails, silver: buildSilver, blaze: buildBlaze };
export function buildSurvivor(id) {
  return (SURVIVOR_BUILDERS[id] || buildAmy)();
}

/* ============================ EXEs ============================ */

/**
 * Original EXE-style dummy models: dark quilled "hog" silhouettes with glowing
 * red accents. Distinct per archetype (fast stalker / heavy / doll / machine).
 */
export function buildExe(typeId = '2011x') {
  const defs = {
    '2011x': { skin: 0x191622, quill: 0x120f1a, eye: 0xff2233, shoe: 0x3a0a12, build: 'lean' },
    kolossus: { skin: 0x2b1420, quill: 0x22101c, eye: 0xff6622, shoe: 0x4a2010, build: 'heavy' },
    tripwire: { skin: 0x271828, quill: 0x1e1220, eye: 0xff44aa, shoe: 0x3a1a3a, build: 'doll' },
    v1: { skin: 0x16222c, quill: 0x101a22, eye: 0x33ffcc, shoe: 0x1a3a44, build: 'machine' }
  };
  const def = defs[typeId] || defs['2011x'];

  const g = humanoid({
    skin: def.skin,
    quill: def.quill,
    belly: def.skin,
    shoe: def.shoe,
    glove: 0x0c0a12,
    height: def.build === 'heavy' ? 1.35 : def.build === 'doll' ? 0.92 : 1.12
  });

  // glow eyes override
  const eyeGlow = new THREE.MeshBasicMaterial({ color: def.eye });
  g.traverse((o) => {
    if (o.isMesh && o.material && o.material.color) {
      const c = o.material.color.getHex();
      if (c === 0x141018) { o.material = eyeGlow; }
    }
  });

  // chest emblem glow
  const emblem = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 20),
    new THREE.MeshBasicMaterial({ color: def.eye, transparent: true, opacity: 0.85 })
  );
  emblem.position.set(0, 1.35, 0.62);
  g.add(emblem);

  if (def.build === 'machine') {
    const visor = box(0.95, 0.16, 0.1, new THREE.MeshBasicMaterial({ color: def.eye }), 0, 2.3, 0.72);
    g.add(visor);
  }
  if (def.build === 'heavy') {
    const pauldronL = sphere(0.55, mat(def.shoe, { metalness: 0.5, roughness: 0.4 }), -0.95, 1.75, 0);
    const pauldronR = sphere(0.55, mat(def.shoe, { metalness: 0.5, roughness: 0.4 }), 0.95, 1.75, 0);
    g.add(pauldronL, pauldronR);
  }
  if (def.build === 'doll') {
    const stitch = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: def.eye, transparent: true, opacity: 0.6 })
    );
    stitch.position.y = 2.15;
    stitch.rotation.x = Math.PI / 2 - 0.25;
    g.add(stitch);
  }

  // red rim aura
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 16, 12),
    new THREE.MeshBasicMaterial({ color: def.eye, transparent: true, opacity: 0.07 })
  );
  aura.name = 'aura';
  aura.position.y = 1.7;
  g.add(aura);

  makeGroupSkeleton(g);
  return g;
}
