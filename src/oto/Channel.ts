import { Gain, Split, Merge, getDestination, Limiter, Meter } from 'tone'
import Synth from './ct-synths/rnbo/Synth'
import Sampler from './ct-synths/rnbo/Sampler2'
import Granular from './ct-synths/rnbo/Granular2';
import AcidSynth from './ct-synths/rnbo/AcidSynth';
import TSynth from './ct-synths/tone/Synth'
import TMono from './ct-synths/tone/MonoSynth'
import TFM from './ct-synths/tone/FMSynth'
import TAM from './ct-synths/tone/AMSynth'
import FXChannel from './ct-synths/rnbo/FXChannel2';
import FXDelay from './ct-synths/rnbo/Delay';
import ReverbGen from './ct-synths/rnbo/ReverbGen';
import SimpleSynth from './ct-synths/faust/SimpleSynth';
import FMSynth from './ct-synths/faust/FMSynth';
import Pad from './ct-synths/faust/Pad'
import FDistortion from './ct-synths/faust/Distortion'
import FTape from './ct-synths/faust/Tape'

import { samples } from './samples';

const satori = new BroadcastChannel('satori');

const destination = getDestination() // system audio output
destination.channelCount = destination.maxChannelCount // set to max channels

const output = new Merge({channels: destination.maxChannelCount}) // create output merger
output.connect(destination) // connect to system audio output

const busses = Array.from({length: 4}, () => new Gain(1))

declare type Instrument = typeof Synth | typeof Sampler | typeof Granular | typeof AcidSynth | typeof TSynth | typeof TMono | typeof TFM | typeof TAM | typeof SimpleSynth

const instMap: Record<string, Instrument> = {
    'synth': Synth,
    'sampler': Sampler,
    'granular': Granular,
    'acid': AcidSynth,
    'tone.synth': TSynth,
    'tone.mono': TMono,
    'tone.fm': TFM,
    'tone.am': TAM,
    'faust.simple': SimpleSynth,
    'faust.fm': FMSynth,
    'faust.pad': Pad
}

/**
 * All channels.
 */
export const channels: Record<string, Channel> = {};

/**
 * Represents an audio channel with its own instruments and effects.
 */
export class Channel {
    id: string;
    out: number| null = null  // output channel index
    input: Gain // input gain
    _output: Split // output splitter
    _limiter: Limiter
    _instruments: Record<string, any> = {}
    _fx: any
    _reverb: any
    _delay: any
    _fdist: any
    _ftape: any
    
    _fader: Gain // volume control
    _busses: Gain[] // fx busses
    _fxBusses: Gain[]
    _meter: Meter
    _shouldMeter: boolean = false
    _lastMeterTime: number = 0
    
    constructor(id: string, out: number = 0) {
        this.id = id
        this.input = new Gain(1)
        this._fader = new Gain(1)
        this._output = new Split({channels: 2})
        this._limiter = new Limiter(-10)
        this._meter = new Meter({ smoothing: 0.25, normalRange: true })
        
        this._limiter.connect(this._output) // delay signal to compensate for lookahead
        this._limiter.connect(this._meter) // but tap signal pre-delay for metering to get accuate reading
        this._fader.connect(this._limiter)

        // create 4 internal bus nodes
        this._busses = Array.from({length: 4}, () => new Gain(0))
        // and connect them to the global busses
        this._busses.forEach((_, i) => this.routeBus(i, busses[i]))
        
        // create 4 fx bus nodes
        this._fxBusses = Array.from({length: 4}, () => new Gain(0))
        
        // and connect them to the global fx channels, but don't connect to self
        this._fxBusses.forEach((_, i) => `fx${i}` !== this.id 
            && this.routeFxBus(i, channels[`fx${i}`]?.input || destination))

        // connect input to fader, busses, fx busses
        this.input.fan(this._fader, ...this._busses, ...this._fxBusses)
        
        this.routeOutput(out)

        this.meterLevel = this.meterLevel.bind(this)

        window.addEventListener('meter', (e) => {
            const customEvent = e as CustomEvent<{id: string, shouldMeter: boolean}>
            if (customEvent.detail.id !== this.id) return
            this._shouldMeter = customEvent.detail.shouldMeter
            requestAnimationFrame(this.meterLevel)
        })
    }

