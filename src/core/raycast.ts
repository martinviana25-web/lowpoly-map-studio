import { sampleHeight } from './heightmap.ts';
import { HEIGHT_MAX, HEIGHT_MIN, type MapData } from './types.ts';

export type Vec3 = readonly [number, number, number];

const STEP = 0.25;
const REFINE_ITERATIONS = 12;

/** Recorta el rayo contra la caja del mapa. Devuelve [tEntrada, tSalida] o null. */
function clipToBounds(map: MapData, o: Vec3, d: Vec3): [number, number] | null {
  const min = [0, HEIGHT_MIN, 0];
  const max = [map.width, HEIGHT_MAX, map.depth];
  let t0 = 0;
  let t1 = Number.POSITIVE_INFINITY;
  for (let axis = 0; axis < 3; axis++) {
    if (d[axis] === 0) {
      if (o[axis] < min[axis] || o[axis] > max[axis]) return null;
      continue;
    }
    const a = (min[axis] - o[axis]) / d[axis];
    const b = (max[axis] - o[axis]) / d[axis];
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  return t0 <= t1 ? [t0, t1] : null;
}

/**
 * Ray-marching sobre el heightfield. `direction` no necesita estar normalizada.
 * Devuelve el primer punto donde el rayo pasa de arriba a abajo de la superficie,
 * o null si no toca el terreno dentro del mapa.
 */
export function raycastHeightfield(map: MapData, origin: Vec3, direction: Vec3): Vec3 | null {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (length === 0) return null;
  const d: Vec3 = [direction[0] / length, direction[1] / length, direction[2] / length];
  const span = clipToBounds(map, origin, d);
  if (!span) return null;

  const at = (t: number): Vec3 => [origin[0] + d[0] * t, origin[1] + d[1] * t, origin[2] + d[2] * t];
  const above = (t: number): boolean => {
    const p = at(t);
    return p[1] >= sampleHeight(map, p[0], p[2]);
  };

  let prevT = span[0];
  let prevAbove = above(prevT);
  for (let t = span[0] + STEP; ; t += STEP) {
    const current = Math.min(t, span[1]);
    const isAbove = above(current);
    if (prevAbove && !isAbove) {
      let lo = prevT;
      let hi = current;
      for (let i = 0; i < REFINE_ITERATIONS; i++) {
        const mid = (lo + hi) / 2;
        if (above(mid)) lo = mid;
        else hi = mid;
      }
      return at(hi);
    }
    if (current >= span[1]) return null;
    prevT = current;
    prevAbove = isAbove;
  }
}
