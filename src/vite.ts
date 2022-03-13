import { Plugin, ResolvedConfig } from 'vite';
import { transform } from './core';

interface Store {
    config: ResolvedConfig | null;
}

export default function VitePluginVueTypeImports(): Plugin {
    const store: Store = {
        config: null,
    };

    return {
        name: 'vite-plugin-vue-type-imports',
        enforce: 'pre',
        async configResolved(config) {
            store.config = config;
        },
        async transform(code, id) {
            if (!/\.(vue)$/.test(id)) return;

            const aliases = store.config?.resolve.alias;

            return {
                code: await transform(code, {
                    id,
                    aliases,
                }),
            };
        },
    };
}