    /**
     * Routes channel output to given output index
     * @param out 
     */
    routeOutput(out: number) {
        if(out === this.out) return

        this._output.disconnect()

        try {
            this._output.connect(output, 0, out)
            this._output.connect(output, 1, out+1)
            this.out = out
        } catch (e) {
            satori.postMessage({ 
                type: 'error', 
                message: `Output channel ${out} is not available on this system.` 
            });
            // revert to previous output
            this._output.connect(output, 0, 0)
            this._output.connect(output, 1, 1)
            this.out = 0
        }
    };

    /**
     * Route a bus to a destination
     * @param bus 
     * @param destination 
     */
    routeBus(bus: number, destination: any) {
        this._busses[bus].connect(destination)
    }

    /**
     * Sets gain for a given bus
     * @param bus 
     * @param gain 
     * @param time 
     * @param lag 
     */
    send(bus: number, gain: number, time: number = 0, lag: number = 10) {
        this._busses[bus].gain.rampTo(gain, lag/1000, time)
    }

    /**
     * Route an FX bus to a destination
     * @param bus 
     * @param destination 
     */
    routeFxBus(bus: number, destination: any) {
        this._fxBusses[bus].connect(destination)
    }

    /**
     * Sets gain for a given FX bus
     * @param bus 
     * @param gain 
     * @param time 
     * @param lag 
     */
    sendFx(bus: number, gain: number, time: number = 0, lag: number = 10) {
        this._fxBusses[bus].gain.rampTo(gain, lag/1000, time)
    }

    /**
     * Initializes FX channel on this channel. Then handles internal routing.
     */
    initFX() {
        this._fx = new FXChannel()
        this._handleInternalRouting()
    }

    /**
     * Initializes Delay effect on this channel. Then handles internal routing.
     */
    initDelay() {
        this._delay = new FXDelay()
        this._handleInternalRouting()
    }

    /**
     * Initializes Reverb effect on this channel. Then handles internal routing.
     */
    initReverb() {
        this._reverb = new ReverbGen()
        this._handleInternalRouting()
    }

    /**
     * Init Faust distortion
     */
    initFDistortion() {
        this._fdist = new FDistortion()
        this._handleInternalRouting()
    }

    /**
     * Init Faust tape
     */
    initFTape() {
        console.log('adding ftape')
        this._ftape = new FTape()
        this._handleInternalRouting()
    }

    /**
     * Meter the output level of this channel, sending updates to the UI via BroadcastChannel
     */
    meterLevel(timestamp: number) {
        if (!this._shouldMeter) return
        if (timestamp - this._lastMeterTime >= 50) {
            satori.postMessage({ type: 'meter', id: this.id, level: this._meter.getValue() })
            this._lastMeterTime = timestamp
        }
        requestAnimationFrame(this.meterLevel)
    }

    /**
     * Handles internal routing of input -> fx -> _fader
     */
    _handleInternalRouting() {
        const { _fx, _reverb, _delay, _fdist, _ftape, input, _fader } = this
        const fx = [_fx, _delay, _reverb, _fdist, _ftape]
        
        // disconnect chain
        fx.forEach(fx => fx && fx.disconnect())
        input.disconnect()
        this.input.fan(...this._busses, ...this._fxBusses)

        const first = fx.find(Boolean)
        const last = [...fx].reverse().find(Boolean)
        
        input.connect(first?.input || _fader)
        last?.connect(_fader)

        fx.filter(Boolean).reduce((prev, curr) => {
            prev && curr && prev.connect(curr.input)
            return curr
        }, null)
    }

