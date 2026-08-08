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
  label: string;
  sub?: string;
  /** Multiline chest-label text for people (runtime canvas texture). */
  labelText?: string;
  maxCount: number;
  isPerson: boolean;
}

export const MODEL_DEFS: ModelDef[] = [
  { kind: 'me', file: 'me.glb', category: 'people', label: '私', sub: 'jag・I', labelText: '私\njag\nI', maxCount: 1, isPerson: true },
  { kind: 'you', file: 'you.glb', category: 'people', label: 'あなた', sub: 'du・You', labelText: 'あなた\ndu\nYou', maxCount: 1, isPerson: true },
  { kind: 'person_a', file: 'person_a.glb', category: 'people', label: 'A', sub: '縞模様・帽子', labelText: 'A', maxCount: 1, isPerson: true },
  { kind: 'person_b', file: 'person_b.glb', category: 'people', label: 'B', sub: '水玉・帽子', labelText: 'B', maxCount: 1, isPerson: true },
  { kind: 'person_c', file: 'person_c.glb', category: 'people', label: 'C', sub: 'チェック・帽子', labelText: 'C', maxCount: 1, isPerson: true },
  { kind: 'family', file: 'family.glb', category: 'people', label: '家族', sub: 'familj・family', labelText: '家族\nfamilj\nfamily', maxCount: 1, isPerson: true },
  { kind: 'school', file: 'lowpoly_school.glb', category: 'school', label: '学校', maxCount: 1, isPerson: false },
  { kind: 'block_tall', file: 'block_tall.glb', category: 'school', label: '縦ブロック', sub: '校門・ドア', maxCount: 3, isPerson: false },
  { kind: 'block_flat', file: 'block_flat.glb', category: 'school', label: '横ブロック', sub: '机', maxCount: 3, isPerson: false },
  { kind: 'present', file: 'lowpoly_present.glb', category: 'props', label: 'プレゼント', maxCount: 2, isPerson: false },
  { kind: 'coffee', file: 'lowpoly_coffee_cup.glb', category: 'props', label: 'コーヒー', sub: '×2', maxCount: 2, isPerson: false },
  { kind: 'apple', file: 'lowpoly_apple.glb', category: 'props', label: 'りんご', sub: '×2', maxCount: 2, isPerson: false },
  { kind: 'cake', file: 'lowpoly_cake_slice.glb', category: 'props', label: 'ケーキ', sub: '×2', maxCount: 2, isPerson: false },
];

export const MODEL_BY_KIND: Record<KindId, ModelDef> = Object.fromEntries(
  MODEL_DEFS.map((d) => [d.kind, d]),
) as Record<KindId, ModelDef>;

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'people', label: '人物' },
  { id: 'school', label: '学校' },
  { id: 'props', label: '小物' },
];

export function modelUrl(def: ModelDef): string {
  return `${import.meta.env.BASE_URL}3dmodels/${def.file}`;
}
