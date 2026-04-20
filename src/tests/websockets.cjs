const { WebSocketServer } = require('ws');

const port = 5001
const wss = new WebSocketServer({ port });

wss.on('connection', (ws) => {
    console.log('Connected');

    ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        // listen out for state updates
        if (message.type === 'stateUpdate') {
            // and print to the console
            console.log('stateUpdate:', message.state);

            // send back basic data for Satori
            ws.send(JSON.stringify({ type: 'data', key: 'foo', value: 'bar' }));
        }
    });

    ws.on('close', () => console.log('Disconnected'));
});

console.log('Listening on ws://localhost:' + port)