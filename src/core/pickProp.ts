import { propHeight } from './propCatalog.ts';
import type { PropInstance } from './types.ts';

type V3 = readonly [number, number, number];

const RAY_LENGTH = 5000;

/** Distancia mínima entre el rayo (acotado) y el segmento vertical x,z desde y0 hasta y1. */
function rayToVerticalSegment(o: V3, d: V3, x: number, z: number, y0: number, y1: number): number {
  // Puntos P = o + t*d (t en [0, L]) y Q = (x, y0 + s*(y1-y0), z), s en [0, 1]; mínimos cuadrados acotados.
  const e = y1 - y0;
  const w: V3 = [o[0] - x, o[1] - y0, o[2] - z];
  const a = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const b = d[1] * e;
  const c = e * e;
  const dd = d[0] * w[0] + d[1] * w[1] + d[2] * w[2];
  const ee = e * w[1];
  const denom = a * c - b * b;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const dist = (t: number, s: number) =>
    Math.hypot(w[0] + t * d[0], w[1] + t * d[1] - s * e, w[2] + t * d[2]);
  let t = denom > 1e-9 ? clamp((b * ee - c * dd) / denom, 0, RAY_LENGTH) : 0;
  let s = c > 1e-9 ? clamp((b * t + ee) / c, 0, 1) : 0;
  t = clamp((b * s - dd) / a, 0, RAY_LENGTH);
  s = c > 1e-9 ? clamp((b * t + ee) / c, 0, 1) : 0;
  return dist(t, s);
}

/** Elemento más cercano al rayo dentro de un radio proporcional a su escala; null si ninguno. */
export function pickPropByRay(props: readonly PropInstance[], origin: V3, direction: V3): PropInstance | null {
  let best: PropInstance | null = null;
  let bestDistance = Infinity;
  for (const prop of props) {
    const [x, y, z] = prop.position;
    const distance = rayToVerticalSegment(origin, direction, x, z, y, y + propHeight(prop.asset) * prop.scale);
    if (distance <= 0.6 * prop.scale + 0.3 && distance < bestDistance) {
      best = prop;
      bestDistance = distance;
    }
  }
  return best;
}
