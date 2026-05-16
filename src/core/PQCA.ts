export const pqcaData = (dataset: number = 0, timestamp: number = 0) => {
    const key = `${dataset.toString().padStart(2, '0')}`;

    if (!pqcaData.cache.has(key)) {
        fetch(`/data/pqca/${key}.json`)
            .then((res) => res.json())
            .then((data) => pqcaData.cache.set(
                key,
                data.frames.map((f: number[]) => Uint8Array.from(f))
            ))
            .catch((err) => {
                console.error(`Failed to fetch PQCA data for dataset ${dataset}:`, err);
                pqcaData.cache.set(key, []);
            });
        return new Uint8Array();
    }

    const data = pqcaData.cache.get(key)!;
    if (data.length === 0) return new Uint8Array();

    if (pqcaData.lastTimestamp.get(key) !== timestamp) {
        pqcaData.lastTimestamp.set(key, timestamp);
        const next = ((pqcaData.frames.get(key) ?? -1) + 1) % data.length;
        pqcaData.frames.set(key, next);
    }

    return data[pqcaData.frames.get(key)!];
}

pqcaData.cache = new Map<string, Uint8Array[]>();
pqcaData.frames = new Map<string, number>();
pqcaData.lastTimestamp = new Map<string, number>();