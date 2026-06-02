const satori = new BroadcastChannel('satori');

// get ?samples= URL parameter
const urlParams = new URLSearchParams(window.location.search);
const samplesParam = urlParams.get('samples');
const samplesURL = samplesParam && decodeURIComponent(samplesParam) || ''

let repos = [
    'https://raw.githubusercontent.com/cephasteom/satori-samples/main/samples.json', // basic Satori samples
    ...samplesURL.split(',').map(u => u.trim()) // repos from url
].filter(Boolean)

let samplesStore: Record<string, string[]> = {}

export async function loadSamples(...userRepos: string[]) {
    samplesStore = await [...new Set([
        ...repos, 
        ...userRepos.map(u => u.trim())
    ])]
        .map(url => fetch(url)
            .then(res => res.json())
            .then((json: Record<string, Array<string>>) => {
                if(!json) return
                
                const samples = Object.entries(json)
                    .filter(([bank]) => bank !== '_base')
                    .reduce((obj, [bank, samples]: [string, Array<string>]) => ({
                        ...obj,
                        [bank]: [samples].flat().map((sample: string) => `${json._base}${sample}`)
                    }), {} as Record<string, Array<string>>);

                return samples;
            })
            .catch(_ => satori.postMessage({ type: 'error', message: `Couldn't load samples from ${url}` }))
        )
        .reduce(async (all, repo) => {
            const acc = await all;
            const banks = await repo;
            return { ...acc, ...banks };
        }, Promise.resolve({} as Record<string, Array<string>>)) || {}

    setTimeout(() => {
        if(Object.keys(samplesStore).length > 0) {
            satori.postMessage({ type: 'success', message: 'Sample banks ->\n' });
            satori.postMessage({ type: 'samples', message: Object.keys(samplesStore).join(',\n') });
        } else {
            satori.postMessage({ type: 'warning', message: 'No sample banks loaded' });
        }
    }, 500);
}

await loadSamples()

export const samples = () => samplesStore;