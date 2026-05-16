import { getDraw } from "tone";

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D | null = null;

/**
 * 
 * @param grid 
 * @param cols 
 * @param rows
 * @returns 
 */
function drawGrid(grid: number[], cols?: number, rows?: number) {
    if (!ctx || !canvas) return;

    let gridCols: number;
    let gridRows: number;

    if (cols == null && rows == null) {
        gridCols = Math.round(Math.sqrt(grid.length));
        gridRows = gridCols;
    } else if (cols != null && rows == null) {
        gridCols = cols;
        gridRows = Math.ceil(grid.length / cols);
    } else if (cols == null && rows != null) {
        gridRows = rows;
        gridCols = Math.ceil(grid.length / rows);
    } else {
        gridCols = cols!;
        gridRows = rows!;
    }

    // Cells are always square; derive size from column count
    const cellSize = canvas.width / gridCols;

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    const totalCells = gridCols * gridRows;

    for (let i = 0; i < totalCells; i++) {
        const value = i < grid.length ? grid[i] : 0;
        const alpha = Math.round(value * 255);

        const col = i % gridCols;
        const row = Math.floor(i / gridCols);

        const xStart = Math.round(col * cellSize);
        const yStart = Math.round(row * cellSize);
        const xEnd = Math.round((col + 1) * cellSize);
        const yEnd = Math.round((row + 1) * cellSize);

        for (let py = yStart; py < Math.min(yEnd, canvas.height); py++) {
            for (let px = xStart; px < Math.min(xEnd, canvas.width); px++) {
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
    const { cols, rows } = event.params;
    const delay = event.params.delay || 0;
    getDraw().schedule(() => drawGrid(grid, cols, rows), time + (delay / 1000));
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
                ctx = canvas.getContext('2d');
            }
        }
    });
    ro.observe(canvas);

    return handler;
}