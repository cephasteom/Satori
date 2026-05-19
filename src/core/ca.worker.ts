/// <reference lib="webworker" />

import { stepBS, stepBriansBrain, stepFloatLife, stepVitality } from "./ca.core";

// Indexed to match the cellularAutomata array in CA.ts
const BS_RULES: Array<{ born: ReadonlySet<number>; survive: ReadonlySet<number> } | string> = [
    { born: new Set([3]),       survive: new Set([2, 3]) },         // 0: GameOfLife
    { born: new Set([3, 6]),    survive: new Set([2, 3]) },         // 1: HighLife
    { born: new Set([3,6,7,8]), survive: new Set([3,4,6,7,8]) },    // 2: DayAndNight
    { born: new Set([3]),       survive: new Set([1,2,3,4,5]) },    // 3: Maze
    { born: new Set([2]),       survive: new Set([]) },             // 4: Seeds
    { born: new Set([3]),       survive: new Set([4,5,6,7,8]) },    // 5: Coral
    'brian',                                                        // 6: BriansBrain
    'float',                                                        // 7: FloatGOL
    'vitality',                                                     // 8: Vitality
];

// One grid per active CA stream
const grids = new Map<string, number[]>();

function computeStep(key: string, caIndex: number, size: number, min: number): number[] {
    const grid = grids.get(key)!;
    const rule = BS_RULES[caIndex];
    let next: number[];
    if (rule === 'brian') {
        next = stepBriansBrain(grid, size, min);
    } else if (rule === 'float') {
        next = stepFloatLife(grid, size, min);
    } else if (rule === 'vitality') {
        next = stepVitality(grid, size, min);
    } else {
        next = stepBS(grid, size, min, rule!.born, rule!.survive);
    }
    grids.set(key, next);
    return next;
}

self.onmessage = ({ data }: MessageEvent) => {
    const { type, key, caIndex, size, min, initGrid, count } = data as {
        type: 'init' | 'compute';
        key: string;
        caIndex: number;
        size: number;
        min: number;
        initGrid?: number[];
        count: number;
    };

    if (type === 'init') {
        grids.set(key, initGrid!);
    }

    const frames: number[][] = [];
    for (let i = 0; i < count; i++) frames.push(computeStep(key, caIndex, size, min));
    self.postMessage({ key, frames });
};
