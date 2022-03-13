import fg from 'fast-glob';
import { dirname, join } from 'path';
import { Alias, AliasOptions } from 'vite';
import { IImport } from './ast';

/**
 * Source: https://github.com/rollup/plugins/blob/master/packages/alias/src/index.ts
 */
export function matches(pattern: string | RegExp, importee: string) {
    if (pattern instanceof RegExp) return pattern.test(importee);

    if (importee.length < pattern.length) return false;

    if (importee === pattern) return true;

    const importeeStartsWithKey = importee.indexOf(pattern) === 0;
    const importeeHasSlashAfterKey = importee.substring(pattern.length)[0] === '/';
    return importeeStartsWithKey && importeeHasSlashAfterKey;
}

export function resolvePath(path: string, from: string, aliases: ((AliasOptions | undefined) & Alias[]) | undefined) {
    const matchedEntry = aliases?.find((entry) => matches(entry.find, path));

    if (matchedEntry) return path.replace(matchedEntry.find, matchedEntry.replacement);

    return join(dirname(from), path);
}

export async function resolveModulePath(
    path: string,
    from: string,
    aliases: ((AliasOptions | undefined) & Alias[]) | undefined,
) {
    const maybePath = resolvePath(path, from, aliases);
    const files = await fg(
        [
            `${maybePath.replace(/\\/g, '/')}`,
            `${maybePath.replace(/\\/g, '/')}*.+(ts|d.ts)`,
            `${maybePath.replace(/\\/g, '/')}*/index.+(ts|d.ts)`,
        ],
        { onlyFiles: true },
    );

    if (files.length > 0) return files[0];

    return null;
}

/**
 * @returns Record<string, string[]> - key: the imported file, value: imported fields
 */
export function groupImports(imports: IImport[]) {
    return imports.reduce<Record<string, string[]>>((obj, importInfo) => {
        obj[importInfo.path] = obj[importInfo.path] || [];
        obj[importInfo.path].push(importInfo.imported);

        return obj;
    }, {});
}

export function intersect(a: Array<any>, b: Array<any>) {
    const setB = new Set(b);
    return [...new Set(a)].filter((x) => setB.has(x));
}

export interface Replacement {
    start: number;
    end: number;
    empty: boolean;
}

/**
 * Replace all items at specified indexes while keeping indexes relative during replacements.
 */
export function replaceAtIndexes(source: string, replacements: Replacement[]) {
    let offset = 0;

    for (const node of replacements) {
        if (node.empty) {
            // eslint-disable-next-line no-param-reassign
            source = source.slice(0, node.start + offset) + source.slice(node.end + offset);

            offset -= node.end - node.start;
        }
    }

    return source;
}

export function getInterfaceCode(source: string): string | false {
    const clip = source.split('{');
    if (clip.length !== 2) return false;

    return clip[1].split('}')[0];
}

export function mergeInterfaceCode(source: string): string | false {
    let result: string | boolean = '';
    const clip = source.split('extends');

    for (const snippet of clip) {
        const code = getInterfaceCode(snippet);
        if (code) {
            result += code;
        } else {
            result = false;
            break;
        }
    }

    return result;
}
