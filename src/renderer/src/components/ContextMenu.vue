<template>
  <div class="absolute bg-black z-[100]" :style="{ top: y + 'px', left: x + 'px' }">
    <div class="text-sm text-gray-400 px-3 py-1 border-b border-gray-700">{{ song.name }}</div>
    <div
      v-for="action in actions"
      :key="action.action"
      class="px-3 py-1 text-gray-300 hover:text-white font-bold cursor-pointer"
      @click="emitAction(action.action)"
    >
      {{ action.label }}
    </div>
  </div>
</template>

<script setup>
const { actions, x, y, song } = defineProps(['actions', 'x', 'y', 'song'])
const emit = defineEmits(['action-clicked'])

const emitAction = (action) => {
  emit('action-clicked', action)
}
</script>
