import { getDraw, getTransport, immediate, Loop } from 'tone'
import { evaluate, compile } from "./compile";
import { setCurrentCycle } from './MidiInput';

const latency = 0; // seconds to schedule ahead

export class Satori {
    cps: number = 0.5;
    transport;
    divisions: number = 48; // how many times / cycle to query
    t: number = 0; // time pointer in cycles
    loop: Loop;

    constructor(handlers: Function[], canvasHandlers: Function[] = []) {
        this.transport = getTransport()
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
                .filter((hap: any) => Object.keys(hap.params).includes('cps'))
                .map((hap: any) => ({time: hap.time, value: hap.params.cps}));
            
            // handle global events
            global.forEach((hap: any) => {
                // update scheduler cps
                this.cps = hap.params.cps ? [hap.params.cps].flat()[0] : 0.5;
                // set transport bpm at the time of the event
                this.transport.bpm.setValueAtTime(240 * this.cps, time);
            });

            // handle stream events and mutations
            streams
                .filter((hap) => !hap.params.mute)
                .forEach((hap) => handlers.forEach(handler => handler(
                    {...hap, cps: this.cps}, 
                    time // time from transport
                    // add delta value from start of this tick, scaled by cps at that time
                    + (hap.time - from) / (cpsEvents.find(({time}: any) => time >= hap.time)?.value || this.cps) 
                    + latency
                )));

            // handle canvas events and mutations
            canvas
                .forEach((hap) => canvasHandlers.forEach(handler => handler(
                    {...hap, cps: this.cps}, 
                    time // time from transport
                    // add delta value from start of this tick, scaled by cps at that time
                    + (hap.time - from) / (cpsEvents.find(({time}: any) => time >= hap.time)?.value || this.cps) 
                    + latency
                )));

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

    evaluate(code: string) {
        // pass code to compile module
        evaluate(code);
    }
}