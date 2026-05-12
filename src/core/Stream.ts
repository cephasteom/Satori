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
    _active: boolean = false;

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
        this._active = true;
        Object.entries(params)
            .filter(([key]) => !['id', 'set', 'query', '__reset', '_active'].includes(key))
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
        // extract pattern entries once per call rather than once per triggered hap
        const patternEntries = Object.entries(this).filter(([_, v]) => v instanceof Pattern);

        const seen = new Set<number>();
        return haps
            .filter((hap: Hap<any>) => {
                if (!hap.value || hap.from < from || hap.from >= to || seen.has(hap.from)) return false;
                seen.add(hap.from);
                return true;
            })
            .map((hap: Hap<any>) => ({
                id: this.id,
                type,
                time: hap.from,
                params: Object.fromEntries(
                    patternEntries.map(([key, pattern]) => {
                        const results = (pattern as Pattern<any>).query(hap.from, hap.to);
                        let best: any[] = [];
                        let bestDiff = Infinity;
                        for (const r of results) {
                            const diff = Math.abs(r.from - hap.from);
                            if (diff < bestDiff) { best = [r]; bestDiff = diff; }
                            else if (diff === bestDiff) best.push(r);
                        }
                        const values = best.map(({ value }) => value);
                        return [key, values.length === 1 ? values[0] : values];
                    })
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
            if (['id', 'set', 'query', '__reset', '_active'].includes(key)) return;
            delete this[key];
        });
        this._active = false;
    }
}