<script setup lang="ts">
import { ButtonProps } from '~/button-types';

// type A = string;

// interface Size {
//     small: 'sm';
//     medium: 'md';
//     large: 'lg';
// }

// interface ButtonProps {
//     color: string;
//     size: number | Size | A;
// }

const df = {
    size: () => ({ msg: '1', base: true }),
    color: 'blue',
};

const props = withDefaults(defineProps<ButtonProps>(), {
    size: () => ({ msg: '1', base: true }),
    color: 'blue',
});
</script>

<template>
    <button py-2 px-4 font-medium rounded m-8>
        {{ props.color }}
        <slot />
    </button>
</template>
