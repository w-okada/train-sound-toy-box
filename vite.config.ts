import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = '/train-sound-toy-box/'

const audioManifestPlugin = (): Plugin => {
  const virtualId = 'virtual:audio-manifest'
  const resolvedId = '\0' + virtualId
  const listMp3 = (sub: string): string[] => {
    try {
      return readdirSync(resolve(__dirname, 'public/assets', sub))
        .filter((f) => f.toLowerCase().endsWith('.mp3'))
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
      const good = listMp3('good')
      const bad = listMp3('bad')
      return `export const good = ${JSON.stringify(good)};\nexport const bad = ${JSON.stringify(bad)};\n`
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
