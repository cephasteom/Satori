type PqcaCache = { frames: Uint8Array[][] } | { frames: Uint8Array[][][] };

export const pqcaData = (dataset: number = 0, frame: number = 0, shot: number = 0): Uint8Array | Uint8Array[] => {
    const key = `${dataset.toString().padStart(2, '0')}`;

    if (!pqcaData.cache.has(key)) {
        fetch(`/data/pqca/${key}.json`)
            .then((res) => res.json())
            .then((data) => {
                const [rows, cols]: [number | undefined, number | undefined] = data.metadata?.system_size ?? [undefined, undefined];

                const frames = data.frames.map((frame: number[][]) =>
                    frame.map((shot: number[]) => {
                        const flat = Uint8Array.from(shot);
                        if (rows && cols) {
                            return Array.from({ length: rows }, (_, r) =>
                                flat.subarray(r * cols, (r + 1) * cols)
                            );
                        }
                        return flat;
                    })
                );

                return pqcaData.cache.set(key, { frames });
            })
            .catch((err) => {
                console.error(`Failed to fetch PQCA data for dataset ${dataset}:`, err);
                pqcaData.cache.set(key, { frames: [] });
            });
        return new Uint8Array();
    }

    const cached = pqcaData.cache.get(key)!;
    if (cached.frames.length === 0) return new Uint8Array();

    const frameData = cached.frames[frame % cached.frames.length];
    return frameData[shot % frameData.length];
}

pqcaData.cache = new Map<string, PqcaCache>();