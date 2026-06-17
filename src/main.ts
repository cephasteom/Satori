import { Satori } from './core/Satori';
import { init as initOto } from './oto';
import { init as initSuperSatori } from './core/SuperSatori';
import { handler as midiHandler } from './core/MIDI';
import { init as initWebSocket } from './core/WebSocket';

import './docs/style.css';
import { init as initDocs } from './docs';
import { init as initEditor } from './editor';
import './editor/theme.css';
import { init as initConsole } from './console';
import './console/style.css';
import examples from './examples';

const urlParams = new URLSearchParams(window.location.search);

// ensure a room name is always in the URL so it's ready to share;
// if one is already present (someone joining a session), keep it as-is
// if (!urlParams.has('room')) {
//     urlParams.set('room', crypto.randomUUID());
//     history.replaceState(null, '', `?${urlParams}${window.location.hash}`);
// }

// initialize UI components
initDocs();
initEditor({
    background: '#282828', 
    fontFamily: '"IBM Plex Mono", monospace',
    letterSpacing: '2',
    fontSize: '14'
});
initConsole();

// select engine to use based on URL param, default to Oto (browser based synth engine)
// SuperSatori (SuperCollider synth engine) can be used by adding ?engine=supersatori to the URL
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

const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const stopIcon = document.getElementById('stop-icon');
const playLabel = playBtn?.querySelector('span');
let isPlaying = false;

const setPlayState = (playing: boolean) => {
    isPlaying = playing;
    if (playIcon) playIcon.style.display = playing ? 'none' : '';
    if (stopIcon) stopIcon.style.display = playing ? '' : 'none';
    if (playLabel) playLabel.textContent = playing ? 'Stop' : 'Play';
    playBtn?.classList.toggle('active', playing);
};

playBtn?.addEventListener('click', () => {
    if (isPlaying) {
        satori.stop();
        setPlayState(false);
    } else {
        window.dispatchEvent(new CustomEvent("triggerEvaluate"));
        satori.play();
        setPlayState(true);
    }
});

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
    const button = document.querySelectorAll('.sidebar button:not(#play-btn)')[index];
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

document.querySelectorAll('.sidebar button:not(#play-btn)').forEach((button, index) => {
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
    if((e.altKey || e.ctrlKey) && e.key === 'Enter') {
        satori.play();
        setPlayState(true);
    }
    if((e.altKey || e.ctrlKey) && e.code === 'Period') {
        e.preventDefault();
        satori.stop();
        setPlayState(false);
    }
});

const modalOverlay = document.getElementById('modal-overlay');
const examplesBtn = document.getElementById('examples-btn');
const modalClose = document.getElementById('modal-close');

const openModal = () => modalOverlay?.classList.remove('hidden');
const closeModal = () => modalOverlay?.classList.add('hidden');

examplesBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
});

modalClose?.addEventListener('click', closeModal);

modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

document.querySelectorAll('.example-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.example as string;
        const code = examples[key as keyof typeof examples];
        if (code) {
            window.dispatchEvent(new CustomEvent('setCode', { detail: { code } }));
            closeModal();
        }
    });
});