import { immediate } from 'tone';
import { WebMidi, type Output } from 'webmidi';
import { formatCCParams } from './utils';
declare type Event = {id: string, params: Record<string, any>, time: number, type: string};

const satori = new BroadcastChannel('satori');

WebMidi.enable().then(() => satori.postMessage({ type: 'info', message: 'MIDI enabled' }));

// keep track of the devices and channels assigned to each stream
// this is because we can't use Output.clear(). See https://bugs.chromium.org/p/chromium/issues/detail?id=471798.
let streams: Record<string, { device: Output, channels?: number[] }> = {};

export function handler(event: Event, time: number) {
    const { params } = event;
    const { midi, midichan, mididelay = 0, amp = 0.5, n = 60, dur = 500, cut = [] } = params;
    
    // If no MIDI param, ignore
    if(midi === undefined) return

    const device = WebMidi.getOutputByName(midi) ?? WebMidi.outputs[midi]
    
    // If invalid MIDI device, error
    if(!device) return satori.postMessage({ 
        type: 'error', 
        message: 'Invalid MIDI device' 
    });

    // determine channels to play on
    const channels = midichan ? (Array.isArray(midichan) ? midichan : [+midichan]) : undefined;

    streams[event.id] = { device, channels };
    
    // playnote expects timestamp in ms from now
    const delta = time - immediate()
    const timestamp = (delta * 1000) + +mididelay;

    const options = {
        time: `+${timestamp}`,
        attack: +amp,
        duration: +dur,
        channels,
    }

    // send CC params
    Object.entries(formatCCParams(params))
        .forEach(([cc, val]) => 
            device.sendControlChange(+cc, +val, {...options, time: `+${timestamp}`}));

    // exit if a mutation
    if(event.type !== 'e') return;
    
    // trigger notes
    device.playNote(
        // remove null, undefined, and NaN values from n
        [n].flat().filter(n => n !== null && n !== undefined && !Number.isNaN(n)).map(n => +n),
        {...options, time: `+${timestamp}`}
    );

    // handle cut
    [cut || []].flat()
        .flatMap(c => c === 'all' ? Object.keys(streams) : c)
        // if integers, convert to strings - ie 0 becomes 's0'
        .map(c => typeof c === 'number' ? `s${c}` : c)
        // if c has a property called id, extract that
        .map(c => typeof c === 'object' && c.id ? c.id : c)
        // cut every note on the specified streams
        .forEach((id: string) => Array.from({ length: 128 }, (_, i) => i)
            .forEach(note => streams[id]?.device.stopNote(note, {
                ...options,
                time: `+${timestamp - 20}`,
                channels: streams[id]?.channels,
            })));   
}