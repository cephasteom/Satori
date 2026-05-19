export const DIRECTIONS = [
    [-1,-1], [-1,0], [-1,1],
    [0,  -1],        [0, 1],
    [1,  -1], [1, 0], [1, 1],
] as const;

export function countAliveNeighbours(grid: number[], size: number, x: number, y: number): number {
    let n = 0;
    for (const [dx, dy] of DIRECTIONS) {
        n += grid[((x + dx + size) % size) * size + ((y + dy + size) % size)];
    }
    return n;
}

export function applyMinPop(grid: number[], size: number, min: number, pop: number): void {
    const target = Math.ceil(size * size * min);
    if (pop >= target) return;
    const dead: number[] = [];
    for (let i = 0; i < grid.length; i++) if (grid[i] === 0) dead.push(i);
    const needed = target - pop;
    for (let k = 0; k < needed; k++) {
        const r = k + Math.floor(Math.random() * (dead.length - k));
        [dead[k], dead[r]] = [dead[r], dead[k]];
        grid[dead[k]] = 1;
    }
}

export function stepBS(
    grid: number[],
    size: number,
    min: number,
    born: ReadonlySet<number>,
    survive: ReadonlySet<number>,
): number[] {
    const next = new Array(size * size).fill(0);
    let pop = 0;
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const n = countAliveNeighbours(grid, size, i, j);
            const idx = i * size + j;
            const alive = grid[idx] === 1 ? (survive.has(n) ? 1 : 0) : (born.has(n) ? 1 : 0);
            next[idx] = alive;
            pop += alive;
        }
    }
    if (min > 0) applyMinPop(next, size, min, pop);
    return next;
}

export function stepBriansBrain(grid: number[], size: number, min: number): number[] {
    const next = new Array(size * size).fill(0);
    let pop = 0;
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const idx = i * size + j;
            const s = grid[idx];
            const ns = s === 1 ? 2 : s === 2 ? 0 : (countAliveNeighbours(grid, size, i, j) === 2 ? 1 : 0);
            next[idx] = ns;
            if (ns === 1) pop++;
        }
    }
    if (min > 0) applyMinPop(next, size, min, pop);
    return next;
}

export function stepFloatLife(
    grid: number[],
    size: number,
    min: number,
    decayRate: number = 0.2,
    threshold: number = 0.5,
): number[] {
    const next = new Array(size * size).fill(0);
    let pop = 0;
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const idx = i * size + j;
            const current = grid[idx];
            let aliveNeighbours = 0;
            for (const [dx, dy] of DIRECTIONS) {
                const nx = (i + dx + size) % size;
                const ny = (j + dy + size) % size;
                if (grid[nx * size + ny] >= threshold) aliveNeighbours++;
            }
            const isAlive = current >= threshold;
            const survives = aliveNeighbours === 2 || aliveNeighbours === 3;
            const born = aliveNeighbours === 3;
            next[idx] = Math.min(1.0, Math.max(0.0,
                (isAlive && survives) || (!isAlive && born)
                    ? current + decayRate
                    : current - decayRate
            ));
            if (next[idx] >= threshold) pop++;
        }
    }
    if (min > 0) applyMinPop(next, size, min, pop);
    return next;
}
