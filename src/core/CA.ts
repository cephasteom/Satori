import { memoize } from "./utils";

let gameOfLifes: { [key: number]: number[] } = {};
// on clearCache event, reset gameOfLifes
window.addEventListener('message', (e) => 
    e.data.type === 'clearCache' && (gameOfLifes = {}))

const createEmptyGrid = (size: number) => new Array(size * size).fill(0);

const initGameOfLife = (size: number) => {
    const grid = createEmptyGrid(size);
    for (let i = 0; i < size * size; i++) {
        grid[i] = Math.random() > 0.1 ? 1 : 0;
    }
    return grid;
}

const countAliveNeighbours = (grid: number[], size: number, x: number, y: number) => {
    const directions = [
        [-1,-1], [-1,0], [-1,1],
        [0, -1],         [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];
    let count = 0;
    for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            count += grid[nx * size + ny];
        }
    }
    return count;
}

export const runGameOfLife = memoize((size: number = 16, min: number = 0) => {
    const grid = gameOfLifes[size] || initGameOfLife(size);
    const newGrid = createEmptyGrid(size);
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const aliveNeighbours = countAliveNeighbours(grid, size, i, j);
            const idx = i * size + j;
            newGrid[idx] = grid[idx] === 1
                ? (aliveNeighbours === 2 || aliveNeighbours === 3 ? 1 : 0)
                : (aliveNeighbours >= 3 ? 1 : 0); // consider changing this to === 3 to prevent overpopulation, but it seems to create more stable patterns with >=, so leaving for now. Could make this a parameter in the future.
        }
    }

    const minPopulation = Math.ceil(size * size * min);
    const population = newGrid.filter(Boolean).length;
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