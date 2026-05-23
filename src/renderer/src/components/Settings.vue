<template>
  <div class="flex flex-col space-y-6 min-h-full">
    <a-divider>Dispositivos de audio</a-divider>

    <a-table
      :data-source="outputsForAlias"
      :columns="deviceAliasColumns"
      :pagination="false"
      size="small"
      row-key="value"
      :loading="isLoadingOutputs"
      class="device-alias-table"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <span class="text-xs">{{ record.displayLabel }}</span>
        </template>
        <template v-else-if="column.key === 'alias'">
          <a-input
            :value="getDeviceAlias(record.value)"
            @change="(e) => setDeviceAlias(record.value, e.target.value)"
            placeholder="Alias opcional"
            size="small"
            allow-clear
          />
        </template>
      </template>
    </a-table>

    <a-divider>Ajustes</a-divider>

    <a-form
      :model="formState"
      name="basic"
      :label-col="{ span: 12 }"
      autocomplete="off"
      @finish="onFinish"
      @finish-failed="onFinishFailed"
    >
      <a-form-item
        label="Tiempo de Crossfader"
        name="crossfaderTime"
        :rules="[{ required: true, type: 'number', message: 'Ingrese un número válido!' }]"
      >
        <a-input-number
          id="inputNumber"
          v-model:value="formState.crossfaderTime"
          :min="0"
          :max="10"
        />
      </a-form-item>

      <a-form-item
        label="Agregados Recientes (Horas)"
        name="recentlyAddedTime"
        :rules="[{ required: true, type: 'number', message: 'Ingrese un número válido!' }]"
      >
        <a-input-number
          id="inputNumber"
          v-model:value="formState.recentlyAddedTime"
          :min="1"
          :max="500"
        />
      </a-form-item>

      <a-form-item
        label="Historial reciente"
        name="historyLimit"
        :rules="[{ required: true, type: 'number', message: 'Ingrese un número válido!' }]"
      >
        <a-input-number
          id="inputNumber"
          v-model:value="formState.historyLimit"
          :min="1"
          :max="200"
        />
      </a-form-item>

      <a-form-item
        label="Velocidad base"
        name="baseSpeed"
        :rules="[{ required: true, type: 'number', message: 'Ingrese un número válido!' }]"
      >
        <a-input-number
          id="inputNumber"
          v-model:value="formState.baseSpeed"
          :min="-20"
          :max="20"
        />
      </a-form-item>

      <a-form-item
        label="Dispositivo Principal"
        name="deckSinkId"
      >
        <a-select
          v-model:value="formState.deckSinkId"
          :options="audioOutputs"
          :loading="isLoadingOutputs"
          :allow-clear="true"
          placeholder="Predeterminada"
          @dropdown-visible-change="onOutputsDropdown"
        />
      </a-form-item>

      <a-form-item
        label="Dispositivo Secundario"
        name="previewSinkId"
      >
        <a-select
          v-model:value="formState.previewSinkId"
          :options="audioOutputs"
          :loading="isLoadingOutputs"
          :allow-clear="true"
          placeholder="Predeterminada / Audífonos"
          @dropdown-visible-change="onOutputsDropdown"
        />
      </a-form-item>

      <a-form-item
        label="Excluir etiquetas"
        name="excludeTags"
      >
        <a-select
          v-model:value="formState.excludeTags"
          mode="multiple"
          :options="tagOptions"
          :loading="isLoadingTags"
          placeholder="Selecciona etiquetas a excluir de 'Todos'"
        />
      </a-form-item>

      <a-form-item
        label="Esquema de color"
        name="colorSchema"
      >
        <a-select
          v-model:value="formState.colorSchema"
          :options="colorSchemaOptions"
          placeholder="Selecciona un esquema"
        />
      </a-form-item>

      <a-form-item
        label="Funciones Avanzadas"
        name="showAdvancedFunctions"
      >
        <a-checkbox v-model:checked="formState.showAdvancedFunctions" />
      </a-form-item>

      <a-form-item
        label="Actualizar portadas automáticamente"
        name="autoUpdateCovers"
      >
        <a-checkbox v-model:checked="formState.autoUpdateCovers" />
      </a-form-item>

      <a-form-item
        label="Actualizaciones"
      >
        <div class="flex flex-col gap-2">
          <a-button
            :loading="isCheckingUpdate"
            @click="checkForUpdates"
          >
            Buscar actualización
          </a-button>
          <span
            v-if="updateCheckMessage"
            class="text-xs text-gray-600"
          >
            {{ updateCheckMessage }}
          </span>
        </div>
      </a-form-item>

      <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
        <a-button
          type="primary"
          html-type="submit"
        >
          Guardar
        </a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<script>