    /**
     * Plays an instrument with given params at given time
     * @param params - e.g. {inst: 'tone.synth', n: 60, dur: 1000}
     * @param time 
     */
    play(params: any, time: number) {
        const { midi, level = 1, out = 0 } = params;
        
        // handle output routing
        this.routeOutput(out);
        
        // handle bus sends
        this._busses.forEach((_, i) => params[`bus${i}`] !== undefined
            && this.send(i, params[`bus${i}`], time));

        // handle fxBus sends
        this._fxBusses.forEach((_, i) => params[`fx${i}`] !== undefined
            && this.sendFx(i, params[`fx${i}`], time));

        // handle fx params
        this.handleFx(params, time);

        // set channel level
        this._fader.gain.rampTo(level, 0.1, time)

        // exit if this is an FX channel
        if(['fx0', 'fx1', 'fx2', 'fx3'].includes(this.id)) return;

        // if inst is integer, using instMap to get actual
        const inst = typeof params.inst === 'number' ? Object.keys(instMap)[params.inst] : params.inst;
        
        // exit if no valid instrument specified
        const noInst = !Object.keys(instMap).includes(inst)
        // throw error if invalid instrument and we're not using MIDI
        if(noInst && midi === undefined && inst !== undefined) satori.postMessage({ 
            type: 'error', 
            message: `Instrument type "${inst}" not recognised.` 
        });
        // exit if no valid instrument specified
        if(noInst) return;

        // initialize instrument if it doesn't exist on this channel yet
        if(!this._instruments[inst]) {
            this._instruments[inst] = new instMap[inst]();
            this._instruments[inst].connect(this.input);
            this._instruments[inst].banks = samples; // provide samples if applicable
        }

        // play instrument with given params
        this._instruments[inst].play(params, time);
    }

    /**
     * Handles FX parameters for this channel. Initializes FX modules as they are requested.
     * @param params - e.g. {dist: 0.5, reverb: 0.3, level: 0.8}
     * @param time 
     */
    handleFx(params: any, time: number) {
        // extract fx params
        const { dist = 0, ring = 0, chorus = 0, lpf = 0, hpf = 0 } = params;
        
        // if any fx params are > 0, initialize fx if not already done
        !this._fx
            && [dist, ring, chorus, lpf, hpf].reduce((a, b) => a + b, 0) > 0 
            && this.initFX()

        // initialize reverb / delay if needed
        params.reverb > 0 && !this._reverb && this.initReverb()
        params.delay > 0 && !this._delay && this.initDelay()
        params.fdist > 0 && !this._fdist && this.initFDistortion()
        params.ftape > 0 && !this._ftape && this.initFTape()

        // set fx params
        this._fx && this._fx.set(params, time)
        this._reverb && this._reverb.set(params, time)
        this._delay && this._delay.set(params, time)
        this._fdist && this._fdist.set(params, time)
        this._ftape && this._ftape.set(params, time)
    }

    /**
     * Mutate all instruments on this channel with given params
     * @param params - e.g {n: 72, modi: 10}
     */
    mutate(params: Record<string, any>, time: number, lag: number = 100) {
        Object.values(this._instruments)
            .forEach(inst => inst.mutate(params, time, lag));

        this._fdist && this._fdist.mutate(params, time, lag);

        // handle bus sends
        this._busses.forEach((_, i) => params[`bus${i}`]
            && this.send(i, params[`bus${i}`], time, lag));

        // handle fxBus sends
        this._fxBusses.forEach((_, i) => params[`fx${i}`]
            && this.sendFx(i, params[`fx${i}`], time, lag));
    }

    /** 
     * Cut all instruments on this channel
     */
    cut(time: number, release: number = 25) {
        Object.values(this._instruments)
            .forEach(inst => inst.cut(time, release));
    }
}

['fx0', 'fx1', 'fx2', 'fx3'].forEach(id => {
    channels[id] = new Channel(id, 0)
})