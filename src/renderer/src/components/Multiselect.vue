<template>
  <div>
    <a-checkbox-group
      v-model:value="selected"
      name="checkboxgroup"
      :options="filteredList.map(item => ({ label: item.name, value: item.id }))"
      @change="selectionChanged"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const selected = ref([])
const filteredList = ref([])

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  list: {
    type: Array,
    required: true
  },
  selectedDefault: {
    type: Array,
    required: false,
    default: () => ([])
  }
})

const emit = defineEmits(['changed'])

watch(() => props.list,
  (newValue = []) => {
    const sorted = [...newValue].sort((a, b) => a.name.localeCompare(b.name))
    filteredList.value = sorted
  },
  { immediate: true })

watch(() => props.selectedDefault,
  (newValue = []) => {
    if (newValue.length > 0 || selected.value.length === 0) {
      selected.value = [...newValue]
    }
  },
  { immediate: true })

function selectionChanged() {
  emit('changed', selected.value)
}

function selectAll() {
  selected.value = props.list.map((item) => item.id)
  emit('changed', selected.value)
}

function selectNone() {
  selected.value = []
  emit('changed', selected.value)
}

defineExpose({
  selectAll,
  selectNone
})
</script>

<style>
.ant-checkbox-group {
  display: flex;
  flex-direction: column;

  label {
    border-bottom: 1px solid #c4c4c4;
  }

  label:last-child{
    border: none;
  }
}
</style>
