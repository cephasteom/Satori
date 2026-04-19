import { complex, round, pow, abs } from 'mathjs'
/**
 * Pattern module - core building block of Satori.
 * Credit: adapted from https://garten.salat.dev/idlecycles/, by Froos.
 * These posts outline how TidalCycles was ported to Strudel. Invaluable reading.
 */
import { parse, evalNode } from './mini';
import { circuit, runCircuit } from './Qubit';
import { cyclesPerSecond, transposeOctave, unwrapArray } from './utils';
import { setupInputListener, syncLoopState } from './MidiInput';
import pkg from 'noisejs';
import { WebMidi } from 'webmidi';
import { retrieve as retrieveData } from './data';
// @ts-ignore
const { Noise } = pkg;
const noiseGenerator = new Noise(Math.random());

const satori = new BroadcastChannel('satori');

/**
 * Hap type - represents a single event in a Pattern
 * @ignore - internal use only
 */
export declare type Hap<T> = { from: number; to: number; value: T };

// Util: Pattern creation shortcut
const P = <T>(q: (from: number, to: number) => Hap<T>[]) => new Pattern(q);

// base cycle function, returning a Pattern instance
const cycle = (callback: (from: number, to: number) => Hap<any>[]) => P((from,to) => {
    const cycleFrom = Math.floor(from);
    const cycleTo = Math.ceil(to);
    let bag: Hap<any>[] = [];
    
    for (let f = cycleFrom; f < cycleTo; f++) {
        const haps = callback(f, f + 1);
        for (let hap of haps) {
            const value = typeof hap.value === "string" ? mini(hap.value as string) : hap.value;
            const sub = value instanceof Pattern
                ? value.query(hap.from, hap.to)
                : [{from: hap.from, to: hap.to, value}];
            bag = bag.concat(sub);
        }
    }

    // filter the bag to only include haps that overlap with the original from-to range
    // this is necessary because the callback may return haps outside the requested range
    return bag.filter(h => h.to > from && h.from < to)
})

/**
 * Speed up a pattern.
 * @param factor - speed-up factor. Can be a number or a Pattern.
 * @example seq('A', 'B', 'C').fast(3) // A for 1/3 cycle, B for 1/3 cycle, C for 1/3 cycle.
 * @example set(1,1).fast(cat(1,2,4,8))
 */
const fast = (factor: number|Pattern<number>, pattern: Pattern<any>) => 
    P((from, to) => {
        const factorValue = unwrap(factor, from, to);
        return pattern.query(from * factorValue, to * factorValue).map(hap => ({
            from: hap.from / factorValue,
            to: hap.to / factorValue,
            value: hap.value
        }))
    });

/**
 * Slow down a pattern.
 * @param factor 
 * @example seq('A', 'B', 'C').slow(2) // A for 2 cycles, B for 2 cycles, C for 2 cycles.
 */
const slow = (factor: number|Pattern<number>, pattern: Pattern<any>) => 
    P((from, to) => {
        const factorValue = unwrap(factor, from, to);
        return pattern.query(from / factorValue, to / factorValue).map(hap => ({
            from: hap.from * factorValue,
            to: hap.to * factorValue,
            value: hap.value
        }))
    });

/**
 * Concat values, one per cycle.
 * @param values
 * @example cat('A', 'B', 'C') // A for 1 cycle, B for 1 cycle, C for 1 cycle.
 */
const cat = (...values: any[]) => 
    cycle((from, to) => [{ from, to, value: values[from % values.length] }]);

/**
 * Alias for cat.
 */
const set = cat

/**
 * Sequence values into a single cycle.
 * @param values
 * @example seq('A', 'B', 'C', 'D') // A for .25 cycle, B for .25 cycle ... D for .25 cycle
 */
const seq = (...values: any[]) => fast(values.length, cat(...values));

/**
 * Randomly choose from a set of values.
 * @param values
 * @example choose('A', 'B', 'C') // randomly chooses A, B, or C each cycle.
 */
const choose = (...values: (any[])) => 
    cycle((from, to) => ([{ from, to, value: values[Math.floor(Math.random() * values.length)]}]))
 

/**
 * Edit the Hap values in a pattern using a callback function
 * @param callback - function to edit each Hap value @param v - current Hap value, w - value to edit with, from - start time, to - end time
 * @ignore - internal use only
 */
const withValue = (callback: (...args: any[]) => any) => 
    (...args: (number|Pattern<any>)[]) => {
        const pattern = args[args.length - 1] as Pattern<any>;
        return P((from, to) => pattern.query(from, to).map((hap) => ({
            ...hap,
            value: unwrapArray([hap.value].flat().map(v => callback(
                ...args.slice(0, -1).map(a => 
                    typeof a === 'function' ? a : unwrap(a, hap.from, hap.to)
                ),
                v, hap.from, hap.to
            )))
        })))
    }

/** 
 * Return the current time in cycles.
 * @param mod - optional modulo value
 * @example t() // current time e.g. 3.25 (3 cycles and a quarter)
 * @example t(4) // current time modulo 4
 */
const t = (mod?: number|Pattern<any>) => P((from, to) => ([{ 
    from, to, 
    value: mod ? from % unwrap(mod, from, to) : from
}]));

