<template>
  <div
    v-bind="containerProps"
    class="multiselect-list"
  >
    <div v-bind="wrapperProps">
      <div
        v-for="row in virtualRows"
        :key="row.data.id"
        class="multiselect-row flex items-center justify-between"
        @mouseenter="onRowEnter(row.data.id)"
        @mouseleave="onRowLeave"
      >
        <a-checkbox
          :checked="selectedSet.has(row.data.id)"
          :value="row.data.id"
          @change="onCheckboxChange(row.data.id, $event.target.checked)"
        >
          {{ row.data.name }}
        </a-checkbox>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useVirtualList } from '@vueuse/core'

const selected = ref([])
const altPressed = ref(false)
const soloHintId = ref(null)

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

const sortedList = computed(() => [...(props.list || [])].sort((a, b) => a.name.localeCompare(b.name)))
const selectedSet = computed(() => new Set(selected.value))

const {
  list: virtualRows,
  containerProps,
  wrapperProps
} = useVirtualList(sortedList, {
  itemHeight: 26,
  overscan: 10
})

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

function onCheckboxChange(id, checked) {
  if (altPressed.value) {
    selectOnly(id)
    soloHintId.value = id

    return
  }

  if (checked) {
    if (!selected.value.includes(id)) {
      selected.value = [...selected.value, id]
    }
  } else {
    selected.value = selected.value.filter((value) => value !== id)
  }
  selectionChanged()
}

function selectOnly(id) {
  selected.value = [id]
  selectionChanged()
}

function onRowEnter(id) {
  if (altPressed.value) {
    soloHintId.value = id
  }
}

function onRowLeave() {
  soloHintId.value = null
}

function handleKeyDown(event) {
  if (event.key === 'Alt') {
    altPressed.value = true
  }
}

function handleKeyUp(event) {
  if (event.key === 'Alt') {
    altPressed.value = false
    soloHintId.value = null
  }
}

function selectAll() {
  selected.value = props.list.map((item) => item.id)
  emit('changed', selected.value)
}

function setSelected(ids = []) {
  selected.value = [...ids]
  selectionChanged()
}

function selectNone() {
  selected.value = []
  emit('changed', selected.value)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})

defineExpose({
  selectAll,
  setSelected,
  selectNone
})
</script>

<style>
.ant-checkbox-wrapper {
  flex: 1;
}

.multiselect-list {
  height: 100%;
  overflow-y: auto;
}

.multiselect-row {
  border-bottom: 1px solid #c4c4c4;
  padding: 2px 0;
}

.multiselect-row:last-child{
  border: none;
}
</style>
