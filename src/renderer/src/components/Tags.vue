<template>
  <div class="flex flex-col space-y-6 min-h-[0]">
    <a-divider>Etiquetas</a-divider>

    <form
      class="mb-6 space-x-2 flex items-center"
      @submit.prevent="saveTag"
    >
      <a-input
        id="tagName"
        v-model:value="tagName"
        autofocus
        type="text"
        class="flex-1"
        placeholder="Nombre de etiqueta"
      />
      <a-button
        type="primary"
        html-type="submit"
      >
        Agregar
      </a-button>
    </form>

    <div class="flex items-center flex-wrap">
      <a-input
        v-for="tag in tags"
        :id="`a${tag.id}`"
        :key="tag.id"
        class="block border-transparent focus:ring-0 focus:bg-white focus:border-ring-600 bg-transparent w-full text-black px-2 py-0.5 leading-tight text-base"
        :value="tag.name"
        @keyup.enter="updateTag(tag.id)"
        @blur="updateTag(tag.id)"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import slugify from '@sindresorhus/slugify'

// const props = defineProps({ tags: Array })
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
    .then(function(response) {
      const indexedData = response.data?.data && typeof response.data.data === 'object' && !Array.isArray(response.data.data) && Object.keys(response.data.data)
        .every((key) => (/^\d+$/).test(key))
? Object.keys(response.data.data).map((key) => Number(key))
          .sort((a, b) => a - b)
          .map((index) => response.data.data[String(index)])
: []
      const payload = Array.isArray(response.data) ? response.data : Array.isArray(response.data?.data) ? response.data.data : indexedData
      tags.value = payload.sort((a, b) => a.name.localeCompare(b.name)).filter((t) => t.id !== 9998)
    })
    .catch(function(error) {
      // handle error
      console.log(error)
    })
    .finally(function() {
      // always executed
    })
}

function saveTag() {
  axios
    .post('http://localhost:3000/tags/save', {
      name: slugify(tagName.value)
    })
    .then(function(response) {
      getTags()
      tagError.value = ''
      tagName.value = ''
    })
    .catch(function(error) {
      tagError.value = error.response.data.message
    })
    .finally(function() {
      // always executed
    })
}

function updateTag(id) {
  const name = document.getElementById(`a${id}`).value
  document.getElementById(`a${id}`).blur()
  axios
    .post('http://localhost:3000/tags/' + id, {
      name: slugify(name)
    })
    .then(function(response) {

    })
    .catch(function(error) {
      tagError.value = error.response.data.message
    })
    .finally(function() {
      tags.value = []
      getTags()
    })
}
</script>
