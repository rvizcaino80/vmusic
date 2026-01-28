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
        label="Salida Preview"
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
        label="Salida Decks (A/B)"
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
    const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings')) || { rowsPerPage: 24, crossfaderTime: 1, recentlyAddedTime: 24 }

    const formState = reactive({
      rowsPerPage: savedSettings.rowsPerPage,
      crossfaderTime: savedSettings.crossfaderTime,
      recentlyAddedTime: savedSettings.recentlyAddedTime,
      previewSinkId: savedSettings.previewSinkId || null,
      deckSinkId: savedSettings.deckSinkId || null
    })

    const audioOutputs = ref([])
    const isLoadingOutputs = ref(false)

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

    const onOutputsDropdown = (open) => {
      if (open) enumerateOutputs()
    }

    onMounted(() => {
      enumerateOutputs()
    })

    const onFinish = (values) => {
      const s = {
        rowsPerPage: formState.rowsPerPage,
        crossfaderTime: formState.crossfaderTime,
        recentlyAddedTime: formState.recentlyAddedTime,
        previewSinkId: formState.previewSinkId === 'default' ? null : formState.previewSinkId || null,
        deckSinkId: formState.deckSinkId === 'default' ? null : formState.deckSinkId || null
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
      audioOutputs,
      isLoadingOutputs,
      onFinish,
      onOutputsDropdown,
      onFinishFailed
    }
  }
}

</script>
