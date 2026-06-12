type PqcaCache = { frames: number[][] } | { frames: number[][][] };

export const pqcaData = (dataset: number = 0, frame: number = 0, shot: number = 0): number | number[] => {
    const key = `${dataset.toString().padStart(2, '0')}`;

    if (!pqcaData.cache.has(key)) {
        // set key to prevent repeat calls
        pqcaData.cache.set(key, { frames: [] });

        // fetch the dataset
        fetch(`/data/pqca/${key}.json`)
            .then((res) => res.json())
            .then((data) => {
                const [rows, cols]: [number | undefined, number | undefined] = data.metadata?.system_size ?? [undefined, undefined];
                const is1DAutomaton = rows === 1 || cols === 1

                const frames = data.frames.map((frame: number[][]) => {
                    const f = Array.isArray(frame[0])
                        // has shots
                        ? frame.map((shot: number[]) => {
                            const flat = Uint8Array.from(shot);
                            if (rows && cols) {
                                return Array.from({ length: rows }, (_, r) =>
                                    Array.from(flat.subarray(r * cols, (r + 1) * cols))
                                );
                            }
                            return flat;
                        })
                        // is single shot
                        : [frame]
                    
                    return is1DAutomaton ? [f] : f
                });

                return pqcaData.cache.set(key, { frames });
            })
            .catch((err) => {
                console.error(`Failed to fetch PQCA data for dataset ${dataset}:`, err);
                // remove from cache so that it can be tried again
                pqcaData.cache.delete(key)
            });
        return [];
    }

    const cached = pqcaData.cache.get(key)!;
    if (cached.frames.length === 0) return [];

    const frameData = cached.frames[frame % cached.frames.length];
    return frameData[shot % frameData.length];
}

pqcaData.cache = new Map<string, PqcaCache>();