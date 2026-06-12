import { getDraw, getTransport, immediate, Loop, now } from 'tone'
import { evaluate, compile } from "./compile";
import { setCurrentCycle } from './MidiInput';

const latency = 0; // seconds to schedule ahead

export class Satori {
    cps: number = 0.5;
    transport;
    divisions: number = 48; // how many times / cycle to query
    t: number = 0; // time pointer in cycles
    loop: Loop;
    handlers: Function[]

    constructor(handlers: Function[], canvasHandlers: Function[] = []) {
        this.transport = getTransport()
        this.handlers = handlers
        this.loop = new Loop(time => {
            const from = this.t;
            const to = this.t + (1 / this.divisions);

            // if the first tick, send a sync event to the engine
            if(from === 0) handlers.forEach(handler => handler({type: 'sync'}, time));

            // compile code between from and to
            const { global, streams, canvas } = compile(from, to);
            
            // update current cycle for use in Pattern queries
            getDraw().schedule(() => setCurrentCycle(from), time);
            
            // extract cps changes
            const cpsEvents = global
                .filter((hap: any) => 'cps' in hap.params)
                .map((hap: any) => ({time: hap.time, value: isNaN(hap.params.cps) ? 0.5 : hap.params.cps}));
            
            // handle global events
            global.forEach((hap: any) => {
                // update scheduler cps
                this.cps = hap.params.cps ? (Array.isArray(hap.params.cps) ? hap.params.cps[0] : hap.params.cps) : 0.5;
                // set transport bpm at the time of the event
                this.transport.bpm.setValueAtTime(240 * this.cps, time);
            });

            // handle stream events and mutations
            streams
                .filter((hap) => !hap.params.mute)
                .forEach((hap) => {
                    const effectiveCps = [cpsEvents.find(({ time: t }) => t >= hap.time)?.value].flat()[0] ?? this.cps;
                    const hapTime = time + (hap.time - from) / effectiveCps + latency;
                    const enriched = { ...hap, cps: this.cps };
                    handlers.forEach(handler => handler(enriched, hapTime));
                });

            // handle canvas events and mutations
            canvas
                .forEach((hap) => {
                    const effectiveCps = cpsEvents.find(({ time: t }) => t >= hap.time)?.value ?? this.cps;
                    const hapTime = time + (hap.time - from) / effectiveCps + latency;
                    const enriched = { ...hap, cps: this.cps };
                    canvasHandlers.forEach(handler => handler(enriched, hapTime));
                });

            // update time pointer for next tick
            this.t = to;

        }, `${this.divisions}n`).start(0);
    }
    
    play() {
        this.transport.start('+0.1');
    }

    stop() {
        // reset time pointer
        this.t = 0;
        this.transport.stop(immediate())
    }

    cut() {
        this.handlers.forEach(handler => handler({type: 'cut'}, now()));
    }

    evaluate(code: string) {
        // pass code to compile module
        evaluate(code);
    }
}