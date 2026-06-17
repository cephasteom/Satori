import json from './instruments.json'
import { sharedKeys } from './utils';
import { marked } from 'marked';

const getMethods = (json: any[]): Record<string, any> => {
    return json
        .filter((item) => !item.name.startsWith('_'))
        .reduce((obj, item) => ({
            ...obj,
            [item.name]:
            {
                description: (item.signatures ? item.signatures[0]?.comment?.summary || [] : [])
                    .filter((comment: Record<string, string>) => comment.kind === 'text')
                    .reduce((desc: string, comment: Record<string, string>) => desc + comment.text, ''),
                examples: (item.signatures ? item.signatures[0]?.comment?.blockTags || [] : [])
                    .filter((example: Record<string, string>) => example.tag === '@example')
                    .map((example: Record<string, string[]>) => example.content[0]?.text || '')
            }
        }), {} as Record<string, any>);
}

export const instruments = {
    synth: getMethods(json.children[0].children[0]?.children || []),
    sampler: getMethods(json.children[2].children[0]?.children || []),
    granular: getMethods(json.children[1].children[0]?.children || []),
    acid: getMethods(json.children[3].children[0]?.children || []),
    ['tone.synth']: getMethods(json.children[4].children[0]?.children || []),
    ['tone.am']: getMethods(json.children[5].children[0]?.children || []),
    ['tone.fm']: getMethods(json.children[6].children[0]?.children || []),
    ['tone.mono']: getMethods(json.children[7].children[0]?.children || [])
}

const sharedMethods = sharedKeys(...Object.values(instruments)).reduce((obj, key) => {
    obj[key] = instruments.synth[key]; // Assuming all instruments have the same keys, take from Synth
    return obj;
}, {} as Record<string, any>);

export const instrumentsDoc = `
Satori includes a default Synth, Sampler, Granular, and AcidSynth instrument. You can set the instrument on a stream using the <code>inst</code> parameter:
${marked(`\`\`\`typescript
s0.set({ inst: 'synth' }) // set synth instrument
s1.set({ inst: 'sampler' }) // set sampler instrument
s2.set({ inst: 'granular' }) // set granular instrument
s3.set({ inst: 'acid' }) // set acid synth instrument
s4.set({ inst: 'tone.synth' }) // set tone synth instrument
s5.set({ inst: 'tone.am' }) // set am synth instrument
s6.set({ inst: 'tone.fm' }) // set fm synth instrument
s7.set({ inst: 'tone.mono' }) // set mono synth instrument
\`\`\``)}
<h3>Shared Parameters</h3>
${Object.entries(sharedMethods).map(([name, info]) => `
    <ul class="docs__list">
        <li>
            <h4>${name}</h4>
            <p>${info.description}</p>
            ${info.examples.length > 0 ? `
                ${marked(info.examples.join('\n'))}
            ` : ''}
        </li>
    </ul>
`).join('')}
${Object.entries(instruments).map(([instrumentName, methods]) => `
    <h3>${instrumentName}</h3>
    <ul class="docs__list">
        ${Object.entries(methods)
            .filter(([name]) => !(name in sharedMethods))
            .map(([name, info]) => `
            <li>
                <h4>${name}</h4>
                <p>${info.description}</p>
                ${info.examples.length > 0 ? `
                    ${marked(info.examples.join('\n'))}
                ` : ''}
            </li>
        `).join('')}
    </ul>
`).join('')}
`