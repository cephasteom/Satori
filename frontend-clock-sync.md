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
- Track an RTT floor over a **rolling window of the last ~30 raw RTTs**, taken as the **20th
  percentile** of that window (not the strict minimum — see the callout below), and admit a
  sample only if `rtt <= floor * 2 + 2ms`.
- Liveness fallback: force-accept a sample if it's been ≥10 seconds (wall-clock time, not ping
  count) since the last accepted sample, regardless of the RTT band or the outlier check, so the
  model can never go stale for longer than that, whatever the current ping cadence is.
- Once the model has ≥5 samples, reject if the implied offset disagrees with the current
  model's prediction by more than 15ms (catches fast-but-wrong outliers the RTT filter misses;
  skipped when the liveness fallback fires, since a real regime change is exactly what that
  fallback exists to admit).

**Two things caught in real testing, both worth not re-introducing:**

1. *Don't use an all-time running minimum for the RTT floor.* An earlier version did
   (`minRtt = Math.min(minRtt, rtt)`, reject unless `rtt <= minRtt * 1.5`), and it froze:
   real loopback RTT jitter bounces in a several-ms band, so as soon as one unusually fast
   round trip set `minRtt` low (observed: 1.00ms), every later sample fell outside `1.5x` of it
   and got rejected — permanently, since the minimum only ever tightens.
2. *A rolling **minimum** doesn't fully fix that either — use a percentile.* Switching to a
   bounded rolling window still leaves the same failure mode, just slower: at the steady-state
   ~4s ping interval, a 30-sample window takes ~2 minutes to flush out one lucky low sample,
   during which the floor (and thus the acceptance band) stays artificially tight. A percentile
   (here, the 20th) fixes this at the root — one fluke sample can't single-handedly set the
   floor, it takes a real cluster of fast samples to move it, so the floor tracks the *typical*
   best case rather than the *luckiest-ever* one.

Both times, the symptom was the same: the model silently stopped updating for extended periods
while continuing to report an increasingly stale offset/skew — exactly the kind of silent
wander this whole design exists to prevent. The liveness fallback is a backstop for whatever
this percentile approach still misses, not the primary fix; being time-based (not a count of
rejected attempts) matters because the ping cadence itself changes between burst and steady
state, so a fixed *attempt* count implies a wildly different *time* bound depending on when it
fires.

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

// Rolling-window, percentile-based RTT floor — see "Sample filtering" above for why
// percentile-of-window, not an all-time or windowed strict minimum.
class RttFloor {
  private samples: number[] = []
  constructor(private windowSize = 30, private percentile = 0.2) {}
  push(rtt: number) {
    this.samples.push(rtt)
    if (this.samples.length > this.windowSize) this.samples.shift()
  }
  reset() { this.samples = [] }
  get value() {
    if (!this.samples.length) return Infinity
    const sorted = [...this.samples].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * this.percentile)]
  }
}

const FORCE_ACCEPT_AFTER_MS = 10_000 // liveness backstop: never let the model go stale longer than this, whatever the ping cadence is

class SyncClient {
  private pingId = 0
  private pending = new Map<number, number>() // pingId -> t0 (perf ms)
  private rttFloor = new RttFloor(30)
  private lastAcceptedAt = performance.now()
  public scModel = new LinearClockModel(50)
  public audioModel = new LinearClockModel(50)
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private ws: WebSocket, private toneCtx: { currentTime: number }) {
    ws.addEventListener('open', () => this.onReconnect())
    ws.addEventListener('close', () => this.onReconnect())
    ws.addEventListener('message', ev => this.onMessage(ev))
  }

  private onReconnect() {
    this.scModel.reset(); this.audioModel.reset(); this.pending.clear()
    this.rttFloor.reset(); this.lastAcceptedAt = performance.now()
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

    this.rttFloor.push(rtt)
    const floor = this.rttFloor.value
    const withinBand = rtt <= floor * 2 + 2
    const forceAccept = (t3 - this.lastAcceptedAt) >= FORCE_ACCEPT_AFTER_MS
    if (!withinBand && !forceAccept) return

    const xSec = (t0 + t3) / 2 / 1000
    const serverTime: number = msg.serverTime
    if (!forceAccept && this.scModel.isOutlier(xSec, serverTime)) return

    this.lastAcceptedAt = t3
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
