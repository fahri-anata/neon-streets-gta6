// util.js — math helpers, seeded RNG, collision detection

export const TAU = Math.PI * 2;

// ------------------------------------------------------------ seeded RNG (mulberry32)
export function mulberry32(seed) {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(rng, min, max) {
  return min + rng() * (max - min);
}

export function randInt(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}

export function pick(rng, array) {
  return array[randInt(rng, 0, array.length - 1)];
}

export function chance(rng, probability) {
  return rng() < probability;
}

// ------------------------------------------------------------ math utilities
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export function wrapAngle(angle) {
  while (angle > Math.PI) angle -= TAU;
  while (angle < -Math.PI) angle += TAU;
  return angle;
}

export function angleDelta(from, to) {
  return wrapAngle(to - from);
}

export function dist2D(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

export function distSq2D(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return dx * dx + dz * dz;
}

export function rotateXZ(x, z, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - z * s, z: x * s + z * c };
}

// ------------------------------------------------------------ collision
export function rectFromCenter(x, z, width, length, heading) {
  const hw = width * 0.5;
  const hl = length * 0.5;
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  
  return {
    corners: [
      { x: x + (-hw * c - hl * s), z: z + (-hw * s + hl * c) },
      { x: x + (hw * c - hl * s), z: z + (hw * s + hl * c) },
      { x: x + (hw * c + hl * s), z: z + (hw * s - hl * c) },
      { x: x + (-hw * c + hl * s), z: z + (-hw * s - hl * c) },
    ],
    minX: x - Math.max(hw, hl),
    maxX: x + Math.max(hw, hl),
    minZ: z - Math.max(hw, hl),
    maxZ: z + Math.max(hw, hl),
  };
}

export function pointInRect(px, pz, rect) {
  if (px < rect.minX || px > rect.maxX || pz < rect.minZ || pz > rect.maxZ) {
    return false;
  }
  
  const corners = rect.corners;
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const xi = corners[i].x, zi = corners[i].z;
    const xj = corners[j].x, zj = corners[j].z;
    if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export function circleRectCollision(cx, cz, radius, rect) {
  // Safety check
  if (!rect || !rect.corners) {
    return null;
  }
  
  // Quick AABB check first
  if (cx + radius < rect.minX || cx - radius > rect.maxX ||
      cz + radius < rect.minZ || cz - radius > rect.maxZ) {
    return null;
  }
  
  // Check if circle center is inside rect
  if (pointInRect(cx, cz, rect)) {
    // Find closest edge and push out
    const corners = rect.corners;
    let minDist = Infinity;
    let normal = { x: 0, z: 0 };
    
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const x1 = corners[i].x, z1 = corners[i].z;
      const x2 = corners[j].x, z2 = corners[j].z;
      
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      const nx = -dz / len;
      const nz = dx / len;
      
      const dist = Math.abs((cx - x1) * nx + (cz - z1) * nz);
      if (dist < minDist) {
        minDist = dist;
        normal = { x: nx, z: nz };
      }
    }
    
    return { x: normal.x, z: normal.z, overlap: radius + minDist };
  }
  
  // Check distance to edges
  const corners = rect.corners;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const x1 = corners[i].x, z1 = corners[i].z;
    const x2 = corners[j].x, z2 = corners[j].z;
    
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    
    // Project circle center onto edge
    const t = clamp(((cx - x1) * dx + (cz - z1) * dz) / (len * len), 0, 1);
    const px = x1 + t * dx;
    const pz = z1 + t * dz;
    
    const dist = Math.sqrt((cx - px) * (cx - px) + (cz - pz) * (cz - pz));
    if (dist < radius) {
      const nx = (cx - px) / dist;
      const nz = (cz - pz) / dist;
      return { x: nx, z: nz, overlap: radius - dist };
    }
  }
  
  return null;
}

export function resolveCircleRect(cx, cz, radius, rect) {
  const collision = circleRectCollision(cx, cz, radius, rect);
  if (collision) {
    return {
      x: cx + collision.x * collision.overlap,
      z: cz + collision.z * collision.overlap,
    };
  }
  return { x: cx, z: cz };
}

export function segmentHitsRect(x1, z1, x2, z2, rect) {
  if (pointInRect(x1, z1, rect) || pointInRect(x2, z2, rect)) {
    return true;
  }
  
  const corners = rect.corners;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (segmentsIntersect(x1, z1, x2, z2, corners[i].x, corners[i].z, corners[j].x, corners[j].z)) {
      return true;
    }
  }
  return false;
}

function segmentsIntersect(x1, z1, x2, z2, x3, z3, x4, z4) {
  const denom = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return false;
  
  const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (z1 - z3) - (z1 - z2) * (x1 - x3)) / denom;
  
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
