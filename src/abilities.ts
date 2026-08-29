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
  { id: 'recruiter', description: ['Stronger temporary', 'balls'], rarity: 'common', maxStacks: 3 },
  // Poison
  { id: 'poison', description: ['Poison'], rarity: 'common', maxStacks: 3 },
  // Auto Gun
  { id: 'autoGun', description: ['Main balls fire', 'tiny boss shots'], rarity: 'common', maxStacks: 4 },
  // Overcharge
  { id: 'overcharge', description: ['Raise base power', 'of all your balls'], rarity: 'uncommon', maxStacks: 3 },
  // Split All
  { id: 'splitAll', description: ['Clone every one', 'of your live balls'], rarity: 'common', maxStacks: 2 },
  // Sacrifice
  { id: 'sacrifice', description: ['Halve boss HP', 'Destroy all balls', 'Gain 2 more picks'], rarity: 'rare', maxStacks: 1 },
  // Boss Magnet
  { id: 'bossMagnet', description: ['Your balls curve', 'toward the boss'], rarity: 'uncommon', maxStacks: 3 },
  // Ball Regen
  { id: 'ballRestore', description: ['Restore lost ball'], rarity: 'uncommon', maxStacks: 2 },
  // Critical
  { id: 'critical', description: ['Balls gain 15%', 'double hit chance'], rarity: 'common', maxStacks: 3 },
  // Paint Cannon
  { id: 'paintShot', description: ['Red bumpers shoot', 'through the table'], rarity: 'uncommon', maxStacks: 3 },
  // Echo Spark
  { id: 'energyEcho', description: ['Blue bumpers spawn', 'temporary balls'], rarity: 'uncommon', maxStacks: 3 },
  { id: 'foreverRainbow', description: ['All your balls stay', 'rainbow forever'], rarity: 'rare', maxStacks: 1 },
  { id: 'autoFlippers', description: ['Flippers attack', 'balls automatically'], rarity: 'rare', maxStacks: 1 },
];

export function abilityById(id: AbilityId): AbilityDefinition {
  return ABILITIES.find((ability) => ability.id === id)!;
}

export function abilityDescription(ability: AbilityDefinition, rank: number): string[] {
  if (ability.id === 'extraCore') return [`Add ${rank + 2} balls`, 'to your stock'];
  if (ability.id === 'recruiter') return [`Temporary balls +1x`, `${[10, 20, 40][rank]} hits / ${[30, 60, 120][rank]} sec`];
  if (ability.id === 'overcharge') return [`All balls gain`, `+${[0.5, 1, 2.5][rank]}x base power`];
  if (ability.id === 'paintShot') return [`Red bumper shot`, `${[8, 14, 22][rank]} base damage`];
  if (ability.id === 'energyEcho') return [`Blue bumper:`, `${[18, 38, 60][rank]}% chance for`, `temporary ball`];
  if (ability.id === 'ballRestore') return ['Restore +1 ball', `every ${[30, 25][rank]} seconds`];
  if (ability.id !== 'autoGun' || rank === 0) return ability.description;
  return rank === 2 ? ['Double bullet', 'damage'] : ['Fire bullets', '50% faster'];
}