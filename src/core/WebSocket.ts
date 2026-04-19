import { evaluate } from './compile';
import { store } from './data';

const satori = new BroadcastChannel('satori');

let ws: WebSocket;

export function init(port: number = 5000) {
    // open WebSocket connection
    ws = new WebSocket('ws://localhost:' + port)

    // handle WebSocket events 
    ws.onopen = () => satori.postMessage({ type: 'success', message: 'Opened WebSocket connection ' + ws.url })
    ws.onerror = () => satori.postMessage({ type: 'error', message: 'Error with WebSocket connection ' + ws.url })
    ws.onclose = () => satori.postMessage({ type: 'error', message: 'WebSocket connection closed ' + ws.url })
    ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        satori.postMessage({ type: 'info', message: `WebSocket message received: ${data.type}` })
        switch (data.type) {
            // evaluate code received over WebSocket connection
            case 'code':
                evaluate(data.code);
                break;
            // add data received over WebSocket connection to local storage for retrieval by Pattern.data()
            case 'data': 
                store(data.key, data.value);
                break;
        }
    }
        
    // listen out for stateUpdate events on the window and broadcast them over the WebSocket connection for anyone who wants to consume them 
    window.addEventListener('message', (event) => {
        if(
            event.data?.type === 'stateUpdate' 
            && ws.readyState === WebSocket.OPEN
        ) {
            console.log('Broadcasting state update over WebSocket', event.data.state);
            ws.send(JSON.stringify({
                type: 'stateUpdate',
                state: event.data.state,
            }))
        }
    })
}