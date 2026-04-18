# Satori
A live coding language for unlimited pattern interference. It supersedes Zen, which was restricted to grid-based event triggering. Satori offers fully flexible timing, and allows parameters from any musical layer to control or transform those of any other. As with Zen, it also includes a simple API for designing, running, and sonifying quantum algorithms via its built-in simulator.

The codebase is modular by design. You can use Satori as a complete live coding environment—combining the core language, editor, console, help docs, and synthesis engine—or import individual modules into your own projects. See the docs below for different use cases. A fully functional version of Satori is hosted at: [satori.cephasteom.co.uk](https://satori.cephasteom.co.uk).

## Local Development
To run this project locally, as a complete application:
* clone this repo
* run `nvm use` (node version manager) to change node to correct version
* `npm i` to install dependencies
* `npm run dev` for hot file reloading
* or `npm run build` and `npm run preview` to use bundled package

## To use Satori in your own applications
```js
import { Satori } from './core/Satori';

// Create a new scheduler instance and pass in event handlers
const satori = new Satori(...);
// evaluate some Satori code
satori.evaluate('...') 

// play / stop
satori.play()
// satori.stop()
```

Handlers are functions that process events. Each event has an ID (source), parameters, a trigger time, and a flag indicating whether it is a mutation or a regular event.
```ts
type Event = {id: string, params: Record<string, any>, time: number, type: 'e' | 'm'};
```

You can create custom handlers for Satori to connect to your system, or use Satori’s built-in ones.
```js
import { init as initOto } from './oto';
import { handler as midiHandler } from './core/MIDI';

const otoHandler = initOto() // initialise the synth engine and get its handler
const satori = new Satori(
    otoHandler, // Satori now triggers events in Oto
    midiHandler // as well as MIDI
);
```

## To use standalone synth engine (Oto)
You can use the synth engine directly, without the need to write Satori code. Simply initialise Oto, then send your own events via the handler.
```js
import { init } from './oto';

const otoHandler = init()

otoHandler({ id: 'custom', params: {...}, time: 3.5, type: 'e' })
```

## To use standalone patterning language
```js
import { Pattern, methods } from './core/Pattern'

const p = new Pattern()
console.log(p.sine().query(0,1)) // query pattern between 0 and 1 cycles

const { saw } = methods // if you want to nest, get nested methods from methods object
const p2 = new Pattern()
console.log(p2.coin().fast(8).ifelse(
    saw(0,10),
    saw(10,1)
))
```

## To use the standalone code editor
```js
import { init } from './editor'

init('#editor')

window.addEventListener("evaluateCode", (e) => console.log(e.detail.code));
```

Will load the editor in the element provided by the id. Default is `#editor`. Listen out for the `evaluateCode` event to handle the editor output.

## To use the standalone console
```js
import { init } from './console';

init('#console')

const channel = new BroadcastChannel('satori');
channel.postMessage({ type: 'info', message: 'a message' } );
```

Initialise the console, passing in the element in which it should render. Default is `#console`. Send messages to the console using the BroadcastChannel interface. Types are `info`, `success`, and `error`.

## Acknowledgements
* This series of blog posts by Froos helped me finally crack time: [garten.salat.dev](https://garten.salat.dev/idlecycles/).
* Code editor built with: [Prism](https://github.com/jonpyt/prism-code-editor/?tab=readme-ov-file).
* Mini-language built on: [PegJS](https://github.com/pegjs/pegjs).
* Quantum simulator built with: [Quantum Circuit](https://www.npmjs.com/package/quantum-circuit).
