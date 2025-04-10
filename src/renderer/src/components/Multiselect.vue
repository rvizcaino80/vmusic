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

const removeAccents = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

watch(() => props.list,
  (newValue, oldValue) => {
    let sorted = newValue.sort((a, b) => a.name.localeCompare(b.name))

    filteredList.value = sorted

    // selected.value = props.list.map((item) => item.id)
  })

watch(() => props.selectedDefault,
  (newValue, oldValue) => {
    if (newValue.length > 0) {
      selected.value = props.selectedDefault
    }
  })

function selectionChanged(e) {
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
