import {
    CallExpression,
    ExportNamedDeclaration,
    ImportDeclaration,
    Node,
    Program,
    StringLiteral,
    TSEnumDeclaration,
    TSInterfaceDeclaration,
    TSModuleDeclaration,
    TSNamespaceExportDeclaration,
    TSTypeAliasDeclaration,
    TSTypeLiteral,
    TSTypeParameterInstantiation,
    TSTypeReference,
    TSUnionType,
} from '@babel/types';
import { babelParse } from '@vue/compiler-sfc';
import fs from 'fs/promises';
import { Alias, AliasOptions } from 'vite';
import { groupImports, intersect, resolveModulePath } from './utils';

const DEFINE_PROPS = 'defineProps';
const DEFINE_EMITS = 'defineEmits';
const WITH_DEFAULTS = 'withDefaults';
const TS_TYPES_KEYS = [
    'TSTypeAliasDeclaration',
    'TSNamespaceExportDeclaration',
    'TSModuleDeclaration',
    'TSInterfaceDeclaration',
    'TSEnumDeclaration',
];

const isDefineProps = (node: Node): node is CallExpression => isCallOf(node, DEFINE_PROPS);
const isDefineEmits = (node: Node): node is CallExpression => isCallOf(node, DEFINE_EMITS);
const isWithDefaults = (node: Node): node is CallExpression => isCallOf(node, WITH_DEFAULTS);

export interface IImport {
    start: number;
    end: number;
    local: string;
    imported: string;
    path: string;
}

export type MaybeNode = Node | null | undefined;

export type ExportNamedFromDeclaration = ExportNamedDeclaration & { source: StringLiteral };

export type TypeInfo = Partial<Record<'type' | 'name', string>>;

export type GetTypesResult = (string | TypeInfo)[];

export type TSTypes =
    | TSTypeAliasDeclaration
    | TSNamespaceExportDeclaration
    | TSModuleDeclaration
    | TSInterfaceDeclaration
    | TSEnumDeclaration;

export function extractImportNodes(ast: Program) {
    return ast.body.filter((node): node is ImportDeclaration => node.type === 'ImportDeclaration');
}

export function getAvailableImportsFromAst(ast: Program) {
    const imports: IImport[] = [];

    const addImport = (node: ImportDeclaration) => {
        for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier') {
                imports.push({
                    start: specifier.imported.start!,
                    end: specifier.local.end!,
                    imported: specifier.imported.name,
                    local: specifier.local.name,
                    path: node.source.value,
                });
            }
        }
    };

    for (const node of ast.body) {
        if (node.type === 'ImportDeclaration') addImport(node);
    }

    return imports;
}

/**
 * get reExported fields
 *
 * e.g. export { x } from './xxx'
 */
export function getAvailableExportsFromAst(ast: Program) {
    const exports: IImport[] = [];

    const addExport = (node: ExportNamedFromDeclaration) => {
        for (const specifier of node.specifiers) {
            if (specifier.type === 'ExportSpecifier' && specifier.exported.type === 'Identifier') {
                exports.push({
                    start: specifier.exported.start!,
                    end: specifier.local.end!,
                    imported: specifier.exported.name,
                    local: specifier.local.name,
                    path: node.source.value,
                });
            }
        }
    };

    for (const node of ast.body) {
        // TODO: support export * from
        if (isExportNamedFromDeclaration(node)) addExport(node);
    }

    return exports;
}

