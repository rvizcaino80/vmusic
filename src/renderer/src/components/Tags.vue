<template>
  <div>
    <form class="mb-6 space-x-2 flex items-center" @submit.prevent="saveTag">
      <input
        autofocus
        id="tagName"
        v-model="tagName"
        type="text"
        class="flex-1"
        placeholder="Nombre de etiqueta"
      />
      <button type="submit" class="p-2 border border-gray-800 bg-gray-800 text-white font-bold">
        Agregar
      </button>
    </form>


    <div
      v-for="tag in tags"
      :key="tag.id"
      class="inline-block bg-gray-600 text-white rounded-full px-3 py-1 mb-2 mr-2"
    >
      {{ tag.name }}
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import slugify from '@sindresorhus/slugify'

//const props = defineProps({ tags: Array })
const emit = defineEmits(['added'])

const tags = ref([])
const tagError = ref('')
const tagName = ref('')

onMounted(() => {
  getTags()
  document.getElementById('tagName').focus()
})

function getTags() {
  axios
    .get('http://localhost:3000/tags')
    .then(function (response) {
      tags.value = response.data.sort((a, b) => a.name.localeCompare(b.name))
    })
    .catch(function (error) {
      // handle error
      console.log(error)
    })
    .finally(function () {
      // always executed
    })
}

function saveTag() {
  axios
    .post('http://localhost:3000/tags/save', {
      name: slugify(tagName.value)
    })
    .then(function (response) {
      getTags()
      tagError.value = ''
      tagName.value = ''
    })
    .catch(function (error) {
      tagError.value = error.response.data.message
    })
    .finally(function () {
      // always executed
    })
}
</script>
