# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Satori is a live coding language for pattern-based music (and quantum circuit sonification). It supersedes an earlier project called Zen. Users write Satori mini-language code in a browser editor; it's parsed/compiled into scheduled events which drive a synth engine (Oto, built on RNBO/Faust/Tone.js) or SuperCollider (via SuperSatori, a companion project at github.com/cephasteom/supersatori), plus MIDI and WebSocket outputs.

The codebase is modular: it can run as the full app (editor + console + docs + synth engine) or individual pieces (`core`, `oto`, `editor`, `console`) can be imported standalone into other projects. See README.md for standalone usage examples of each module.

## Commands

- `nvm use` — set Node version (see `.nvmrc`); required before installing/running
- `npm i` — install dependencies (also initializes the `src/oto/ct-synths` git submodule, which itself has its own `node_modules`/`package.json`)
- `npm run dev` — start Vite dev server with hot reload
- `npm run build` — typecheck (`tsc`) then build with Vite (builds two entry points: `index.html` and `pqca/index.html`)
- `npm run preview` — serve the built bundle
- `npm run docs` — regenerate `src/docs/*.json` API docs via typedoc (also `docs:pattern`, `docs:stream`, `docs:instruments`, `docs:fx` individually)
- No automated test suite / linter is configured. `src/tests/websockets.cjs` is a manual script for exercising the WebSocket round-trip (`node src/tests/websockets.cjs`), not a test runner.

## Architecture

### Scheduling loop
`src/core/Satori.ts` is the top-level scheduler. It runs a Tone.js `Loop` ticking `divisions` (48) times per cycle. Each tick it calls `compile(from, to)` to query all patterns over that time window, then dispatches the resulting events to whatever `handlers` were passed into the `Satori` constructor (e.g. Oto's handler, MIDI handler, SuperSatori handler). `cps` (cycles per second) is itself pattern-controlled and updates the Tone.js transport BPM live.

### Compile pipeline
`src/core/compile.ts` — `evaluate(code)` runs user code through `parseShorthand` (`src/core/parse.ts`, which rewrites the indentation-based shorthand like `s0 \n n '...'` into `s0.set({...})` calls) and executes it inside a `new Function(...)` with a controlled `scope` object exposing streams, qubits, pattern methods, and utilities — this is the sandbox the user's live-coded language runs in. `compile(from, to)` then queries every active `Stream`/`Qubit`/canvas stream over the given cycle range to produce the `global`, `streams`, and `canvas` event lists consumed by the scheduler.

### Streams and Patterns
- `Stream` (`src/core/Stream.ts`) is a musical layer/track (`s0`..`s15`, `fx0`..`fx3`, plus `global` and `canvas`). `.set({...})` assigns parameters, which are either `Pattern` instances or values wrapped via `methods.set`.
- `Pattern` (`src/core/Pattern.ts`, ~1900 lines) is the core pattern-query engine (Tidal-Cycles-inspired): patterns are queried over a cycle range to produce `Hap`s (time-value events). This is the largest and most central file — most pattern-transformation methods (`.fast`, `.slow`, `.every`, `.ifelse`, etc.) live here, and are also exposed to user code via the `methods` export.
- `src/core/mini.ts` + PegJS grammar (`.pegjs`, via the `pegjs` dependency) implement the mini-notation string syntax (e.g. `'1*4'`, `'Ddor..'`) used inside pattern strings.
- `src/core/scales.ts`, `src/core/chords.ts` — music theory data/helpers used by the mini-notation and pattern methods.

### Synth engine (Oto)
`src/oto/index.ts` initializes the browser-based synth engine: it listens for user-gesture events to unlock Web Audio, then `handler(event, time)` dispatches `'e'` (note event), `'m'` (mutation — modulates already-active voices), and `'cut'` events to per-channel `Channel` instances (`src/oto/Channel.ts`). Instruments/effects themselves live in the `src/oto/ct-synths` **git submodule** (separate repo: cephasteom/ct-synths) — it's organized by underlying synthesis tech: `rnbo/` (RNBO/Max-compiled wasm instruments), `faust/` (Faust DSP), `tone/` (Tone.js synths).

### Alternate/parallel engine
`src/core/SuperSatori.ts` sends the same event stream to a SuperCollider backend over a connection (see the separate `supersatori` repo), selected at runtime via `?engine=supersatori` URL param instead of the default Oto handler.

### Quantum circuit support
`src/core/Qubit.ts` and `src/core/CA.ts`/`src/core/ca.core.ts`/`src/core/ca.worker.ts` (cellular automata, run in a Web Worker via `CAWorkerClient.ts`) implement Satori's built-in quantum circuit simulator (backed by the `quantum-circuit` package), letting user code build/run quantum circuits whose measurement results feed back into patterns. `PQCA.ts` and the top-level `pqca/` directory are a separate build entry point (`pqca/index.html`, its own `main.ts`/`ui.ts`/`presets.ts`) — a fork of the project focused on Partitioned Quantum Cellular Automata, built as a second Vite rollup input alongside the main app.

### UI modules
Each is a standalone, independently importable module with an `init(selector, ...)` entry point:
- `src/editor/` — code editor (built on `prism-code-editor`; `collab.ts` handles collaborative/room editing)
- `src/console/` — output console, driven by the `BroadcastChannel('satori')` API (any module can `postMessage` `{type: 'info'|'success'|'error', message}` to it)
- `src/docs/` — in-app documentation/examples browser; content authored in the `.ts` files here (`patterns.ts`, `streams.ts`, `instruments.ts`, etc.) alongside generated `*.json` typedoc output
- `src/canvas/` — visual/canvas output driven by the `canvas` stream's events
- `src/examples/` — bundled example pieces of Satori code (`breaks.ts`, `qcm.ts`)

### Cross-cutting communication
- **BroadcastChannel `'satori'`** is the primary decoupled messaging bus between modules (console messages, audio-start notifications, etc.) — check for `new BroadcastChannel('satori')` when tracing how modules talk to each other without direct imports.
- **`window.postMessage`** is used for a few specific signals, e.g. `{type: 'clearCache'}` fired on every `evaluate()` to reset memoized pattern functions.
- **WebSocket** (`src/core/WebSocket.ts`, enabled via `?ws=true&wsPort=<port>`) broadcasts evaluated code (`code`, `qasm`, `qiskit`) out to external listeners and can also receive code/dataset input from outside.
- **MIDI** (`src/core/MIDI.ts`, `src/core/MidiInput.ts`) — output handler plus input handling via `webmidi`.

## Working with the `ct-synths` submodule

`src/oto/ct-synths` is a git submodule pointing at a separate repository (cephasteom/ct-synths). Changes to instruments/effects belong there, not in this repo. Run `git submodule update --init` if it appears empty after clone. It has its own `package.json`/`node_modules`.
