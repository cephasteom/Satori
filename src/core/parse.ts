/**
 * Allow a shorthand syntax for defining stream updates, e.g.:
 * 
 * s0
 *   x: H q0
 *   y: CNOT q0, q1
 * 
 * is equivalent to:
 * 
 * s0.set({
 *   x: H q0,
 *   y: CNOT q0, q1
 * })
 * @param code 
 * @returns 
 */
export function parseShorthand(code: string): string {
    const lines = code.split('\n');
    const result: string[] = [];
    let i = 0;

    const streamPattern = /^(\s*)(s\d+|fx\d+|global)\s*$/;
    const keyPattern = /^(\s*)(\w+)\s*:(.*)/;

    while (i < lines.length) {
        const line = lines[i];
        const streamMatch = line.match(streamPattern);

        if (streamMatch && i + 1 < lines.length) {
            const streamIndent = streamMatch[1];
            const streamName = streamMatch[2];
            const nextKeyMatch = lines[i + 1].match(keyPattern);

            if (nextKeyMatch && nextKeyMatch[1].length > streamIndent.length) {
                const keyIndent = nextKeyMatch[1];
                const pairs: string[] = [];
                i++;

                while (i < lines.length) {
                    const km = lines[i].match(keyPattern);

                    if (km && km[1] === keyIndent) {
                        const valueLines = [km[3].trimStart()];
                        i++;

                        while (i < lines.length) {
                            const contIndent = lines[i].match(/^(\s*)/)?.[1] ?? '';
                            if (lines[i].trim() && contIndent.length > keyIndent.length) {
                                valueLines.push(lines[i]);
                                i++;
                            } else {
                                break;
                            }
                        }

                        pairs.push(`${keyIndent}${km[2]}: ${valueLines.join('\n')}`);
                    } else {
                        break;
                    }
                }

                result.push(`${streamIndent}${streamName}.set({`);
                result.push(pairs.join(',\n'));
                result.push(`${streamIndent}})`);
                continue;
            }
        }

        result.push(line);
        i++;
    }

    return result.join('\n');
}