import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5188, strictPort: true },
  preview: { host: true, port: 5189, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
})
