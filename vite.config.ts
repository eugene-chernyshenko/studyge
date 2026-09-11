import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

/** Emits version.json next to index.html so a running page can spot a new deploy. */
function versionManifest(): Plugin {
  return {
    name: 'studyge-version-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version }),
      })
    },
  }
}

// GitHub Pages serves a project site from /<repo>/, so the production build needs
// that prefix. Everything that loads data or flags goes through import.meta.env.BASE_URL,
// which picks this up automatically. Dev keeps the plain root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/studyge/' : '/',
  plugins: [react(), versionManifest()],
  define: {
    // Pages caches every file for 10 minutes and its headers cannot be changed,
    // so data URLs carry the version: new release, new URL, never a stale mix.
    __APP_VERSION__: JSON.stringify(version),
  },
}))