/**
 * Return the current cycle as an integer.
 * @param mod - optional modulo value
 * @example c() // current cycle
 * @example c(4) // current cycle modulo 4
 */
const c = (mod?: number|Pattern<any>) => t(mod).trunc();

/**
 * Return the current cycles per second.
 */
const cps = () => P((from, to) => ([{ from, to, value: cyclesPerSecond() }]));

/**
 * Convert cycles to seconds.
 * @param cycles - number of cycles
 * @example (4).cts() // convert a number as a method
 * @example cts(1) // or as a function
 * @example '1 2 3 4'.cts() // convert a mini pattern string
 * @example seq(1,2,3,4).cts() // convert a Pattern
 */
const cts = (cycles: number|string|Pattern<number>) => 
    P((from, to) => wrap(cycles).div(cps()).query(from, to));

/**
 * Cycles to milliseconds.
 * @param cycles - number of cycles
 * @example (4).ctms() // convert a number as a method
 * @example ctms(1) // or as a function
 * @example '1 2 3 4'.ctms() // convert a mini pattern string
 * @example seq(1,2,3,4).ctms() // convert a Pattern
 */
const ctms = (cycles: number|string|Pattern<number>) => 
    cts(cycles).mul(1000);

/**
 * MIDI note number to frequency.
 * @param midi - MIDI note number or pattern of MIDI note numbers
 * @returns 
 */
const mtof = (midi: number|string|Pattern<number>) =>
    P((from, to) => ([{
        from, to,
        value: 440 * 2 ** ((unwrap(midi, from, to) - 69) / 12)
    }]));

/**
 * Frequency to MIDI note number.
 * @param freq - frequency or pattern of frequencies
 * @returns 
 */
const ftom = (freq: number|string|Pattern<number>) =>
    P((from, to) => ([{
        from, to,
        value: 69 + 12 * Math.log2(unwrap(freq, from, to) / 440)
    }]));


/**
 * Add a value or pattern.
 * @param value - value or pattern to add.
 * @example seq(1,2,3).add(2) // 3,4,5
 * @example seq(1,2,3).add(saw(0,3,3)) // 1, 3, 5
 */ 
const add = withValue((amount, value) => amount + value);

/** 
 * Subtract a value or pattern.
 * @param value - value or pattern to subtract.
 * @example seq(5,6,7).sub(2) // 3,4,5
 * @example seq(5,6,7).sub(saw(0,3,3)) // 5, 5, 5
 */
const sub = withValue((amount, value) => value - amount);

/** 
 * Multiply a value or pattern.
 * @param value - value or pattern to multiply by.
 * @example seq(1,2,3).mul(2) // 2,4,6
 * @example seq(1,2,3).mul(saw(1,3,3)) // 1, 4, 9
 */
const mul = withValue((amount, value) => amount * value);
   
/** 
 * Divide a value or pattern.
 * @param value - value or pattern to divide by.
 * @example seq(2,4,6).div(2) // 1,2,3
 * @example seq(2,4,6).div(saw(1,3,3)) // 2, 2, 2
 */
const div = withValue((amount, value) => value / amount);

/**
 * Modulo by a value or pattern.
 * @param value - value or pattern to modulo by.
 * @example seq(5,6,7).mod(4) // 1,2,3
 * @example seq(5,6,7).mod(saw(1,4,3)) // 5%1, 6%2, 7%3
 */
const mod = withValue((amount, value) => value % amount);

/**
 * Round to a particular step.
 * @param step - step size to round to.
 * @example random().round(0.25) // random values rounded to nearest 0.25
 */
const step = withValue((step, value) => Math.round(value / step) * step);

/**
 * To fixed decimal places.
 */
const fixed = withValue((places, value) => parseFloat(Number(value).toFixed(places)));

/**
 * Less than comparison. Returns 1 if value < threshold, else 0.
 * @param value - value or pattern to compare with.
 * @example seq(1,2,3).lt(2) // 1,0,0
 * @example seq(1,2,3).lt(saw(0,4,3)) // compares each value with saw values
 */
const lt = withValue((threshold, value) => value < threshold ? 1 : 0);

/**
 * Greater than comparison. Returns 1 if value > threshold, else 0.
 * @param value - value or pattern to compare with.
 * @example seq(1,2,3).gt(2) // 0,0,1
 * @example seq(1,2,3).gt(saw(0,4,3)) // compares each value with saw values
 */
const gt = withValue((threshold, value) => value > threshold ? 1 : 0);

/**
 * Equal to comparison. Returns 1 if value == threshold, else 0.
 * @param value - value or pattern to compare with.
 * @example seq(1,2,2).eq(2) // 0,1,1
 * @example seq(1,2,3).eq(saw(0,4,3)) // compares each value with saw values
 */
const eq = withValue((threshold, value) => value == threshold ? 1 : 0);

/**
 * Not equal to comparison. Returns 1 if value != threshold, else 0.
 * @param value - value or pattern to compare with.
 * @example seq(1,2,2).neq(2) // 1,0,0
 * @example seq(1,2,3).neq(saw(0,4,3)) // compares each value with saw values
 */
const neq = withValue((threshold, value) => value != threshold ? 1 : 0);

