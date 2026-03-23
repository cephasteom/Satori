import { WebMidi } from 'webmidi';
// import { getTransport } from "tone";

type RecordedNote = { from: number; to: number; n: number; amp: number };

type LoopState = {
    notes: RecordedNote[];
    activeNotes: Map<number, { from: number; amp: number }>;
    isRecording: boolean;
    loopLen: number;
    listenerAttached: boolean;
};

const STORAGE_KEY = 'satori:midiloop';

function saveToStorage() {
    const data: Record<string, RecordedNote[]> = {};
    loopStates.forEach((state, key) => { data[key] = state.notes; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromStorage(): Record<string, RecordedNote[]> {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
        return {};
    }
}

// export function toneTimeToPosition(toneTime: string): number {
//     const [bars, quarters, sixteenths] = toneTime.split(':').map(Number);
//     const beats = 1 / 4 * quarters;
//     const divisions = Math.floor(sixteenths) / 16;
//     return bars + beats + divisions;
// }

// export function getPosition() : number {
//     const toneTime = getTransport().position as string;
//     return toneTimeToPosition(toneTime);
// }

// Persistent note registry — survives code re-evaluations
const loopStates: Map<string, LoopState> = new Map();

// Restore saved notes on startup
const saved = loadFromStorage();
Object.entries(saved).forEach(([key, notes]) => {
    loopStates.set(key, {
        notes,
        activeNotes: new Map(),
        isRecording: false,
        loopLen: 1,
        listenerAttached: false,
    });
});

// Current scheduler cycle position — updated by Satori each tick
export let currentCycle = 0;
export function setCurrentCycle(t: number) {
    currentCycle = t;
}

function getOrCreate(key: string): LoopState {
    if (!loopStates.has(key)) {
        loopStates.set(key, {
            notes: [],
            activeNotes: new Map(),
            isRecording: false,
            loopLen: 1,
            listenerAttached: false,
        });
    }
    return loopStates.get(key)!;
}

/**
 * Called from the Pattern query each tick to sync recording/clear state.
 * Returns the current loop state for use in the query.
 */
export function syncLoopState(
    key: string,
    isRecording: boolean,
    loopLen: number,
    shouldClear: boolean
): LoopState {
    const state = getOrCreate(key);
    state.isRecording = isRecording;
    state.loopLen = loopLen;

    if (shouldClear) {
        state.notes = [];
        state.activeNotes.clear();
        saveToStorage();
    }

    return state;
}

/**
 * Attach note-on / note-off listeners to the given MIDI input device and channel.
 * Safe to call multiple times — listeners are only attached once per key.
 */
export function setupInputListener(deviceName: string, channel: number) {
    const key = `${deviceName}:${channel}`;
    const state = getOrCreate(key);
    if (state.listenerAttached) return;

    const attach = () => {
        const input = WebMidi.getInputByName(deviceName) ?? WebMidi.inputs[+deviceName];
        if (!input) return;

        input.addListener('noteon', (e) => {
            const s = loopStates.get(key);
            if (!s?.isRecording) return;

            const n = e.note.number;
            // @ts-ignore
            const amp = e.velocity;
            s.activeNotes.set(n, { from: currentCycle % s.loopLen, amp });
        }, { channels: [channel] });

        input.addListener('noteoff', (e) => {
            const s = loopStates.get(key);
            if (!s) return;

            const n = e.note.number;
            if (!s.activeNotes.has(n)) return;

            const { from, amp } = s.activeNotes.get(n)!;
            s.activeNotes.delete(n);

            const to = currentCycle % s.loopLen;
            s.notes.push({ from, to, n, amp });
            saveToStorage();
        }, { channels: [channel] });

        state.listenerAttached = true;
    };

    WebMidi.enabled ? attach() : WebMidi.enable().then(attach);
}
