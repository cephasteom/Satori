import { getDraw } from "tone";

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
    console.log('Sending event to SuperSatori:', event);
    getDraw().schedule(() => ws.send(JSON.stringify(event)), time);
}