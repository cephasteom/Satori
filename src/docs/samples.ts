export default `
To use your own samples, you can provide a JSON file with the following structure:
\`\`\`js
{
    "_base": "https://yourdomain.com/path/to/samples/",
    "bank1": ["bank1/sample1.wav", "bank1/sample2.wav", "bank1/sample3.wav"],
    "bank2": ["bank2/sampleA.wav", "bank2/sampleB.wav"]
}
\`\`\`

The "_base" key specifies the base URL where your samples are hosted. Each subsequent key (like "bank1", "bank2") represents a sample bank, with an array of sample file names. See [TidalCycles/dirt-samples](https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/strudel.json) for an example.

To load the file do one of the following: 

Use the \`loadSamples()\` utility within your code. For example: 
\`\`\`js
load("https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/strudel.json")
\`\`\`

Or, pass the URL of your JSON file as a query parameter named "samples" in the application URL. For example: \`https://satori.cephasteom.co.uk?samples=https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/strudel.json\`.
`