import type { AbilityId } from './types';
import { PAINT_SHOT_DAMAGES } from './constants';

export type AbilityRarity = 'common' | 'uncommon' | 'rare' | 'rare+';

export interface AbilityDefinition {
  id: AbilityId;
  description: string[];
  rarity: AbilityRarity;
  maxStacks: number;
}

export const ABILITIES: AbilityDefinition[] = [
  // Extra Ball
  { id: 1, description: ['Add 2 balls', 'to your reserve'], rarity: 'common', maxStacks: 4 },
  // Recruiter
  { id: 2, description: ['Temporary balls', 'hit harder &', 'last longer'], rarity: 'common', maxStacks: 3 },
  // Poison
  { id: 3, description: [], rarity: 'common', maxStacks: 3 },
  // Auto Gun
  { id: 4, description: ['Main balls fire', '2 damage bullets'], rarity: 'common', maxStacks: 4 },
  // Overcharge
  { id: 5, description: ['Raise base power', 'of all your balls'], rarity: 'uncommon', maxStacks: 3 },
  // Split All
  { id: 6, description: ['Double all', 'your balls in play'], rarity: 'common', maxStacks: 2 },
  // Sacrifice
  { id: 7, description: ['Halve boss HP', 'Lose ALL balls', 'in play', 'Pick 2 more cards'], rarity: 'rare', maxStacks: 1 },
  // Boss Magnet
  { id: 8, description: ['Main balls home in', 'near the boss'], rarity: 'uncommon', maxStacks: 2 },
  // Ball Regen
  { id: 9, description: ['Restore lost ball'], rarity: 'uncommon', maxStacks: 2 },
  // Critical
  { id: 10, description: ['15% chance to', 'deal double damage'], rarity: 'common', maxStacks: 3 },
  // Paint Cannon
  { id: 11, description: ['Red bumpers fire', '4 damage bullets'], rarity: 'uncommon', maxStacks: 3 },
  // Echo Spark
  { id: 12, description: ['Blue bumper: 18%', 'spawn temporary ball', 'above the boss'], rarity: 'uncommon', maxStacks: 3 },
  { id: 13, description: ['All balls stay', 'rainbow forever', '+25% damage'], rarity: 'rare+', maxStacks: 1 },
  { id: 14, description: ['IDLE MODE', 'Flippers hit nearby', 'balls automatically'], rarity: 'rare+', maxStacks: 1 },
  { id: 15, description: ['15% longer flippers', '20% stronger hits'], rarity: 'rare+', maxStacks: 1 },
];

export function abilityById(id: AbilityId): AbilityDefinition {
  return ABILITIES.find((ability) => ability.id === id)!;
}

export function abilityDescription(ability: AbilityDefinition, rank: number): string[] {
  if (ability.id === 1) return [`Add ${(rank + 1) * 2} balls`, 'to your reserve'];
  if (ability.id === 3) return ['Hits stack poison', `+${[4, 8, 12][rank]} each hit`];
  if (ability.id === 5) return [`All balls gain`, `+${[0.5, 1, 2.5][rank]}x base power`];
  if (ability.id === 6 && rank) return ['Quadruple all', 'your balls in play'];
  if (ability.id === 11) return ['Red bumpers fire', `${PAINT_SHOT_DAMAGES[rank]} damage bullets`];
  if (ability.id === 12) return [`Blue bumper: ${[18, 38, 60][rank]}%`, 'spawn temporary ball', 'above the boss'];
  if (ability.id === 9) return ['Restore 1 ball', `every ${[30, 25][rank]} sec`, 'max 4 in reserve'];
  if (ability.id === 10) return [`${[12, 24, 36][rank]}% chance to`, 'deal double damage'];
  if (ability.id !== 4 || rank === 0) return ability.description;
  return rank === 2 ? ['Double bullet', 'damage'] : rank === 3 ? ['12 damage bullets', '50% faster'] : ['Fire bullets', '50% faster'];
}