import { immediate } from "tone";
import { formatParamKey } from "../oto/utils";

declare type Event = {id: string, params: Record<string, any>, time: number, type: string};

const satori = new BroadcastChannel('satori');

let ws: WebSocket;

export function init() {
    ws = new WebSocket('ws://localhost:8080')
    
    ws.onopen = () => satori.postMessage({ type: 'success', message: 'Connected to SuperSatori' })
    ws.onerror = () => satori.postMessage({ type: 'error', message: 'SuperSatori error' })
    ws.onclose = () => satori.postMessage({ type: 'error', message: 'SuperSatori disconnected' })
    ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        const synthdefs = Object.entries(data.synthdefs || {})
            // @ts-ignore
            .map(([name, def = {}]) => `${name}: ${Object.keys(def).join(', ')}`)

        switch (data.type) {
            case 'synthdefs':
                satori.postMessage({ type: 'success', message: 'SuperSatori synths -> \n' })
                synthdefs.forEach(synthdef => satori.postMessage({ type: 'info', message: synthdef }))
                break;
        }
    }

    return handler
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
    ws.send(JSON.stringify({
        ...event,
        delta: time - immediate(),
        params: Object.entries(event.params)
            .reduce((obj, [key, val]) => ({
                ...obj,
                // remove the _ prefix from all param keys as that's what the instruments expect
                [formatParamKey(key)]: val
            }), {})
    }))
}

export function handleMutation(event: Event, time: number) {
    ws.send(JSON.stringify({
        ...event,
        delta: time - immediate(),
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