import {
    CallExpression,
    ExportNamedDeclaration,
    ImportDeclaration,
    Node,
    Program,
    StringLiteral,
    TSEnumDeclaration,
    TSExpressionWithTypeArguments,
    TSInterfaceDeclaration,
    TSTypeAliasDeclaration,
    TSTypeLiteral,
    TSTypeParameterInstantiation,
    TSTypeReference,
    TSUnionType,
} from '@babel/types';
import { babelParse } from '@vue/compiler-sfc';
import fs from 'fs';
import { Alias, AliasOptions } from 'vite';
import { groupImports, intersect, resolveModulePath } from './utils';

const DEFINE_PROPS = 'defineProps';
const DEFINE_EMITS = 'defineEmits';
const WITH_DEFAULTS = 'withDefaults';
const TS_TYPES_KEYS = ['TSTypeAliasDeclaration', 'TSInterfaceDeclaration', 'TSEnumDeclaration'];

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

export interface ExtractMetaData {
    extendInterfaceIndex?: number;
    isProperty?: boolean;
}

export type MaybeNode = Node | null | undefined;

export type ExportNamedFromDeclaration = ExportNamedDeclaration & { source: StringLiteral };

export type TypeInfo = Partial<Record<'type' | 'name', string>>;

export type GetTypesResult = (string | TypeInfo)[];

export interface GetImportsResult {
    imports: IImport[];
    importNodes: ImportDeclaration[];
}

export type TSTypes = TSTypeAliasDeclaration | TSInterfaceDeclaration | TSEnumDeclaration;

export type NodeMap = Map<string, TSTypes>;

export function getAvailableImportsFromAst(ast: Program): GetImportsResult {
    const imports: IImport[] = [];
    const importNodes: ImportDeclaration[] = [];

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

        importNodes.push(node);
    };

    for (const node of ast.body) {
        if (node.type === 'ImportDeclaration') addImport(node);
    }

    return { imports, importNodes };
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

            if (propsTypeDefinition.type === 'TSTypeReference' && propsTypeDefinition.typeName.type === 'Identifier') {
                interfaces.push(propsTypeDefinition.typeName.name);

                // TODO: Support nested type params
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
            // e.g. 'export interface | type | ...'
            if (node.type === 'ExportNamedDeclaration' && node.declaration && isTSTypes(node.declaration))
                return node.declaration;

            // e.g. 'interface | type | ...'
            if (isTSTypes(node)) return node;

            return null;
        })
        .filter((x): x is TSTypes => x !== null);
}

interface ExtractTypesFromSourceOptions {
    relativePath: string;
    aliases: ((AliasOptions | undefined) & Alias[]) | undefined;
    extracted?: [string, string][];
    map?: Map<string, number>;
}

/**
 * Given a specific source file, extract the specified types.
 */
