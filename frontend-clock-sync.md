# Frontend clock-sync contract

SuperSatori's bridge/synth engine no longer reconstructs a tempo clock from `cps`/`time`
snapshots. Instead, SuperCollider's own `SystemClock` is the single source of truth, and the
**frontend** (Satori, in the separate `cephasteom/Satori` repo) is responsible for continuously
measuring its offset and drift against it, then sending each event's target time already
translated into that clock's domain.

This file documents the wire contract the frontend must implement, plus a working sketch to
port over. See `apps/bridge/src/index.ts` and `apps/synth/main.scd` for the bridge/SC side,
already implemented.

## Wire contract

**Sync ping** (send periodically — see cadence below):
```json
{ "type": "sync", "pingId": 0 }
```

**Sync reply** (bridge sends back):
```json
{ "type": "syncReply", "pingId": 0, "serverTime": 123.456 }
```
`serverTime` is SuperCollider's `SystemClock.seconds` at the moment it processed the ping.

**Event / mutation** (replaces the old `time`/`delta`/`cps`/`unixtime` fields with one absolute
target time, in the same `SystemClock.seconds` domain as `serverTime` above):
```json
{ "id": "s0", "type": "e", "atTime": 123.706, "params": { "inst": "fm", "n": 60 } }
```
`type` is `"e"` (event) or `"m"` (mutation), same as before.

## Why two clock models, not one

Never compare AudioContext time to anything else directly — that was the bug in the very first
clock-sync attempt in this project (using Tone.js's AudioContext-domain time as if it were
comparable to SuperCollider's OS-clock-domain time; they're different hardware/clock domains
even on the same machine and drift apart). Instead, chain two small linear models:

