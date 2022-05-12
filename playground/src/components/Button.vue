<script setup lang="ts">
import '~/auto-imports';
import { ButtonProps } from '~/button-types';

// const df = {
//     size: () => ({ msg: '1', base: true }),
//     color: 'blue',
// };

interface InputProps {
    name: string;
}

interface BProps extends ButtonProps, InputProps {
    more: boolean;
}

const props = defineProps<BProps>();
</script>

<template>
    <button py-2 px-4 font-medium rounded m-8>
        {{ props.more }}
        <slot />
    </button>
</template>
