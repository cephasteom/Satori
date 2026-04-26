import { start } from 'tone';
import { Channel, channels } from './Channel';
import { formatParamKey } from './utils';

declare type Event = {id: string, params: Record<string, any>, time: number, type: string};
const satori = new BroadcastChannel('satori');

export function init() {
    window.addEventListener('keydown', startAudio)
    window.addEventListener('click', startAudio)
    window.addEventListener('touchstart', startAudio)
    return handler
}

async function startAudio() {
    await start()
    satori.postMessage({ type: 'info', message: 'Started audio' });
    window.removeEventListener('keydown', startAudio)
    window.removeEventListener('click', startAudio)
    window.removeEventListener('touchstart', startAudio)
}

export function handler(event: Event, time: number) {
    switch (event.type) {
        case 'e': return handleEvent(event, time);
        case 'm': return handleMutation(event, time);
    }    
}

/**
 * Handle event to play notes
 * @param event 
 * @param time 
 */
function handleEvent(event: Event, time: number) {
    const { id, params } = event;
    const { out = 0, strum = 0, cutr = 25 } = params;
    
    // remove the _ prefix from all param keys
    const formatted: Record<string, any> = Object.entries(params)
        .reduce((obj, [key, val]) => ({
            ...obj,
            [formatParamKey(key)]: val
        }), {});

    // cut specified channels, or all if 'all' is specified
    [formatted.cut !== undefined ? formatted.cut : []].flat()
        .flatMap(c => c === 'all' ? Object.keys(channels) : c)
        // if integers, convert to strings - ie 0 becomes 's0'
        .map(c => typeof c === 'number' ? `s${c}` : c)
        // if c has a property called id, extract that
        .map(c => typeof c === 'object' && c.id ? c.id : c)
        .forEach((id: string) => channels[id]?.cut(time, Math.floor(cutr) || 25));
    
    // initialize channel if it doesn't exist
    channels[id] = channels[id] || new Channel(id, out);
    
    // play notes - handle polyphony if n is an array
    [formatted.n || 60].flat()
        .filter(Boolean)
        .forEach((n: number, noteIndex: number) => {
            channels[id].play({
                ...Object.entries(formatted)
                    .reduce((obj, [key, val]) => ({
                        ...obj,
                        // handle polyphonic params
                        [key]: Array.isArray(val) ? val[noteIndex%val.length] : val
                    }), {}),
                n
            }, time + ((strum/1000) * noteIndex));
        })
}

/**
 * Handle mutation event, mutating any params that are prefixed with '_'
 * @param mutation 
 * @param time 
 */
function handleMutation(mutation: Event, time: number) {
    const { params, id } = mutation;
    channels[id]?.mutate(
        Object.entries(params)
            // only mutate params that are prefixed with '_'
            .filter(([key, _]) => key.startsWith('_'))
            // remove the _ prefix from all param keys as that's what the instruments expect
            .reduce((obj, [key, val]) => ({
                ...obj,
                [formatParamKey(key)]: Array.isArray(val) ? val[0] : val
            }), {}),
        time,
        params.lag
    );
}