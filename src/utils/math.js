/** Shared math helpers. Distances are in studs. */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const deg2rad = (d) => (d * Math.PI) / 180;
export const rad2deg = (r) => (r * 180) / Math.PI;

/** Horizontal (XZ-plane) distance in studs — the game's official distance metric. */
export function horizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Full 3D distance. */
export function distance3(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Closest point on segment AB to point P (for swept projectile checks). */
export function closestPointOnSegment(p, a, b, out) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const lenSq = abx * abx + aby * aby + abz * abz;
  let t = 0;
  if (lenSq > 1e-8) {
    t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / lenSq;
    t = clamp(t, 0, 1);
  }
  out.x = a.x + abx * t;
  out.y = a.y + aby * t;
  out.z = a.z + abz * t;
  out.t = t;
  return out;
}

/** Sphere (center c, radius r) vs segment (a→b). Returns hit info or null. */
export function segmentSphereHit(a, b, c, r) {
  const closest = closestPointOnSegment(c, a, b, { x: 0, y: 0, z: 0, t: 0 });
  const dx = c.x - closest.x, dy = c.y - closest.y, dz = c.z - closest.z;
  const distSq = dx * dx + dy * dy + dz * dz;
  if (distSq <= r * r) {
    return { point: closest, t: closest.t, distance: Math.sqrt(distSq) };
  }
  return null;
}

export function formatSeconds(s) { return `${s.toFixed(2)}s`; }
export function formatStuds(s) { return `${s.toFixed(1)} studs`; }
