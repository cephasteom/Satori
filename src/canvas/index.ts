import { getDraw } from "tone";

let canvas: HTMLCanvasElement;

function drawGrid(grid: number[]) {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // get square root of grid length to determine grid dimensions
    const gridSize = Math.sqrt(grid.length);
    const cellSize = canvas.width / gridSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    grid.forEach((value, index) => {
        const x = (index % gridSize) * cellSize;
        const y = Math.floor(index / gridSize) * cellSize;

        ctx.fillStyle = `rgba(255, 255, 255, ${value})`;
        ctx.fillRect(x, y, cellSize, cellSize);
    });
}

export const handler = (event: any, time: number) => {
    const grid: number[] = event.params.grid || [];
    getDraw().schedule(() => drawGrid(grid), time);
}

export const init = () => {
    canvas = document.querySelector('#satori-canvas') as HTMLCanvasElement;
    if (!canvas) return handler;

    const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            const size = Math.round(Math.min(width, height));
            if (canvas.width !== size || canvas.height !== size) {
                canvas.width = size;
                canvas.height = size;
            }
        }
    });
    ro.observe(canvas);

    return handler;
}
