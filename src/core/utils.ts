import { getTransport } from 'tone';
import { scales } from './scales';
import { WebMidi } from 'webmidi';
import { clear as clearStore, keys, store } from './data';

const channel = new BroadcastChannel('satori');

// memoize multiple argument function - use sparingly as we're creating strings as keys
export function memoize(fn: (...args: any[]) => any) {
    let cache: Record<string, any> = {};
    
    // on clearCache event, reset cache
    window.addEventListener('message', (e) => 
        e.data.type === 'clearCache' && (cache = {}))

    return (...args: any[]) => {
        let n = args.map(a => JSON.stringify(a)).join('-');
        return n in cache 
            ? cache[n]
            : (cache[n] = fn(...args));
        }
    }

export function cyclesPerSecond(): number {
    const transport = getTransport();
    const bpm = transport.bpm.value;
    return bpm / 60 / 4;
}

export function transposeOctave(note: number, octaves: number): number {
    return note + (octaves * 12);
}

export function formatCCParams(params: Record<string, any>): Record<string, any> {
    return Object.entries(params)
        .filter(([key, val]) => key.startsWith('cc') && val !== undefined)
        .reduce((obj, [key, val]) => ({
            ...obj,
            [+key.replace('cc', '')]: Math.floor(val * 127)
        }), {});
}

// a function which checks if a value is an array. If it is and is only has one item, return that item
export function unwrapArray(value: any): any {
    return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

// a function that can flatten different types of lists
export const flatten = (data: Uint8Array | Uint8Array[] | number[] | number[][]): Uint8Array => {
    if (data instanceof Uint8Array) return data;
    if (data.length === 0) return new Uint8Array();
    if (data[0] instanceof Uint8Array)
        return new Uint8Array((data[0] as Uint8Array).buffer, (data[0] as Uint8Array).byteOffset, (data as Uint8Array[]).reduce((acc, row) => acc + row.length, 0));
    const flat = (data as number[] | number[][]).flat(2);
    return Uint8Array.from(flat as number[]);
}

export const to2D = (
    data: Uint8Array | Uint8Array[] | number[] | number[][], 
    rows?: number, 
    cols?: number): any => {
    // if (data[0].length) return data
    let gridCols: number;
    let gridRows: number;
    const is2D = data[0]?.length

    if (is2D) {
        return data
    } else if (cols == null && rows == null) {
        // assume a perfect square
        gridCols = Math.round(Math.sqrt(data.length));
        gridRows = gridCols;
    } else if (cols != null && rows == null) {
        // best fit based on cols
        gridCols = cols;
        gridRows = Math.ceil(data.length / cols);
    } else if (cols == null && rows != null) {
        // best fit based on rows
        gridRows = rows;
        gridCols = Math.ceil(data.length / rows);
    } else {
        gridCols = cols!;
        gridRows = rows!;
    }

    let arr = []
    for (let i = 0; i < gridRows; i++) {
        arr[i] = []
    }
    for (let i = 0; i < gridCols; i++) {
        arr[Math.floor(i/gridCols)] = data[i]
    }

    return data
}

let samplesMessage = '';
channel.addEventListener('message', (e) => samplesMessage = e.data.type === 'samples' 
    ? e.data.message 
    : samplesMessage);

// Utility functions accessible in user code
export const utilities = {
    scales: () => {
        channel.postMessage({ type: 'success', message: 'Scales ->\n' });
        channel.postMessage({ type: 'info', message: Object.keys(scales).join(', ') } );
    },
    print: (message: any) => {
        channel.postMessage({ type: 'credit', message: String(message) } );
    },
    clear: () => {
        channel.postMessage({ type: 'clear' } );
    },
    instruments: () => {
        channel.postMessage({ type: 'success', message: 'Instruments ->\n' });
        channel.postMessage({ type: 'info', message: 'synth, sampler, granular, acid, tone.synth, tone.am, tone.fm, tone.mono' } );
    },
    effects: () => {
        channel.postMessage({ type: 'success', message: 'Effects ->\n' });
        channel.postMessage({ type: 'info', message: 'reverb, delay, dist, hpf, lpf' } );
    },
    midi: () => {
        channel.postMessage({ type: 'success', message: 'MIDI ins ->\n' });
        channel.postMessage({ type: 'info', message: WebMidi.inputs.map(i => i.name).join(', ') } );
        channel.postMessage({ type: 'success', message: 'MIDI outs ->\n' });
        channel.postMessage({ type: 'info', message: WebMidi.outputs.map(i => i.name).join(', ') } );
    },
    samples: () => {
        channel.postMessage({ type: 'success', message: 'Sample banks ->\n' });
        channel.postMessage({ type: 'samples', message: samplesMessage } );
    },
    store,
    stored: () => {
        const ks = keys();
        if(ks.length === 0) {
            channel.postMessage({ type: 'info', message: 'No stored data.' } );
            return;
        }

        channel.postMessage({ type: 'success', message: 'Data keys ->\n' });
        channel.postMessage({ type: 'info', message: ks.join(', ') } ); 
    },
    clearStore: () => {
        clearStore();
        channel.postMessage({ type: 'success', message: 'Clearing stored data...' });
    },

}