import fg from 'fast-glob';
import { existsSync, readFileSync } from 'fs';
import { resolveModule } from 'local-pkg';
import { dirname, extname, join } from 'path';
import { Alias, AliasOptions } from 'vite';
import { IImport } from './ast';

type Pkg = Partial<Record<'types' | 'typings', string>>;

/**
 * Source: https://github.com/rollup/plugins/blob/master/packages/alias/src/index.ts
 */
export function matches(pattern: string | RegExp, importee: string) {
    if (pattern instanceof RegExp) return pattern.test(importee);

    if (importee.length < pattern.length) return false;

    if (importee === pattern) return true;

    const importeeStartsWithKey = importee.indexOf(pattern) === 0;
    const importeeHasSlashAfterKey = importee.slice(pattern.length)[0] === '/';
    return importeeStartsWithKey && importeeHasSlashAfterKey;
}

// https://github.com/antfu/local-pkg/blob/main/index.mjs
export function searchPackageJSON(dir: string): string | undefined {
    let packageJsonPath;
    while (true) {
        if (!dir) return;
        const newDir = dirname(dir);
        if (newDir === dir) return;
        // eslint-disable-next-line no-param-reassign
        dir = newDir;
        packageJsonPath = join(dir, 'package.json');
        if (existsSync(packageJsonPath)) break;
    }

    return packageJsonPath;
}

export function resolvePath(path: string, from: string, aliases: ((AliasOptions | undefined) & Alias[]) | undefined) {
    const matchedEntry = aliases?.find((entry) => matches(entry.find, path));

    // Path which is using aliases. e.g. '~/types'
    if (matchedEntry) return path.replace(matchedEntry.find, matchedEntry.replacement);

    const resolved_path = resolveModule(path);

    // Not a module. e.g. '../types'
    if (!resolved_path) {
        return join(dirname(from), path);
    }

    // Result is a typescript file. e.g. 'vue/macros-global.d.ts'
    if (extname(resolved_path) === '.ts') {
        return resolved_path;
    }
    // Not a typescript file, find declaration file
    // The only situation is that the types are imported from the main entry. e.g. 'vue' -> 'vue/dist/vue.d.ts'
    else {
        const packageJsonPath = searchPackageJSON(resolved_path);

        if (!packageJsonPath) {
            return;
        }

        const { types, typings } = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as Pkg;

        let result: string | undefined;

        try {
            // @ts-ignore
            result = join(dirname(packageJsonPath), types || typings);
        } catch {}

        return result;
    }
}

export async function resolveModulePath(
    path: string,
    from: string,
    aliases: ((AliasOptions | undefined) & Alias[]) | undefined,
) {
    const maybePath = resolvePath(path, from, aliases)?.replace(/\\/g, '/');

    if (!maybePath) {
        return null;
    }

    // console.log('MaybePath', maybePath.replace(/\\/g, '/'));

    const files = await fg([`${maybePath}`, `${maybePath}*.+(ts|d.ts)`, `${maybePath}*/index.+(ts|d.ts)`], {
        onlyFiles: true,
    });

    if (files.length) return files[0];

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

export function intersect<R = any>(a: Array<any>, b: Array<any>) {
    const setB = new Set(b);
    return [...new Set(a)].filter((x) => setB.has(x)) as R[];
}

export interface Replacement {
    start: number;
    end: number;
    empty: boolean;
}

/**
 * Replace all items at specified indexes while keeping indexes relative during replacements.
 */
export function replaceAtIndexes(source: string, replacements: Replacement[], clean: boolean): string {
    let result = source;
    let offset = 0;

    for (const node of replacements) {
        if (node.empty) {
            result = result.slice(0, node.start + offset) + result.slice(node.end + offset);

            offset -= node.end - node.start;
        }
    }

    // remove empty newline -> ''
    if (clean) {
        result = result
            .split('\n')
            .filter((val) => val)
            .join('\n');
    }

    return result;
}

export class CodeCache {
    private container: Map<string, string>;

    public constructor() {
        this.container = new Map();
    }

    public get(id: string) {
        return this.container.get(id);
    }

    public set(id: string, value: string) {
        this.container.set(id, value);

        return value;
    }
}

export function insertString(source: string, start: number, insertVal: string): string {
    return source.slice(0, start) + insertVal + source.slice(start);
}
