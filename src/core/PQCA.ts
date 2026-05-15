// TODO: memoize so that multiple clients can call at a particular time and get the same result

/**
 * 
 * @param dataset - index of the dataset
 * @param frame - index of the frame
 * @returns the requested frame of PQCA data, or an empty array if the data is not yet available
 */
const pqcaData = (dataset: number = 0, frame: number = 0) => {
    // check whether the data for this dataset is already cached
    const key = `${dataset.toString().padStart(2, '0')}`;
    if (pqcaData.cache.has(key)) {
        const data = pqcaData.cache.get(key)!;
        // return the appropriate frame of data, looping back to the start if necessary
        return data[frame % data.length];
    }

    fetch(`/data/pqca/${key}.json`)
        .then((res) => res.json())
        .then((data) => pqcaData.cache.set(
            key, 
            data.frames.map((f: number[]) => Uint8Array.from(f))
        ))
        .catch((err) => {
            console.error(`Failed to fetch PQCA data for dataset ${dataset}:`, err);
            pqcaData.cache.set(key, []); // cache an empty array to prevent future fetch attempts
        });

    // return an empty array for now, we'll update the cache when the fetch completes
    return []
}
pqcaData.cache = new Map<string, Uint8Array[]>();

export const getPqcaData = pqcaData;