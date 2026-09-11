import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves a project site from /<repo>/, so the production build needs
// that prefix. Everything that loads data or flags goes through import.meta.env.BASE_URL,
// which picks this up automatically. Dev keeps the plain root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/studyge/' : '/',
  plugins: [react()],
}))
