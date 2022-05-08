<script setup lang="ts">
import { ButtonProps } from '~/button-types';

// const df = {
//     size: () => ({ msg: '1', base: true }),
//     color: 'blue',
// };

interface BProps extends ButtonProps {
    more: boolean;
}

const props = withDefaults(defineProps<BProps>(), {
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
