<template>
  <div class="flex flex-col space-y-6 min-h-[0]">
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
        label="Canciones por página"
        name="rowsPerPage"
        :rules="[{ required: true, type: 'number', message: 'Ingrese un número válido!' }]"
      >
        <a-input-number
          id="inputNumber"
          v-model:value="formState.rowsPerPage"
          :min="1"
          :max="100"
        />
      </a-form-item>

      <a-form-item
        label="Canciones por página (FS)"
        name="rowsPerPageFs"
        :rules="[{ required: true, type: 'number', message: 'Ingrese un número válido!' }]"
      >
        <a-input-number
          id="inputNumberRowsFs"
          v-model:value="formState.rowsPerPageFs"
          :min="1"
          :max="100"
        />
      </a-form-item>

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
import { reactive, ref, onMounted } from 'vue'

export default {
  emits: ['saved'],
  setup(props, context) {
    const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings')) || {
      rowsPerPage: 24,
      rowsPerPageFs: 24,
      crossfaderTime: 1,
      recentlyAddedTime: 24,
      historyLimit: 15,
      baseSpeed: 0,
      excludeTags: [],
      colorSchema: 'sunset'
    }

    const formState = reactive({
      rowsPerPage: savedSettings.rowsPerPage,
      rowsPerPageFs: typeof savedSettings.rowsPerPageFs === 'number' ? savedSettings.rowsPerPageFs : savedSettings.rowsPerPage,
      crossfaderTime: savedSettings.crossfaderTime,
      recentlyAddedTime: savedSettings.recentlyAddedTime,
      historyLimit: typeof savedSettings.historyLimit === 'number' ? savedSettings.historyLimit : 15,
      baseSpeed: typeof savedSettings.baseSpeed === 'number' ? savedSettings.baseSpeed : 0,
      previewSinkId: savedSettings.previewSinkId || null,
      deckSinkId: savedSettings.deckSinkId || null,
      excludeTags: savedSettings.excludeTags || [],
      colorSchema: savedSettings.colorSchema || 'sunset'
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
      { label: 'Nocturno', value: 'nocturno' },
      { label: 'Oceano', value: 'oceano' },
      { label: 'Orquidea', value: 'orquidea' },
      { label: 'Rubí', value: 'coral' }
    ])
    const audioOutputs = ref([])
    const isLoadingOutputs = ref(false)
    const isLoadingTags = ref(false)

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
        const outputs = devices.filter((d) => d.kind === 'audiooutput')
          .map((d) => ({ label: d.label || 'Salida predeterminada', value: d.deviceId }))
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
        tagOptions.value = data.sort((a, b) => a.name.localeCompare(b.name))
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

    onMounted(() => {
      enumerateOutputs()
      loadTags()
    })

    const onFinish = (values) => {
      const s = {
        rowsPerPage: formState.rowsPerPage,
        rowsPerPageFs: formState.rowsPerPageFs,
        crossfaderTime: formState.crossfaderTime,
        recentlyAddedTime: formState.recentlyAddedTime,
        historyLimit: formState.historyLimit,
        baseSpeed: formState.baseSpeed,
        previewSinkId: formState.previewSinkId === 'default' ? null : formState.previewSinkId || null,
        deckSinkId: formState.deckSinkId === 'default' ? null : formState.deckSinkId || null,
        excludeTags: formState.excludeTags || [],
        colorSchema: formState.colorSchema || 'sunset'
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
      onFinish,
      onOutputsDropdown,
      onFinishFailed
    }
  }
}

</script>
