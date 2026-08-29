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
  { id: 'extraCore', description: ['Add 2 balls', 'to your reserve'], rarity: 'common', maxStacks: 4 },
  // Recruiter
  { id: 'recruiter', description: ['Temporary balls', 'hit harder &', 'last longer'], rarity: 'common', maxStacks: 3 },
  // Poison
  { id: 'poison', description: ['Hits add poison', '+8 delayed damage'], rarity: 'common', maxStacks: 3 },
  // Auto Gun
  { id: 'autoGun', description: ['Main balls fire', '4 damage bullets'], rarity: 'common', maxStacks: 4 },
  // Overcharge
  { id: 'overcharge', description: ['Raise base power', 'of all your balls'], rarity: 'uncommon', maxStacks: 3 },
  // Split All
  { id: 'splitAll', description: ['Double all', 'your balls in play'], rarity: 'common', maxStacks: 2 },
  // Sacrifice
  { id: 'sacrifice', description: ['Halve current boss HP', 'Lose all balls in play', 'Pick 2 more cards'], rarity: 'rare', maxStacks: 1 },
  // Boss Magnet
  { id: 'bossMagnet', description: ['Your balls curve', 'toward the boss'], rarity: 'uncommon', maxStacks: 3 },
  // Ball Regen
  { id: 'ballRestore', description: ['Restore lost ball'], rarity: 'uncommon', maxStacks: 2 },
  // Critical
  { id: 'critical', description: ['15% chance to', 'deal double damage'], rarity: 'common', maxStacks: 3 },
  // Paint Cannon
  { id: 'paintShot', description: ['Red bumpers shoot', 'through the table'], rarity: 'uncommon', maxStacks: 3 },
  // Echo Spark
  { id: 'energyEcho', description: ['Blue bumper: 18%', 'spawn temporary ball', 'above the boss'], rarity: 'uncommon', maxStacks: 3 },
  { id: 'foreverRainbow', description: ['All balls stay', 'rainbow forever', '+25% damage'], rarity: 'rare', maxStacks: 1 },
  { id: 'autoFlippers', description: ['IDLE MODE', 'Flippers hit nearby', 'balls automatically'], rarity: 'rare', maxStacks: 1 },
];

export function abilityById(id: AbilityId): AbilityDefinition {
  return ABILITIES.find((ability) => ability.id === id)!;
}

export function abilityDescription(ability: AbilityDefinition, rank: number): string[] {
  if (ability.id === 'extraCore') return [`Add ${rank + 2} balls`, 'to your reserve'];
  if (ability.id === 'poison') return ['Hits add poison', `+${[8, 16, 24][rank]} delayed damage`];
  if (ability.id === 'overcharge') return [`All balls gain`, `+${[0.5, 1, 2.5][rank]}x base power`];
  if (ability.id === 'splitAll' && rank) return ['Quadruple all', 'your balls in play'];
  if (ability.id === 'paintShot') return [`Red bumper shot`, `${[8, 14, 22][rank]} base damage`];
  if (ability.id === 'energyEcho') return [`Blue bumper: ${[18, 38, 60][rank]}%`, 'spawn temporary ball', 'above the boss'];
  if (ability.id === 'ballRestore') return ['Restore 1 ball', `every ${[30, 25][rank]} sec`, 'max 4 in reserve'];
  if (ability.id === 'critical') return [`${[15, 30, 45][rank]}% chance to`, 'deal double damage'];
  if (ability.id !== 'autoGun' || rank === 0) return ability.description;
  return rank === 2 ? ['Double bullet', 'damage'] : ['Fire bullets', '50% faster'];
}