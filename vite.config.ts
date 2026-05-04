import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = '/train-sound-toy-box/'

const audioManifestPlugin = (): Plugin => {
  const virtualId = 'virtual:audio-manifest'
  const resolvedId = '\0' + virtualId
  const listByExt = (sub: string, ext: string): string[] => {
    try {
      return readdirSync(resolve(__dirname, 'public/assets', sub))
        .filter((f) => f.toLowerCase().endsWith(ext))
        .sort()
        .map((f) => `${BASE}assets/${sub}/${encodeURIComponent(f)}`)
    } catch {
      return []
    }
  }
  return {
    name: 'audio-manifest',
    resolveId(id) {
      if (id === virtualId) return resolvedId
      return null
    },
    load(id) {
      if (id !== resolvedId) return null
      const good = listByExt('good', '.mp3')
      const bad = listByExt('bad', '.mp3')
      const goodMovies = listByExt('good_movie', '.mp4')
      return `export const good = ${JSON.stringify(good)};\nexport const bad = ${JSON.stringify(bad)};\nexport const goodMovies = ${JSON.stringify(goodMovies)};\n`
    },
    configureServer(server) {
      const watcher = server.watcher
      const trigger = (path: string) => {
        if (!path.includes('/public/assets/')) return
        const mod = server.moduleGraph.getModuleById(resolvedId)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      watcher.on('add', trigger)
      watcher.on('unlink', trigger)
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [react(), audioManifestPlugin()],
  build: {
    outDir: 'docs',
  },
})
