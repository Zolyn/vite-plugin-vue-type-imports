<script setup lang="ts">
import { ButtonProps } from '~/button-types';

const props = defineProps<ButtonProps>();
</script>

<template>
    <button py-2 px-4 font-medium rounded m-8>
        {{ props.color }}
        <slot />
    </button>
</template>
