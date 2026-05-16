export const pqca1 = (dataset: number = 0, timestamp: number = 0) => {
    const key = `${dataset.toString().padStart(2, '0')}`;

    if (!pqca1.cache.has(key)) {
        fetch(`/data/pqca/${key}.json`)
            .then((res) => res.json())
            .then((data) => pqca1.cache.set(
                key,
                data.frames.map((f: number[]) => Uint8Array.from(f))
            ))
            .catch((err) => {
                console.error(`Failed to fetch PQCA data for dataset ${dataset}:`, err);
                pqca1.cache.set(key, []);
            });
        return new Uint8Array();
    }

    const data = pqca1.cache.get(key)!;
    if (data.length === 0) return new Uint8Array();

    if (pqca1.lastTimestamp.get(key) !== timestamp) {
        pqca1.lastTimestamp.set(key, timestamp);
        const next = ((pqca1.frames.get(key) ?? -1) + 1) % data.length;
        pqca1.frames.set(key, next);
    }

    const currentFrame = pqca1.frames.get(key)!;
    const frameLen = data[0].length;
    const grid = new Uint8Array(frameLen * frameLen);

    const rowCount = Math.min(currentFrame + 1, frameLen);
    for (let row = 0; row < rowCount; row++) {
        const frameIndex = currentFrame - row;
        grid.set(data[frameIndex], row * frameLen);
    }

    return grid;
}

pqca1.cache = new Map<string, Uint8Array[]>();
pqca1.frames = new Map<string, number>();
pqca1.lastTimestamp = new Map<string, number>();

export const pqca2 = (dataset: number = 0, timestamp: number = 0) => {
    const key = `${dataset.toString().padStart(2, '0')}`;

    if (!pqca2.cache.has(key)) {
        fetch(`/data/pqca/${key}.json`)
            .then((res) => res.json())
            .then((data) => pqca2.cache.set(
                key,
                data.frames.map((f: number[]) => Uint8Array.from(f))
            ))
            .catch((err) => {
                console.error(`Failed to fetch PQCA data for dataset ${dataset}:`, err);
                pqca2.cache.set(key, []);
            });
        return new Uint8Array();
    }

    const data = pqca2.cache.get(key)!;
    if (data.length === 0) return new Uint8Array();

    if (pqca2.lastTimestamp.get(key) !== timestamp) {
        pqca2.lastTimestamp.set(key, timestamp);
        const next = ((pqca2.frames.get(key) ?? -1) + 1) % data.length;
        pqca2.frames.set(key, next);
    }

    return data[pqca2.frames.get(key)!];
}

pqca2.cache = new Map<string, Uint8Array[]>();
pqca2.frames = new Map<string, number>();
pqca2.lastTimestamp = new Map<string, number>();