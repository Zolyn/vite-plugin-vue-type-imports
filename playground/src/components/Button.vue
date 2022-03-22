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

const props = defineProps<ButtonProps>();
</script>

<template>
    <button py-2 px-4 font-medium rounded m-8>
        {{ props.color }}
        <slot />
    </button>
</template>
