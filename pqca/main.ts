import './ui';
import { Satori } from '../src/core/Satori';
import { presets } from './presets';
// @ts-ignore
import './editor-theme.css';
import { init as initEditor } from '../src/editor';
import { init as initConsole } from '../src/console';
import { init as initDocs } from '../src/docs';

import { init as initOto } from '../src/oto';
import { init as initSuperSatori } from '../src/core/SuperSatori';
import { handler as midiHandler } from '../src/core/MIDI';
import { init as initWebSocket } from '../src/core/WebSocket';
import { init as initCanvas } from '../src/canvas';

initEditor({background: '#0a0a0a'});
initConsole();
initDocs();

// select engine to use based on URL param, default to Oto (browser based synth engine)
// SuperSatori (SuperCollider synth engine) can be used by adding ?engine=supersatori to the URL
const urlParams = new URLSearchParams(window.location.search);
const engine = urlParams.get('engine');
const ws = urlParams.get('ws');
const preset = urlParams.get('preset');
const wsPort = parseInt(urlParams.get('wsPort') || '5001');

// handlers process events and are fired on every tick of the scheduler
const handlers = engine === 'supersatori' 
    ? [initSuperSatori()]
    : [initOto(), midiHandler];

// broadcast satori over WebSocket if ?ws=true is in the URL
ws && initWebSocket(wsPort);

// Create a new Satori instance and pass in handlers
const satori = new Satori(handlers, [initCanvas()]);

const runBtn = document.getElementById('run-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
let isRunning = false;

const transportTime = document.getElementById('transport-time') as HTMLDivElement;
let startTime: number = 0;
const updateTime = () => {
    const elapsed = Date.now() - startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const milliseconds = Math.floor((elapsed % 1000) / 10);
    if(transportTime) transportTime.innerHTML = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
    isRunning 
     ? requestAnimationFrame(updateTime)
     : (transportTime.innerHTML = `00:00:00`);
}

const play = () => {
    if(isRunning) return;
    startTime = Date.now();
    satori.play();
    isRunning = true;
    updateTime();
    runBtn.classList.add('is-running');
    stopBtn.classList.add('is-running');
}

const stop = () => {
    satori.stop();
    satori.cut();
    isRunning = false;
    runBtn.classList.remove('is-running');
    stopBtn.classList.remove('is-running');
}

window.addEventListener('keydown', (e) => {
    // Play / Stop controls
    if((e.altKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        play();
    }
    if((e.altKey || e.ctrlKey) && e.code === 'Period') {
        e.preventDefault();
        stop();
    }
});

let isFirstRun = true
runBtn?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent("triggerEvaluate"));
    play();
    if(isFirstRun) {
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent("triggerEvaluate")) // bit of a hack to ensure synths have loaded
            isFirstRun = false
        }, 1000)
    }
});

stopBtn?.addEventListener('click', stop);

const presetBts = document.querySelectorAll('.preset-btn')
if(preset) {
    const code = presets[+preset];
    if(!code ) console.warn(`Preset ${preset} not found`);
    else {
        // send a setCode event to the global scope, which the editor listens out for to set the code in the editor
        window.dispatchEvent(new CustomEvent("setCode", { detail: { code } }));
        // set presetBtn active
        [...presetBts]
            .find(btn => btn.getAttribute('data-preset') === preset)
            ?.classList.add('active')
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('preset');
    window.history.replaceState({}, '', url);
}