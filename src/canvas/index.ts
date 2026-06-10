import { getDraw } from "tone";

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D | null = null;

export type RenderMode = "blocky" | "bilinear" | "dots" | "blur";

function resolveGridDimensions(
    grid: number[] | number[][],
    cols?: number,
    rows?: number
): { flatGrid: number[]; gridCols: number; gridRows: number } {
    console.log(grid)
    const is2D = Array.isArray(grid[0]);
    let gridCols: number;
    let gridRows: number;
    let flatGrid: number[];

    if (is2D) {
        const grid2D = grid as number[][];
        gridCols = grid2D[0].length;
        gridRows = grid2D.length;
        flatGrid = grid2D.flat();
    } else {
        flatGrid = grid.flat();
        if (cols == null && rows == null) {
            gridCols = Math.round(Math.sqrt(flatGrid.length));
            gridRows = gridCols;
        } else if (cols != null && rows == null) {
            gridCols = cols;
            gridRows = Math.ceil(flatGrid.length / cols);
        } else if (cols == null && rows != null) {
            gridRows = rows;
            gridCols = Math.ceil(flatGrid.length / rows);
        } else {
            gridCols = cols!;
            gridRows = rows!;
        }
    }

    return { flatGrid, gridCols, gridRows };
}

function renderBlocky(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    flatGrid: number[],
    gridCols: number,
    gridRows: number
): void {
    const cellSize = Math.min(canvas.width / gridCols, canvas.height / gridRows);
    const xOffset = Math.round((canvas.width - cellSize * gridCols) / 2);
    const yOffset = Math.round((canvas.height - cellSize * gridRows) / 2);

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = 13; data[i + 1] = 13; data[i + 2] = 13; data[i + 3] = 255;
    }

    const totalCells = gridCols * gridRows;
    for (let i = 0; i < totalCells; i++) {
        const value = i < flatGrid.length ? flatGrid[i] : 0;
        const alpha = Math.round(value * 255);
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);
        const xStart = xOffset + Math.round(col * cellSize);
        const yStart = yOffset + Math.round(row * cellSize);
        const xEnd = xOffset + Math.round((col + 1) * cellSize);
        const yEnd = yOffset + Math.round((row + 1) * cellSize);

        for (let py = yStart; py < Math.min(yEnd, canvas.height); py++) {
            for (let px = xStart; px < Math.min(xEnd, canvas.width); px++) {
                const idx = (py * canvas.width + px) * 4;
                data[idx]     = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
                data[idx + 3] = alpha;
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function renderDots(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    flatGrid: number[],
    gridCols: number,
    gridRows: number
): void {
    const cellSize = Math.min(canvas.width / gridCols, canvas.height / gridRows);
    const xOffset = (canvas.width - cellSize * gridCols) / 2;
    const yOffset = (canvas.height - cellSize * gridRows) / 2;
    const maxRadius = cellSize * 0.5;

    ctx.fillStyle = "rgb(13,13,13)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const totalCells = gridCols * gridRows;
    for (let i = 0; i < totalCells; i++) {
        const value = i < flatGrid.length ? flatGrid[i] : 0;
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);
        const cx = xOffset + (col + 0.5) * cellSize;
        const cy = yOffset + (row + 0.5) * cellSize;
        const radius = maxRadius * value;

        if (radius < 0.5) continue;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.5 + value * 0.5})`;
        ctx.fill();
    }
}

/**
 * Draw Grid
 * @param grid   - a 1D or 2D array of values in the range [0, 1]
 * @param cols   - optional column count (inferred if omitted)
 * @param rows   - optional row count (inferred if omitted)
 * @param mode   - render mode: "blocky" | "bilinear" | "dots" | "blur" (default: "blocky")
 */
function drawGrid(
    grid: number[] | number[][],
    cols: number,
    rows: number,
    mode: RenderMode = "blocky"
): void {
    if (!ctx || !canvas) return;

    const { flatGrid, gridCols, gridRows } = resolveGridDimensions(grid, cols, rows);

    switch (mode) {
        case "dots":
            renderDots(ctx, canvas, flatGrid, gridCols, gridRows);
            break;
        case "blocky":
        default:
            renderBlocky(ctx, canvas, flatGrid, gridCols, gridRows);
            break;
    }
}

export const handler = (event: any, time: number) => {
    const grid: number[] = event.params.grid || [];
    const { cols, rows, mode } = event.params;
    const delay = event.params.delay || 0;
    getDraw().schedule(
        () => drawGrid(grid, cols, rows, mode as RenderMode),
        time + (delay / 1000)
    );
};

export const init = () => {
    canvas = document.querySelector("#satori-canvas") as HTMLCanvasElement;
    if (!canvas) return handler;

    ctx = canvas.getContext("2d");

    const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            const size = Math.round(Math.min(width, height));
            if (canvas.width !== size || canvas.height !== size) {
                canvas.width = size;
                canvas.height = size;
                ctx = canvas.getContext("2d");
            }
        }
    });
    ro.observe(canvas);

    return handler;
};