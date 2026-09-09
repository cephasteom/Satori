import { getTransport } from 'tone';
import { scales } from './scales';
import { WebMidi } from 'webmidi';
import { clear as clearStore, keys, store } from './data';
import { loadSamples } from '../oto/samples';

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

// read a value out of a scalar/1D/2D structure at the given path, as produced by mapValue's callback
export function readPath(value: any, path: number[]): any {
    return path.reduce((acc, i) => acc?.[i], value);
}

// Applies callback to each element of value, preserving scalar/1D/2D shape.
// A 1-element array result collapses back to a scalar (matches unwrapArray's contract).
// path identifies the element's position ([], [i], or [r, c]) so callbacks can compare
// against the same position in another same-shaped value (e.g. a previous hap's value).
export function mapValue<T, R>(value: any, callback: (v: T, path: number[]) => R): any {
    if (Array.isArray(value) && Array.isArray(value[0])) {
        return value.map((row: T[], r: number) => row.map((v, c) => callback(v, [r, c])));
    }
    if (Array.isArray(value)) {
        return unwrapArray(value.map((v: T, i: number) => callback(v, [i])));
    }
    return callback(value, []);
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
    cols?: number
): number[][] => {
    if ((data as any)[0]?.length) return data as number[][];

    const flat = data as number[] | Uint8Array;
    const gridCols = cols ?? (rows ? Math.ceil(flat.length / rows) : Math.round(Math.sqrt(flat.length)));
    const gridRows = rows ?? Math.ceil(flat.length / gridCols);

    return Array.from({ length: gridRows }, (_, i) =>
        Array.from({ length: gridCols }, (_, j) => flat[i * gridCols + j] ?? 0)
    );
};

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
        channel.postMessage({ type: 'info', message: 'synth, sampler, granular, acid, tone.synth, tone.am, tone.fm, tone.mono, faust.fm, faust.pad, faust.karplus, faust.noiseres, faust.kick, faust.snare, faust.hihat' } );
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
    load: loadSamples,
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