export function getUsedInterfacesFromAst(ast: Program) {
    const interfaces: GetTypesResult = [];

    const addInterface = (node: Node) => {
        if (node.type === 'CallExpression' && node.typeParameters?.type === 'TSTypeParameterInstantiation') {
            const propsTypeDefinition = node.typeParameters.params[0];

            if (propsTypeDefinition.type === 'TSTypeReference') {
                if (propsTypeDefinition.typeName.type === 'Identifier')
                    interfaces.push(propsTypeDefinition.typeName.name);

                if (propsTypeDefinition.typeParameters)
                    interfaces.push(...getTypesFromTypeParameters(propsTypeDefinition.typeParameters));
            }
        }
    };

    for (const node of ast.body) {
        if (node.type === 'ExpressionStatement') {
            if (isWithDefaults(node.expression)) addInterface(node.expression.arguments[0]);
            else if (isDefineProps(node.expression) || isDefineEmits(node.expression)) addInterface(node.expression);
        }

        if (node.type === 'VariableDeclaration' && !node.declare) {
            for (const decl of node.declarations) {
                if (decl.init) {
                    if (isWithDefaults(decl.init)) addInterface(decl.init.arguments[0]);
                    else if (isDefineProps(decl.init) || isDefineEmits(decl.init)) addInterface(decl.init);
                }
            }
        }
    }

    return interfaces;
}

function getTypesFromTypeParameters(x: TSTypeParameterInstantiation) {
    const types: GetTypesResult = [];

    for (const p of x.params) {
        if (p.type === 'TSTypeLiteral') {
            types.push(...getTSTypeLiteralTypes(p));
        } else if (p.type === 'TSTypeReference') {
            if (p.typeName.type === 'Identifier') types.push(p.typeName.name);
        }
    }

    return types;
}

function getTSTypeLiteralTypes(x: TSTypeLiteral) {
    const types: GetTypesResult = [];

    for (const m of x.members) {
        if (m.type === 'TSPropertySignature') {
            if (m.typeAnnotation?.typeAnnotation.type === 'TSTypeLiteral') {
                types.push(...getTSTypeLiteralTypes(m.typeAnnotation.typeAnnotation));
            } else if (m.typeAnnotation?.typeAnnotation.type === 'TSTypeReference') {
                if (m.typeAnnotation.typeAnnotation.typeName.type === 'Identifier') {
                    // TODO: understand why we push a object
                    types.push({
                        type: m.typeAnnotation.typeAnnotation.type,
                        name: m.typeAnnotation.typeAnnotation.typeName.name,
                    });
                }

                if (m.typeAnnotation.typeAnnotation.typeParameters)
                    types.push(...getTypesFromTypeParameters(m.typeAnnotation.typeAnnotation.typeParameters));
            } else {
                types.push({ type: m.typeAnnotation?.typeAnnotation.type });
            }
        }
    }

    return types;
}

function extractAllTypescriptTypesFromAST(ast: Program) {
    return ast.body
        .map((node) => {
            if (node.type === 'ExportNamedDeclaration' && node.declaration && isTSTypes(node.declaration))
                return node.declaration;

            if (isTSTypes(node)) return node;

            return null;
        })
        .filter((x): x is TSTypes => x !== null);
}

interface ExtractTypesFromSourceOptions {
    relativePath: string;
    aliases: ((AliasOptions | undefined) & Alias[]) | undefined;
}

/**
 * Given a specific source file, extract the specified types.
 */
