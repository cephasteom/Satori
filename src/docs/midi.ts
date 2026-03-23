export default `
To send MIDI Note and Control Change messages from a stream, set the \`midi\` parameter to one of the available outputs shown when running \`midi()\`. You can also configure the MIDI channel with \`midichan\` and add timing offset with \`mididelay\`.

\`\`\`js
s0.set({ 
    midi: '!My MIDI Device', // name of MIDI output - escape with ! to avoid pattern matching
    midichan: 1, // sends to all channels if not specified (optional)
    mididelay: 100, // delay in ms for syncing with audio (optional)
    n: 60, // MIDI note number
    dur: 500, // note duration in ms
    amp: 0.8, // note velocity (0-1)
    cc74: 0.9, // CC74 value (0-1)  
})
\`\`\`
`