import { formatParamKey } from "../oto/utils";
import { SyncClient } from "./SyncClient";

declare type Event = {id: string, params: Record<string, any>, time: number, type: string};

const satori = new BroadcastChannel('satori');

// how long to wait for SuperSatori to respond before assuming it isn't running
const CONNECT_TIMEOUT = 1000;

let ws: WebSocket;
// tracks this client's offset/drift against SuperSatori's SC SystemClock, so
// event times can be translated from AudioContext domain into that domain
let sync: SyncClient;

/**
 * Try to connect to SuperSatori on load. Resolves with the event handler if
 * SuperSatori is found within CONNECT_TIMEOUT, or null otherwise, so the
 * caller can decide whether to use it as the synth engine.
 */
export function connect(): Promise<Function | null> {
    return new Promise((resolve) => {
        ws = new WebSocket('ws://localhost:8080');
        let settled = false;

        const fail = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            satori.postMessage({ type: 'info', message: 'No SuperSatori found, using default synth engine' });
            resolve(null);
        };
        const timer = setTimeout(fail, CONNECT_TIMEOUT);

        ws.onopen = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            sync = new SyncClient(ws);
            satori.postMessage({ type: 'success', message: 'Connected to SuperSatori, using as synth engine' });
            resolve(handler);
        };
        ws.onerror = fail;
        ws.onclose = () => {
            // if we haven't resolved yet, treat close as a failed connection attempt
            if (!settled) return fail();
            satori.postMessage({ type: 'error', message: 'SuperSatori disconnected' });
        };
        ws.onmessage = (message) => {
            const data = JSON.parse(message.data);

            switch (data.type) {
                case 'syncReply':
                    sync.handleReply(data);
                    break;
                case 'synthdefs': {
                    const synthdefs = Object.entries(data.synthdefs || {})
                        // @ts-ignore
                        .map(([name, def = {}]) => `${name}: ${Object.keys(def).join(', ')}`)
                    satori.postMessage({ type: 'success', message: 'SuperSatori synths -> \n' })
                    synthdefs.forEach(synthdef => satori.postMessage({ type: 'info', message: synthdef }))
                    break;
                }
            }
        }
    });
}

export function handler(event: Event, time: number) {
    // if no WebSocket connection, ignore
    if(ws.readyState !== WebSocket.OPEN) return
    switch (event.type) {
        case 'e': return handleEvent(event, time);
        case 'm': return handleMutation(event, time);
    }
}

export function handleEvent(event: Event, time: number) {
    const params = Object.entries(event.params)
        .reduce((obj, [key, val]) => ({
            ...obj,
            // remove the _ prefix from all param keys as that's what the instruments expect
            [formatParamKey(key)]: val
        }), {} as Record<string, any>);
    
    const { inst, n, freq } = params;
    if(
        inst !== undefined
        && (n === undefined || Array.isArray(n) && n.length === 0)
        && (freq === undefined || Array.isArray(freq) && freq.length === 0)
    ) return; // if using an instrument, and no note param, ignore
    
    ws.send(JSON.stringify({
        ...event,
        atTime: sync.audioTimeToScTime(time),
        params
    }))
}

export function handleMutation(event: Event, time: number) {
    ws.send(JSON.stringify({
        ...event,
        atTime: sync.audioTimeToScTime(time),
        params: Object.entries(event.params)
            // only mutate params that are prefixed with '_'
            .filter(([key, _]) => key.startsWith('_'))
            // remove the _ prefix from all param keys as that's what the instruments expect
            .reduce((obj, [key, val]) => ({
                ...obj,
                [formatParamKey(key)]: val
            }), {})
    }))
}