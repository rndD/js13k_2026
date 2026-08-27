import type { AbilityId } from './types';

export type AbilityRarity = 'common' | 'uncommon' | 'rare';

export interface AbilityDefinition {
  id: AbilityId;
  title: string;
  description: [string, string];
  rarity: AbilityRarity;
  maxStacks: number;
}

export const ABILITIES: AbilityDefinition[] = [
  { id: 'extraCore', title: '+1 BALL', description: ['Add one ball', 'to your stock'], rarity: 'common', maxStacks: 5 },
  { id: 'recruiter', title: 'RECRUITER', description: ['Captured balls', 'start stronger'], rarity: 'uncommon', maxStacks: 3 },
  { id: 'armorShatter', title: 'SHATTER', description: ['Break: deal 30', 'to other armor'], rarity: 'rare', maxStacks: 3 },
];

export function abilityById(id: AbilityId): AbilityDefinition {
  return ABILITIES.find((ability) => ability.id === id)!;
}