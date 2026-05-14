import { marked } from 'marked';

export default `
    <p>Satori is a JS live coding environment for the browser. <code>ctrl+return</code> or <code>alt+return</code> to play. <code>ctrl+.</code> or <code>alt+.</code> to stop.</p>
    <p>Streams are musical layers, represented by <code>s0</code>, <code>s1</code>, ... <code>s15</code>. Parameters are determined by an object passed to the <code>.set()</code> method.</p>
    <p>Parameter values can be raw:</p>
    ${marked(`\`\`\`typescript
s0.set({ inst: 'synth', note: 60, dur: 0.5 })
\`\`\``)}
    <p>patterns:</p>
    ${marked(`\`\`\`typescript
s1.set({ note: seq(60,62,64,65), dur: sine().add(.25) })
\`\`\``)}   
    <p>or mini-notation:</p>
    ${marked(`\`\`\`typescript
s2.set({ note: 'Ddor%16..' })
\`\`\``)}   
    <p>Trigger an event using <code>e</code>:</p>
    ${marked(`\`\`\`typescript
s3.set({ ..., e: seq(1,0,1) })
\`\`\``)}
    <p>Mutations modulate all active voices on a Stream, with parameters prefixed by <code>_</code>. Trigger a mutation using <code>m</code>:</p>
    ${marked(`\`\`\`typescript
s4.set({ 
    n: 'Cmi..', // doesn't mutate
    _pan: sine(), // does mutate
    e: seq(1,0,1,0), // use e to trigger an event
    m: '1*8' // use m to trigger a mutation every 8 steps
})
\`\`\``)}`