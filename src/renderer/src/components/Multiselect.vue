<template>
  <div class="multiselect-shell">
    <div
      v-bind="containerProps"
      class="multiselect-list"
    >
      <div v-bind="wrapperProps">
        <div
          v-for="row in virtualRows"
          :key="row.data.id"
          class="multiselect-row flex items-center justify-between relative"
          @mouseenter="onRowEnter(row.data.id)"
          @mouseleave="onRowLeave"
        >
          <a-checkbox
            :checked="selectedSet.has(String(row.data.id))"
            :value="row.data.id"
            @change="onCheckboxChange(row.data.id, $event.target.checked)"
          >
            {{ row.data.name }}
          </a-checkbox>
          <span
            v-if="effectiveAltPressed && hoveredRowId === row.data.id"
            class="multiselect-solo-hint"
          >
            SOLO
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useVirtualList } from '@vueuse/core'

const selected = ref([])
const altPressed = ref(false)
const hoveredRowId = ref(null)

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
  },
  altPressed: {
    type: Boolean,
    required: false,
    default: false
  },
  filterQuery: {
    type: String,
    required: false,
    default: ''
  }
})

const emit = defineEmits(['changed'])

const sortedList = computed(() => [...(props.list || [])].sort((a, b) => a.name.localeCompare(b.name)))
const filteredList = computed(() => {
  const query = normalizeSearchText(props.filterQuery)
  if (!query) return sortedList.value

  return sortedList.value.filter((item) => normalizeSearchText(item?.name).includes(query))
})
const selectedSet = computed(() => new Set((selected.value || []).map((value) => String(value))))
const effectiveAltPressed = computed(() => props.altPressed || altPressed.value)

const {
  list: virtualRows,
  containerProps,
  wrapperProps
} = useVirtualList(filteredList, {
  itemHeight: 26,
  overscan: 10
})

watch(() => props.selectedDefault,
  (newValue = []) => {
    const normalized = normalizeIds(newValue)
    if (newValue.length > 0 || selected.value.length === 0) {
      selected.value = normalized
    }
  },
  { immediate: true })

function selectionChanged() {
  emit('changed', selected.value)
}

function onCheckboxChange(id, checked) {
  const idKey = String(id)

  if (effectiveAltPressed.value) {
    selectOnly(id)

    return
  }

  if (checked) {
    if (!selectedSet.value.has(idKey)) {
      selected.value = [...selected.value, id]
    }
  } else {
    selected.value = selected.value.filter((value) => String(value) !== idKey)
  }
  selectionChanged()
}

function selectOnly(id) {
  selected.value = [id]
  selectionChanged()
}

function onRowEnter(id) {
  hoveredRowId.value = id
}

function onRowLeave() {
  hoveredRowId.value = null
}

function handleKeyDown(event) {
  if (event.key === 'Alt') {
    altPressed.value = true
  }
}

function handleKeyUp(event) {
  if (event.key === 'Alt') {
    altPressed.value = false
  }
}

function selectAll() {
  selected.value = props.list.map((item) => item.id)
  emit('changed', selected.value)
}

function setSelected(ids = []) {
  selected.value = normalizeIds(ids)
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

function normalizeIds(ids = []) {
  return (Array.isArray(ids) ? ids : [])
    .map((value) => (value && typeof value === 'object' ? value.id : value))
    .filter((value) => value !== null && value !== undefined)
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

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

.multiselect-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.multiselect-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.multiselect-row {
  border-bottom: 1px solid color-mix(in srgb, #9ca3af 18%, transparent);
  padding: 2px 52px 2px 0;
}

.multiselect-row:last-child{
  border: none;
}

.multiselect-solo-hint {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #000000;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  user-select: none;
  pointer-events: none;
}
</style>
