import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Refuse to start if a secret was given a VITE_ prefix, which would bundle it
  // into the browser code. Keep keys like ANTHROPIC_API_KEY unprefixed.
  const exposed = Object.keys(loadEnv(mode, process.cwd(), 'VITE_')).filter((name) => /ANTHROPIC|CLAUDE|API_KEY|SECRET/i.test(name))
  if (exposed.length > 0) {
    throw new Error(`Remove the VITE_ prefix from ${exposed.join(', ')} in your .env file — it would expose the value in the browser.`)
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { host: '127.0.0.1', port: 5173 },
    preview: { host: '127.0.0.1', port: 4173 },
  }
})
