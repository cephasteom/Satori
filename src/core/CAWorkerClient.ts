import { initGameOfLife } from './CA';

// How many frames to keep ahead of consumption
const LOOKAHEAD = 8;
// Request a refill when buffer drops to this level
const REFILL_AT = 4;

type FrameKey = string; // `${caIndex}-${size}`

class CAWorkerClient {
    private worker: Worker;
    private buffers = new Map<FrameKey, Uint8Array[]>();
    private initialized = new Set<FrameKey>();
    private lastResult = new Map<FrameKey, { from: number; frame: Uint8Array }>();

    constructor() {
        this.worker = new Worker(new URL('./ca.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = ({ data }: MessageEvent) => {
            const { key, frames } = data as { key: string; frames: ArrayBuffer[] };
            const buf = this.buffers.get(key) ?? [];
            for (const ab of frames) buf.push(new Uint8Array(ab));
            this.buffers.set(key, buf);
        };
        this.worker.onerror = (e: ErrorEvent) => console.error('[CAWorker]', e.message);
    }

    getFrame(
        caIndex: number,
        size: number,
        min: number,
        preset: number,
        reset: number,
        from: number,
    ): Uint8Array {
        const key: FrameKey = `${caIndex}-${size}`;

        // Dedup: same from within the same scheduling pass returns the same frame
        const last = this.lastResult.get(key);
        if (!reset && last?.from === from) return last.frame;

        if (reset || !this.initialized.has(key)) {
            return this.initialize(key, caIndex, size, min, preset, from);
        }

        const buf = this.buffers.get(key) ?? [];
        const frame = buf.shift();

        if (buf.length < REFILL_AT) {
            this.worker.postMessage({
                type: 'compute',
                key,
                caIndex,
                size,
                min,
                count: LOOKAHEAD - buf.length,
            });
        }

        if (!frame) {
            // Buffer temporarily empty — repeat last known frame rather than stalling
            return last?.frame ?? new Uint8Array(size * size);
        }

        const result = { from, frame };
        this.lastResult.set(key, result);
        return frame;
    }

    private initialize(
        key: FrameKey,
        caIndex: number,
        size: number,
        min: number,
        preset: number,
        from: number,
    ): Uint8Array {
        const initGrid = new Uint8Array(initGameOfLife(size, preset));
        this.initialized.add(key);
        this.buffers.set(key, []);
        this.lastResult.delete(key);

        // Send a copy to the worker so both sides start from identical state
        const copy = initGrid.buffer.slice(0);
        this.worker.postMessage(
            { type: 'init', key, caIndex, size, min, initGrid: copy, count: LOOKAHEAD },
            { transfer: [copy] },
        );

        this.lastResult.set(key, { from, frame: initGrid });
        return initGrid;
    }

    dispose(): void {
        this.worker.terminate();
    }
}

export const caWorkerClient = new CAWorkerClient();