/**
 * If a value is true, negate it (1 -> 0, 0 -> 1).
 * @param value - value or pattern to negate.
 * @example coin().not() // returns 1 when coin() is 0, else 0
 * @example not(coin()) // same as above
 */
const not = withValue((value) => value ? 0 : 1);

/**
 * Use a custom function to transform pattern values.
 * @param func - function to apply. Receives the current value as the first argument.
 * @example seq(1,2,3).fn(x => x * x) // 1,4,9
 */
const fn = withValue((func, ...args) => func(...args));

/**
 * Map from one range to another.
 * @param outMin - output minimum
 * @param outMax - output maximum
 * @param inMin - input minimum, default 0
 * @param inMax - input maximum, default 1
 * @example random().mtr(50, 100) // from 0-1 to 50-100
 */
const mtr = withValue((outMin, outMax, ...rest) => {
    rest = rest.slice(0, -2); // remove from and to
    const value = rest.pop() as number; // last arg is the value
    const inMin = rest[0] ?? 0; // default 0
    const inMax = rest[1] ?? 1; // default 1
    return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin))
});

/**
 * Alias for mtr.
 */
const scale = mtr

/**
 * Clamp pattern values to a given range.
 * @param min - minimum value, default 0
 * @param max - maximum value, default 1
 * @example random().mul(10).clamp(2, 4) // clamps random()*10 values to between 2 and 4
 */
const clamp = withValue((...args) => {
    args = args.slice(0, -2); // remove from and to
    const value = args.pop() as number; // last arg is the value
    const min = args[0] ?? 0; // default 0
    const max = args[1] ?? 1; // default 1
    return Math.min(Math.max(value, min), max);
}); 

// Base function for generating waveform patterns with Pattern arguments
const waveform = (callback: (i: number, ...args: number[]) => number) =>
    (...args: (number | Pattern<number>)[]) =>
        P((from, to) => {
            // Evaluate q (the last arg) dynamically per requested time slice
            const q = unwrap(args[args.length - 1], from, to);

            // Build q evenly spaced steps
            const values = Array.from({ length: q }, (_, i) => {
                // then unwrap each argument at the appropriate fractional time
                const frac = i / q;
                const t = from + frac * (to - from);
                return callback(
                    i, 
                    ...args.map(a => unwrap(a, t, t + 1e-9)) as number[]);
            });

            return seq(...values).query(from, to);
        });

/**
 * Generate a ramp from min to max, once per cycle.
 * @param min - start value
 * @param max - end value
 * @param q - quantization: steps/cycle. Default 48. Increase for a more fine-grained waveform.
 * @example saw(0,4) // a ramp from 0 to 4 over the course of 1 cycle
 * @example saw(0,1,96).slow(2) // a ramp from 0 to 1 over the course of 2 cycles, with finer steps to mitigate the slow pattern
 */
const saw = (min: number = 0, max: number = 1, q: number = 48) => 
    waveform((i, min, max, q) => {
        const v = i / (q - 1);
        return min + (max - min) * v;
    })(min, max, q);

/**
 * Alias for saw
 */
const range = saw

/** Alias for saw
 */
const ramp = saw

/**
 * Generate a sine wave from min to max over one cycle.
 * @param min - minimum value
 * @param max - maximum value
 * @param q - quantization: steps/cycle. Default 48. Increase for a more fine-grained waveform.
 * @example sine(0, 1) // a sine wave from 0 to 1 over the course of 1 cycle
 * @example sine(-1, 1, 96).slow(2) // a sine wave from -1 to 1 over the course of 2 cycles, with finer steps to mitigate the slow pattern
 */
const sine = (min: number = 0, max: number = 1, q: number = 48) => 
    waveform((i, min, max, q) => {
        const v = i / q;
        const s = Math.sin(v * (360 * (Math.PI / 180))) * 0.5 + 0.5;
        return min + (max - min) * s;
    })(min, max, q);

/**
 * Generate a cosine wave from min to max over one cycle
 * @param min - minimum value
 * @param max - maximum value
 * @param q - quantization: steps/cycle. Default 48. Increase for a more fine-grained waveform.
 * @example cosine(0, 1) // a cosine wave from 0 to 1 over the course of 1 cycle
 */
const cosine = (min: number = 0, max: number = 1, q: number = 48) => 
    waveform((i, min, max, q) => {
        const v = i / q;
        const s = Math.cos(v * (360 * (Math.PI / 180))) * 0.5 + 0.5;
        return min + (max - min) * s;
    })(min, max, q);

/**
 * Generate a triangle wave from min to max over one cycle
 * @param min - minimum value
 * @param max - maximum value
 * @param q - quantization: steps/cycle. Default 48. Increase for a more fine-grained waveform.
 * @example tri(0, 1) // a triangle wave from 0 to 1 over the course of 1 cycle
 */
const tri = (min: number = 0, max: number = 1, q: number = 48) => 
    waveform((i, min, max, q) => {
        const v = i / q;
        const t = v < 0.5 ? (v * 2) : (1 - (v - 0.5) * 2);
        return min + (max - min) * t;
    })(min, max, q);

/**
 * Generate a pulse wave from min to max over one cycle.
 * @param min - minimum value
 * @param max - maximum value
 * @param duty - duty cycle (0 to 1)
 * @param q - quantization: steps/cycle. Default 48. Increase for a more fine-grained waveform.
 * @example pulse(0, 1, 0.25) // a pulse wave from 0 to 1 with a duty cycle of 25% over the course of 1 cycle
 */
