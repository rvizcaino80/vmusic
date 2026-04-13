<script setup>
import { ref, onMounted } from 'vue'
import { use } from 'ant-design-vue/lib/config-provider/context'

const versions = ref([])
const loading = ref(true)
const expandedVersions = ref({})

const typeLabels = {
  new: { label: 'Nuevas funciones', emoji: '✨', color: 'text-green-600' },
  fix: { label: 'Correcciones', emoji: '🐛', color: 'text-red-600' },
  perf: { label: 'Mejoras de rendimiento', emoji: '🚀', color: 'text-blue-600' },
  refactor: { label: 'Refactorización', emoji: '♻️', color: 'text-yellow-600' },
  other: { label: 'Otros cambios', emoji: '📝', color: 'text-gray-600' }
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)

  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

const toggleVersion = (version) => {
  expandedVersions.value[version] = !expandedVersions.value[version]
}

const hasChanges = (changes) => {
  return Object.values(changes).some((arr) => arr && arr.length > 0)
}

onMounted(async () => {
  try {
    const response = await fetch('/changelog.json')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = await response.json()
    versions.value = data.versions || []
    versions.value.forEach((v) => {
      expandedVersions.value[v.version] = false
    })
  } catch (e) {
    console.error('Error loading changelog:', e)
    versions.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col space-y-4 min-h-full">
    <a-divider>
      <div class="flex items-center space-x-2">
        <i-mdi-file-document-outline class="w-5 h-5" />
        <span>Registro de cambios</span>
      </div>
    </a-divider>

    <div v-if="loading" class="flex items-center justify-center py-10">
      <a-spin />
    </div>

    <div v-else-if="versions.length === 0" class="text-center py-10 text-gray-500">
      No hay cambios registrados
    </div>

    <div v-else class="flex flex-col space-y-3 overflow-y-auto flex-1">
      <div v-for="item in versions" :key="item.version" class="border rounded-lg overflow-hidden">
        <button
          class="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 transition-colors text-left"
          @click="toggleVersion(item.version)"
        >
          <div class="flex items-center space-x-3">
            <span class="font-bold text-lg">v{{ item.version }}</span>
            <span class="text-sm text-gray-500">{{ formatDate(item.date) }}</span>
          </div>
          <i-mdi-chevron-down
            class="w-5 h-5 transition-transform"
            :class="{ 'rotate-180': expandedVersions[item.version] }"
          />
        </button>

        <div v-if="expandedVersions[item.version]" class="p-3 bg-white">
          <div v-if="!hasChanges(item.changes)" class="text-gray-500 text-sm">
            Sin cambios destacados
          </div>

          <div v-else class="flex flex-col space-y-4">
            <div
              v-for="(info, type) in typeLabels"
              v-show="item.changes[type] && item.changes[type].length > 0"
              :key="type"
            >
              <div class="flex items-center space-x-2 mb-1">
                <span class="text-lg">{{ info.emoji }}</span>
                <span class="font-medium text-sm" :class="info.color">
                  {{ info.label }}
                </span>
              </div>
              <ul class="ml-8 space-y-1">
                <li
                  v-for="(change, idx) in item.changes[type]"
                  :key="idx"
                  class="text-sm text-gray-700 list-disc"
                >
                  {{ change }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="text-xs text-gray-400 text-center pt-2 border-t">Powered by Salsamanía</div>
  </div>
</template>
