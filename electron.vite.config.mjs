import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'

function copyBackendFiles() {
  return {
    name: 'copy-backend-files',
    closeBundle() {
      const srcDir = resolve('src/main/backend')
      const destDir = resolve('out/main/backend')

      function copyRecursive(src, dest) {
        if (!existsSync(dest)) {
          mkdirSync(dest, { recursive: true })
        }

        const entries = readdirSync(src)
        for (const entry of entries) {
          const srcPath = resolve(src, entry)
          const destPath = resolve(dest, entry)
          const stat = statSync(srcPath)

          if (stat.isDirectory()) {
            copyRecursive(srcPath, destPath)
          } else {
            copyFileSync(srcPath, destPath)
          }
        }
      }

      if (existsSync(srcDir)) {
        copyRecursive(srcDir, destDir)
        console.log('✅ Backend files copied to out/main/backend')
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyBackendFiles()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      Icons({ compiler: 'vue3' }),
      Components({
        resolvers: [
          IconsResolver(),
          AntDesignVueResolver({
            importStyle: false // css in js
          })
        ]
      }),
      vue()
    ]
  }
})
