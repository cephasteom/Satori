import { Pattern, methods, type Hap } from './Pattern';
export declare type Event = { time: number, params: Record<string, any>, id: string | null };

export interface Stream extends Record<string, any> {
    id: string;
}

/**
 * A Stream is a musical layer. You can think of it as a track in a DAW, or a channel in a mixer.
 * It can be used to control multiple instruments, effects, and routing.
 * Stream instances are stored as `s0`, `s1`, `s2`, `s3`, `s4`, `s5`, `s6`, `s7` etc.
 * @example
 * s0.set({ ... }) // pass an object to set parameters
 */
export class Stream {
    constructor(id: string) {
        this.id = id;
    }

    /**
     * Set parameters on the Stream.
     * @param params - A record of parameter names and their values (Patterns or static values).
     * @example
     * s0.set({ 
     *   inst: 'synth',
     *   _n: '60 62 64 65', // prefix with _ to indicate it's a mutable parameter
     *   e: seq(1,0,1,0), // use e to trigger an event
     *   m: seq(0,1,0,1) // use m to trigger a mutation (modulate all active voices)
     * })
     */
    set(params: Record<string, any>) {
        Object.entries(params)
            .filter(([key]) => !['id', 'set', 'query', '__reset'].includes(key))
            .forEach(([key, value]) => this[key] = (value instanceof Pattern 
                ? value 
                : methods.set(value)));
    }

    /**
     * Alias for `set` method.
     * @param params 
     */
    _(params: Record<string, any>) {
        this.set(params);
    }

    /**
     * Format event and mutation haps for output.
     * @ignore - internal use only
     * @returns 
     */
    format(haps: Hap<any>[] = [], from: number, to: number, type: string): Event[] {
        return haps
            // only keep event haps with a value, and where the from time falls within the range
            .filter((hap: Hap<any>) => !!hap.value && hap.from >= from && hap.from < to)
            // iterate over haps and build param sets
            .map((hap: Hap<any>) => ({
                id: this.id,
                type,
                time: hap.from,
                params: Object.fromEntries(Object.entries(this)
                    // only keep Patterns
                    .filter(([_, value]) => value instanceof Pattern)
                    // query each Pattern and...
                    .map(([key, pattern]) => [key, (pattern as Pattern<any>)
                        .query(hap.from, hap.to)
                        // keep the closest one(s) to the event time. Keep more than one if the closest ones have the same value
                        .reduce((acc: any[], curr) => {
                            if (acc.length === 0) return [curr];
                            const accDiff = Math.abs(acc[0].from - hap.from);
                            const currDiff = Math.abs(curr.from - hap.from);
                            if (currDiff < accDiff) return [curr];
                            if (currDiff === accDiff) return [...acc, curr];
                            return acc;
                        }, [])
                        .map(hap => hap.value)
                        // if there's only one closest hap, return its value directly
                        // .reduce((acc, _, __, array) => array.length === 1 ? acc[0] : array)
                    ])
                )
            }));
    }
    
    /**
     * Compile events and parameters in a given time range.
     * @ignore - internal use only
     * @param from 
     * @param to 
     * @returns An array of events + mutations with their associated parameters.
     */
    query(from: number, to: number) {
        return {
            events: this.format(this.e?.query(from, to), from, to, 'e'),
            mutations: this.format(this.m?.query(from, to), from, to, 'm'),
        }
    }

    /**
     * Reset the Stream to its initial state.
     * @ignore - internal use only
     */
    __reset() {
        Object.keys(this).forEach(key => {
            if (['id', 'set', 'query', '__reset'].includes(key)) return;
            delete this[key];
        });
    }
}