const pulse = (min: number = 0, max: number = 1, duty: number = 0.5, q: number = 48) => 
    waveform((i, min, max, duty, q) => {
        const v = (i / q);
        const s = (v % 1) < duty ? 1 : 0;
        return min + (max - min) * s;
    })(min, max, duty, q);

/**
 * Alias for pulse with a duty cycle of 0.5.
 * @param min - minimum value
 * @param max - maximum value
 * @example square(0, 4) // a square wave from 0 to 4 over the course of 1 cycle
 */
const square = (min: number = 0, max: number = 1, q: number = 48) => pulse(min, max, 0.5, q);

/**
 * Alias for square
 */
const sq = square;

/**
 * Noise waveform from min to max over one cycle.
 * @param min 
 * @param max 
 * @param q 
 * @example noise() // noise values between 0 and 1
 * @example noise(5, 10) // noise values between 5 and 10
 * @example noise().slow(3) // noise values between 0 and 1, slowed down over 3 cycles
 */
const noise = (min: number = 0, max: number = 1, q: number = 48) => 
    waveform((i, min, max) => {
        const v = noiseGenerator.simplex2(i / 32, 0) * 0.5 + 0.5;
        return min + (max - min) * v;
    })(min, max, q);

/**
 * Layer values over the same time range.
 * @param values
 * @example stack(0, sine(), square()) // layers a sine wave and square wave over a constant 0 value.
 */
const stack = (...values: any[]) => cycle((from, to) => values.map((value) => ({ from, to, value })));

/**
 * Interpolate values.
 * @param value
 * @example sine().interp(saw()) // interpolates between sine and saw waveforms over time 
 */
const interp = withValue((v, w, from, to) => v + (w - v) * ((from + to) / 2 % 1));

/**
 * Randomly replace values with 0.
 * @param probability
 * @example sine().degrade(0.3) // randomly replaces 30% of sine wave values with 0
 */
const degrade = withValue((v, w) => Math.random() < v ? 0 : w);



// base function for probability based Patterns
const weightedCoin = (
    probability: number|Pattern<any> = 0.5,
    ...args: (string|number|Pattern<any>)[]
) => {
    const pattern = P((from, to) => ([{from, to, value: Math.random() < unwrap(probability, from, to) ? 1 : 0}]));
    return args.length
        ? ifelse(...args, pattern)
        : pattern;
} 


/**
 * Return an equal distribution of 1s and 0s.
 * @example coin() // returns 0 or 1 with equal probability
 * @example coin('A', 'B') // returns 'A' or 'B' with equal probability
 * @example (60).add(coin(5)) // adds either 0 or 5 to 60 with equal probability
 * @example (60).add((5).coin()) // same as above
 */
const coin = (...args: any[]) => weightedCoin(0.5, ...args);

/**
 * Alias for coin
 */
const sometimes = coin

/**
 * Return mostly 0s, occasionally 1s. Optionally, provide if-else patterns.
 * @example rarely()
 * @example rarely('A', 'B') // returns 'A' when condition is true, else 'B'
 * @example (60).add(rarely(5)) // adds 5 to 60 occasionally
 * @exaample (60).add((5).rarely()) // same as above
 */

const rarely = (...args: any[]) => weightedCoin(0.125, ...args);

/**
 * Return mostly 1s, occasionally 0s.
 * @example often()
 * @example often('A', 'B') // returns 'A' when condition is true, else 'B'
 * @example (60).add(often(5)) // adds 5 to 60 most of the time
 * @example (60).add((5).often()) // same as above
 */
const often = (...args: any[]) => weightedCoin(0.75, ...args);

/**
 * Compare values. If both are true, return 1, else 0.
 * @param value
 * @example coin().and(coin()) // returns 1 when both coins() are true
 */
const and = withValue((other, v, from, to) => {
    if (!v) return 0;
    const resolved = typeof other === 'function' ? other() : other; // handle thunked patterns
    return v && unwrap(resolved, from, to);
});

/**
 * Compare values. If one of them is true, return 1, else 0.
 * @param value
 * @example coin().or(coin()) // returns 1 when either coin() is true
 */
const or = withValue((other, v, from, to) => {
    if (v) return 1;
    const resolved = typeof other === 'function' ? other() : other; // handle thunked patterns
    return unwrap(resolved, from, to) ? 1 : 0;
});

/**
 * Compare values. If one is true and the other is false, return 1, else 0.
 * @param value
 * @example set(1).xor(1) // returns 0
 */
const xor = withValue((other, v, from, to) => {
    const resolved = typeof other === 'function' ? other() : other; // handle thunked patterns
    return unwrap(resolved, from, to) ? (v ? 0 : 1) : (v ? 1 : 0);
});

/**
 * If else control structure for patterns.
 * @param condition - condition pattern
 * @param thenPattern - pattern to return if condition is true. Default is 1.
 * @param elsePattern - pattern to return if condition is false. Default is 0.
 * @example coin().ifelse('A', 'B') // returns 'A' when coin() is true, else 'B'
 * @example ifelse('A', 'B', coin()) // same as above

 */
