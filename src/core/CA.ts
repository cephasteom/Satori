import { memoize } from "./utils";

/**
 * Hold GOFs in state using their size as the key
 */
const gameOfLifes: { [key: number]: number[][] } = {};

const createEmptyGrid = (size: number) => 
    Array.from({ length: size }, () => Array(size).fill(0));

const initGameOfLife = (size: number) => {
    const grid = createEmptyGrid(size);
    // initialize with a random pattern
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            grid[i][j] = Math.random() > 0.5 ? 1 : 0; // 20% chance of being alive
        }
    }
    return grid;
}

const countAliveNeighbours = (grid: number[][], x: number, y: number) => {
    const directions = [
        [-1,-1], [-1,0], [-1,1],
        [0, -1],         [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];
    let count = 0;
    for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < grid.length && ny >= 0 && ny < grid[0].length) {
            count += grid[nx][ny];
        }
    }
    return count;
}

/**
 * Run a step of the Game of Life simulation.
 * Uses the size and time to memoize, so call using runGameOfLife(size, time) to allow multiple calls to it per time step without triggering multiple calculations.
 */
export const runGameOfLife = memoize((size: number = 16) => {
    const grid = gameOfLifes[size] || initGameOfLife(size);
    const newGrid = createEmptyGrid(size);
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const aliveNeighbours = countAliveNeighbours(grid, i, j);
            newGrid[i][j] = grid[i][j] === 1
                ? (aliveNeighbours === 2 || aliveNeighbours === 3 ? 1 : 0)
                : (aliveNeighbours === 3 ? 1 : 0);
        }
    }

    const minPopulation = Math.ceil(size * size * 0.1); // ensure at least 10% of cells are alive
    const population = newGrid.flat().filter(Boolean).length;
    if (population < minPopulation) {
        const deadCells: [number, number][] = [];
        for (let i = 0; i < size; i++)
            for (let j = 0; j < size; j++)
                if (newGrid[i][j] === 0) deadCells.push([i, j]);

        // randomly revive cells until we hit minPopulation
        for (let k = population; k < minPopulation; k++) {
            const [i, j] = deadCells.splice(Math.floor(Math.random() * deadCells.length), 1)[0];
            newGrid[i][j] = 1;
        }
    }

    gameOfLifes[size] = newGrid;
    return newGrid;
});