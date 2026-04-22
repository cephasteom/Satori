import { Stream, type Event } from './Stream';
import { Qubit, circuit, renderCircuit } from './Qubit';
import { methods } from './Pattern';
import { utilities } from './utils';
import { parseShorthand } from './parse';

let lastCode: string = ''; // last successfully evaluated code

// create streams
const global = new Stream('global');
const streams = Array(16).fill(0).map((_, i) => new Stream('s' + i))
const fxStreams = Array(4).fill(0).map((_, i) => new Stream('fx' + i))
const qubits = Array(16).fill(0).map((_, i) => new Qubit(i));

export const reset = () => {
    [global, ...streams, ...fxStreams, ...qubits].forEach(c => c.__reset());
    circuit.clear();
}

const channel = new BroadcastChannel('satori');

// everything the user should be able to access in their code
const scope = {
    streams,
    fxStreams,
    ...[
        ...streams, 
        ...fxStreams, 
        global
    ].reduce((obj, stream) => ({
        ...obj,
        [stream.id]: stream
    }), {}),
    qubits,
    ...qubits.reduce((obj, qubit) => ({
        ...obj,
        [qubit._id]: qubit
    }), {}),
    ...methods,
    ...utilities,
}

/**
 * Evaluate user code within a controlled scope. If an error occurs, the last successfully evaluated code is re-applied.
 * @param code - The user code to evaluate.
 */
export function evaluate(code: string) {
    try {
        // Reset all streams before evaluating new code
        reset();

        // fire resetCache event to clear any memoized functions
        window.postMessage({ type: 'clearCache' }, '*');

        // Evaluate the user code within the defined scope
        new Function(...Object.keys(scope), `${parseShorthand(code)}`)(...Object.values(scope));
        // Store the last successfully evaluated code
        lastCode = code;

        // run the circuit based on its current configuration
        circuit.run();

        // render circuit in the UI
        renderCircuit();

        // broadcast the new state of the world for anyone who wants to consume it (like the editor for live code updates, or a visualizer)
        window.dispatchEvent(new CustomEvent('stateUpdate', {
            detail: {
                code,
                qasm: circuit.exportToQASM(),
                qiskit: circuit.exportToQiskit(),
            }
        }));
        
    } catch (e: any) {
        // if we have a last successfully evaluated code, re-evaluate it
        lastCode && evaluate(lastCode);
        // and broadcast the error for anyone who wants to consume it
        channel.postMessage({ type: 'error', message: e.message } );
    }
}

/**
 * Listen for 'evaluateCode' events from the editor and evaluate the code
 */
window.addEventListener("evaluateCode", (e) => {
    const customEvent = e as CustomEvent<{ code: string }>;
    evaluate(customEvent.detail.code);
});

/**
 * Compile current code into a list of events and mutations between the specified time range.
 * @param from - The start time in cycles.
 * @param to - The end time in cycles.
 * @returns An object containing global events and stream-specific events and mutations.
 */ 
export const compile = (from: number, to: number) => {
    
    // build circuits, applying dynamic parameters
    qubits.forEach(qubit => qubit.build(from, to));

    return {
        // at the global level, we are only interested in events (at least for now)
        global: global.query(from, to).events,
        // at the stream level, we want events and mutations
        streams: [...streams, ...fxStreams].reduce((compiled, stream) => {
            const { events, mutations } = stream.query(from, to);
            return [
                ...compiled,
                ...events,
                ...mutations
            ]
        }, [] as Event[]),
    }
}