const ifelse = (
    ...args: (string|number|Pattern<any>)[] 
) => {
    const pattern = args[args.length - 1] as Pattern<any>;
    const ifPattern = args.length > 1 ? args[0] : wrap(1); // default to 1 if no thenPattern provided
    const elsePattern = args.length > 2 ? args[1] : pattern; // default to 0 if no elsePattern provided

    return P((from, to) => {
        return wrap(unwrap(pattern, from, to) 
            ? ifPattern
            : elsePattern
        ).query(from, to)
    });
}

/**
 * Alias for ifelse.
 */
const ie = ifelse

/**
 * If hap.from === from, return hap.value, else 0.
 * @param pattern - pattern to evaluate
 * @example seq(1).fallsOnFrom().query(0,1) // returns 1
 * @example seq(1).fallsOnFrom().query(0.5,1.5) // returns 0
 * @ignore - internal use only
 */
const fallsOnFrom = (pattern: Pattern<any>) => 
    P((from, to) => pattern.query(from, to)
        .map(hap => ({
            ...hap,
            // if hap.from is within the requested from-to range, return hap.value, else 0
            value: hap.from >= from && hap.from < to ? hap.value : 0
        })));

/**
 * Return a 1 every n cycles, else 0.
 * @param n - interval
 * @example every(0.25) // returns 1 every quarter cycle. Equivalent to seq(1,1,1,1).
 * @example every(2) // returns 1 every 2 cycles. Equivalent to seq(1).slow(2).
 */
// @ts-ignore
const every = (n: number) => seq(1).slow(n).fallsOnFrom();

/**
 * Toggle 1s and 0s when the condition is met.
 * @param condition - pattern to evaluate
 * @example rarely().toggle() // toggles between 1 and 0 each time rarely() returns 1
 */
const toggle = (condition: Pattern<any>) => {
    let state = false;

    return P((from, to) => {
        const shouldToggle = unwrap(condition, from, to);
        state = shouldToggle ? !state : state;
        
        return [{
            from, to, 
            value: state ? 1 : 0
        }];
    });
}

/**
 * Fill a cache with n number of cycles worth of values from the preceding pattern
 * @param cycles - number of cycles to cache. Default is 1.
 * @param clear - if true, clear the cache. Default is false.
 * @param pattern - pattern to cache
 * @example '1?0*8'.cache(1,every(4)) // caches 1 cycle worth of random 0 or 1s. Clears the cache every 4 cycles.
 * @returns 
 */
const cache = (...args: any[]) => {
    let state: Record<number, any[]> = {};
    const pattern = args[args.length - 1] as Pattern<any>;
    
    return P((from, to) => pattern.query(from, to).map((hap) => {
        const {from, to} = hap;
        const cycles = args.length > 1 ? unwrap(args[0], from, to) : 1;
        const clear = args.length > 2 ? unwrap(args[1], from, to) : false;
        const i = from % cycles;

        state[i] === undefined && (state[i] = hap.value);
        clear && (state = {});
        
        return { ...hap, value: state[i] };
    }));
}

/**
 * Sample and hold a pattern at n divisions per cycle.
 * Samples the pattern once per division and holds the value until the next.
 * @param divisions - number of divisions per cycle
 * @example random().hold(16) // 16 stable random values per cycle
 * @example coin().hold(8) // 8 stable coin tosses per cycle
 */
const hold = (divisions: number | Pattern<number>, pattern: Pattern<any>) =>
    P((from, to) => {
        const cycleFrom = Math.floor(from);
        const cycleTo = Math.ceil(to);
        const divs = unwrap(divisions, from, to);
        return Array.from({ length: (cycleTo - cycleFrom) * divs }, (_, i) => {
            const f = cycleFrom + i / divs;
            const mid = f + 1 / (divs * 2);
            return { 
                from: f, 
                to: f + 1 / divs, 
                value: unwrap(pattern, mid, mid + 1e-9) 
            };
        });
    });

/**
 * Hold the last value of a pattern until a condition is met, then update the value.
 * @param condition - pattern to evaluate for updating the value
 * @example 'C E G'.holdUntil(coin()) // holds the current chord until coin() returns 1, then updates to the next chord in the sequence
 */
const holdUntil = (condition: Pattern<any>, pattern: Pattern<any>) => {
    let lastValue: any = null;

    return P((from, to) => {
        const shouldUpdate = unwrap(condition, from, to);
        const haps = pattern.query(from, to);
        
        if (shouldUpdate && haps.length > 0) {
            lastValue = haps[haps.length - 1].value; // update to the most recent value
        }
        
        return [{
            from, to,
            value: lastValue
        }];
    });
}

/**
 * Increment a counter each time a condition is met.
 * @param condition - pattern to evaluate
 * @example coin().count() // increments the count each time coin() returns 1
 * @example count(coin()) // same as above
 */
const count = (condition: Pattern<any>) => {
    let counter = 0;

    return P((from, to) => {
        const triggered = unwrap(condition, from, to);
        triggered && (counter += 1);
        return [{
            from, to,
            value: counter
        }];
    });
}

