/**
 * Vue Router configuration
 *
 * Uses lazy loading for all route components to reduce initial bundle size.
 * Routes correspond to sidebar navigation options.
 */
import { createRouter, createMemoryHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/library'
  },
  {
    path: '/library',
    name: 'library',
    component: () => import('../App.vue'),
    // Library is the default view embedded in App.vue
    // This route activates the library panel
    meta: { option: 'library', title: 'Biblioteca' }
  },
  {
    path: '/download',
    name: 'download',
    component: () => import('../components/Download.vue'),
    meta: { option: 'download', title: 'Descargas' }
  },
  {
    path: '/add-mp3',
    name: 'add-mp3',
    component: () => import('../components/AddMp3.vue'),
    meta: { option: 'add_mp3', title: 'Importar MP3' }
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../App.vue'),
    meta: { option: 'history', title: 'Historial' }
  },
  {
    path: '/playlists',
    name: 'playlists',
    component: () => import('../components/Playlists.vue'),
    meta: { option: 'playlists', title: 'Playlists' }
  },
  {
    path: '/artists',
    name: 'artists',
    component: () => import('../components/Artists.vue'),
    meta: { option: 'artists', title: 'Artistas' }
  },
  {
    path: '/tags',
    name: 'tags',
    component: () => import('../components/Tags.vue'),
    meta: { option: 'tags', title: 'Tags' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../components/Settings.vue'),
    meta: { option: 'settings', title: 'Configuración' }
  },
  {
    path: '/edit/:id',
    name: 'edit',
    component: () => import('../components/Edit.vue'),
    props: true,
    meta: { option: 'edit', title: 'Editar' }
  },
  {
    path: '/wave/:id',
    name: 'wave',
    component: () => import('../components/Wave.vue'),
    props: true,
    meta: { option: 'wave', title: 'Waveform' }
  },
  {
    path: '/changelog',
    name: 'changelog',
    component: () => import('../components/Changelog.vue'),
    meta: { option: 'changelog', title: 'Cambios' }
  }
]

const router = createRouter({
  history: createMemoryHistory(), // Memory history for Electron
  routes
})

/**
 * Navigation guard to handle option changes
 */
router.beforeEach((to, from, next) => {
  // Update document title
  if (to.meta?.title) {
    document.title = `Salsamania - ${to.meta.title}`
  }
  next()
})

export default router
