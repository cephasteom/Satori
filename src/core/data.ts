/**
 * Store data in local storage to be retrieved by Pattern.data()
 */
export function store(key: string, value: any) {
    localStorage.setItem('satori.data.' + key, JSON.stringify(value));
}

/**
 * Retrieve data from local storage that was stored by store() for use in Pattern.data()
 */
export function retrieve(key: string) {
    const item = localStorage.getItem('satori.data.' + key);
    return item ? JSON.parse(item) : null;
}

/**
 * Clear all data stored in local storage by store()
 */
export function clear() {
    Object.keys(localStorage)
        .filter(key => key.startsWith('satori.data.'))
        .forEach(key => localStorage.removeItem(key));
}

/**
 * Get all keys of data stored in local storage by store()
 */
export function keys() {
    return Object.keys(localStorage)
        .filter(key => key.startsWith('satori.data.'))
        .map(key => key.replace('satori.data.', ''));
}