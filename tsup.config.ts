import { Options } from 'tsup';

const config: Options = {
    format: ['esm', 'cjs'],
    entry: ['./src/index.ts', './src/nuxt.ts'],
    target: 'node14',
    clean: true,
    external: ['fast-glob', '@babel/types', '@babel/generator'],
};

export default config;
