import { getTransport, immediate, Loop } from 'tone'
import { evaluate, compile } from "./compile";
import { setCurrentCycle } from './MidiInput';

const latency = 0.1; // seconds to schedule ahead

export class Satori {
    cps: number = 0.5;
    transport;
    divisions: number = 48; // how many times / cycle to query
    t: number = 0; // time pointer in cycles
    loop: Loop;

    constructor(...handlers: Function[]) {
        this.transport = getTransport()
        this.loop = new Loop(time => {
            const from = this.t;
            const to = this.t + (1 / this.divisions);
            setCurrentCycle(from);
            
            // compile code between from and to
            const { global, streams } = compile(from, to);

            const cpsEvents = global
                .filter((hap: any) => Object.keys(hap.params).includes('cps'))
                .map((hap: any) => ({time: hap.time, value: hap.params.cps}));
            
            global.forEach((hap: any) => {
                // update scheduler cps
                this.cps = hap.params.cps ? [hap.params.cps].flat()[0] : 0.5;
                // set transport bpm at the time of the event
                this.transport.bpm.setValueAtTime(240 * this.cps, time);
            });

            streams
                .filter((hap) => !hap.params.mute)
                .forEach((hap) => handlers.forEach(handler => handler(
                    hap, 
                    time // time from transport
                    + (hap.time - from) // add delta value from start of this tick
                    / (cpsEvents.find(({time}: any) => time >= hap.time)?.value || this.cps) // scaled by cps at that time
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