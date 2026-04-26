import { version } from '../../package.json';

const channel = new BroadcastChannel('satori');
channel.addEventListener('message', (e) => log(e.data.type, e.data.message));
let hasInitialized = false;

let messages: {type: string, message: string}[] = [
    {type: 'success', message: `v${version}`},
    {type: 'success', message: `© <a href="https://cephasteom.co.uk" target="_blank">Cephas Teom</a> ${new Date().getFullYear()}`},
    {type: 'info', message: `Please report any issues on <a href="https://github.com/cephasteom/satori/issues" target="_blank">GitHub</a>.`},
    {type: 'info', message: '`ctrl+return`/`alt+return` to play. `ctrl+.`/`alt+.` to stop.'},
    {type: 'info', message: '`cmd+1` console, `cmd+2` docs, `cmd+3` circuit.'},
    {type: 'info', message: '`samples()`, `instruments()`, `effects()`, and `midi()` for lists.'},
]

function log(type: string, message: string) {
    messages = type === 'clear' 
        ? messages.slice(0, 2)
        : [...messages, { type, message }];
    hasInitialized && render();
}

function render(element: string = '#console') {
    const console = document.querySelector(element);
    if (!console) return;

    console.innerHTML = `
        <div class="console__messages">
            ${
                messages
                    // wrap any `...` between in <code> tags
                    .map(message => {
                        const formattedMessage = message.message.replace(/`{3}([\s\S]*?)`{3}/g, (_match, p1) => {
                            return `<pre><code>${p1}</code></pre>`;
                        }).replace(/`{1}([\s\S]*?)`{1}/g, (_match, p1) => {
                            return `<code>${p1}</code>`;
                        });
                        return { type: message.type, message: formattedMessage };
                    })
                    .map(message => `<${message.type === 'title' ? 'h2' : 'p'} class="console__message console__message--${message.type}">${message.message}</${message.type === 'title' ? 'h1' : 'p'}>`).join('')
            }
        </div>
    `;

    const container = console.querySelector('.console__messages');
    container && messages.length > 9 && (container.scrollTop = container.scrollHeight);
}

export const init = () => { render(); hasInitialized = true; }