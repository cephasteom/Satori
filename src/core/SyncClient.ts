import { immediate } from "tone";

// A windowed ordinary-least-squares fit of offset = y - x against x, tracking
// both a baseline offset and a drift rate (skew) between two clock domains.
class LinearClockModel {
    private xs: number[] = [];
    private offsets: number[] = [];
    private xRef: number | null = null;
    private a = 0;
    private b = 0;
    private maxWindow: number;

    constructor(maxWindow = 50) {
        this.maxWindow = maxWindow;
    }

    reset() {
        this.xs = [];
        this.offsets = [];
        this.xRef = null;
        this.a = 0;
        this.b = 0;
    }

    addSample(x: number, y: number) {
        if (this.xRef === null) this.xRef = x;
        this.xs.push(x);
        this.offsets.push(y - x);
        if (this.xs.length > this.maxWindow) {
            this.xs.shift();
            this.offsets.shift();
            this.xRef = this.xs[0];
        }
        this.refit();
    }

    private refit() {
        const n = this.xs.length;
        if (n === 0) return;
        const xr = this.xRef!;
        const xc = this.xs.map(x => x - xr);
        const meanX = xc.reduce((s, v) => s + v, 0) / n;
        const meanY = this.offsets.reduce((s, v) => s + v, 0) / n;
        let sxx = 0, sxy = 0;
        for (let i = 0; i < n; i++) {
            const dx = xc[i] - meanX;
            sxx += dx * dx;
            sxy += dx * (this.offsets[i] - meanY);
        }
        this.b = sxx > 1e-9 ? sxy / sxx : 0;
        this.a = meanY - this.b * meanX;
    }

    ready() { return this.xs.length > 0; }

    isOutlier(x: number, y: number, thresholdSec = 0.015) {
        if (this.xs.length < 5) return false;
        return Math.abs((y - x) - this.predictOffset(x)) > thresholdSec;
    }

    private predictOffset(x: number) {
        return this.xRef === null ? 0 : this.a + this.b * (x - this.xRef);
    }

    predict(x: number) { return x + this.predictOffset(x); }
}

/**
 * Continuously measures this client's offset/drift against SuperSatori's SC
 * SystemClock via a sync ping/pong, chaining two linear clock models
 * (AudioContext -> performance.now(), performance.now() -> SC SystemClock)
 * so AudioContext-domain event times can be translated into SC's domain.
 *
 * AudioContext time is never compared directly to SC's OS-clock-domain time -
 * they're different hardware/clock domains that drift apart even on the same
 * machine.
 */
export class SyncClient {
    private pingId = 0;
    private pending = new Map<number, number>(); // pingId -> t0 (perf ms)
    private minRtt = Infinity;
    private scModel = new LinearClockModel(50);
    private audioModel = new LinearClockModel(50);
    private timer: ReturnType<typeof setTimeout> | null = null;
    private ws: WebSocket;

    constructor(ws: WebSocket) {
        this.ws = ws;
        this.onReconnect();
    }

    // reset both models and restart the fast burst; call on every WebSocket (re)connect
    onReconnect() {
        this.scModel.reset();
        this.audioModel.reset();
        this.pending.clear();
        this.minRtt = Infinity;
        this.scheduleNext(0, 8, 150);
    }

    stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    private scheduleNext(count: number, burstRemaining: number, intervalMs: number) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.sendPing();
            const nextRemaining = burstRemaining - 1;
            const nextInterval = nextRemaining > 0 ? intervalMs : count < 20 ? 500 : 4000;
            this.scheduleNext(count + 1, Math.max(nextRemaining, 0), nextInterval);
        }, intervalMs);
    }

    private sendPing() {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        // bracket the AudioContext read between two performance.now() reads to
        // average out the JS-turn gap between the two clock reads
        const p0 = performance.now();
        const audioTime = immediate();
        const p1 = performance.now();
        const perfAtAudioSample = (p0 + p1) / 2;
        const id = this.pingId++;
        this.pending.set(id, perfAtAudioSample);
        this.audioModel.addSample(audioTime, perfAtAudioSample / 1000);
        this.ws.send(JSON.stringify({ type: 'sync', pingId: id }));
    }

    // feed a 'syncReply' message from SuperSatori into the model
    handleReply(msg: { pingId: number, serverTime: number }) {
        const t0 = this.pending.get(msg.pingId);
        if (t0 === undefined) return;
        this.pending.delete(msg.pingId);
        const t3 = performance.now();
        const rtt = t3 - t0;
        // on loopback, rtt this high indicates a stall, not real latency
        if (rtt > 50) return;
        this.minRtt = Math.min(this.minRtt, rtt);
        // NTP-style near-best filter
        if (rtt > this.minRtt * 1.5) return;
        const xSec = (t0 + t3) / 2 / 1000;
        const serverTime = msg.serverTime;
        if (this.scModel.isOutlier(xSec, serverTime)) return;
        this.scModel.addSample(xSec, serverTime);
    }

    ready() { return this.scModel.ready(); }

    // AudioContext-domain target -> SC SystemClock.seconds domain, via Model A then Model B.
    // Falls back to identity before any sync samples exist.
    audioTimeToScTime(audioTargetTime: number): number {
        const perfTargetSec = this.audioModel.ready() ? this.audioModel.predict(audioTargetTime) : audioTargetTime;
        return this.scModel.ready() ? this.scModel.predict(perfTargetSec) : perfTargetSec;
    }
}