import { reactive, ref, computed, onMounted } from 'vue'

export default {
  name: 'AppSettings',
  emits: ['saved'],
  setup(props, context) {
    const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings')) || {
      crossfaderTime: 1,
      recentlyAddedTime: 24,
      historyLimit: 15,
      baseSpeed: 0,
      excludeTags: [],
      colorSchema: 'sunset',
      showAdvancedFunctions: false,
      autoUpdateCovers: false
    }

    const formState = reactive({
      crossfaderTime: savedSettings.crossfaderTime,
      recentlyAddedTime: savedSettings.recentlyAddedTime,
      historyLimit: typeof savedSettings.historyLimit === 'number' ? savedSettings.historyLimit : 15,
      baseSpeed: typeof savedSettings.baseSpeed === 'number' ? savedSettings.baseSpeed : 0,
      previewSinkId: savedSettings.previewSinkId || null,
      deckSinkId: savedSettings.deckSinkId || null,
      excludeTags: savedSettings.excludeTags || [],
      colorSchema: savedSettings.colorSchema || 'sunset',
      showAdvancedFunctions: Boolean(savedSettings.showAdvancedFunctions),
      autoUpdateCovers: Boolean(savedSettings.autoUpdateCovers)
    })

    const tagOptions = ref([])
    const colorSchemaOptions = ref([
      { label: 'Atardecer', value: 'sunset' },
      { label: 'Aurora', value: 'ocean' },
      { label: 'Bosque', value: 'bosque' },
      { label: 'Campo', value: 'linen' },
      { label: 'Chicle', value: 'aurora' },
      { label: 'Cobre', value: 'tormenta_cobre' },
      { label: 'Deportivo', value: 'monochrome' },
      { label: 'Oceano', value: 'oceano' },
      { label: 'Orquidea', value: 'orquidea' },
      { label: 'Playa', value: 'nocturno' },
      { label: 'Rubí', value: 'coral' }
    ])
    const DEVICE_ALIAS_KEY = 'vmusic_device_aliases'
    const audioOutputs = ref([])
    const isLoadingOutputs = ref(false)
    const isLoadingTags = ref(false)
    const isCheckingUpdate = ref(false)
    const updateCheckMessage = ref('')

    const deviceAliasColumns = [
      { title: 'Dispositivo', key: 'name', dataIndex: 'label' },
      { title: 'Alias', key: 'alias' }
    ]

    const outputsForAlias = computed(() =>
      audioOutputs.value
        .filter((d) => d.value !== 'default')
        .map((d) => ({
          ...d,
          displayLabel: `${d.originalLabel} (${d.value.slice(-4)}${d.groupId ? ` g:${d.groupId.slice(-4)}` : ''})`
        }))
    )

    function loadDeviceAliases() {
      try {
        const stored = localStorage.getItem(DEVICE_ALIAS_KEY)
        return stored ? JSON.parse(stored) : {}
      } catch {
        return {}
      }
    }

    function getDeviceAlias(deviceId) {
      const aliases = loadDeviceAliases()
      return aliases[deviceId] || ''
    }

    function resolveAlias(deviceId, originalLabel, groupId, aliases) {
      return aliases[deviceId] || aliases[originalLabel] || (groupId ? aliases[groupId] : '') || ''
    }

    function setDeviceAlias(deviceId, alias) {
      try {
        const device = audioOutputs.value.find((d) => d.value === deviceId)
        const originalLabel = device?.originalLabel || ''
        const groupId = device?.groupId || ''
        const aliases = loadDeviceAliases()
        if (alias && alias.trim()) {
          aliases[deviceId] = alias.trim()
          if (originalLabel) aliases[originalLabel] = alias.trim()
          if (groupId) aliases[groupId] = alias.trim()
        } else {
          delete aliases[deviceId]
          if (originalLabel) delete aliases[originalLabel]
          if (groupId) delete aliases[groupId]
        }
        localStorage.setItem(DEVICE_ALIAS_KEY, JSON.stringify(aliases))
        audioOutputs.value = audioOutputs.value.map((d) => {
          if (d.value !== deviceId) return d
          const aliasLabel = aliases[deviceId] || d.originalLabel
          return { ...d, label: aliasLabel }
        })
      } catch {
        // ignore
      }
    }

    const enumerateOutputs = async() => {
      if (!navigator.mediaDevices?.enumerateDevices) return []
      try {
        isLoadingOutputs.value = true
        let devices = await navigator.mediaDevices.enumerateDevices()
        const hasLabels = devices.some((d) => d.label && d.label.length > 0)
        if (!hasLabels && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          devices = await navigator.mediaDevices.enumerateDevices()
          stream.getTracks().forEach((track) => track.stop())
        }
        const aliases = loadDeviceAliases()
        const outputs = devices.filter((d) => d.kind === 'audiooutput')
          .map((d) => {
            const originalLabel = d.label || 'Salida predeterminada'
            const aliasLabel = resolveAlias(d.deviceId, originalLabel, d.groupId, aliases) || originalLabel
            return { label: aliasLabel, value: d.deviceId, originalLabel, groupId: d.groupId || '' }
          })
        audioOutputs.value = [
          { label: 'Predeterminada (sistema)', value: 'default' },
          ...outputs
        ]
      } catch (error) {
        console.warn('No se pudieron listar salidas de audio', error)
      } finally {
        isLoadingOutputs.value = false
      }
    }

    const loadTags = async() => {
      try {
        isLoadingTags.value = true
        const response = await fetch('http://localhost:3000/tags')
        const data = await response.json()
        let indexedData = []
        if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data) && Object.keys(data.data).every((key) => (/^\d+$/).test(key))) {
          indexedData = Object.keys(data.data)
            .map((key) => Number(key))
            .sort((a, b) => a - b)
            .map((index) => data.data[String(index)])
        }
        const normalized = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : indexedData
        tagOptions.value = normalized.sort((a, b) => a.name.localeCompare(b.name))
          .map((t) => ({ label: t.name, value: t.id }))
      } catch (error) {
        console.warn('No se pudieron cargar las etiquetas', error)
      } finally {
        isLoadingTags.value = false
      }
    }

    const onOutputsDropdown = (open) => {
      if (open) enumerateOutputs()
    }

    const checkForUpdates = async() => {
      updateCheckMessage.value = ''

      if (!window.electron2?.checkAndPrepareCustomUpdater) {
        updateCheckMessage.value = 'Las actualizaciones manuales solo están disponibles en la app instalada.'

        return
      }

      try {
        isCheckingUpdate.value = true
        const state = await window.electron2.checkAndPrepareCustomUpdater()

        if (state?.status === 'up-to-date') {
          updateCheckMessage.value = 'No hay actualización pendiente.'

          return
        }

        if (state?.status === 'downloaded') {
          updateCheckMessage.value = 'Actualización descargada. Sigue el flujo normal para instalar.'

          return
        }

        if (state?.status === 'downloading' || state?.status === 'available' || state?.status === 'installing') {
          updateCheckMessage.value = state.message || 'Actualización en progreso.'

          return
        }

        if (state?.status === 'error') {
          updateCheckMessage.value = state.message || 'No se pudo buscar la actualización.'
        }
      } catch (error) {
        updateCheckMessage.value = error?.message || 'No se pudo buscar la actualización.'
      } finally {
        isCheckingUpdate.value = false
      }
    }

    onMounted(() => {
      enumerateOutputs()
      loadTags()
    })

    const onFinish = (values) => {
      const s = {
        crossfaderTime: formState.crossfaderTime,
        recentlyAddedTime: formState.recentlyAddedTime,
        historyLimit: formState.historyLimit,
        baseSpeed: formState.baseSpeed,
        previewSinkId: formState.previewSinkId === 'default' ? null : formState.previewSinkId || null,
        deckSinkId: formState.deckSinkId === 'default' ? null : formState.deckSinkId || null,
        excludeTags: formState.excludeTags || [],
        colorSchema: formState.colorSchema || 'sunset',
        showAdvancedFunctions: Boolean(formState.showAdvancedFunctions),
        autoUpdateCovers: Boolean(formState.autoUpdateCovers)
      }
      localStorage.setItem('vmusic_settings', JSON.stringify(s))
      context.emit('saved')
    }

    const onFinishFailed = (errorInfo) => {
      console.log('Failed:', errorInfo)
    }

    return {
      savedSettings,
      formState,
      tagOptions,
      colorSchemaOptions,
      audioOutputs,
      isLoadingOutputs,
      isLoadingTags,
      isCheckingUpdate,
      updateCheckMessage,
      onFinish,
      onOutputsDropdown,
      onFinishFailed,
      checkForUpdates,
      deviceAliasColumns,
      outputsForAlias,
      getDeviceAlias,
      setDeviceAlias
    }
  }
}

</script>

<style scoped>
.device-alias-table :deep(td),
.device-alias-table :deep(th) {
  padding: 8px 12px !important;
}
</style>
