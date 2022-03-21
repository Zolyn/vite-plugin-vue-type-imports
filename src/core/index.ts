import { babelParse, parse } from '@vue/compiler-sfc';
import fs from 'fs';
import { Alias, AliasOptions } from 'vite';
import {
    extractImportNodes,
    extractTypesFromSource,
    getAvailableImportsFromAst,
    getUsedInterfacesFromAst
} from './ast';
import {
    groupImports,
    intersect,
    mergeInterfaceCode,
    removeAdditionalEscapeChar,
    replaceAtIndexes,
    Replacement,
    resolveModulePath
} from './utils';

export interface TransformOptions {
    id: string;
    aliases: ((AliasOptions | undefined) & Alias[]) | undefined;
}

export async function transform(code: string, { id, aliases }: TransformOptions) {
    // console.time('vue_parse');
    const {
        descriptor: { scriptSetup },
    } = parse(code);

    // console.timeEnd('vue_parse');

    if (scriptSetup?.lang !== 'ts' || !scriptSetup.content) return code;

    const { program } = babelParse(scriptSetup.content, {
        sourceType: 'module',
        plugins: ['typescript', 'topLevelAwait'],
    });

    const imports = getAvailableImportsFromAst(program);
    const interfaces = getUsedInterfacesFromAst(program);

    /**
     * For every interface used in defineProps or defineEmits, we need to match
     * it to an import and then load the interface from the import and inline it
     * at the top of the vue script setup.
     */
    let resolvedTypes = (
        await Promise.all(
            Object.entries(groupImports(imports)).map(async ([unresolvedPath, importedFields]) => {
                const intersection = intersect(importedFields, interfaces);
                // console.log('Intersect:', intersection);

                let path: string | null = null;

                if (intersection.length) {
                    path = await resolveModulePath(unresolvedPath, id, aliases);
                }

                if (path) {
                    // NOTE: Slow when use fsPromises.readFile(), tested on Arch Linux x64 (Kernel 5.16.11)
                    // Wondering what make it slow. Temporarily, use fs.readFileSync() instead.
                    const content = fs.readFileSync(path, 'utf-8');

                    const types = (
                        await extractTypesFromSource(content, intersection, {
                            relativePath: path,
                            aliases,
                        })
                    ).reverse();

                    return types;
                }
                return null;
            }),
        )
    )
        .flat()
        .filter((x): x is [string, string] => x !== null);

    const replacements: Replacement[] = [];
    const fullImports = extractImportNodes(program);

    // Clean up imports
    fullImports.forEach((i) => {
        i.specifiers = i.specifiers.filter((specifier) => {
            if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier') {
                const name = specifier.imported.name;
                return !resolvedTypes.some((x) => x[0] === name);
            }

            return true;
        });

        if (!i.specifiers.length) {
            replacements.push({
                start: i.start!,
                end: i.end!,
                empty: true,
            });
        } else {
            replacements.push({
                start: i.start!,
                end: i.end!,
                empty: false,
            });
        }
    });

    console.log(resolvedTypes);

    // if (resolvedTypes.length) {
    //     const name = resolvedTypes[resolvedTypes.length - 1][0];
    //     const interfaceCodes = resolvedTypes.map(([_, interfaceCode]) => interfaceCode).join('');
    //     const result = mergeInterfaceCode(interfaceCodes);

    //     if (result) resolvedTypes = [[name, `interface ${name} {${result}}`]];
    // }

    console.log(resolvedTypes);

    const inlinedTypes = resolvedTypes.map((x) => x[1]).join('\n');

    const transformedCode = [
        // Tag head
        code.slice(0, scriptSetup.loc.start.offset),
        // Script setup content
        inlinedTypes,
        replaceAtIndexes(scriptSetup.content, replacements),
        // Tag end
        code.slice(scriptSetup.loc.end.offset),
    ].join('\n');

    return removeAdditionalEscapeChar(transformedCode);
}
