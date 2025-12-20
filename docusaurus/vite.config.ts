import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/logseq-anki-sync/',
  build: {
    outDir: 'build'
  }
})
