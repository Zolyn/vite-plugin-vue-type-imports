import { Plugin, ResolvedConfig } from 'vite';
import { transform } from './core';
import { CodeCache } from './core/utils';

interface PluginOptions {
    clean?: boolean;
}

export default function VitePluginVueTypeImports(options: PluginOptions = {}): Plugin {
    const clean = options.clean ?? false;
    let resolvedConfig: ResolvedConfig | undefined;
    // NOTE: It might be useful for SSR?
    const cache = new CodeCache();

    return {
        name: 'vite-plugin-vue-type-imports',
        enforce: 'pre',
        async configResolved(config) {
            resolvedConfig = config;
        },
        async transform(code, id) {
            if (!/\.(vue)$/.test(id)) return;

            const aliases = resolvedConfig?.resolve.alias;

            const transformedCode =
                cache.get(id) ??
                cache.set(
                    id,
                    await transform(code, {
                        id,
                        aliases,
                        clean,
                    }),
                );

            return {
                code: transformedCode,
            };
        },
    };
}
