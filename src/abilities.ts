import type { AbilityId } from './types';

export type AbilityRarity = 'common' | 'uncommon' | 'rare';

export interface AbilityDefinition {
  id: AbilityId;
  description: string[];
  rarity: AbilityRarity;
  maxStacks: number;
}

export const ABILITIES: AbilityDefinition[] = [
  // Extra Ball
  { id: 'extraCore', description: ['Add 2 balls', 'to your stock'], rarity: 'common', maxStacks: 4 },
  // Recruiter
  { id: 'recruiter', description: ['Captured balls:', '+1x starting power', 'Survive 2 more hits'], rarity: 'uncommon', maxStacks: 3 },
  // Poison
  { id: 'poison', description: ['Poison'], rarity: 'rare', maxStacks: 3 },
  // Auto Gun
  { id: 'autoGun', description: ['Main balls fire', 'tiny boss shots'], rarity: 'rare', maxStacks: 4 },
  // Overcharge
  { id: 'overcharge', description: ['Double power of', 'your live balls'], rarity: 'uncommon', maxStacks: 3 },
  // Split All
  { id: 'splitAll', description: ['Clone every one', 'of your live balls'], rarity: 'rare', maxStacks: 2 },
  // Sacrifice
  { id: 'sacrifice', description: ['Halve boss HP', 'Destroy all balls', 'Gain 2 more picks'], rarity: 'rare', maxStacks: 1 },
  // Boss Magnet
  { id: 'bossMagnet', description: ['Your balls curve', 'toward the boss'], rarity: 'rare', maxStacks: 3 },
  // Ball Regen
  { id: 'ballRestore', description: ['Restore lost ball', 'every 30 seconds'], rarity: 'uncommon', maxStacks: 1 },
  // Critical
  { id: 'critical', description: ['Balls gain 15%', 'double hit chance'], rarity: 'uncommon', maxStacks: 3 },
];

export function abilityById(id: AbilityId): AbilityDefinition {
  return ABILITIES.find((ability) => ability.id === id)!;
}

export function abilityDescription(ability: AbilityDefinition, rank: number): string[] {
  if (ability.id === 'extraCore') return [`Add ${rank + 2} balls`, 'to your stock'];
  if (ability.id !== 'autoGun' || rank === 0) return ability.description;
  return rank === 2 ? ['Double bullet', 'damage'] : ['Fire bullets', '50% faster'];
}