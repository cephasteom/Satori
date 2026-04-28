import { getDraw } from "tone";

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D | null = null;

function drawGrid(grid: number[]) {
    if (!ctx || !canvas) return;

    const gridSize = Math.sqrt(grid.length);
    const cellSize = canvas.width / gridSize;
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < grid.length; i++) {
        const col = i % gridSize;
        const row = Math.floor(i / gridSize);
        const alpha = Math.round(grid[i] * 255);

        const xStart = Math.round(col * cellSize);
        const yStart = Math.round(row * cellSize);
        const xEnd = Math.round((col + 1) * cellSize);
        const yEnd = Math.round((row + 1) * cellSize);

        for (let py = yStart; py < yEnd; py++) {
            for (let px = xStart; px < xEnd; px++) {
                const idx = (py * canvas.width + px) * 4;
                data[idx]     = 255; // R
                data[idx + 1] = 255; // G
                data[idx + 2] = 255; // B
                data[idx + 3] = alpha;
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

export const handler = (event: any, time: number) => {
    const grid: number[] = event.params.grid || [];
    getDraw().schedule(() => drawGrid(grid), time);
}

export const init = () => {
    canvas = document.querySelector('#satori-canvas') as HTMLCanvasElement;
    if (!canvas) return handler;

    ctx = canvas.getContext('2d');

    const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            const size = Math.round(Math.min(width, height));
            if (canvas.width !== size || canvas.height !== size) {
                canvas.width = size;
                canvas.height = size;
                ctx = canvas.getContext('2d'); // re-cache after resize clears the context
            }
        }
    });
    ro.observe(canvas);

    return handler;
}