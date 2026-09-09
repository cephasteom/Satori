import Stream from './Stream.json'
import { marked } from 'marked';

export const streamMethods: Record<string, any> = (Stream.children[0]?.children?.filter((item) => ['set'].includes(item.name)) || [])
    .reduce((obj, item) => ({
        ...obj,
        [item.name]:
        {
            // @ts-ignore
            description: (item.signatures[0]?.comment?.summary || [])
                // @ts-ignore
                .filter((comment) => comment.kind === 'text')
                // @ts-ignore
                .reduce((desc, comment) => desc + comment.text, ''),
            // @ts-ignore
            examples: (item.signatures[0]?.comment?.blockTags || [])
                // @ts-ignore
                .filter((example) => example.tag === '@example')
                // @ts-ignore
                .map((example) => example.content[0]?.text || '')
        }
    }), {} as Record<string, any>);

export const streamDoc = `
<p>A Stream represents a musical layer. There are 16 instrument streams (s0 to s15) and 4 fx streams (fx0 to fx3).</p>
    <ul class="docs__list">
        <li>
            <h4>set</h4>
            <p>Set parameters on the Stream.</p>
            ${marked(streamMethods['set'].examples.join('\n'))}
        </li>
        <li>
            <h4>Fx streams</h4>
            <p>Send signal to an fx stream:</p>
            ${marked(`\`\`\`typescript
s0.set({  
    inst: 'synth',
    n: 'Ddor%16..',
    fx0: 0.5, // send 50% of signal to fx0
    e: '1*2',
})

fx0.set({
    reverb: 1, // set reverb on the fx stream
    delay: 0.5, // set delay
    e: '1*8', // fx streams are regular streams, so need to be triggered
})
\`\`\``)}
        </li>
        <li>
            <h4>Special Parameters</h4>
            <p>Some parameters effect the behaviour of the stream:</p>
${marked(`\`\`\`typescript
s0.set({ mute: '0 1 0 1' )} // mute stream
\`\`\``)}
${marked(`\`\`\`typescript
s0.set({ cut: 's0' )} // cut self when an event is triggered
\`\`\``)}
${marked(`\`\`\`typescript
s0.set({ cut: 0 )} // or use integer index
\`\`\``)}
${marked(`\`\`\`typescript
s0.set({ cut: s0 )} // or use stream itself
\`\`\``)}
${marked(`\`\`\`typescript
s0.set({ cut: ['s0', 's1', 's2'] )} // cut self and other streams
\`\`\``)}
${marked(`\`\`\`typescript
s0.set({ cut: [0,1,2] )} // equivalent using integer indices
\`\`\``)}
${marked(`\`\`\`typescript
s0.set({ cut: 'all' )} // cut all other streams
\`\`\``)}
${marked(`\`\`\`typescript
s1.set({
  inst: 'synth', n: 'Cmi%16', 
  strum: ctms(1/8), // strum staggers notes (in ms) when multiple notes are played
  e: '1|0'})
\`\`\``)}
        </li>
        <li>
            <h4>Stream Interference</h4>
            <p>You can use stream parameters as vales for other stream parameters and pattern arguments. This allows for interesting interactions between streams.</p>
            ${marked(`\`\`\`typescript
s0.set({ n: 'Cmi7', // set s0 to play C minor 7
    e: '1*4' }) // and trigger every 4 steps
s1.set({ n: s0.n.add(12), // s1 uses s0's note + 12 semitones
    e: not(s0.e).and('1*8') }) // s1 triggers on 8th notes, but only when s0 is not triggering
\`\`\``)}
        </li>
        <li>
            <h4>Updating parameters in place</h4>
            <p>Once a parameter has been set, calling a pattern method on it (like <code>.add()</code> above) is <em>pure</em> - it returns a new pattern and leaves the parameter untouched, which is what makes Stream Interference above safe. <code>.set()</code> is the exception: calling <code>.set()</code> directly on a parameter replaces it in place. Only what's enclosed within <code>.set()</code> actually updates the value - any pattern methods used to build that argument are still just building a value, not mutating anything themselves.</p>
            ${marked(`\`\`\`typescript
s0.set({ n: 60 })
s0.n.add(2) // pure: returns a new pattern, s0.n is still 60
s0.n.set(65) // mutates: s0.n is now 65
s0.n.set((2).add(2)) // mutates: sets n to 2 + 2 - only the outer set() commits it
\`\`\``)}
            <p>If a parameter has never been set, calling <em>any</em> pattern method on it populates it, equivalent to using <code>.set()</code>. Once populated, it follows the rule above - only <code>.set()</code> updates it again.</p>
            ${marked(`\`\`\`typescript
s0.e.once() // e was never set, so this populates it - same as s0.set({ e: once() })
s0.e.once() // e is now set, so this is a pure call and does not reset it again
\`\`\``)}
        </li>
    </ul>`