import type { KindId } from './models';

export interface Question {
  id: number;
  items: KindId[];
}

/**
 * Placeholder question presets. The actual questions are not decided yet, so
 * the asset lists are varied/randomised for now. Edit these by hand later to
 * assign the people/props that each question should load onto the stage.
 */
export const QUESTIONS: Question[] = [
  { id: 1, items: ['person_b', 'person_c'] },
  { id: 2, items: ['person_a', 'person_b', 'present'] },
  { id: 3, items: ['school', 'person_a', 'person_b', 'block_tall', 'block_tall', 'block_flat'] },
  { id: 4, items: ['you', 'person_b', 'coffee', 'apple'] },
  { id: 5, items: ['me', 'family'] },
  { id: 6, items: ['person_a', 'person_c', 'school', 'block_flat', 'block_flat', 'block_flat'] },
  { id: 7, items: ['person_b', 'person_c', 'present', 'present'] },
  { id: 8, items: ['person_a', 'person_c', 'coffee', 'cake'] },
  { id: 9, items: ['school', 'me', 'you', 'block_tall', 'block_flat'] },
  { id: 10, items: ['family', 'person_a', 'present'] },
  { id: 11, items: ['person_a', 'person_b', 'apple', 'cake'] },
  { id: 12, items: ['school', 'person_b', 'person_c', 'block_tall', 'block_tall', 'block_tall'] },
  { id: 13, items: ['you', 'person_c', 'present'] },
  { id: 14, items: ['person_a', 'family', 'coffee', 'coffee'] },
  { id: 15, items: ['school', 'me', 'family', 'block_flat', 'block_tall'] },
  { id: 16, items: ['person_b', 'you', 'apple'] },
  { id: 17, items: ['person_c', 'person_a', 'school', 'block_tall', 'block_flat', 'block_flat'] },
  { id: 18, items: ['me', 'person_b', 'cake', 'coffee'] },
  { id: 19, items: ['family', 'person_c', 'present', 'apple'] },
  { id: 20, items: ['you', 'person_a', 'school', 'block_flat', 'block_flat'] },
];
