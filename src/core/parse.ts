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
    const isComment = (line: string) => line.trimStart().startsWith('//');

    while (i < lines.length) {
        const line = lines[i];
        const streamMatch = line.match(streamPattern);

        if (streamMatch && i + 1 < lines.length) {
            const streamIndent = streamMatch[1];
            const streamName = streamMatch[2];

            // Look past any comment lines to find the first key
            let nextKeyIdx = i + 1;
            while (nextKeyIdx < lines.length && isComment(lines[nextKeyIdx])) {
                nextKeyIdx++;
            }
            const nextKeyMatch = nextKeyIdx < lines.length ? lines[nextKeyIdx].match(keyPattern) : null;

            if (nextKeyMatch && nextKeyMatch[1].length > streamIndent.length) {
                const keyIndent = nextKeyMatch[1];
                type BlockItem = { kind: 'pair'; text: string } | { kind: 'comment'; text: string };
                const blockItems: BlockItem[] = [];
                i++;

                // Preserve comment lines before the first key
                while (i < nextKeyIdx) {
                    blockItems.push({ kind: 'comment', text: lines[i] });
                    i++;
                }

                while (i < lines.length) {
                    if (isComment(lines[i])) {
                        blockItems.push({ kind: 'comment', text: lines[i] });
                        i++;
                        continue;
                    }

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

                        blockItems.push({ kind: 'pair', text: `${keyIndent}${km[2]}: ${valueLines.join('\n')}` });
                    } else {
                        break;
                    }
                }

                let lastPairIndex = -1;
                for (let j = blockItems.length - 1; j >= 0; j--) {
                    if (blockItems[j].kind === 'pair') { lastPairIndex = j; break; }
                }

                const rendered = blockItems.map((item, j) =>
                    item.kind === 'comment' ? item.text : item.text + (j < lastPairIndex ? ',' : '')
                );

                result.push(`${streamIndent}${streamName}.set({`);
                result.push(rendered.join('\n'));
                result.push(`${streamIndent}})`);
                continue;
            }
        }

        result.push(line);
        i++;
    }

    return result.join('\n');
}