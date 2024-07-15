<script setup>
import { ref, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'

const selected = ref([])
const filterQuery = ref('')
const filteredList = ref([])

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  list: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['changed'])

const removeAccents = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

watch(
  () => props.list,
  (newValue, oldValue) => {
    let sorted = newValue.sort((a, b) => a.name.localeCompare(b.name))

    filteredList.value = sorted
    selectAll()
})

watch(selected, (newValue, oldValue) => {
  emit('changed', selected.value)
})

watch(filterQuery, (newValue, oldValue) => {
  if (newValue.length > 0) {
    selected.value = []
    filteredList.value = props.list.filter((item) => {
      return removeAccents(item.name.toLowerCase()).includes(removeAccents(newValue.toLowerCase()))
    })
  } else {
    selected.value = props.list.map((item) => item.id)
  }
})

function selectOne(e) {
  selected.value = [e.id]
}

function selectAll() {
  selected.value = props.list.map((item) => item.id)
}

function selectNone() {
  selected.value = []
}

defineExpose({
  selectAll,
  selectNone
})
</script>

<template>
  <!--div class="flex items-center justify-between">
    <label class="block text-sm text-gray-600">Artista</label>

    <input
      v-model="filterQuery"
      placeholder="Filtrar artista"
      class="text-xs p-1 min-w-[170px]"
      type="text"
    />
  </div-->

  <div class="divide-y divide-gray-400">
    <div v-for="item in filteredList" :key="item.id" class="relative flex items-center">
      <div class="mr-3 flex items-center ml-1">
        <input
          @click.meta="selectOne(item)"
          :id="`${name}${item.id}`"
          v-model="selected"
          :value="item.id"
          :name="`${name}${item.id}`"
          type="checkbox"
          class="h-4 w-4 focus:outline-0 focus:outline-transparent focus:shadow-none focus:drop-shadow-none rounded border-gray-300 text-indigo-600 ring-0 active:ring-0 focus:ring-0 focus:outline-none">
      </div>
      <div class="min-w-0 flex-1 text-sm">
        <label :for="`${name}${item.id}`" class="block select-none font-medium text-gray-900">{{
            item.name
          }}</label>
      </div>
    </div>
  </div>
</template>
