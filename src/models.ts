export type KindId =
  | 'me'
  | 'you'
  | 'person_a'
  | 'person_b'
  | 'person_c'
  | 'family'
  | 'school'
  | 'block_tall'
  | 'block_flat'
  | 'present'
  | 'coffee'
  | 'apple'
  | 'cake';

export type Category = 'people' | 'school' | 'props';

export interface ModelDef {
  kind: KindId;
  file: string;
  category: Category;
  maxCount: number;
  isPerson: boolean;
}

export const MODEL_DEFS: ModelDef[] = [
  { kind: 'me', file: 'me.glb', category: 'people', maxCount: 1, isPerson: true },
  { kind: 'you', file: 'you.glb', category: 'people', maxCount: 1, isPerson: true },
  { kind: 'person_a', file: 'person_a.glb', category: 'people', maxCount: 1, isPerson: true },
  { kind: 'person_b', file: 'person_b.glb', category: 'people', maxCount: 1, isPerson: true },
  { kind: 'person_c', file: 'person_c.glb', category: 'people', maxCount: 1, isPerson: true },
  { kind: 'family', file: 'family.glb', category: 'people', maxCount: 1, isPerson: true },
  { kind: 'school', file: 'lowpoly_school.glb', category: 'school', maxCount: 1, isPerson: false },
  { kind: 'block_tall', file: 'block_tall.glb', category: 'school', maxCount: 3, isPerson: false },
  { kind: 'block_flat', file: 'block_flat.glb', category: 'school', maxCount: 3, isPerson: false },
  { kind: 'present', file: 'lowpoly_present.glb', category: 'props', maxCount: 2, isPerson: false },
  { kind: 'coffee', file: 'lowpoly_coffee_cup.glb', category: 'props', maxCount: 2, isPerson: false },
  { kind: 'apple', file: 'lowpoly_apple.glb', category: 'props', maxCount: 2, isPerson: false },
  { kind: 'cake', file: 'lowpoly_cake_slice.glb', category: 'props', maxCount: 2, isPerson: false },
];

export const MODEL_BY_KIND: Record<KindId, ModelDef> = Object.fromEntries(
  MODEL_DEFS.map((d) => [d.kind, d]),
) as Record<KindId, ModelDef>;

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'people', label: '人物' },
  { id: 'school', label: '学校' },
  { id: 'props', label: '小物' },
];

/**
 * Resolves the absolute URL for a model definition's GLB file, based on the
 * app's base path.
 * @param def The model definition.
 * @returns The URL string for the model file.
 */
export function modelUrl(def: ModelDef): string {
  return `${import.meta.env.BASE_URL}3dmodels/${def.file}`;
}