// base function for handling Math[operation] patterns
const operate = (operator: string) => (...args: (number|Pattern<any>)[]) => cycle((from, to) => {
    const p = args[args.length - 1];
    // @ts-ignore
    const calc = (...values: (number|Pattern<any>)[]) => Math[operator](...values.map(v => unwrap(v, from, to)));
    
    return p instanceof Pattern 
        ? p.query(from, to).map(hap => ({...hap, value: calc(hap.value, ...args)}))     
        : [{from, to, value: calc(...args)}];
});

/**
 * Operators - all operators from the JS Math object can be used as functions or Pattern methods.
 * @example random() // return a random number between 0 and 1 every cycle
 * @example set(2).pow(2) // returns 4 every cycle
 * @example seq(1,2,3).pow(2) // returns the sine of 1, then 2, then 3 over successive cycles
 */
const operators = Object.getOwnPropertyNames(Math)
    .filter(prop => typeof (Math as any)[prop] === 'function');

// Util: unwrap ensures we get a raw value
export function unwrap<T>(value: Pattern<T>|any, from: number, to: number) {
    value = typeof value === "string" ? mini(value as string) : value;
    return value instanceof Pattern 
        ? value.query(from, to)[0]?.value 
        : value;
}

// Util: wrap ensures a value is a Pattern
function wrap<T>(value: T): Pattern<T> {
    return value instanceof Pattern
        ? value
        : set(value);
}

/**
 * Parse a mini pattern string into a Pattern instance.
 * @param value - mini pattern string
 * @example mini('Cmaj7..?') // parses the mini pattern string into a Pattern
 */
const mini = (value: string) => evalNode(parse(value), methods);

/**
 * Assuming a chord pattern, invert the chord by a given number of steps.
 * @param steps - number of steps to invert. Positive values invert up, negative values invert down.
 * @example 'Cma#7'.invert(1) // returns 'E G B C'
 * @example 'Cma#7'.invert(-1) // returns 'B C E G'
 */
const inversion = (...args: any[]) => {
    const pattern = args[args.length - 1] as Pattern<any>;
    return P((from, to) => pattern.query(from, to).map((hap, i, arr) => {
        const chordLength = arr.length;
        const note = hap.value
        const inversion = Math.floor(unwrap(args[0] || 0, from, to))
        const inverted = transposeOctave(
            +note, 
            Math.abs(inversion) % chordLength > i ? inversion > 0 ? 1 : -1 : 0
        );
        
        return {...hap, value: inverted }
    }));
}

/**
 * Assuming a stack, take the element at the given index.
 * @param index - index of the element to take. 
 * @example 'Dmi'.at(2) // returns A
 * @example 'Dmi'.at([0,2]) // returns D and A
 */
const at = (...args: any[]) => P((from, to) => {
    const pattern = args[args.length - 1] as Pattern<any>;
    const indexes = args.slice(0, -1).map(a => unwrap(a, from, to)).flat(); // remove pattern
    return pattern.query(from, to).filter((_, i, arr) => 
        indexes.includes(i % arr.length));
}); 

/**
 * Assuming an array, return 1 if includes the given value, else 0.
 * @param value - value to check for
 * @example 'C E G'.includes('E') // returns 1
 * @example 'C E G'.includes('D') // returns 0
 */
const includes = (...args: any[]) => P((from, to) => {
    const pattern = args[args.length - 1] as Pattern<any>;
    const checkValues = args.slice(0, -1).map(a => unwrap(a, from, to)).flat(); // remove pattern
    return pattern.query(from, to).map(hap => ({
        ...hap,
        value: checkValues.some(v => 
            unwrapArray([hap.value].flat()).includes(v)
        ) ? 1 : 0
    }));
});

/**
 * Expand the current value into a list of n values. An optional function can be provided to transform each value.
 * @param n - number of values to expand into
 * @param func - optional function to transform each value. Receives the current value and the index as arguments.
 * @example 'C'.expand(3) // returns stack('C', 'C', 'C')
 * @example 'C'.expand(3, (note, i) => note + i * 2) // returns stack('C', 'D', 'E')
 * @example s1.set({
    inst: 'synth', n: 'C4*2'.expand(16, (x,i) => x+i*2),
    strum: ctms(1/8),
    e: every(2) })
 */
const expand = withValue((...args) => {
    args = args.slice(0, -2); // remove from and to
    const value = args.pop(); // last arg is the value
    const n = args[0] || 1; // first arg is n
    const func = args[1] || ((x: any) => x); // second arg is optional function
    return Array.from({ length: n }, (_, i) => func(value, i));
});

/**
 * Print the current Pattern value for debugging.
 * @example seq('A', 'B', 'C').print() // prints the value of the pattern on each division of the cycle.
 * @example seq('A', 'B', 'C').print('MyPattern') // prints the value of the pattern with an identifier.
 */
const print = (...args: any[]) => P((from, to) => {
    const pattern = args[args.length - 1] as Pattern<any>;
    const id = args.length > 1 && unwrap(args[0], from, to);
    return pattern.query(from, to).map(hap => {
        setTimeout(() => satori.postMessage({ 
            type: 'pattern-print', 
            message: `${parseFloat(from.toFixed(2))}: ${id ? `"${id}"` : ''} ${unwrap(hap.value, hap.from, hap.to)}`
        }), 120);
        return hap;
    });
});

