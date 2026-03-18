import { getTransport } from 'tone';
import { scales } from './scales';
import { WebMidi } from 'webmidi';

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
    }
}