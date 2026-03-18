import Pattern from './Pattern.json'
import { marked } from 'marked';

// extract all Pattern methods
export const patternMethods: Record<string, any> = (Pattern.children.find((item) => item.name === 'methods')?.type?.declaration?.children || [])
    .reduce((obj, item) => ({
        ...obj,
        [item.name]: {
            description: item.comment?.summary
                .filter((comment) => comment.kind === 'text')
                .reduce((desc, comment) => desc + comment.text, '') || '',
            examples: (item.comment?.blockTags || [])
                .filter((example) => example.tag === '@example')
                .map((example) => example.content[0]?.text || '')
        }
    }), {} as Record<string, any>);

export const patternDoc = `
<ul class="docs__list">
    <p>Patterns are the building blocks of Satori. They can be used to control any stream parameter.</p>
    ${marked(`\`\`\`typescript
s0.set({  
    inst: 'synth',
    n: seq(60,62,64,65),
    fx0: sine().fast(2),
    amp: '0.5 1'.fast(4), // you can chain pattern methods off mini-notation strings
    dtime: (1).ctms(), // call pattern methods off numbers
    e: seq(1,seq(1,1,1,1),1,1)
})
\`\`\``)}
    <li>
        <h4>JS Math</h4>
        <p>The JS Math object provides basic mathematical operations as Pattern methods. These can be used as a chained method or as standalone functions where the first argument is the value to operate on.</p>
        ${marked(`\`\`\`typescript
sine(0,10).floor() // rounds down to nearest integer
floor(sine(0,10)) // same as above, but with value as first argument instead of last
\`\`\``)}
    ${Object.entries(patternMethods).map(([name, info]) => `
        <li>
            <h4>${name}</h4>
            <p>${info.description}</p>
            ${info.examples.length > 0 ? `
                ${marked(info.examples.join('\n'))}
            ` : ''}
        </li>
    `).join('')}
    <li>
        <h4>Operators</h4>
        <p>Every operator from the JS <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math" target="_blank">Math object</a> is a Pattern method.</p>
        ${marked(`\`\`\`typescript
s0.set({  
    inst: 'synth',
    n: seq(60,62,64,65).add(12), // transposes up an octave
    amp: random().mul(0.5).add(0.5), // random amplitude between 0.5 and 1
    e: seq(1,1,1,1)
})
\`\`\``)}
    </li>
</ul>`;