import { memoize } from "./utils";

// --- Still lifes ---

const block = (): number[] =>
  [0,0,1,1,
   0,0,1,1,
   0,0,0,0,
   0,0,0,0];
// Always use size=4 for this one; embed into larger grid with offset helper below

const beehive = (): number[] =>
  [0,1,1,0,
   1,0,0,1,
   0,1,1,0];

const loaf = (): number[] =>
  [0,1,1,0,
   1,0,0,1,
   0,1,0,1,
   0,0,1,0];

// --- Oscillators ---

const blinker = (): number[] =>
  [0,0,0,
   1,1,1,
   0,0,0];

const toad = (): number[] =>
  [0,0,0,0,
   0,1,1,1,
   1,1,1,0,
   0,0,0,0];

const beacon = (): number[] =>
  [1,1,0,0,
   1,1,0,0,
   0,0,1,1,
   0,0,1,1];

const pulsar = (size: number): number[] => {
  const coords: [number, number][] = [
    [2,4],[2,5],[2,6],[2,10],[2,11],[2,12],
    [4,2],[4,7],[4,9],[4,14],
    [5,2],[5,7],[5,9],[5,14],
    [6,2],[6,7],[6,9],[6,14],
    [7,4],[7,5],[7,6],[7,10],[7,11],[7,12],
    [9,4],[9,5],[9,6],[9,10],[9,11],[9,12],
    [10,2],[10,7],[10,9],[10,14],
    [11,2],[11,7],[11,9],[11,14],
    [12,2],[12,7],[12,9],[12,14],
    [14,4],[14,5],[14,6],[14,10],[14,11],[14,12],
  ];
  return placePattern(size, coords);
};

// --- Spaceships ---

const glider = (size: number): number[] => {
  const coords: [number, number][] = [[0,1],[1,2],[2,0],[2,1],[2,2]];
  return placePattern(size, coords);
};

const lwss = (size: number): number[] => {
  const coords: [number, number][] = [[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]];
  return placePattern(size, coords);
};

// --- Methuselahs (long-lived chaotic patterns) ---

const rPentomino = (size: number): number[] => {
  const coords: [number, number][] = [[0,1],[0,2],[1,0],[1,1],[2,1]];
  return placePattern(size, coords, { centerX: true, centerY: true });
};

const acorn = (size: number): number[] => {
  const coords: [number, number][] = [[0,1],[1,3],[2,0],[2,1],[2,4],[2,5],[2,6]];
  return placePattern(size, coords, { centerX: true, centerY: true });
};

const diehard = (size: number): number[] => {
  const coords: [number, number][] = [[0,6],[1,0],[1,1],[2,1],[2,5],[2,6],[2,7]];
  return placePattern(size, coords, { centerX: true, centerY: true });
};

// --- Infinite growth ---

const gosperGliderGun = (size: number): number[] => {
  const coords: [number, number][] = [
    [0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],
    [3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],
    [4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],
    [5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13],
  ];
  return placePattern(size, coords);
};

// --- Utilities ---

interface PlaceOptions {
  centerX?: boolean;
  centerY?: boolean;
  offsetRow?: number;
  offsetCol?: number;
}

const placePattern = (
  size: number,
  coords: [number, number][],
  options: PlaceOptions = {}
): number[] => {
  const grid = createEmptyGrid(size).map(() => 0);
  const maxRow = Math.max(...coords.map(([r]) => r));
  const maxCol = Math.max(...coords.map(([, c]) => c));

  const offsetRow = options.centerY ? Math.floor((size - maxRow) / 2) : (options.offsetRow ?? 1);
  const offsetCol = options.centerX ? Math.floor((size - maxCol) / 2) : (options.offsetCol ?? 1);

  for (const [r, c] of coords) {
    const row = r + offsetRow;
    const col = c + offsetCol;
    if (row >= 0 && row < size && col >= 0 && col < size) {
      grid[row * size + col] = 1;
    }
  }
  return grid;
};

let gameOfLifes: { [key: number]: number[] } = {};

// on clearCache event, reset gameOfLifes
window.addEventListener('message', (e) => 
    e.data.type === 'clearCache' && (gameOfLifes = {}))

const createEmptyGrid = (size: number) => new Array(size * size).fill(0);
const randomState = (size: number, sparsity: number = 0.8) => createEmptyGrid(size).map(() => Math.random() > sparsity ? 1 : 0);

const initGameOfLife = (size: number, startState: number = 0) => {
    const preset = startState % 18; // wrap around if startState is greater than number of presets
    switch (preset) {
        case 0: return randomState(size, .75);
        case 1: return randomState(size, .5);
        case 2: return placePattern(size, [[1,0],[1,1],[1,2]], { centerX: true, centerY: true });
        case 3: return placePattern(size, [[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]], { centerX: true, centerY: true });
        case 4: return placePattern(size, [[0,0],[0,1],[1,0],[1,1],[2,2],[2,3],[3,2],[3,3]], { centerX: true, centerY: true });
        case 5: return glider(size);
        case 6: return lwss(size);
        case 7: return pulsar(size);
        case 8: return rPentomino(size);
        case 9: return acorn(size);
        case 10: return diehard(size);
        case 11: return gosperGliderGun(size);
        case 12: return block();
        case 13: return beehive();
        case 14: return loaf();
        case 15: return blinker();
        case 16: return toad();
        case 17: return beacon();
        default: return randomState(size);
    }
}

const countAliveNeighbours = (grid: number[], size: number, x: number, y: number) => {
    const directions = [
        [-1,-1], [-1,0], [-1,1],
        [0, -1],         [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];
    let count = 0;
    for (const [dx, dy] of directions) {
        const nx = (x + dx + size) % size;
        const ny = (y + dy + size) % size;
        count += grid[nx * size + ny];
    }
    return count;
}

export const runGameOfLife = memoize((
    size: number = 16, 
    min: number = 0,
    startState: number = 0
) => {
    const grid = gameOfLifes[size] || initGameOfLife(size, startState);
    const newGrid = createEmptyGrid(size);
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const aliveNeighbours = countAliveNeighbours(grid, size, i, j);
            const idx = i * size + j;
            newGrid[idx] = grid[idx] === 1
                ? (aliveNeighbours === 2 || aliveNeighbours === 3 ? 1 : 0)
                : (aliveNeighbours === 3 ? 1 : 0); // consider changing this to === 3 to prevent overpopulation, but it seems to create more stable patterns with >=, so leaving for now. Could make this a parameter in the future.
        }
    }

    const minPopulation = Math.ceil(size * size * min);
    let population = newGrid.filter(Boolean).length;
    if (population < minPopulation) {
        const deadCells: number[] = [];
        for (let i = 0; i < size * size; i++)
            if (newGrid[i] === 0) deadCells.push(i);

        for (let k = population; k < minPopulation; k++) {
            const idx = deadCells.splice(Math.floor(Math.random() * deadCells.length), 1)[0];
            newGrid[idx] = 1;
        }
    }

    gameOfLifes[size] = newGrid;
    return newGrid;
});