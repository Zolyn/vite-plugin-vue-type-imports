import Vue from '@vitejs/plugin-vue';
import VueTypeImports from '@zolyn/vite-plugin-vue-type-imports';
import path from 'path';
import { presetAttributify, presetIcons, presetUno } from 'unocss';
import Unocss from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';
import Inspect from 'vite-plugin-inspect';

export default defineConfig({
    resolve: {
        alias: {
            '~/': `${path.resolve(__dirname, 'src')}/`,
        },
    },
    plugins: [
        Vue(),
        VueTypeImports(),
        Unocss({
            presets: [presetUno(), presetIcons(), presetAttributify()],
        }),
        Components({
            dirs: ['src/components'],
            dts: 'src/components.d.ts',
        }),
        AutoImport({
            imports: ['vue', '@vueuse/core'],
            dts: 'src/auto-imports.d.ts',
        }),
        Inspect(),
    ],
});
