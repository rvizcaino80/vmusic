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
import { reactive } from 'vue'

export default {
  emits: ['saved'],
  setup(props, context) {
    const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings'))

    const formState = reactive({
      rowsPerPage: savedSettings.rowsPerPage,
      crossfaderTime: savedSettings.crossfaderTime,
      recentlyAddedTime: savedSettings.recentlyAddedTime
    })

    const onFinish = (values) => {
      const s = { rowsPerPage: formState.rowsPerPage, crossfaderTime: formState.crossfaderTime, recentlyAddedTime: formState.recentlyAddedTime }
      localStorage.setItem('vmusic_settings', JSON.stringify(s))
      context.emit('saved')
    }

    const onFinishFailed = (errorInfo) => {
      console.log('Failed:', errorInfo)
    }

    return {
      savedSettings,
      formState,
      onFinish,
      onFinishFailed
    }
  }
}

</script>
