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
  { id: 1, description: ['Add 2 balls', 'to your reserve'], rarity: 'common', maxStacks: 4 },
  // Recruiter
  { id: 2, description: ['Temporary balls', 'hit harder &', 'last longer'], rarity: 'common', maxStacks: 3 },
  // Poison
  { id: 3, description: ['Hits stack poison', '+8 each hit', 'Bursts every second'], rarity: 'common', maxStacks: 3 },
  // Auto Gun
  { id: 4, description: ['Main balls fire', '4 damage bullets'], rarity: 'common', maxStacks: 4 },
  // Overcharge
  { id: 5, description: ['Raise base power', 'of all your balls'], rarity: 'uncommon', maxStacks: 3 },
  // Split All
  { id: 6, description: ['Double all', 'your balls in play'], rarity: 'common', maxStacks: 2 },
  // Sacrifice
  { id: 7, description: ['Halve boss HP', 'Lose balls in play', 'Pick 2 more cards'], rarity: 'rare', maxStacks: 1 },
  // Boss Magnet
  { id: 8, description: ['Your balls curve', 'toward the boss'], rarity: 'uncommon', maxStacks: 3 },
  // Ball Regen
  { id: 9, description: ['Restore lost ball'], rarity: 'uncommon', maxStacks: 2 },
  // Critical
  { id: 10, description: ['15% chance to', 'deal double damage'], rarity: 'common', maxStacks: 3 },
  // Paint Cannon
  { id: 11, description: ['Red bumpers shoot', 'through the table'], rarity: 'uncommon', maxStacks: 3 },
  // Echo Spark
  { id: 12, description: ['Blue bumper: 18%', 'spawn temporary ball', 'above the boss'], rarity: 'uncommon', maxStacks: 3 },
  { id: 13, description: ['All balls stay', 'rainbow forever', '+25% damage'], rarity: 'rare', maxStacks: 1 },
  { id: 14, description: ['IDLE MODE', 'Flippers hit nearby', 'balls automatically'], rarity: 'rare', maxStacks: 1 },
];

export function abilityById(id: AbilityId): AbilityDefinition {
  return ABILITIES.find((ability) => ability.id === id)!;
}

export function abilityDescription(ability: AbilityDefinition, rank: number): string[] {
  if (ability.id === 1) return [`Add ${rank + 2} balls`, 'to your reserve'];
  if (ability.id === 3) return ['Hits stack poison', `+${[8, 16, 24][rank]} each hit`, 'Bursts every second'];
  if (ability.id === 5) return [`All balls gain`, `+${[0.5, 1, 2.5][rank]}x base power`];
  if (ability.id === 6 && rank) return ['Quadruple all', 'your balls in play'];
  if (ability.id === 11) return [`Red bumper shot`, `${[8, 14, 22][rank]} base damage`];
  if (ability.id === 12) return [`Blue bumper: ${[18, 38, 60][rank]}%`, 'spawn temporary ball', 'above the boss'];
  if (ability.id === 9) return ['Restore 1 ball', `every ${[30, 25][rank]} sec`, 'max 4 in reserve'];
  if (ability.id === 10) return [`${[15, 30, 45][rank]}% chance to`, 'deal double damage'];
  if (ability.id !== 4 || rank === 0) return ability.description;
  return rank === 2 ? ['Double bullet', 'damage'] : ['Fire bullets', '50% faster'];
}