/**
 * Measure Qubit at index.
 * @param index - qubit index
 * @param divisions - how many times to measure the circuit each cycle. Default is 16ths.
 * @example qm(0) // measures qubit 0
 */
const qmeasure = (index: number|Pattern<number>, divisions: number = 16) => 
    mini('1').fast(divisions)
        .and(() => P((from, to) => {
            runCircuit(from); // memoized circuit run. Only runs once per time range.
            const value = circuit.measure(unwrap(index, from, to)) || 0;
            return [{ from, to, value: value ? 1 : 0 }];
        }));

/**
 * Alias for qmeasure.
 */
const qm = qmeasure

/**
 * Measure all Qubits. Returns an array of measured values.
 * @param divisions - how many times to measure the circuit each cycle. Default is 16ths.
 * @example qmeasures() // measures all qubits
 */
const qmeasures = (divisions: number = 16) =>
    mini('1').fast(divisions)
        .and(() => P((from, to) => {
            runCircuit(from); // memoized circuit run. Only runs once per time range.
            return [{ from, to, value: circuit.measureAll() }];
        }));

/** Alias for qmeasures.
 */
const qms = qmeasures

/**
 * Probability of basis state at index.
 * @param index - basis state index
 * @example qprob(0) // probability of basis state 0
 */
const qprob = (index: number|Pattern<number>) => P((from, to) => {
    const length = circuit.numAmplitudes()
    const i = (unwrap(index, from, to) % length);
    const value = pow(abs(round(circuit.state[i] || complex(0, 0), 14)), 2);
    return [{ from, to, value }];
}).fixed(5);

/** Alias for qprob.
 */
const qpr = qprob

/**
 * Probabilities of all basis states. As an array.
 * @example qprobs() // probabilities of all basis states
 */
const qprobs = () => P((from, to) => {
    const length = circuit.numAmplitudes()
    const values = Array.from({ length }, (_, i) => 
        pow(abs(round(circuit.state[i] || complex(0, 0), 14)), 2));
    return [{ from, to, value: values }];
}).fixed(5);

/** Alias for qprobs.
 */
const qprs = qprobs

/**
 * Phase of basis state at index.
 * @param index - basis state index
 * @example qphase(0) // phase of basis state 0
 * @returns 
 */
const qphase = (index: number|Pattern<number>) => P((from, to) => {
    const states = circuit.stateAsArray()
    const i = unwrap(index, from, to) % states.length
    return [{ from, to, value: states[i].phase }];
})
    .add(Math.PI * 2).mod(Math.PI * 2) // shift from [-π, π] to [0, 2π]
    .mtr(0, 1, 0, 2 * Math.PI)         // normalise to [0, 1]
    .fixed(5);

/** Alias for qphase.
 */
const qph = qphase

/**
 * Phases of all basis states. As an array.
 * @example qphases() // phases of all basis states
 */
const qphases = () => P((from, to) => {
    const phases = circuit.stateAsArray().map((s: any) => s.phase);
    return [{ from, to, value: phases }];
})
    .add(Math.PI * 2).mod(Math.PI * 2) // shift from [-π, π] to [0, 2π]
    .mtr(0, 1, 0, 2 * Math.PI)         // normalise to [0, 1]
    .fixed(5);

/** Alias for qphases.
 */
const qphs = qphases

/**
 * Listen to a MIDI input device, on a channel. 
 * Record notes and loop them.
 * Recorded notes persist across code evaluations until cleared.
 * @param device - MIDI input device name or index
 * @param channel - MIDI channel to listen on (1–16)
 * @param args - additional arguments for loop control -
 * cycles: number or pattern - length of the loop in cycles. Default is 1.
 * record: boolean or pattern - whether to record incoming notes. Default is true.
 * clear: boolean or pattern - whether to clear recorded notes. Default is false.
 * @example const loop = loopmidiin(
1, // device name or index
1, // midi channel 
{ // additional arguments 
  cycles: 1, // loop length in cycles, default is 1
  record: 1, // whether to record incoming notes, default is true
  clear: every(4).toggle() // whether to clear recorded notes, default is false
});

s0._({
  n: loop,
  inst: 0,
  dur: ctms(1/16),
  e: '1*16'
})
 */
const loopmidiin = (
    device: string|number|Pattern<any>,
    channel: number|Pattern<any>,
    args: {
        cycles: Pattern<any> | number, 
        record: Pattern<any> | number, 
        clear: Pattern<any> | number,
        quantize: number | null
    }
) => {
    const deviceValue = unwrap(device, 0, 0);
    const channelValue = unwrap(channel, 0, 0);
    const inputName = WebMidi.inputs[+deviceValue]?.name ?? deviceValue;
    const key = `${inputName}:${channelValue}`;
    setupInputListener(inputName, channelValue);

    return P<number>((from, to) => {
        const {cycles = 1, record = true, clear = false, quantize = null} = args;
        
        const loopLen = unwrap(cycles, from, to);
        const isRecording = !!unwrap(record, from, to);
        const shouldClear = !!unwrap(clear, from, to);
        const quantizeValue = unwrap(quantize, from, to);

        const state = syncLoopState(key, isRecording, loopLen, shouldClear);

        if (state.notes.length === 0) return [];

        // Position within the current loop iteration
        const loopPos    = from % loopLen;
        const loopPosEnd = to   % loopLen;
        const wraps      = loopPosEnd < loopPos; // tick straddles a loop boundary

        // Absolute base of this loop iteration
        const currentCycle = from - loopPos;
        // quantize value, as in 16 for 16ths, or 8 for 8ths. If null, no quantization is applied.
        const q = (value: number) => quantizeValue ? Math.round(value * quantizeValue) / quantizeValue : value;

        const result = state.notes
            .filter(note => {
                const noteStart = q(note.from);
                return wraps
                    ? (noteStart >= loopPos || noteStart < loopPosEnd)
                    : (noteStart >= loopPos && noteStart < loopPosEnd)
            })
            .map(note => ({
                from: currentCycle + q(note.from),
                // if note-off landed before note-on (crossed boundary), clamp to loop end
                to: currentCycle + q(note.to > note.from ? note.to : loopLen),
                value: note.n,
            }));

        return result;
    });
};

