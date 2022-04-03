<h2 align="center">vite-plugin-vue-type-imports</h2>

<p align="center">
  Enables you to import types and use them in your <code>defineProps</code> and <code>defineEmits</code>
</p>

<p align="center">
<a href="https://www.npmjs.com/package/vite-plugin-vue-type-imports" target="__blank"><img src="https://img.shields.io/npm/v/@zolyn/vite-plugin-vue-type-imports?color=a356fe&label=Version" alt="NPM version"></a>
</p>

> ⚠️ This Plugin is still in Development and there may be bugs. Use at your own risk.

## Install
```bash
# Install Plugin
npm i -D @zolyn/vite-plugin-vue-type-imports
```

```ts
// vite.config.ts

import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import VueTypeImports from '@zolyn/vite-plugin-vue-type-imports'

export default defineConfig({
  plugins: [
    Vue(), 
    VueTypeImports(),
  ],
})
```

### Nuxt
```ts
// nuxt.config.ts

export default {
  buildModules: [
    '@zolyn/vite-plugin-vue-type-imports/nuxt',
  ]
}
```

## Usage

```ts
// types.ts

export interface User {
  username: string
  password: string
  avatar?: string
}
```

```html
<script setup lang="ts">
import type { User } from '~/types'

defineProps<User>()
</script>

<template>...</template>
```

## Known limitations
- `import default` , `export default` and `export * from` syntax are not supported.
- nested type parameters (e.g. `defineProps<Props<T>>()`) are not supported.
- `Enum` types will be converted to `type [name] = number | string`, since Vue can't handle them right now.
- At this stage, the plugin only scans the imported interfaces and does not process the interfaces defined in the SFC
- Interface which extends Literal Type or Intersection Type is not supported.
- Types imported from external packages are not fully supported right now.
- The plugin may be slow because it needs to traverse the AST (using @babel/parser).

## License

[MIT License](https://mit-license.org) © 2021-PRESENT [Jacob Clevenger](https://github.com/jacobclevenger) & [Yumeoto Zorin](https://github.com/Zolyn)
