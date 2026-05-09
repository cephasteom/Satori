const levels: { [key: string]: number } = {}

export function updateLevel(id: string, value: number) {
    levels[id] = value < 0.001 ? 0 : value; // treat very low values as 0 to avoid floating point issues
}

export function getLevel(id: string) {
    // send custom event to trigger level update before returning value
    window.dispatchEvent(new CustomEvent('meter', { detail: { id, shouldMeter: true } }))
    return levels[id] || 0;
}

export function clearLevels() {
    Object.keys(levels).forEach(key => {
        // send custom event to cancel any pending meter updates for this channel
        window.dispatchEvent(new CustomEvent('meter', { detail: { id: key, shouldMeter: false } }))
        delete levels[key];
    });
}

const satori = new BroadcastChannel('satori');

// listen for level updates from channels and update our levels object accordingly
satori.addEventListener('message', (event) => {
    if (event.data.type === 'meter') {
        const { id, level } = event.data;
        updateLevel(id, level);
    }
});