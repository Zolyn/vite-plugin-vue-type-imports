<script setup lang="ts">
import { Props } from '~/typings';
import { resolveComponent } from 'vue';
import { Test } from '~/typings';

const props = defineProps<Props<Test>>();
</script>

<template>
    <button py-2 px-4 font-medium rounded m-8>
        {{ props.bar }}
        <slot />
    </button>
</template>