export async function extractTypesFromSource(
    source: string,
    types: string[],
    { relativePath, aliases, extracted, map }: ExtractTypesFromSourceOptions,
) {
    const extractedTypes: [string, string][] = extracted ?? [];
    const missingTypes: string[] = [];
    const extendsMap = map ?? new Map<string, number>();
    const ast = babelParse(source, { sourceType: 'module', plugins: ['typescript', 'topLevelAwait'] }).program;

    // Get external types
    const imports = [...getAvailableImportsFromAst(ast).imports, ...getAvailableExportsFromAst(ast)];
    const typescriptNodes = extractAllTypescriptTypesFromAST(ast);
    const nodeMap = getTSNodeMap();
    // console.log(nodeMap);

    const extractFromPosition = (start: number | null, end: number | null) =>
        isNumber(start) && isNumber(end) ? source.slice(start, end) : '';

    function getTSNodeMap(): NodeMap {
        const nodeMap = new Map<string, TSTypes>();

        for (const node of typescriptNodes) {
            if ('name' in node.id) {
                nodeMap.set(node.id.name, node);
            }
        }

        return nodeMap;
    }

    function _ExtractTypeByName(node: TSTypes, metadata: ExtractMetaData) {
        switch (node.type) {
            // Types e.g. export Type Color = 'red' | 'blue'
            case 'TSTypeAliasDeclaration': {
                extractTypesFromTypeAlias(node, metadata);
                break;
            }
            // Interfaces e.g. export interface MyInterface {}
            case 'TSInterfaceDeclaration': {
                extractTypesFromInterface(node, metadata);
                break;
            }
            // Enums e.g. export enum UserType {}
            case 'TSEnumDeclaration': {
                extractTypesFromEnum(node);
                break;
            }
        }
    }

    /**
     * Extract ts types by name.
     */
    function extractTypeByName(name: string, metadata: ExtractMetaData = {}) {
        let { extendInterfaceIndex, isProperty } = metadata;

        extendInterfaceIndex ??= extendsMap.get(name);

        const node = nodeMap.get(name);
        if (node) {
            _ExtractTypeByName(node, { extendInterfaceIndex, isProperty });
        } else {
            if (isNumber(extendInterfaceIndex)) {
                extendsMap.set(name, extendInterfaceIndex);
            }

            missingTypes.push(name);
            // console.log('Missing types:', missingTypes);
        }
    }

    // Recursively calls this function to find types from other modules.
    const extractTypesFromModule = async (modulePath: string, types: string[]) => {
        const path = await resolveModulePath(modulePath, relativePath, aliases);
        if (!path) return [];

        // NOTE: Slow when use fsPromises.readFile(), tested on Arch Linux x64 (Kernel 5.16.11)
        // Wondering what make it slow. Temporarily, use fs.readFileSync() instead.
        const contents = fs.readFileSync(path, 'utf-8');

        return extractTypesFromSource(contents, types, {
            relativePath: path,
            aliases,
            extracted: extractedTypes,
            map: extendsMap,
        });
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

    function extractExtendInterfaces(interfaces: TSExpressionWithTypeArguments[], extendInterfaceIndex: number) {
        for (const extend of interfaces) {
            if (extend.expression.type === 'Identifier') {
                extractTypeByName(extend.expression.name, { extendInterfaceIndex });
            }
        }
    }

    /**
     * Extract ts type interfaces. Should also check top-level properties
     * in the interface to look for types to extract
     */
    const extractTypesFromInterface = (node: TSInterfaceDeclaration, metadata: ExtractMetaData) => {
        const { extendInterfaceIndex, isProperty } = metadata;

        const interfaceName = node.id.name;
        const extendsInterfaces = node.extends;

        // Skip all process, since Vue only transform the type of nested objects to 'Object'
        if (isProperty) {
            extractedTypes.push([interfaceName, `interface ${interfaceName} {}`]);
            return;
        }

        let bodyStart = node.body.start!;
        let bodyEnd = node.body.end!;

        if (isNumber(extendInterfaceIndex)) {
            bodyStart += 1;

            if (extendsInterfaces) {
                bodyEnd -= 1;

                extractedTypes[extendInterfaceIndex][1] += extractFromPosition(bodyStart, bodyEnd);
                extractExtendInterfaces(extendsInterfaces, extendInterfaceIndex);
            } else {
                extractedTypes[extendInterfaceIndex][1] += extractFromPosition(bodyStart, bodyEnd);
            }
        } else if (extendsInterfaces) {
            bodyEnd -= 1;

            const interfaceIndex =
                extractedTypes.push([
                    interfaceName,
                    `interface ${interfaceName} ${extractFromPosition(bodyStart, bodyEnd)}`,
                ]) - 1;

            extractExtendInterfaces(extendsInterfaces, interfaceIndex);
        } else {
            extractedTypes.push([
                interfaceName,
                `interface ${interfaceName} ${extractFromPosition(bodyStart, bodyEnd)}`,
            ]);
        }

        for (const prop of node.body.body) {
            if (prop.type === 'TSPropertySignature') {
                if (prop.typeAnnotation?.typeAnnotation.type === 'TSUnionType')
                    // TODO: Should this be filtered?
                    extractTypesFromTSUnionType(prop.typeAnnotation.typeAnnotation);
                else if (
                    prop.typeAnnotation?.typeAnnotation.type === 'TSTypeReference' &&
                    prop.typeAnnotation.typeAnnotation.typeName.type === 'Identifier'
                )
                    extractTypeByName(prop.typeAnnotation.typeAnnotation.typeName.name, { isProperty: true });
            }
        }
    };

    /**
     * Extract types from TSTypeAlias
     */
    const extractTypesFromTypeAlias = (node: TSTypeAliasDeclaration, metadata: ExtractMetaData) => {
        extractedTypes.push([node.id.name, extractFromPosition(node.start, node.end)]);

        if (node.typeAnnotation.type === 'TSUnionType') extractTypesFromTSUnionType(node.typeAnnotation);

        // TODO: Support TSLiteral, IntersectionType
        if (node.typeAnnotation.type === 'TSTypeReference' && node.typeAnnotation.typeName.type === 'Identifier')
            extractTypeByName(node.typeAnnotation.typeName.name);
    };

    /**
     * Extract enum types. Since I don't believe these can depend on any other
     * types we just want to extract the string itself.
     *
     * Zorin: Since Vue can't handle Enum types right now, would it be better to convert it to 'type [name] = number | string;'?
     */
    const extractTypesFromEnum = (node: TSEnumDeclaration) => {
        const enumName = node.id.name;
        extractedTypes.push([enumName, `type ${enumName} = number | string;`]);
    };

    for (const typeName of types) {
        extractTypeByName(typeName);
    }

    await Promise.all(
        Object.entries(groupImports(imports)).map(async ([modulePath, importedFields]) => {
            const intersection = intersect(importedFields, missingTypes);

            if (intersection.length) {
                await extractTypesFromModule(modulePath, intersection);
            }
        }),
    );

    return extractedTypes;
}

export function isNumber(n: unknown): n is number {
    return typeof n === 'number';
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