export async function extractTypesFromSource(
    source: string,
    types: string[],
    { relativePath, aliases }: ExtractTypesFromSourceOptions,
) {
    const extractedTypes: [string, string][] = [];
    const missingTypes: string[] = [];
    const ast = babelParse(source, { sourceType: 'module', plugins: ['typescript', 'topLevelAwait'] }).program;
    // TODO: understand why we need to get imports
    const imports = [...getAvailableImportsFromAst(ast), ...getAvailableExportsFromAst(ast)];
    const typescriptNodes = extractAllTypescriptTypesFromAST(ast);

    const extractFromPosition = (start: number | null, end: number | null) =>
        start && end ? source.substring(start, end) : '';

    // Recursively calls this function to find types from other modules.
    const extractTypesFromModule = async (modulePath: string, types: string[]) => {
        const path = await resolveModulePath(modulePath, relativePath, aliases);
        if (!path) return [];

        const contents = await fs.readFile(path, 'utf-8');
        return extractTypesFromSource(contents, types, { relativePath: path, aliases });
    };

    const extractTypesFromTSUnionType = async (union: TSUnionType) => {
        union.types
            .filter((n): n is TSTypeReference => n.type === 'TSTypeReference')
            .forEach((typeReference) => {
                if (typeReference.typeName.type === 'Identifier') {
                    extractTypeByName(typeReference.typeName.name);
                }
            });
    };

    /**
     * Extract ts types by name.
     */
    const extractTypeByName = async (name: string) => {
        for (const node of typescriptNodes) {
            if ('name' in node.id && node.id.name === name) {
                if (node.type === 'TSTypeAliasDeclaration') {
                    return extractTypesFromTypeAlias(node);
                } else if (node.type === 'TSInterfaceDeclaration') {
                    return extractTypesFromInterface(node);
                } else if (node.type === 'TSEnumDeclaration') {
                    return extractTypesFromEnum(node);
                }
            }
        }

        missingTypes.push(name);
    };

    /**
     * Extract ts type interfaces. Should also check top-level properties
     * in the interface to look for types to extract
     */
    const extractTypesFromInterface = (node: TSInterfaceDeclaration) => {
        extractedTypes.push([node.id.name, extractFromPosition(node.start, node.end)]);

        if (node.extends) {
            for (const extend of node.extends) {
                if (extend.expression.type === 'Identifier') extractTypeByName(extend.expression.name);
            }
        }

        for (const prop of node.body.body) {
            if (prop.type === 'TSPropertySignature') {
                if (prop.typeAnnotation?.typeAnnotation.type === 'TSUnionType')
                    extractTypesFromTSUnionType(prop.typeAnnotation.typeAnnotation);
                else if (
                    prop.typeAnnotation?.typeAnnotation.type === 'TSTypeReference' &&
                    prop.typeAnnotation.typeAnnotation.typeName.type === 'Identifier'
                )
                    extractTypeByName(prop.typeAnnotation.typeAnnotation.typeName.name);
            }
        }
    };

    /**
     * Extract types from TSTypeAlias
     */
    const extractTypesFromTypeAlias = (node: TSTypeAliasDeclaration) => {
        extractedTypes.push([node.id.name, extractFromPosition(node.start, node.end)]);

        if (node.typeAnnotation.type === 'TSUnionType') extractTypesFromTSUnionType(node.typeAnnotation);

        if (node.typeAnnotation.type === 'TSTypeReference' && node.typeAnnotation.typeName.type === 'Identifier')
            extractTypeByName(node.typeAnnotation.typeName.name);
    };

    /**
     * Extract enum types. Since I don't believe these can depend on any other
     * types we just want to extract the string itself.
     */
    const extractTypesFromEnum = (node: TSEnumDeclaration) => {
        extractedTypes.push([node.id.name, extractFromPosition(node.start, node.end)]);
    };

    for (const node of typescriptNodes) {
        for (const typeName of types) {
            // Interfaces e.g. export interface MyInterface {}
            if (node.type === 'TSInterfaceDeclaration' && node.id.name === typeName) extractTypesFromInterface(node);
            // Types e.g. export Type Color = 'red' | 'blue'
            else if (node.type === 'TSTypeAliasDeclaration' && node.id.name === typeName)
                extractTypesFromTypeAlias(node);
            // Enums e.g. export enum UserType {}
            else if (node.type === 'TSEnumDeclaration' && node.id.name === typeName) extractTypesFromEnum(node);
            else missingTypes.push(typeName);
        }
    }

    await Promise.all(
        Object.entries(groupImports(imports)).map(async ([modulePath, importedFields]) => {
            const intersection = intersect(importedFields, missingTypes);

            if (intersection.length > 0)
                extractedTypes.push(...(await extractTypesFromModule(modulePath, intersection)));
        }),
    );

    return extractedTypes;
}

export function isCallOf(node: MaybeNode, test: string | ((id: string) => boolean)): node is CallExpression {
    return !!(
        node &&
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        (typeof test === 'string' ? node.callee.name === test : test(node.callee.name))
    );
}

export function isTSTypes(node: MaybeNode): node is TSTypes {
    return !!(node && TS_TYPES_KEYS.includes(node.type));
}

export function isExportNamedFromDeclaration(node: MaybeNode): node is ExportNamedFromDeclaration {
    return !!(node && node.type === 'ExportNamedDeclaration' && node.source);
}
