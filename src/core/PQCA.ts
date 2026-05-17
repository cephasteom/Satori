export const pqcaData = (dataset: number = 0, frame: number = 0, shot: number = 0) => {
    const key = `${dataset.toString().padStart(2, '0')}`;

    if (!pqcaData.cache.has(key)) {
        fetch(`/data/pqca/${key}.json`)
            .then((res) => res.json())
            .then((data) => pqcaData.cache.set(
                key,
                data.frames.map((frame: number[][]) => frame.map((shot: number[]) => Uint8Array.from(shot)))
            ))
            .catch((err) => {
                console.error(`Failed to fetch PQCA data for dataset ${dataset}:`, err);
                pqcaData.cache.set(key, []);
            });
        return new Uint8Array();
    }

    const data = pqcaData.cache.get(key)!;
    if (data.length === 0) return new Uint8Array();

    const frameData = data[frame % data.length]
    return frameData[shot % frameData.length];
}

pqcaData.cache = new Map<string, Uint8Array[]>();