import PartySocket from 'partysocket';

const PARTYKIT_HOST = 'grabbed-dawn.cephasteom.partykit.dev';
const channel = new BroadcastChannel('satori');

export function initCollab(room: string, setCode: (code: string) => void) {
    const clientId = Math.random().toString(36).slice(2);
    let suppressSend = false;

    const socket = new PartySocket({ host: PARTYKIT_HOST, room });

    socket.onopen = () => channel.postMessage({ type: 'success', message: `Collab connected — room: ${room}` });
    socket.onerror = () => channel.postMessage({ type: 'error', message: 'Collab connection error' });
    socket.onclose = () => channel.postMessage({ type: 'info', message: 'Collab connection closed' });

    socket.onmessage = (e) => {
        let data: any;
        try {
            data = JSON.parse(e.data.slice(e.data.indexOf(': ') + 2));
        } catch {
            return;
        }
        console.log(data);
        if (data.type === 'code' && data.clientId !== clientId) {
            suppressSend = true;
            setCode(data.code);
            suppressSend = false;
        }
    };

    let debounce: ReturnType<typeof setTimeout>;
    const sendCode = (code: string) => {
        if (suppressSend) return;
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            socket.send(JSON.stringify({ type: 'code', code, clientId }));
        }, 100);
    };

    return { sendCode };
}
