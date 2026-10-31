import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  type BufferGeometry,
} from 'three';

export type PropCategory = 'Vegetación' | 'Rocas' | 'Estructuras';

type Shape =
  | { type: 'box'; size: [number, number, number] }
  | { type: 'cone'; radius: number; height: number; sides: number }
  | { type: 'cylinder'; top: number; bottom: number; height: number; sides: number }
  | { type: 'ico'; radius: number }
  | { type: 'dodeca'; radius: number };

export interface PropPiece {
  shape: Shape;
  /** Centro de la pieza respecto de la base del prop. */
  offset: [number, number, number];
  scale?: [number, number, number];
  rotationY?: number;
  color: number;
}

export interface PropDef {
  id: string;
  label: string;
  category: PropCategory;
  pieces: PropPiece[];
}

const TRUNK = 0x7a5230;
const LEAF = 0x3f8f3c;
const PINE = 0x2c6e49;
const STONE = 0x85817c;
const WALL = 0xd8c9a8;
const ROOF = 0xb0483a;

export const PROP_CATALOG: readonly PropDef[] = [
  {
    id: 'arbol',
    label: 'Árbol',
    category: 'Vegetación',
    pieces: [
      { shape: { type: 'cylinder', top: 0.12, bottom: 0.18, height: 1, sides: 6 }, offset: [0, 0.5, 0], color: TRUNK },
      { shape: { type: 'ico', radius: 0.75 }, offset: [0, 1.5, 0], color: LEAF },
    ],
  },
  {
    id: 'pino',
    label: 'Pino',
    category: 'Vegetación',
    pieces: [
      { shape: { type: 'cylinder', top: 0.1, bottom: 0.15, height: 0.6, sides: 6 }, offset: [0, 0.3, 0], color: TRUNK },
      { shape: { type: 'cone', radius: 0.7, height: 1.2, sides: 7 }, offset: [0, 1.1, 0], color: PINE },
      { shape: { type: 'cone', radius: 0.5, height: 1, sides: 7 }, offset: [0, 1.9, 0], color: PINE },
    ],
  },
  {
    id: 'arbusto',
    label: 'Arbusto',
    category: 'Vegetación',
    pieces: [
      { shape: { type: 'ico', radius: 0.4 }, offset: [0, 0.3, 0], scale: [1.2, 0.8, 1], color: 0x4f9a45 },
    ],
  },
  {
    id: 'flor',
    label: 'Flor',
    category: 'Vegetación',
    pieces: [
      { shape: { type: 'cylinder', top: 0.02, bottom: 0.03, height: 0.4, sides: 4 }, offset: [0, 0.2, 0], color: 0x4f9a45 },
      { shape: { type: 'dodeca', radius: 0.13 }, offset: [0, 0.45, 0], color: 0xe56b9a },
    ],
  },
  {
    id: 'roca-chica',
    label: 'Roca chica',
    category: 'Rocas',
    pieces: [
      { shape: { type: 'dodeca', radius: 0.4 }, offset: [0, 0.25, 0], scale: [1.1, 0.7, 0.9], color: STONE },
    ],
  },
  {
    id: 'roca-grande',
    label: 'Roca grande',
    category: 'Rocas',
    pieces: [
      { shape: { type: 'dodeca', radius: 0.9 }, offset: [0, 0.55, 0], scale: [1.2, 0.8, 1], color: 0x74706b },
      { shape: { type: 'ico', radius: 0.4 }, offset: [0.7, 0.25, 0.3], color: STONE },
    ],
  },
  {
    id: 'casa',
    label: 'Casa',
    category: 'Estructuras',
    pieces: [
      { shape: { type: 'box', size: [1.8, 1.1, 1.5] }, offset: [0, 0.55, 0], color: WALL },
      { shape: { type: 'cone', radius: 1.45, height: 0.9, sides: 4 }, offset: [0, 1.55, 0], rotationY: Math.PI / 4, color: ROOF },
    ],
  },
  {
    id: 'torre',
    label: 'Torre',
    category: 'Estructuras',
    pieces: [
      { shape: { type: 'cylinder', top: 0.7, bottom: 0.85, height: 3.2, sides: 8 }, offset: [0, 1.6, 0], color: STONE },
      { shape: { type: 'cone', radius: 1, height: 1.2, sides: 8 }, offset: [0, 3.8, 0], color: ROOF },
    ],
  },
  {
    id: 'muro',
    label: 'Muro',
    category: 'Estructuras',
    pieces: [{ shape: { type: 'box', size: [2, 1, 0.4] }, offset: [0, 0.5, 0], color: STONE }],
  },
];

const BY_ID = new Map(PROP_CATALOG.map((def) => [def.id, def]));

export function findProp(id: string): PropDef | undefined {
  return BY_ID.get(id);
}

/** Geometría de una pieza con su transformación ya aplicada, para instanciar. */
export function createPieceGeometry(piece: PropPiece): BufferGeometry {
  const { shape } = piece;
  let geometry: BufferGeometry;
  switch (shape.type) {
    case 'box':
      geometry = new BoxGeometry(...shape.size);
      break;
    case 'cone':
      geometry = new ConeGeometry(shape.radius, shape.height, shape.sides);
      break;
    case 'cylinder':
      geometry = new CylinderGeometry(shape.top, shape.bottom, shape.height, shape.sides);
      break;
    case 'ico':
      geometry = new IcosahedronGeometry(shape.radius, 0);
      break;
    case 'dodeca':
      geometry = new DodecahedronGeometry(shape.radius, 0);
      break;
  }
  if (piece.scale) geometry.scale(...piece.scale);
  if (piece.rotationY) geometry.rotateY(piece.rotationY);
  geometry.translate(...piece.offset);
  return geometry;
}
