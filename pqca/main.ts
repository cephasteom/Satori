import './ui';
// @ts-ignore
import './editor-theme.css';
import { init as initEditor } from '../src/editor';

import { Satori } from '../src/core/Satori';
import { init as initOto } from '../src/oto';
import { init as initSuperSatori } from '../src/core/SuperSatori';
import { handler as midiHandler } from '../src/core/MIDI';
import { init as initWebSocket } from '../src/core/WebSocket';

initEditor();

// select engine to use based on URL param, default to Oto (browser based synth engine)
// SuperSatori (SuperCollider synth engine) can be used by adding ?engine=supersatori to the URL
const urlParams = new URLSearchParams(window.location.search);
const engine = urlParams.get('engine');
const ws = urlParams.get('ws');
const wsPort = parseInt(urlParams.get('wsPort') || '5001');

// handlers process events and are fired on every tick of the scheduler
const handlers = engine === 'supersatori' 
    ? [initSuperSatori()]
    : [initOto(), midiHandler];

// broadcast satori over WebSocket if ?ws=true is in the URL
ws && initWebSocket(wsPort);

// Create a new Satori instance and pass in handlers
const satori = new Satori(...handlers);

window.addEventListener('keydown', (e) => {
    // Play / Stop controls
    if((e.altKey || e.ctrlKey) && e.key === 'Enter') satori.play();
    if((e.altKey || e.ctrlKey) && e.code === 'Period') {
        e.preventDefault();
        satori.stop();
    }
});

let isRunning = false;
document.getElementById('run-btn')?.addEventListener('click', () => {
    if(isRunning) {
        isRunning = false;
        return satori.stop();
    }
    // send a triggerEvaluate event to the global scope, which the editor listens out for to trigger code evaluation
    window.dispatchEvent(new CustomEvent("triggerEvaluate"));
    satori.play();
    isRunning = true;
});