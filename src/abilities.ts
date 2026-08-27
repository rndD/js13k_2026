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
  { id: 'poison', title: 'POISON', description: ['Boss hits plant', 'delayed damage'], rarity: 'rare', maxStacks: 3 },
  { id: 'autoGun', title: 'AUTO GUN', description: ['Your main ball', 'fires at boss'], rarity: 'rare', maxStacks: 4 },
  { id: 'overcharge', title: 'OVERCHARGE', description: ['Double power of', 'your live balls'], rarity: 'uncommon', maxStacks: 3 },
  { id: 'splitAll', title: 'SPLIT ALL', description: ['Clone every one', 'of your balls'], rarity: 'rare', maxStacks: 2 },
  { id: 'sacrifice', title: 'SACRIFICE', description: ['Halve boss life', 'gain 2 choices'], rarity: 'rare', maxStacks: 1 },
  { id: 'bossMagnet', title: 'BOSS MAGNET', description: ['Your balls curve', 'toward the boss'], rarity: 'rare', maxStacks: 3 },
];

export function abilityById(id: AbilityId): AbilityDefinition {
  return ABILITIES.find((ability) => ability.id === id)!;
}