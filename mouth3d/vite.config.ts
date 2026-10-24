import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Standalone lab for the 3D mouth model. Uses its own port so it can run next
// to the main app's dev server (5173).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5180 },
  preview: { host: '127.0.0.1', port: 4180 },
})