- **Model A**: AudioContext-domain seconds → `performance.now()`-domain ms (local only; corrects
  for AudioContext's own hardware clock drifting relative to the JS/OS timer).
- **Model B**: `performance.now()`-domain seconds → SC `SystemClock.seconds` domain (built from
  the ping/pong exchange above).

Both models are the same shape: a windowed ordinary-least-squares fit of `offset = y - x` against
`x`, tracking both a baseline offset **and** a drift rate (skew) — a single point-offset can't
represent "the other clock is running 0.02% slower than mine," which is exactly what causes
long-run wander if omitted.

## Cadence

- Fast burst on connect/reconnect: 8 pings at 150ms spacing.
- Warm-up: 500ms spacing until steady state.
- Steady state: one ping every ~4s. Same-machine clock skew changes slowly, so this is enough
  to track it while keeping traffic negligible.
- Reset both models and restart the burst on every WebSocket reconnect.

## Sample filtering

For each ping, `t0` = local send time, `t3` = local receive time of the reply (both
`performance.now()` ms):
- Reject if `rtt = t3 - t0 > 50ms` (on loopback this indicates a stall, not real latency).
- Track a rolling `minRtt`; reject unless `rtt <= minRtt * 1.5` (NTP-style near-best filter).
- Once the model has ≥5 samples, reject if the implied offset disagrees with the current
  model's prediction by more than 15ms (catches fast-but-wrong outliers the RTT filter misses).

## Reference implementation

```ts
class LinearClockModel {
  private xs: number[] = []; private offsets: number[] = []; private xRef: number | null = null
  private a = 0; private b = 0
  constructor(private maxWindow = 50) {}
  reset() { this.xs = []; this.offsets = []; this.xRef = null; this.a = 0; this.b = 0 }
  addSample(x: number, y: number) {
    if (this.xRef === null) this.xRef = x
    this.xs.push(x); this.offsets.push(y - x)
    if (this.xs.length > this.maxWindow) { this.xs.shift(); this.offsets.shift(); this.xRef = this.xs[0] }
    this.refit()
  }
  private refit() {
    const n = this.xs.length; if (n === 0) return
    const xr = this.xRef!, xc = this.xs.map(x => x - xr)
    const meanX = xc.reduce((s, v) => s + v, 0) / n
    const meanY = this.offsets.reduce((s, v) => s + v, 0) / n
    let sxx = 0, sxy = 0
    for (let i = 0; i < n; i++) { const dx = xc[i] - meanX; sxx += dx * dx; sxy += dx * (this.offsets[i] - meanY) }
    this.b = sxx > 1e-9 ? sxy / sxx : 0
    this.a = meanY - this.b * meanX
  }
  ready() { return this.xs.length > 0 }
  isOutlier(x: number, y: number, thresholdSec = 0.015) {
    if (this.xs.length < 5) return false
    return Math.abs((y - x) - this.predictOffset(x)) > thresholdSec
  }
  private predictOffset(x: number) { return this.xRef === null ? 0 : this.a + this.b * (x - this.xRef) }
  predict(x: number) { return x + this.predictOffset(x) }
}

class SyncClient {
  private pingId = 0
  private pending = new Map<number, number>() // pingId -> t0 (perf ms)
  private minRtt = Infinity
  public scModel = new LinearClockModel(50)
  public audioModel = new LinearClockModel(50)
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private ws: WebSocket, private toneCtx: { currentTime: number }) {
    ws.addEventListener('open', () => this.onReconnect())
    ws.addEventListener('close', () => this.onReconnect())
    ws.addEventListener('message', ev => this.onMessage(ev))
  }

  private onReconnect() {
    this.scModel.reset(); this.audioModel.reset(); this.pending.clear(); this.minRtt = Infinity
    this.scheduleNext(0, 8, 150)
  }

  private scheduleNext(count: number, burstRemaining: number, intervalMs: number) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.sendPing()
      const nextRemaining = burstRemaining - 1
      const nextInterval = nextRemaining > 0 ? intervalMs : count < 20 ? 500 : 4000
      this.scheduleNext(count + 1, Math.max(nextRemaining, 0), nextInterval)
    }, intervalMs)
  }

  private sendPing() {
    // Bracket the AudioContext read between two performance.now() reads to
    // average out the JS-turn gap between the two clock reads.
    const p0 = performance.now(); const audioTime = this.toneCtx.currentTime; const p1 = performance.now()
    const perfAtAudioSample = (p0 + p1) / 2
    const id = this.pingId++
    this.pending.set(id, perfAtAudioSample)
    this.audioModel.addSample(audioTime, perfAtAudioSample / 1000)
    this.ws.send(JSON.stringify({ type: 'sync', pingId: id }))
  }

  private onMessage(ev: MessageEvent) {
    const msg = JSON.parse(ev.data)
    if (msg.type !== 'syncReply') return
    const t0 = this.pending.get(msg.pingId); if (t0 === undefined) return
    this.pending.delete(msg.pingId)
    const t3 = performance.now(); const rtt = t3 - t0
    if (rtt > 50) return
    this.minRtt = Math.min(this.minRtt, rtt)
    if (rtt > this.minRtt * 1.5) return
    const xSec = (t0 + t3) / 2 / 1000
    const serverTime: number = msg.serverTime
    if (this.scModel.isOutlier(xSec, serverTime)) return
    this.scModel.addSample(xSec, serverTime)
  }

  // AudioContext-domain target -> SC SystemClock.seconds domain, via Model A then Model B.
  audioTimeToScTime(audioTargetTime: number): number {
    const perfTargetSec = this.audioModel.ready() ? this.audioModel.predict(audioTargetTime) : audioTargetTime
    return this.scModel.ready() ? this.scModel.predict(perfTargetSec) : perfTargetSec
  }
}

// usage where Satori currently hands a Tone.js-scheduled event to the WS send path:
function sendSatoriEvent(ws: WebSocket, sync: SyncClient, id: string, type: 'e' | 'm', params: Record<string, any>, audioTargetTime: number) {
  ws.send(JSON.stringify({ id, type, params, atTime: sync.audioTimeToScTime(audioTargetTime) }))
}
```

## Startup / reconnect

- Before any sync samples exist, `audioTimeToScTime` falls back to identity (treats domains as
  aligned) — affects only the first ~1–2s after playback starts or a reconnect. Optionally hold
  the very first event until `scModel.ready()` to avoid an unmodeled first note, at the cost of a
  small fixed startup latency.
- On WS reconnect, discard all prior offset/skew history and restart the fast burst — a new
  AudioContext instance or a restarted bridge/SC process invalidates it.

## Verifying against a running SuperSatori without frontend changes

`apps/bridge/scripts/sync-harness.ts` (run via `npm run sync-harness --workspace=apps/bridge`,
or `npm run sync-harness --workspace=apps/bridge -- --inject` to also fire synthetic events on
stream `s0`) implements this same protocol standalone against a running bridge + `main.scd`, so
the sync round trip and scheduling accuracy can be checked before porting this into Satori.