/**
 * Retrieve data from the store
 * @param key - key of the data to retrieve
 * @param rest - optional additional arguments to retrieve nested data. 
 * @example s0.set({
  inst: 'synth', 
  cut: 0,
  n: retrieve(
    'test', // key of the data to retrieve from the store
    'foo | bar', // optional additional argument(s) to retrieve nested data. 
    t().mul(16).mod(4) // for example, use the current time as an index
  ).add(60),
  e: '1*16'
})

store('test', {
  foo: [1,2,3,4],
  bar: [4,5,6,7]
})
*/
const retrieve = (key: string, ...rest: any[]) => {
    const data = retrieveData(key) || [];
    return P((from, to) => {
        // unwrap any patterns in the rest of the arguments
        const args = rest.map(arg => unwrap(arg, from, to));
        // use the args as indexes and/or keys to retrieve nested data, if the retrieved data is an array or object
        const value = args.reduce((acc, arg) => {
            if (Array.isArray(acc) && typeof arg === 'number') {
                return acc[arg % acc.length]; // wrap around if index is out of bounds
            } else if (acc && typeof acc === 'object' && arg in acc) {
                return acc[arg];
            } else {
                return undefined; // if the path is invalid, return undefined
            }
        }, data);

        return [{ from, to, value }];
    });
};

export const methods = {
    t, c,
    fn,
    cat, set, seq,
    fast, slow,
    add, sub, mul, div, mod, step,
    saw, range, ramp, sine, cosine, tri, pulse, square, sq, noise,
    mtr, scale, clamp, fixed,
    stack, inversion,
    mini, hold, holdUntil,
    interp, degrade, expand, toggle, cache, count,
    choose, coin, rarely, sometimes, often, every, fallsOnFrom,
    ifelse, ie, and, or, xor, not,
    cts, ctms, cps,
    mtof, ftom,
    lt, gt, eq, neq,
    at, includes,
    ...operators.reduce((obj, name) => ({
        ...obj,
        [name]: operate(name)
    }), {}),
    print,
    qm, qmeasure, qms, qmeasures, qpr, qprob, qprs, qprobs, qph, qphase, qphs, qphases,
    loopmidiin, retrieve
};

// declare a type for Pattern methods, for use in the Pattern interface
type PatternMethods = {
    // key must be a key from methods
    // value is a function with the same parameters and return type as the corresponding method in methods
    [K in keyof typeof methods]: (...args: Parameters<typeof methods[K]>) => ReturnType<typeof methods[K]>;
} & {
    // fallback for runtime operators
    [key: string]: (...args: any[]) => any;
};

export interface Pattern<T> extends PatternMethods {}

/**
 * Pattern class.
 * The core building block of Satori. Patterns represent time-varying values over cycles.
 * @example s0.set({
 *  freq: sine(100,1000) // use a Pattern to set frequency
 *  e: seq(1,1,0,1) // use a Pattern to trigger events
 * })
 */
export class Pattern<T> {
    /**
     * Query function - returns Haps for a given time range
     * @param from - start time
     * @param to - end time
     * @ignore - internal use only
     */
    query: (from: number, to: number) => Hap<T>[];

    /**
     * Create a new Pattern instance
     * @param query - function that returns Haps for a given time range
     * @ignore - internal use only
     */
    constructor(query: (from: number, to: number) => Hap<T>[] = (from, to) => [{from, to, value: null as any}]) {
        this.query = query

        // bind methods to this pattern instance
        Object.entries(methods).forEach(([name, method]) => {
            this[name as keyof typeof methods] = ((...args: any[]) =>
                // @ts-ignore
                method(...args, this)) as any;
        });
    }
}

// Extend String and Number prototypes to include Pattern methods
declare global {
    interface String {
        [key: string]: any;
    }
    interface Number {
        [key: string]: any;
    }
}

// add all methods to the string prototype so that we can do '1 2 3'.add(2) for example
// this is wild thing to do as it will interfere with other JS code...
Object.entries(methods).forEach(([name, method]) => {
    // @ts-ignore
    Number.prototype[name] = function(...args: any[]) {
        // @ts-ignore
        return method(...args, set(this.valueOf()));
    }
    String.prototype[name] = function(...args: any[]) {
        // @ts-ignore
        return method(...args, set(mini(this.toString())));
    }
});