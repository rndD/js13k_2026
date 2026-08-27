import type { AbilityId } from './types';

export type AbilityRarity = 'common' | 'uncommon' | 'rare';

export interface AbilityDefinition {
  id: AbilityId;
  description: [string, string];
  rarity: AbilityRarity;
  maxStacks: number;
}

export const ABILITIES: AbilityDefinition[] = [
  { id: 'extraCore', description: ['Add one ball', 'to your stock'], rarity: 'common', maxStacks: 5 },
  { id: 'recruiter', description: ['Captured balls', 'start stronger'], rarity: 'uncommon', maxStacks: 3 },
  { id: 'poison', description: ['Boss hits plant', 'delayed damage'], rarity: 'rare', maxStacks: 3 },
  { id: 'autoGun', description: ['Main balls fire', 'tiny boss shots'], rarity: 'rare', maxStacks: 4 },
  { id: 'overcharge', description: ['Double power of', 'your live balls'], rarity: 'uncommon', maxStacks: 3 },
  { id: 'splitAll', description: ['Clone every one', 'of your live balls'], rarity: 'rare', maxStacks: 2 },
  { id: 'sacrifice', description: ['Halve boss life', 'gain 2 choices'], rarity: 'rare', maxStacks: 1 },
  { id: 'bossMagnet', description: ['Your balls curve', 'toward the boss'], rarity: 'rare', maxStacks: 3 },
  { id: 'ballRestore', description: ['Restore lost ball', 'every 30 seconds'], rarity: 'uncommon', maxStacks: 1 },
  { id: 'critical', description: ['Balls gain 15%', 'double hit chance'], rarity: 'uncommon', maxStacks: 3 },
];

export function abilityById(id: AbilityId): AbilityDefinition {
  return ABILITIES.find((ability) => ability.id === id)!;
}

export function abilityDescription(ability: AbilityDefinition, rank: number): [string, string] {
  if (ability.id !== 'autoGun' || rank === 0) return ability.description;
  return rank === 2 ? ['Double bullet', 'damage'] : ['Fire bullets', '50% faster'];
}