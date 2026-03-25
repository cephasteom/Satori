import { getDraw } from "tone";
import { formatParamKey } from "../oto/utils";

declare type Event = {id: string, params: Record<string, any>, time: number, type: string};

const satori = new BroadcastChannel('satori');

let ws: WebSocket;

export function init() {
    ws = new WebSocket('ws://localhost:8080')
    
    ws.onopen = () => satori.postMessage({ type: 'info', message: 'Connected to SuperSatori' })
    ws.onerror = e => satori.postMessage({ type: 'error', message: 'SuperSatori error', details: e })
    ws.onclose = () => satori.postMessage({ type: 'warn', message: 'SuperSatori disconnected' })

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
    const formattedEvent = {
        ...event,
        params: Object.entries(event.params).reduce((obj, [key, val]) => ({
            ...obj,
            // remove the _ prefix from all param keys as that's what the instruments expect
            [formatParamKey(key)]: val
        }), {})
    }
    // send event to SuperSatori via WebSocket
    getDraw().schedule(() => ws.send(JSON.stringify(formattedEvent)), time);
}

export function handleMutation(event: Event, time: number) {

    const formattedMutation = {
        ...event,
        params: Object.entries(event.params)
            // only mutate params that are prefixed with '_'
            .filter(([key, _]) => key.startsWith('_'))
            // remove the _ prefix from all param keys as that's what the instruments expect
            .reduce((obj, [key, val]) => ({
                ...obj,
                [formatParamKey(key)]: val
            }), {})
    }
    // send mutation to SuperSatori via WebSocket
    getDraw().schedule(() => ws.send(JSON.stringify(formattedMutation)), time);
}