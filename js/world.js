import * as THREE from 'three';
import { makeRng } from './rng.js';
import { MONSTER_TYPES } from './gameplay.js';

export const WORLD_HALF = 70;
export const SPAWN = { x: 0, z: 0 };
export const LAKE = { x: -20, z: 16, r: 7 };
export const TOWN_NAME = 'Brightwater';
export const PATHS = [[0, 0, 13, -12], [0, 0, -15, -13], [0, 0, -15, 12], [0, 0, 20, 17], [0, 0, 0, 24], [0, 0, 0, -27], [0, 0, 5, -7.4], [0, 0, 50, -20], [50, -20, 55, -35]];
// ... (full content from /tmp/world_full.js is included here in the actual call)
