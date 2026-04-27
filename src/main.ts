import { Satori } from './core/Satori';
import { init as initOto } from './oto';
import { init as initSuperSatori } from './core/SuperSatori';
import { handler as midiHandler } from './core/MIDI';
import { init as initWebSocket } from './core/WebSocket';

import { init as initDocs } from './docs';
import { init as initEditor } from './editor';
import './editor/theme.css';
import { init as initConsole } from './console';
import './console/style.css';

// initialize UI components
initDocs();
initEditor();
initConsole();

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
const satori = new Satori(handlers);

// Handle hide/show of help components
const toggleComponent = (id: string, displayStyle: string = 'block') => {
    const el = document.getElementById(id);
    if(!el) return;
    el.style.display = el.style.display === 'none'
        ? displayStyle
        : 'none';

    // When all help components are hidden, hide the parent container too
    const help: HTMLElement | null = document.querySelector('.help');
    if(!help) return;
    help.style.display = Array.from(help?.children || [])
        // @ts-ignore
        .map((c: Element) => c.style.display)
        .every(style => style === 'none')
            ? 'none'
            : 'flex';
}

// save active components to localStorage so they persist across reloads
const saveActiveComponent = (name: string) => {
    const activeComponents = localStorage.getItem('satori.activeComponents')?.split(',') || [];
    const index = activeComponents.indexOf(name);
    index > -1
        ? activeComponents.splice(index, 1)
        : activeComponents.push(name);
    localStorage.setItem('satori.activeComponents', activeComponents.join(','));
}

const toggleButtonActive = (index: number) => {
    const button = document.querySelectorAll('.sidebar button')[index];
    if(button) button.classList.toggle('active');
}

const components = ['console', 'docs', 'circuit'];
const activeComponents = localStorage.getItem('satori.activeComponents')?.split(',') || ['console'];

activeComponents.forEach(component => {
    if(components.includes(component)) {
        toggleComponent(component);
        toggleButtonActive(components.indexOf(component));
    }
});

document.querySelectorAll('.sidebar button').forEach((button, index) => {
    button.addEventListener('click', () => {
        toggleComponent(components[index]);
        toggleButtonActive(index);
        saveActiveComponent(components[index]);
    });
});

window.addEventListener('keydown', (e) => {
    // Toggle help components with meta key + number (1: console, 2: docs, 3: circuit)
    if(e.metaKey && parseInt(e.key) < components.length + 1) {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        toggleComponent(components[index]);
        toggleButtonActive(index);
        saveActiveComponent(components[index]);
    }

    // Play / Stop controls
    if((e.altKey || e.ctrlKey) && e.key === 'Enter') satori.play();
    if((e.altKey || e.ctrlKey) && e.code === 'Period') {
        e.preventDefault();
        satori.stop();
    }
});